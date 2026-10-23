"""Extra watches: another lesson from the wall once tonight's watch is kept.

docs/specs/2026-10-19-path-home-design.md#what-an-extra-watch-holds. The path is the
learner's review schedule, so an extra watch never moves it: no card answered tonight comes
back (an early second review does little for memory), and nothing here marks a night kept. It opens only once tonight's lesson is
finished (`start`), so its answers land on a night that is already kept.

An extra watch is the size of tonight's lesson, as many as the learner wants, and holds the
same mix as the nightly watch, slot by slot (mix.py): look first, tonight's idea, mixed review
and your games. Its games slots take what the nightly watch had no room for: cards due tonight
not yet reviewed, family puzzles owed, then new slips that no lesson has held yet (newest
games first) and family puzzles for held moves, the move closest to the 11-day bar first,
since solving one is what lets such a move stop slipping (deck.holds).

Answers grade and save exactly as in any lesson (the deck, puzzle and family endpoints).
The open watch lives in one setting for the user's day; its progress is what was answered
tonight beyond what had been when it started. Each finished watch is logged once
(`log_finished`, LOG_SETTING) with what it held, for the path's history.
"""

from datetime import date

from . import db, deck, patterns, puzzles

SETTING = "extra_watch"  # {day, cards, others, puzzles, total, kept}: tonight's open extra watch
# [{day, n, held, slipped, stopped, cards: [[game_id, ply], ...]}]: every finished extra watch,
# oldest first; `n` is its place among that night's extra watches (1 first).
LOG_SETTING = "extra_watch_log"


class NotKept(Exception):
    """Tonight's watch is not finished yet: the first watch of the night comes first."""


def current(conn, today: date) -> dict | None:
    """Tonight's latest extra watch, or None when none was started today."""
    saved = db.get_setting(conn, SETTING)
    return saved if isinstance(saved, dict) and saved.get("day") == today.isoformat() else None


def answered(conn, today: date) -> dict[str, int]:
    """Tonight's answers so far: positions answered (first answers), threat questions and
    "Your move" items answered on their own, and puzzles tried. A watch keeps these from when
    it started; what it adds to them is its own."""
    from . import drill, unannounced  # both read the deck, which reads puzzles like this module

    start, end = db.day_range(conn, today)
    cards = conn.execute(
        """SELECT count(DISTINCT (game_id, ply)) FROM card_reviews
           WHERE reviewed_at >= %s AND reviewed_at < %s""",
        (start, end),
    ).fetchone()[0]
    others = drill.answered_today(conn, today) + unannounced.answered_today(conn, today)
    return {"cards": cards, "others": others, "puzzles": puzzles.done_today(conn, today)}


def _day(watch: dict) -> date:
    return date.fromisoformat(watch["day"])


def _done(conn, today: date, watch: dict) -> int:
    """Items answered since the watch started: positions' first answers, threat questions and
    "Your move" items, and puzzles' first tries."""
    now = answered(conn, today)
    added = now["cards"] - watch["cards"] + now["others"] - watch.get("others", 0) + now["puzzles"] - watch["puzzles"]
    return min(watch["total"], added)


def _finished(conn, today: date, watch: dict) -> bool:
    return watch["total"] > 0 and _done(conn, today, watch) >= watch["total"]


def kept_tonight(conn, today: date) -> int:
    """Extra watches finished tonight: the path's small nodes between the nights."""
    watch = current(conn, today)
    if watch is None:
        return 0
    finished = _finished(conn, today, watch)
    if finished:
        log_finished(conn)
    return watch["kept"] + (1 if finished else 0)


def log(conn) -> list[dict]:
    """Every finished extra watch, oldest first, as LOG_SETTING has it."""
    saved = db.get_setting(conn, LOG_SETTING)
    return saved if isinstance(saved, list) else []


def held_in(conn, watch: dict) -> dict:
    """What a finished watch held: its first `total` items, the night's answers after those it
    started with (positions' first answers and puzzle tries, as `answered` counts them), held or
    slipped, and the moves that stopped slipping (earned their star) while it ran."""
    day_range = db.day_range(conn, _day(watch))
    cards = conn.execute(
        """SELECT reviewed_at AS at, correct, game_id, ply FROM card_reviews
           WHERE rating IS NOT NULL AND reviewed_at >= %s AND reviewed_at < %s ORDER BY reviewed_at, id""",
        day_range,
    ).fetchall()[watch["cards"] :]
    tries = conn.execute(
        """SELECT attempted_at AS at, success FROM puzzle_attempts
           WHERE source = %s AND attempted_at >= %s AND attempted_at < %s ORDER BY attempted_at, id""",
        (puzzles.SOURCE, *day_range),
    ).fetchall()[watch["puzzles"] :]
    items = [(r["at"], bool(r["correct"]), (r["game_id"], r["ply"])) for r in cards]
    items += [(r["at"], bool(r["success"]), None) for r in tries]
    items.sort(key=lambda item: item[0])
    items = items[: watch["total"]]
    stopped = (
        conn.execute(
            "SELECT count(*) FROM cards WHERE mastered_at >= %s AND mastered_at <= %s", (items[0][0], items[-1][0])
        ).fetchone()[0]
        if items
        else 0
    )
    held = sum(1 for _, right, _ in items if right)
    return {
        "held": held,
        "slipped": len(items) - held,
        "stopped": stopped,
        "cards": [list(key) for _, _, key in items if key],
    }


def log_finished(conn) -> None:
    """Log the saved watch once it is finished, whichever night it was on. Idempotent."""
    watch = db.get_setting(conn, SETTING)
    if not isinstance(watch, dict) or "day" not in watch:
        return
    if not _finished(conn, _day(watch), watch):
        return
    entries = log(conn)
    n = watch["kept"] + 1
    if any(e["day"] == watch["day"] and e["n"] == n for e in entries):
        return
    from . import watch as story  # it reads the streak from daily, which reads this module

    story.stamp_stars(conn)
    entries.append({"day": watch["day"], "n": n, **held_in(conn, watch)})
    db.set_setting(conn, LOG_SETTING, entries)


def start(conn, today: date) -> dict:
    """Tonight's open extra watch, or the next one when the last is finished. Raises NotKept
    until tonight's lesson is finished (daily.lesson)."""
    from . import daily  # daily's summary reads kept_tonight from here

    lesson = daily.lesson(conn, today)
    if not lesson["total"] or lesson["done"] < lesson["total"]:
        raise NotKept("Keep tonight's watch first.")
    watch = current(conn, today)
    if watch is not None and watch["total"] > 0 and not _finished(conn, today, watch):
        return watch
    kept = kept_tonight(conn, today)  # logs the finished one before it is replaced
    watch = {"day": today.isoformat(), **answered(conn, today), "total": lesson["total"], "kept": kept}
    db.set_setting(conn, SETTING, watch)
    return watch


def serve(conn, today: date, watch: dict, pick) -> tuple[dict, dict]:
    """The watch's next item, from `pick(n)` (mix.serve for item `n` of the watch), and its
    progress {done, total, kept}. A watch with nothing left to serve ends where it is."""
    done = _done(conn, today, watch)
    item = {"card": None, "threat": None, "move": None, "puzzle": None, "mode": None}
    if done < watch["total"]:
        item = pick(done)
        if not any(item[k] for k in ("card", "threat", "move", "puzzle")):
            watch = {**watch, "total": done}
            db.set_setting(conn, SETTING, watch)
    finished = watch["total"] > 0 and done >= watch["total"]
    if finished:
        log_finished(conn)
    return item, {"done": done, "total": watch["total"], "kept": watch["kept"] + (1 if finished else 0)}


def new_slip(conn) -> tuple[int, int] | None:
    """The newest game's never-answered position: no lesson has held it, and it is due on no
    night, so serving it moves nothing on the schedule."""
    row = conn.execute(
        """SELECT c.game_id, c.ply FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           JOIN games g ON g.id = c.game_id
           WHERE c.due IS NULL AND c.reviews = 0 AND m.best_uci IS NOT NULL AND c.suspended_at IS NULL
           ORDER BY g.played_at DESC NULLS LAST, c.game_id DESC, c.ply LIMIT 1"""
    ).fetchone()
    return (row["game_id"], row["ply"]) if row else None


def held_family(conn, today: date) -> tuple[tuple[int, int], dict] | None:
    """A held move (its last answer right) with a tactic family and no family member solved
    yet, the one with the longest memory first, and its family puzzle. A move whose family
    puzzle was tried tonight waits for another night, so a miss does not loop."""
    start, _ = db.day_range(conn, today)
    rows = conn.execute(
        """SELECT c.game_id, c.ply, c.fsrs FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.suspended_at IS NULL AND c.reviews > 0 AND m.best_uci IS NOT NULL
             AND m.pattern IS NOT NULL AND m.pattern <> ALL(%s)
             AND NOT EXISTS (SELECT 1 FROM puzzle_attempts a
                             WHERE a.family_game_id = c.game_id AND a.family_ply = c.ply
                               AND (a.success OR a.attempted_at >= %s))
             AND (SELECT r.correct FROM card_reviews r WHERE r.game_id = c.game_id AND r.ply = c.ply
                  ORDER BY r.reviewed_at DESC, r.id DESC LIMIT 1) IS TRUE""",
        (list(patterns.NAMELESS), start),
    ).fetchall()
    rows.sort(key=lambda r: (-deck._stability(r["fsrs"]), r["game_id"], r["ply"]))
    for r in rows:
        if fam := puzzles.family_puzzle(conn, r["game_id"], r["ply"], today):
            return (r["game_id"], r["ply"]), fam
    return None


def family_served(conn, puzzle_id: str, today: date) -> tuple[int, int] | None:
    """The held move this puzzle was served for in tonight's extra watch, worked out again
    rather than taken from the client (as puzzles._family_of does for the lesson's)."""
    if current(conn, today) is None:
        return None
    held = held_family(conn, today)
    return held[0] if held and held[1]["id"] == puzzle_id else None
