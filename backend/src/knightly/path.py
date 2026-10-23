"""The home path's schedule and history (docs/specs/2026-10-19-path-home-design.md, "Backend
and API"): the learner's spaced-repetition schedule laid out as a road, so everything here is
read from the cards' FSRS due dates and the answers saved, never from topics.

- **The schedule ahead** (`ahead`): the next AHEAD_DAYS days, each with the moves due that
  day by their FSRS due date and up to AHEAD_MOVES of them by name, each saying whether a Good
  answer that day would make it stop slipping (its **last check**: watch.stopped).
- **History** (`history`): every kept night's date (oldest first, so its place is its night
  number) with what its watch held, and every finished extra watch (extra.log). A night's
  watch is its first answers of the day, less those its extra watches held.
- **A kept night** (`night`): the moves that night held and where each stands now.
- **The first star** (`first_star`): before any star, the held move closest to the 11-day bar.
"""

import json
from datetime import UTC, date, datetime, timedelta

from fsrs import Card, Rating

from . import daily, db, deck, extra, positions, puzzles, watch

AHEAD_DAYS = 7  # a week of the schedule ahead, tomorrow first
AHEAD_MOVES = 3  # moves named per day ahead


def _last_check(fsrs, state: Card, row, families: set) -> bool:
    """Whether a Good answer when the card comes due would make it stop slipping."""
    after = deck._review(fsrs, state, Rating.Good, state.due, row["game_id"], row["ply"], row["reviews"])
    return watch.stopped(after.stability or 0, row["pattern"], (row["game_id"], row["ply"]) in families)


def _details(conn, keys: list[tuple[int, int]]) -> dict[tuple[int, int], dict]:
    """{key: {san, label, opponent, color, fen}} for move rows."""
    if not keys:
        return {}
    rows = conn.execute(
        """SELECT m.game_id, m.ply, m.san, m.color, g.opponent FROM moves m
           JOIN games g ON g.id = m.game_id
           WHERE (m.game_id, m.ply) IN (SELECT * FROM unnest(%s::int[], %s::int[]))""",
        ([k[0] for k in keys], [k[1] for k in keys]),
    ).fetchall()
    names = watch.explain(conn, keys)
    fens = positions.fens(conn, {k[0] for k in keys})
    return {
        (r["game_id"], r["ply"]): {
            "san": r["san"],
            "label": names[(r["game_id"], r["ply"])]["label"],
            "opponent": r["opponent"],
            "color": r["color"],
            "fen": fens.get((r["game_id"], r["ply"])),
        }
        for r in rows
    }


def _held_runs(conn) -> dict[tuple[int, int], int]:
    return {(c["game_id"], c["ply"]): c["held"] for c in watch.cards(conn)}


def ahead(conn, today: date) -> list[dict]:
    """The next AHEAD_DAYS days from tomorrow: how many moves are due each day (by their FSRS
    due date; overdue ones are tonight's) and up to AHEAD_MOVES of them, the last checks first,
    then the longest held, each with whether it is its last check."""
    days = [today + timedelta(days=i) for i in range(1, AHEAD_DAYS + 1)]
    rows = conn.execute(
        """SELECT c.game_id, c.ply, c.due, c.fsrs, c.reviews, m.pattern FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.fsrs IS NOT NULL AND c.suspended_at IS NULL AND m.best_uci IS NOT NULL
             AND c.due >= %s AND c.due <= %s
           ORDER BY c.due, c.game_id, c.ply""",
        (days[0].isoformat(), days[-1].isoformat()),
    ).fetchall()
    fsrs, families = deck.scheduler(conn), puzzles.families_solved(conn)
    held = _held_runs(conn) if rows else {}
    by_day: dict[str, list[dict]] = {d.isoformat(): [] for d in days}
    for r in rows:
        state = Card.from_dict(json.loads(r["fsrs"]))
        key = (r["game_id"], r["ply"])
        by_day[r["due"]].append(
            {
                "game_id": r["game_id"],
                "ply": r["ply"],
                "held": held.get(key, 0),
                "last_check": _last_check(fsrs, state, r, families),
            }
        )
    for moves in by_day.values():
        moves.sort(key=lambda m: (not m["last_check"], -m["held"], m["game_id"], m["ply"]))
    shown = [(m["game_id"], m["ply"]) for moves in by_day.values() for m in moves[:AHEAD_MOVES]]
    details = _details(conn, shown)
    return [
        {
            "date": day,
            "due": len(moves),
            "last_checks": sum(1 for m in moves if m["last_check"]),
            "moves": [{**m, **details[(m["game_id"], m["ply"])]} for m in moves[:AHEAD_MOVES]],
        }
        for day, moves in by_day.items()
    ]


def _first_answers(conn, start: str, end: str) -> list[dict]:
    """Each card's first (graded) answer of the day for every day in [start, end), oldest first."""
    return conn.execute(
        """SELECT game_id, ply, reviewed_at, correct FROM card_reviews
           WHERE rating IS NOT NULL AND reviewed_at >= %s AND reviewed_at < %s
           ORDER BY reviewed_at, id""",
        (start, end),
    ).fetchall()


def _local_day(conn, stamp: str) -> str:
    return db.local_date(conn, datetime.strptime(stamp, db.STAMP_FORMAT).replace(tzinfo=UTC)).isoformat()


def _extra_keys(entries: list[dict]) -> dict[str, set[tuple[int, int]]]:
    keys: dict[str, set[tuple[int, int]]] = {}
    for e in entries:
        keys.setdefault(e["day"], set()).update(tuple(k) for k in e.get("cards", []))
    return keys


def history(conn, today: date) -> dict:
    """Every kept night (oldest first: night N is the Nth) with what its watch held, and
    every finished extra watch with what it held. Logs a finished extra watch first."""
    extra.log_finished(conn)
    nights = daily.kept_nights(conn, today)
    entries = extra.log(conn)
    if not nights:
        return {"nights": [], "extra": [_extra_out(e) for e in entries]}
    start = db.day_range(conn, date.fromisoformat(nights[0]))[0]
    end = db.day_range(conn, today)[1]
    in_extra = _extra_keys(entries)
    counts = {d: {"held": 0, "slipped": 0, "stopped": 0} for d in nights}
    for r in _first_answers(conn, start, end):
        day = _local_day(conn, r["reviewed_at"])
        if day in counts and (r["game_id"], r["ply"]) not in in_extra.get(day, set()):
            counts[day]["held" if r["correct"] else "slipped"] += 1
    stars = conn.execute(
        "SELECT mastered_at FROM cards WHERE mastered_at IS NOT NULL AND mastered_at >= %s", (start,)
    ).fetchall()
    extra_stopped: dict[str, int] = {}
    for e in entries:
        extra_stopped[e["day"]] = extra_stopped.get(e["day"], 0) + e["stopped"]
    for r in stars:
        day = _local_day(conn, r["mastered_at"])
        if day in counts:
            counts[day]["stopped"] += 1
    for day, n in extra_stopped.items():
        if day in counts:
            counts[day]["stopped"] = max(0, counts[day]["stopped"] - n)
    return {
        "nights": [{"date": d, **counts[d]} for d in nights],
        "extra": [_extra_out(e) for e in entries],
    }


def _extra_out(entry: dict) -> dict:
    return {"date": entry["day"], **{k: entry[k] for k in ("held", "slipped", "stopped")}}


def night(conn, today: date, day: date) -> dict | None:
    """A kept night's watch: what it held and, for each of its moves, the answer that night
    and where it stands now (`state` and its next `due` day). None when `day` was not kept."""
    nights = daily.kept_nights(conn, today)
    key = day.isoformat()
    if key not in nights:
        return None
    extra.log_finished(conn)
    watch.stamp_stars(conn)
    in_extra = _extra_keys(extra.log(conn)).get(key, set())
    answers = [r for r in _first_answers(conn, *db.day_range(conn, day)) if (r["game_id"], r["ply"]) not in in_extra]
    keys = [(r["game_id"], r["ply"]) for r in answers]
    now = {(c["game_id"], c["ply"]): c for c in watch.cards(conn, sorted({k[0] for k in keys}))} if keys else {}
    details = _details(conn, keys)
    start, end = db.day_range(conn, day)
    stopped = conn.execute(
        """SELECT count(*) FROM cards WHERE mastered_at >= %s AND mastered_at < %s
           AND (game_id, ply) IN (SELECT * FROM unnest(%s::int[], %s::int[]))""",
        (start, end, [k[0] for k in keys], [k[1] for k in keys]),
    ).fetchone()[0]
    moves = []
    for r in answers:
        k = (r["game_id"], r["ply"])
        card = now.get(k)
        moves.append(
            {
                "game_id": k[0],
                "ply": k[1],
                **details[k],
                "held_then": bool(r["correct"]),
                # A suspended card has left the watch: it reads as stopped no more and comes
                # back never, so it is "hidden".
                "state": card["state"] if card else "hidden",
                "due": card["due"] if card else None,
            }
        )
    held = sum(1 for m in moves if m["held_then"])
    return {
        "date": key,
        "night": nights.index(key) + 1,
        "held": held,
        "slipped": len(moves) - held,
        "stopped": stopped,
        "moves": moves,
    }


def first_star(conn, stars: int) -> dict | None:
    """Before any star: the held move closest to stopping slipping, its FSRS stability (days
    it is expected to hold) against watch.STOPPED_DAYS, and whether it also needs a family
    puzzle solved. None once a star is earned or while no move is held."""
    if stars:
        return None
    held = [c for c in watch.cards(conn) if c["state"] == "held"]
    if not held:
        return None
    rows = {
        (r["game_id"], r["ply"]): r
        for r in conn.execute(
            """SELECT c.game_id, c.ply, c.fsrs, m.pattern FROM cards c
               JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
               WHERE (c.game_id, c.ply) IN (SELECT * FROM unnest(%s::int[], %s::int[]))""",
            ([c["game_id"] for c in held], [c["ply"] for c in held]),
        )
    }
    families = puzzles.families_solved(conn)

    def stability(c):
        return deck._stability(rows[(c["game_id"], c["ply"])]["fsrs"])

    best = max(held, key=lambda c: (min(stability(c), watch.STOPPED_DAYS), c["held"], -c["game_id"], -c["ply"]))
    key = (best["game_id"], best["ply"])
    details = _details(conn, [key])[key]
    return {
        "game_id": key[0],
        "ply": key[1],
        "san": details["san"],
        "label": details["label"],
        "days": round(min(stability(best), watch.STOPPED_DAYS), 1),
        "target": watch.STOPPED_DAYS,
        "needs_family": deck.has_family(rows[key]["pattern"]) and key not in families,
    }
