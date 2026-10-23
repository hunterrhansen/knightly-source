"""The watch story's data (docs/specs/2026-10-18-watch-story-design.md, "Backend and API"):
each review card's state on the watch, tonight's preview, the slips per game and this week,
and the journey of stars and ranks.

A card is **on watch** while it has never been answered or its last answer failed, **held**
once its last answer was right but it has not yet stopped slipping, and has **stopped
slipping** once it holds for STOPPED_DAYS (`stopped`): answered Good on two separate days, so
the first star is about two days away. That is the watch story's bar, shorter than the deck's
long-term memory (deck.MASTERED_DAYS), which the memory counts keep. Suspended cards are on
none of them.

A **star** is a card's first stop (`cards.mastered_at`, set once by `stamp_stars`). Stars
never go away: a card that lapses goes back on watch and its star is dimmed until it holds
again. Stars count what you have learned; they are not a route to rank. **Ranks** come from
the walk alone: Page with the first night kept, then a castle after every POSTS_PER_RANK
posts cleared (wards.post_ranks). A rank once reached is kept (RANKS_SETTING).
"""

import json
from datetime import UTC, date, datetime, timedelta

from fsrs import Card, Rating

from . import causes, daily, db, deck, patterns, positions, puzzles, wards

TONIGHT_ROWS = 3  # move rows on the Watch page's tonight card
RECENT_DAYS = 7  # a new slip from a game this recent leads the tonight headline
WEEK_DAYS = 7  # the Games summary card's period

# (key, name, post): the post whose clearing reaches the rank (a castle every
# wards.POSTS_PER_RANK posts). Page comes with the first night kept; Knight III stands at the
# Keep, beyond the posts built so far, so no post reaches it yet.
RANKS = [
    ("page", "Page", None),
    ("squire-1", "Squire I", 3),
    ("squire-2", "Squire II", 6),
    ("squire-3", "Squire III", 9),
    ("knight-1", "Knight I", 12),
    ("knight-2", "Knight II", 15),
    ("knight-3", "Knight III", None),
]
RANKS_SETTING = "ranks_reached"  # {rank key: "YYYY-MM-DD"}: reached ranks are never lost
NIGHT_MILESTONES = (7, 30, 100, 365)
# A move has stopped slipping (and earns its star) once FSRS expects it to hold this many
# days: a move answered Good on two separate days reaches about 11 days' stability.
STOPPED_DAYS = 11

# A move's label: its blunder cause (causes.py), else its tactic (patterns.THEMES), else
# "Your move N".
CAUSE_LABELS = {
    "missedThreat": "Missed threat",
    "backRank": "Back-rank threat",
    "loosePiece": "Loose piece",
}
TACTIC_LABELS = {
    "hangingPiece": "Loose piece",
    "fork": "Fork",
    "pin": "Pin",
    "skewer": "Skewer",
    "discoveredAttack": "Discovered attack",
    "backRankMate": "Back-rank threat",
    "mate": "Mate",
    "promotion": "Promotion",
    "enPassant": "En passant",
    "advancedPawn": "Advanced pawn",
    "trappedPiece": "Trapped piece",
}


def label(cause_kind: str | None, pattern: str | None, move_number: int | None) -> str:
    """A move's name on the watch: its cause, else its tactic, else "Your move 14"."""
    named = CAUSE_LABELS.get(cause_kind or "") or TACTIC_LABELS.get(pattern or "")
    return named or (f"Your move {move_number}" if move_number else "Your move")


def explain(conn, keys) -> dict[tuple[int, int], dict]:
    """{(game_id, ply): {label, reason}} for review cards: the label, and the cause's one-line
    reason when it has one (None otherwise). Built from stored facts, never a search."""
    keys = sorted(set(keys))
    if not keys:
        return {}
    rows = conn.execute(
        """SELECT game_id, ply, uci, pattern, layer, move_number, cause_facts FROM moves
           WHERE (game_id, ply) IN (SELECT * FROM unnest(%s::int[], %s::int[]))""",
        ([k[0] for k in keys], [k[1] for k in keys]),
    ).fetchall()
    needs_fen = {r["game_id"] for r in rows if r["cause_facts"]}
    fens = positions.fens(conn, needs_fen) if needs_fen else {}
    out = {}
    for r in rows:
        facts = r["cause_facts"]
        if isinstance(facts, str):
            facts = json.loads(facts)
        fen = fens.get((r["game_id"], r["ply"]))
        found = causes.for_game_move(fen, r["uci"], r["layer"], facts) if fen and facts else None
        out[(r["game_id"], r["ply"])] = {
            "label": label(found["cause_kind"] if found else None, r["pattern"], r["move_number"]),
            "reason": found["cause_text"] if found else None,
        }
    return out


# Card states


def _stability(fsrs_json: str | None) -> float:
    return (json.loads(fsrs_json).get("stability") or 0) if fsrs_json else 0


def stopped(stability: float, pattern: str | None, family_solved: bool) -> bool:
    """Whether a move has stopped slipping: it holds for STOPPED_DAYS by the same rule as
    long-term memory (deck.holds: a card with a tactic family needs one of its puzzles solved)."""
    return deck.holds(stability, pattern, family_solved, STOPPED_DAYS)


def stopped_today_keys(conn, today: date | None = None) -> set[tuple[int, int]]:
    """The (game_id, ply) of moves that stopped slipping today: their stars relit."""
    return deck.crossed_today_keys(conn, today, STOPPED_DAYS)


def state_of(reviews: int, last_correct: bool | None, mastered: bool) -> str:
    """A card's place on the watch: "stopped" (`stopped`), "on_watch" (never answered, or its
    last answer failed) or "held" (last answer right, not stopped yet)."""
    if mastered:
        return "stopped"
    if reviews == 0 or last_correct is False:
        return "on_watch"
    return "held"


def cards(conn, game_ids: list[int] | None = None) -> list[dict]:
    """Every review card in the deck (suspended ones left out), or those of `game_ids`, with
    its state, next due day, star and how many answers in a row it has held. `mastered` is
    whether it has stopped slipping (`stopped`), not deck long-term memory."""
    where, params = "c.suspended_at IS NULL", []
    if game_ids is not None:
        where += " AND c.game_id = ANY(%s)"
        params.append(list(game_ids))
    rows = conn.execute(
        f"""SELECT c.game_id, c.ply, c.reviews, c.lapses, c.due, c.fsrs, c.mastered_at, m.pattern
            FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
            WHERE {where} ORDER BY c.game_id, c.ply""",
        params,
    ).fetchall()
    if not rows:
        return []
    # Each card's graded answers, newest first: the last decides on watch or held, and the
    # run of right answers since the last miss is how long it has held.
    answers: dict[tuple[int, int], list[bool]] = {}
    review_where = "game_id = ANY(%s)" if game_ids is not None else "TRUE"
    for r in conn.execute(
        f"""SELECT game_id, ply, correct FROM card_reviews WHERE {review_where}
            ORDER BY reviewed_at DESC, id DESC""",
        [list(game_ids)] if game_ids is not None else [],
    ):
        answers.setdefault((r["game_id"], r["ply"]), []).append(bool(r["correct"]))
    families = puzzles.families_solved(conn)
    out = []
    for r in rows:
        key = (r["game_id"], r["ply"])
        history = answers.get(key, [])
        held = next((i for i, right in enumerate(history) if not right), len(history))
        mastered = stopped(_stability(r["fsrs"]), r["pattern"], key in families)
        out.append(
            {
                "game_id": r["game_id"],
                "ply": r["ply"],
                "state": state_of(r["reviews"], history[0] if history else None, mastered),
                "due": r["due"],
                "held": held,
                "reviews": r["reviews"],
                "lapses": r["lapses"],
                "mastered": mastered,
                "mastered_at": r["mastered_at"],
            }
        )
    return out


def _tally(states) -> dict:
    counts = {"on_watch": 0, "held": 0, "stopped": 0}
    for s in states:
        counts[s] += 1
    return counts


def deck_states(conn) -> dict:
    """{on_watch, held, stopped} for every move in the deck (hidden ones left out)."""
    return _tally(c["state"] for c in cards(conn))


def slips(conn, games: list) -> dict[int, dict | None]:
    """{game_id: {on_watch, held, stopped}} for game_facts rows: None until a game is analysed,
    all zero for an analysed game with nothing that slipped (Clean)."""
    analysed = [g["id"] for g in games if g["analysed"]]
    by_game: dict[int, list[str]] = {gid: [] for gid in analysed}
    for c in cards(conn, analysed) if analysed else []:
        by_game[c["game_id"]].append(c["state"])
    return {g["id"]: _tally(by_game[g["id"]]) if g["analysed"] else None for g in games}


def week(conn, now: datetime | None = None) -> dict:
    """The Games summary card: games played in the last WEEK_DAYS days, how many of them are
    analysed (the card hides with none), moves that slipped in them and where those are."""
    since = db.stamp((now or datetime.now(UTC)) - timedelta(days=WEEK_DAYS))
    from . import game_facts

    games = game_facts.rows(conn, "f.played_at >= %s", (since,))
    per_game = slips(conn, games)
    totals = {"on_watch": 0, "held": 0, "stopped": 0}
    for counts in per_game.values():
        for k, v in (counts or {}).items():
            totals[k] += v
    return {
        "games": len(games),
        "analysed": sum(1 for g in games if g["analysed"]),
        "slipped": sum(totals.values()),
        **totals,
    }


def deck_cards(conn, game_id: int) -> list[dict]:
    """A game's review cards in move order, for "What slipped past you": state, next due
    day, label, one-line reason and answers held in a row."""
    found = cards(conn, [game_id])
    names = explain(conn, [(c["game_id"], c["ply"]) for c in found])
    return [
        {
            "ply": c["ply"],
            "state": c["state"],
            "due": c["due"],
            **names[(c["game_id"], c["ply"])],
            "held": c["held"],
        }
        for c in found
    ]


# Tonight


def _chip(reviews: int, lapses: int, almost: bool) -> str | None:
    """New (never answered), almost (one Good answer from stopping slipping) or again
    (answered wrong before)."""
    if reviews == 0:
        return "new"
    if almost:
        return "almost"
    if lapses > 0:
        return "again"
    return None


def _almost(conn, row, now: datetime) -> bool:
    """Whether a Good answer now would make the move stop slipping (`stopped`)."""
    if not row["fsrs"]:
        return False
    state = Card.from_dict(json.loads(row["fsrs"]))
    after = deck._review(deck.scheduler(conn), state, Rating.Good, now, row["game_id"], row["ply"], row["reviews"])
    family = puzzles.family_solved(conn, row["game_id"], row["ply"])
    return stopped(after.stability or 0, row["pattern"], family)


def tonight(conn, today: date, lesson: dict, remaining: list, now: datetime | None = None) -> dict:
    """The Watch page's preview of tonight's lesson: up to TONIGHT_ROWS of its positions in
    lesson order, how many of the lesson's positions are new slips from the last RECENT_DAYS
    days of games, and how many more items the lesson holds beyond the rows. `lesson` is
    daily.lesson; `remaining` today's deck.queue.

    When a newly analysed game's slips lead the lesson (deck.lead_game), `game` names it
    (opponent, when played, how many of its slips are in the lesson) and the rows are only
    its slips: the game review folded into the watch."""
    now = now or datetime.now(UTC)
    left = max(0, lesson["total"] - lesson["done"])
    ordered = deck.lesson_queue(conn, today, now, remaining=remaining)[:left]
    keys = [(r["game_id"], r["ply"]) for r in ordered]
    details = {
        (r["game_id"], r["ply"]): r
        for r in conn.execute(
            """SELECT c.game_id, c.ply, c.reviews, c.lapses, c.fsrs, m.san, m.color, m.pattern,
                      g.opponent, g.played_at
               FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
               JOIN games g ON g.id = c.game_id
               WHERE (c.game_id, c.ply) IN (SELECT * FROM unnest(%s::int[], %s::int[]))""",
            ([k[0] for k in keys], [k[1] for k in keys]),
        )
    }
    lead = deck.lead_game(conn, now)
    lead_keys = [k for k in keys if k[0] == lead and details[k]["reviews"] == 0]
    recent = db.stamp(now - timedelta(days=RECENT_DAYS))
    slipped_recent = sum(1 for k in keys if details[k]["reviews"] == 0 and (details[k]["played_at"] or "") >= recent)
    shown = (lead_keys or keys)[:TONIGHT_ROWS]
    names = explain(conn, shown)
    fens = positions.fens(conn, {k[0] for k in shown})
    rows = []
    for k in shown:
        d = details[k]
        rows.append(
            {
                "game_id": k[0],
                "ply": k[1],
                "san": d["san"],
                "label": names[k]["label"],
                "opponent": d["opponent"],
                "played_at": d["played_at"],
                "chip": _chip(d["reviews"], d["lapses"], _almost(conn, d, now)),
                "color": d["color"],
                "fen": fens.get(k),
            }
        )
    game = None
    if lead_keys:
        first = details[lead_keys[0]]
        game = {"id": lead, "opponent": first["opponent"], "played_at": first["played_at"], "slipped": len(lead_keys)}
    return {
        "slipped_recent": slipped_recent,
        "cards": rows,
        "remaining": max(0, left - len(rows)),
        "game": game,
    }


# Stars and ranks


def stamp_stars(conn) -> int:
    """Give a star (`cards.mastered_at`) to every card that has stopped slipping (`stopped`)
    and has none yet, dated from its history: the first answer that carried its stability to
    STOPPED_DAYS (or its last answer, for reviews from before stability was stored),
    or the family puzzle that completed it when that came later. Dating from history makes
    this the backfill too, and makes calling it late harmless. Returns how many it stamped."""
    nameless = list(patterns.NAMELESS)
    days = STOPPED_DAYS
    return conn.execute(
        """UPDATE cards SET mastered_at = s.at
           FROM (
             SELECT k.game_id, k.ply,
                    greatest(
                      coalesce((SELECT min(r.reviewed_at) FROM card_reviews r
                                WHERE r.game_id = k.game_id AND r.ply = k.ply AND r.stability_after >= %s),
                               k.last_reviewed_at, k.added_at),
                      CASE WHEN m.pattern IS NOT NULL AND m.pattern <> ALL(%s) THEN
                        (SELECT min(a.attempted_at) FROM puzzle_attempts a
                         WHERE a.family_game_id = k.game_id AND a.family_ply = k.ply AND a.success)
                      END) AS at
             FROM cards k JOIN moves m ON m.game_id = k.game_id AND m.ply = k.ply
             WHERE k.mastered_at IS NULL
               AND (EXISTS (SELECT 1 FROM card_reviews r
                            WHERE r.game_id = k.game_id AND r.ply = k.ply AND r.stability_after >= %s)
                    OR coalesce((k.fsrs::jsonb ->> 'stability')::float8, 0) >= %s)
               AND (m.pattern IS NULL OR m.pattern = ANY(%s)
                    OR EXISTS (SELECT 1 FROM puzzle_attempts a
                               WHERE a.family_game_id = k.game_id AND a.family_ply = k.ply AND a.success))
           ) s
           WHERE cards.game_id = s.game_id AND cards.ply = s.ply AND cards.mastered_at IS NULL""",
        (days, nameless, days, days, nameless),
    ).rowcount


def _local_day(conn, stamp: str) -> str:
    return db.local_date(conn, datetime.strptime(stamp, db.STAMP_FORMAT).replace(tzinfo=UTC)).isoformat()


def _stars(conn) -> list[dict]:
    """Every star, oldest first: the card, the day it was earned and whether it is dimmed
    (the card has slipped again since: it no longer `stopped`). Suspended cards keep their
    stars."""
    rows = conn.execute(
        """SELECT c.game_id, c.ply, c.fsrs, c.mastered_at, m.pattern, m.san
           FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.mastered_at IS NOT NULL ORDER BY c.mastered_at, c.game_id, c.ply"""
    ).fetchall()
    families = puzzles.families_solved(conn)
    return [
        {
            "game_id": r["game_id"],
            "ply": r["ply"],
            "san": r["san"],
            "earned_on": _local_day(conn, r["mastered_at"]),
            "dimmed": not stopped(_stability(r["fsrs"]), r["pattern"], (r["game_id"], r["ply"]) in families),
        }
        for r in rows
    ]


def _ranks(conn, nights: list[str]) -> list[dict]:
    """RANKS with the day each was reached (None while it isn't): Page with the first night
    kept, the others when the castle's posts were all cleared. Reached ranks are saved and
    never lost, including ones reached under the old star thresholds."""
    saved = db.get_setting(conn, RANKS_SETTING) or {}
    reached = dict(saved)
    for key, day in wards.post_ranks(conn).items():
        reached.setdefault(key, day)
    if nights:
        reached.setdefault("page", nights[0])
    if reached != saved:
        db.set_setting(conn, RANKS_SETTING, reached)
    return [{"key": key, "name": name, "post": post, "reached_on": reached.get(key)} for key, name, post in RANKS]


def _summary(stars: list[dict], ranks: list[dict]) -> dict:
    """Home's journey line: stars, the current rank (Page until another is reached) and the
    next one with the post that reaches it."""
    current = max((i for i, r in enumerate(ranks) if r["reached_on"]), default=0)
    nxt = next((r for r in ranks[current + 1 :] if not r["reached_on"]), None)
    return {
        "stars": len(stars),
        "rank": ranks[current]["name"],
        "rank_reached_on": ranks[current]["reached_on"],
        "next_rank": nxt["name"] if nxt else None,
        "next_post": nxt["post"] if nxt else None,
    }


def journey_summary(conn, today: date) -> dict:
    """Home's `journey`. Stamps new stars first; writes, so call it in a transaction."""
    stamp_stars(conn)
    stars = _stars(conn)
    return _summary(stars, _ranks(conn, daily.kept_nights(conn, today)))


def journey(conn, today: date) -> dict:
    """The Progress map: the summary, every rank with its post and the day reached,
    every star (dimmed while its card has lapsed), and the nights kept with their milestones.
    Stamps new stars first; writes, so call it in a transaction."""
    stamp_stars(conn)
    stars = _stars(conn)
    nights = daily.kept_nights(conn, today)
    ranks = _ranks(conn, nights)
    names = explain(conn, [(s["game_id"], s["ply"]) for s in stars])
    return {
        **_summary(stars, ranks),
        "dimmed": sum(1 for s in stars if s["dimmed"]),
        "ranks": ranks,
        "star_list": [{**s, "label": names[(s["game_id"], s["ply"])]["label"]} for s in stars],
        "nights": {
            "total": len(nights),
            "milestones": [
                {"nights": n, "reached_on": nights[n - 1] if len(nights) >= n else None} for n in NIGHT_MILESTONES
            ],
        },
    }
