"""The review deck: spaced repetition over positions from your own games.

Every mistake, miss or blunder of yours where one move was better than the rest by
CARD_GAP becomes a card: the position before your move, and the engine's move as the
answer.

Scheduling is inspired by Anki, the go-to for learning a lot and keeping it (decided Oct 7,
2026): it uses FSRS, the scheduler Anki uses by default, and grades each answer with Anki's
buttons, which the app presses for you from your FIRST try of the day:

- Easy: the engine's own move, found within EASY_SECONDS with no hint: you clearly know it.
- Good: the best move, or one within GOOD_DROP points of win chance of it, or any mate.
- Hard: within HARD_DROP points ("Good move! Best was ...").
- Again: anything else, a hint before answering, or Show me. Anki's manual is clear that a
  forgotten card is Again, never Hard, or the schedule stops being trustworthy.

You can try again after a miss and keep going until you find it; that's for learning and
doesn't change the grade (the same rule Lichess uses for puzzle ratings). A position you
didn't get first time also comes back once more at the end of the session (the app does
that, Duolingo-style; it stands in for Anki's relearning steps, so FSRS runs without any).

Each day serves every card that's due (most overdue first), then a few new ones: PACES
new positions a day for the pace chosen in Settings (Standard: 5). Like Anki, new cards and
reviews have separate limits, so reviews never crowd out the mistakes from your latest
games, and new cards never outrun what you can keep up with. Reviews stop at MAX_REVIEWS
a day, Anki's default: about twice what Intense settles at (below), so due reviews only
wait for tomorrow (most overdue first) after a long break, never in normal use. Once
today's queue is finished, "Learn more" (`learn_more`) raises today's new limit by one
pace's worth, for today only, like Anki's Custom Study; those cards are graded and
scheduled like any other. There is no reviewing ahead of cards not yet due. New positions
come weakest first: blunders, then the habit costing you most (game_trend's win% lost a
game), then the tactic you are weakest at (patterns.weakness: the find rate in your own
games, shrunk toward your overall one), then your newest games.

Reviews grow as the deck does: simulating FSRS, each new position a day brings about seven
reviews a day after three months and ten after a year. At about a minute for a new position
and 20 seconds for a review, Light, Standard and Intense come to about 10, 15 and 30 minutes
a day once the deck is a few months old.
"""

import contextvars
import json
import random
from datetime import UTC, date, datetime, timedelta

import chess
import chess.engine
import fsrs.scheduler as fsrs_scheduler
from fsrs import Card, Rating, ReviewLog, Scheduler

from . import db, game_trend, monitoring, patterns, positions, puzzles, timing
from .analyze import find_engine, only_move, win_pct
from .brilliance import GREAT_GAP

# New positions a day for each pace (Settings › Practice), and reviews allowed a day.
PACES = {"light": 3, "standard": 5, "intense": 10}
DEFAULT_PACE = "standard"
PACE_SETTING = "review_pace"
MAX_REVIEWS = 200
# Today's extra new positions from Learn more: {"day": "2026-10-16", "count": 5}.
EXTRA_NEW_SETTING = "extra_new_today"
# Blunders are learned first, then mistakes and misses.
WEAKEST = {"blunder": 0, "mistake": 1, "miss": 1}
# One move clearly better: the engine's second choice would have cost this much win%,
# the same bar as a Great move. Practice lines extend only through such moves, since a
# line's later moves accept nothing but the line's move (practice_lines).
CLEAR_GAP = GREAT_GAP
# How close to the best move an answer must be, in points of win chance (Lichess and
# Chess.com both call moves within a couple of points good or excellent).
GOOD_DROP = 2
HARD_DROP = 5
# A mistake becomes a card when the engine's second choice would have cost this much win%.
# `judge` takes any first move within HARD_DROP as Hard and marks anything worse wrong, so
# a second-best move under this bar is graded correctly rather than being a hidden right
# answer. Provisional until the release gate in the review deck quality spec.
CARD_GAP = HARD_DROP
# Bumped when the rules for which moves become cards change, so every account's deck
# refreshes once (`refresh`). 2: CARD_GAP replaced CLEAR_GAP. 3: the bar is mate-aware
# (`analyze.only_move`), so a mate beside another winning move now makes a card.
DECK_RULES = 3
JUDGE_DEPTH = 14
# A first try of the engine's move this quick (no hint) is Easy: it spaces out faster.
EASY_SECONDS = 10
# "Mastered" for the counts on Progress and Done: FSRS expects you to remember it for two
# months or more. Mastered cards still come back, just rarely.
MASTERED_DAYS = 60
# A position missed this many times is a leech: it opens with its context first (Anki says
# 8 for vocabulary; positions are fewer and costlier). Never suspended automatically.
LEECH_LAPSES = 4
SKIP = "0000"  # Show me (or Skip): no move

# No learning or relearning steps: the session's end-of-lesson redo does that job.
SCHEDULER = Scheduler(learning_steps=(), relearning_steps=())
# Like Anki's "Optimize": once there are this many graded answers, FSRS can be fitted to your
# own memory; with fewer, its optimizer keeps the defaults anyway. The worker tunes after a
# daily update (maybe_tune), then again about monthly, as Anki's manual recommends.
MIN_TUNE_REVIEWS = 512
RETUNE_DAYS = 30
# After a failed attempt (or on a server without the optimizer), try again a week later.
RETRY_TUNE_DAYS = 7
RATING = {"again": Rating.Again, "hard": Rating.Hard, "good": Rating.Good, "easy": Rating.Easy}

# Like Anki, a card's interval fuzz is seeded from the card and its review count, so the
# date shown before an answer (`preview`) is the one the answer then saves. py-fsrs draws
# its fuzz from `random.random`; that draw goes through this request's seeded generator
# (a context variable, so concurrent requests never share one).
_fuzz: contextvars.ContextVar[random.Random | None] = contextvars.ContextVar("fsrs_fuzz", default=None)


def _fuzz_draw() -> float:
    seeded = _fuzz.get()
    return seeded.random() if seeded else random.random()


fsrs_scheduler.random = _fuzz_draw


def _review(
    fsrs: Scheduler,
    state: Card,
    rating: Rating,
    when: datetime,
    game_id: int,
    ply: int,
    reviews: int,
    duration: int | None = None,
) -> Card:
    """FSRS's next state for `rating`, with the card's own seeded fuzz."""
    token = _fuzz.set(random.Random(f"{game_id}:{ply}:{reviews}"))
    try:
        return fsrs.review_card(state, rating, when, review_duration=duration)[0]
    finally:
        _fuzz.reset(token)


def best_gap(color: str, eval_best: int | None, eval_second: int | None) -> float | None:
    """How much win% the engine's second choice would have cost, from the mover's side, or
    None without a second choice. Evals are White's point of view, as stored in `moves`."""
    if eval_best is None or eval_second is None:
        return None
    sign = 1 if color == "white" else -1
    return win_pct(sign * eval_best) - win_pct(sign * eval_second)


def clear_best(color: str, eval_best: int | None, eval_second: int | None) -> bool:
    """Whether the engine's best move beat its second choice by CARD_GAP: a card's bar.
    `analyze.only_move`, not `best_gap`, because win% saturates: a mate beside a merely
    winning move reads as no gap at all, so those positions never became cards."""
    return only_move(color, eval_best, eval_second, CARD_GAP)


def _mistakes(conn, where: str = "TRUE", params: tuple = ()) -> list[db.Row]:
    """Every mistake, miss or blunder of yours with an engine move."""
    return conn.execute(
        f"""SELECT m.game_id, m.ply, m.color, m.san, m.best_san, m.classification,
                   m.eval_before, m.eval_second FROM moves m
            WHERE m.is_user AND m.best_uci IS NOT NULL
              AND m.classification IN ({", ".join("%s" for _ in patterns.KINDS)}) AND {where}""",
        (*patterns.KINDS, *params),
    ).fetchall()


def _qualifying(conn, where: str = "TRUE", params: tuple = ()) -> list[tuple[int, int]]:
    """(game_id, ply) of every move of yours that makes a card, card or not yet."""
    return [
        (r["game_id"], r["ply"])
        for r in _mistakes(conn, where, params)
        if clear_best(r["color"], r["eval_before"], r["eval_second"])
    ]


def near_bar(conn, low: float = HARD_DROP, high: float = CLEAR_GAP, limit: int = 40) -> list[dict]:
    """Mistakes of yours whose best move beat the second choice by at least `low` and less
    than `high` win%, newest games first, with the position: the sample the review deck
    quality spec's release gate reviews on a board before CARD_GAP is settled."""
    rows = [
        (r, gap)
        for r in _mistakes(conn)
        if (gap := best_gap(r["color"], r["eval_before"], r["eval_second"])) is not None and low <= gap < high
    ]
    played = {
        r["id"]: r["played_at"]
        for r in conn.execute(
            "SELECT id, played_at FROM games WHERE id = ANY(%s)", (sorted({r["game_id"] for r, _ in rows}),)
        )
    }
    rows.sort(key=lambda item: (played.get(item[0]["game_id"]) or "", item[0]["ply"]), reverse=True)
    rows = rows[:limit]
    fens = positions.fens(conn, [r["game_id"] for r, _ in rows])
    return [
        {
            "game_id": r["game_id"],
            "ply": r["ply"],
            "played_at": played.get(r["game_id"]),
            "classification": r["classification"],
            "played": r["san"],
            "best": r["best_san"],
            "gap": round(gap, 1),
            "fen": fens.get((r["game_id"], r["ply"])),
        }
        for r, gap in rows
    ]


def game_plies(conn, game_id: int) -> list[int]:
    """The plies of a game that are review-deck positions, or will be at the next sync: game
    review asks you to find these moves, before Finish review has added them."""
    cards = conn.execute("SELECT ply, suspended_at FROM cards WHERE game_id = %s", (game_id,)).fetchall()
    hidden = {r["ply"] for r in cards if r["suspended_at"]}
    have = {r["ply"] for r in cards} - hidden
    return sorted(have | ({ply for _, ply in _qualifying(conn, "m.game_id = %s", (game_id,))} - hidden))


def sync(conn: db.Connection) -> int:
    """Add a card for every qualifying move that doesn't have one yet, and give cards
    answered before FSRS their FSRS state. Cards are never removed, so re-analysing a game
    keeps its review history. Returns how many were added."""
    have = {tuple(r) for r in conn.execute("SELECT game_id, ply FROM cards")}
    new = [key for key in _qualifying(conn) if key not in have]
    # DO NOTHING: two requests can sync at once (the page loading twice, say).
    added = (
        conn.executemany("INSERT INTO cards (game_id, ply) VALUES (%s, %s) ON CONFLICT DO NOTHING", new).rowcount
        if new
        else 0
    )
    _replay_history(conn)
    return added


SYNCED_SETTING = "deck_synced_version"


def refresh(conn: db.Connection) -> bool:
    """`sync` and name new mistakes' tactics (patterns.tag_all), but only when game analysis
    has written moves, or the card rules (DECK_RULES) changed, since the last refresh
    (db.analysis_changed): both scan every move of yours, and the deck is read after every
    answer. Returns whether it ran."""
    version = [db.analysis_version(conn), DECK_RULES]
    if db.get_setting(conn, SYNCED_SETTING) == version:
        return False
    timing.call("sync", sync, conn)
    timing.call("tag", patterns.tag_all, conn)
    # The version read first: analysis committed during this refresh runs it again next time.
    db.set_setting(conn, SYNCED_SETTING, version)
    return True


def scheduler(conn) -> Scheduler:
    """FSRS with your own parameters once they've been tuned, else the defaults."""
    row = conn.execute("SELECT value FROM settings WHERE key = 'fsrs_parameters'").fetchone()
    if not row:
        return SCHEDULER
    return Scheduler(parameters=json.loads(row[0]), learning_steps=(), relearning_steps=())


def _review_logs(conn) -> list[ReviewLog]:
    """Every graded answer (a card's first of the day) as FSRS review logs."""
    rows = conn.execute(
        """SELECT game_id, ply, reviewed_at, rating FROM card_reviews
           WHERE rating IS NOT NULL ORDER BY reviewed_at, id"""
    ).fetchall()
    return [
        ReviewLog(
            card_id=r["game_id"] * 1000 + r["ply"],
            rating=RATING[r["rating"]],
            review_datetime=datetime.fromisoformat(r["reviewed_at"].replace("Z", "+00:00")),
            review_duration=None,
        )
        for r in rows
    ]


def tuning(conn) -> dict:
    """Whether the deck runs on your own FSRS parameters, and how many reviews there are."""

    def setting(key):
        row = conn.execute("SELECT value FROM settings WHERE key = %s", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    reviews = conn.execute("SELECT count(*) FROM card_reviews WHERE rating IS NOT NULL").fetchone()[0]
    return {
        "personal": setting("fsrs_parameters") is not None,
        "reviews": reviews,
        "needed": MIN_TUNE_REVIEWS,
        "tuned_at": setting("fsrs_tuned_at"),
        "tuned_reviews": setting("fsrs_tuned_reviews"),
    }


def tune(conn, now: datetime | None = None) -> dict:
    """Fit FSRS to your own answers, as Anki's Optimize does, and use the result from now on.
    Needs MIN_TUNE_REVIEWS reviews and the optimizer (`uv sync --extra optimizer`, PyTorch)."""
    logs = _review_logs(conn)
    if len(logs) < MIN_TUNE_REVIEWS:
        return {**tuning(conn), "tuned": False}
    from fsrs import Optimizer  # raises ImportError without the optimizer extra

    parameters = [float(p) for p in Optimizer(logs).compute_optimal_parameters()]
    Scheduler(parameters=parameters)  # raises on parameters FSRS can't use: nothing is saved
    for key, value in (
        ("fsrs_parameters", parameters),
        ("fsrs_tuned_at", _stamp(now)),
        ("fsrs_tuned_reviews", len(logs)),
    ):
        db.set_setting(conn, key, value)
    return {**tuning(conn), "tuned": True}


def _stamp(now: datetime | None) -> str:
    return db.stamp(now or datetime.now(UTC))


def _days_since(stamp: str | None, now: datetime) -> float:
    if not stamp:
        return float("inf")
    return (now - datetime.fromisoformat(stamp.replace("Z", "+00:00"))).total_seconds() / 86400


def tune_due(conn, now: datetime | None = None) -> bool:
    """Whether to (re)tune: MIN_TUNE_REVIEWS answers, and never tuned or tuned RETUNE_DAYS
    ago with new answers since, and no failed attempt in the last RETRY_TUNE_DAYS."""
    now = now or datetime.now(UTC)
    state = tuning(conn)
    if state["reviews"] < MIN_TUNE_REVIEWS:
        return False
    if _days_since(db.get_setting(conn, "fsrs_tune_failed_at"), now) < RETRY_TUNE_DAYS:
        return False
    if not state["personal"]:
        return True
    return _days_since(state["tuned_at"], now) >= RETUNE_DAYS and state["reviews"] > (state["tuned_reviews"] or 0)


def maybe_tune(conn, now: datetime | None = None, log=print) -> bool:
    """Tune when tune_due says so; the worker calls this after each daily update. A failure,
    including a server without the optimizer, keeps the parameters in use (the defaults or
    the last tuned ones) and waits RETRY_TUNE_DAYS. Returns whether new ones were saved."""
    if not tune_due(conn, now):
        return False
    try:
        with conn:
            tuned = tune(conn, now)["tuned"]
    except Exception as e:  # ImportError too: the deck carries on with what it has
        log(f"FSRS tuning failed, keeping the current parameters: {e!r}")
        if not isinstance(e, ImportError):
            monitoring.capture(e)
        db.set_setting(conn, "fsrs_tune_failed_at", _stamp(now))
        return False
    if tuned:
        log(f"Tuned FSRS to {tuning(conn)['reviews']} reviews")
    return tuned


def _replay_history(conn) -> None:
    """Cards answered under the old fixed ladder (3 days, 1 week, ...) have no FSRS state:
    rebuild it by replaying their answers, a right one as Good and a wrong one as Again."""
    fsrs = scheduler(conn)
    for card in conn.execute("SELECT game_id, ply FROM cards WHERE fsrs IS NULL AND reviews > 0").fetchall():
        state = Card()
        for r in conn.execute(
            """SELECT reviewed_at, correct FROM card_reviews WHERE game_id = %s AND ply = %s
               ORDER BY reviewed_at, id""",
            (card["game_id"], card["ply"]),
        ):
            at = datetime.fromisoformat(r["reviewed_at"].replace("Z", "+00:00"))
            state, _ = fsrs.review_card(state, Rating.Good if r["correct"] else Rating.Again, at)
            conn.execute(
                "UPDATE card_reviews SET rating = %s WHERE game_id = %s AND ply = %s AND reviewed_at = %s AND rating IS NULL",
                ("good" if r["correct"] else "again", card["game_id"], card["ply"], r["reviewed_at"]),
            )
        conn.execute(
            "UPDATE cards SET fsrs = %s, due = %s WHERE game_id = %s AND ply = %s",
            (json.dumps(state.to_dict()), _local_date(conn, state.due), card["game_id"], card["ply"]),
        )


def _local_date(conn, at: datetime) -> str:
    return db.local_date(conn, at).isoformat()


def game_counts(conn) -> dict:
    """Your standard games whose analysis has finished, and those still waiting for it:
    the deck draws on the first, so an empty deck can say whether more is coming."""
    row = conn.execute(
        """SELECT count(a.game_id) AS analyzed, count(*) - count(a.game_id) AS pending
           FROM games g LEFT JOIN game_analysis a ON a.game_id = g.id
           WHERE g.variant = 'standard'"""
    ).fetchone()
    return {"analyzed": row["analyzed"], "pending": row["pending"]}


def _reviewed_today(conn, today: date) -> set[tuple[int, int]]:
    rows = conn.execute(
        "SELECT DISTINCT game_id, ply FROM card_reviews WHERE reviewed_at >= %s AND reviewed_at < %s",
        db.day_range(conn, today),
    )
    return {(r["game_id"], r["ply"]) for r in rows}


def pace(conn) -> str:
    """The pace chosen in Settings › Practice: how many new positions a day."""
    value = db.get_setting(conn, PACE_SETTING, DEFAULT_PACE)
    return value if value in PACES else DEFAULT_PACE


def _extra_new(conn, today: date) -> int:
    """Extra new positions Learn more added today; any other day's count has lapsed."""
    extra = db.get_setting(conn, EXTRA_NEW_SETTING)
    if isinstance(extra, dict) and extra.get("day") == today.isoformat():
        return max(0, int(extra.get("count") or 0))
    return 0


def new_limit(conn, today: date) -> int:
    """Today's new positions: the pace's, plus any Learn more added today."""
    return PACES[pace(conn)] + _extra_new(conn, today)


def more_available(conn, today: date, remaining: list[db.Row]) -> int:
    """How many new positions Learn more would add now: one pace's worth, or fewer when the
    deck has fewer unanswered, and 0 until today's queue is finished."""
    if remaining:
        return 0
    unanswered = conn.execute(
        """SELECT count(*) FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.due IS NULL AND m.best_uci IS NOT NULL AND c.suspended_at IS NULL"""
    ).fetchone()[0]
    return min(PACES[pace(conn)], unanswered)


def learn_more(conn, today: date | None = None) -> int:
    """Raise today's new-position limit by what `more_available` offers (Anki's Custom
    Study, "increase today's new card limit"); the pace setting is unchanged. Returns how
    many were added (0 when there is nothing to add)."""
    today = today or db.today(conn)
    added = more_available(conn, today, queue(conn, today))
    if added:
        db.set_setting(conn, EXTRA_NEW_SETTING, {"day": today.isoformat(), "count": _extra_new(conn, today) + added})
    return added


def _introduced_today(conn, today: date) -> int:
    """Cards answered for the first time ever today: today's new positions."""
    start, end = db.day_range(conn, today)
    return conn.execute(
        """SELECT count(*) FROM (SELECT 1 FROM card_reviews GROUP BY game_id, ply
                                 HAVING min(reviewed_at) >= %s AND min(reviewed_at) < %s) t""",
        (start, end),
    ).fetchone()[0]


LEAD_GAME_DAYS = 3  # a game's new slips lead tonight's lesson for this long after it is played


def lead_game(conn, now: datetime | None = None) -> int | None:
    """The newest game played in the last LEAD_GAME_DAYS with a slip never answered: its new
    slips lead tonight's lesson (and its card says "Your game vs kd_88"), so a newly analysed
    game is the night's watch rather than a separate review."""
    since = db.stamp((now or datetime.now(UTC)) - timedelta(days=LEAD_GAME_DAYS))
    row = conn.execute(
        """SELECT c.game_id FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           JOIN games g ON g.id = c.game_id
           WHERE c.due IS NULL AND c.suspended_at IS NULL AND m.best_uci IS NOT NULL
             AND g.played_at >= %s
           ORDER BY g.played_at DESC, c.game_id DESC LIMIT 1""",
        (since,),
    ).fetchone()
    return row["game_id"] if row else None


def queue(conn, today: date | None = None) -> list[db.Row]:
    """Today's remaining cards, in order: due ones (most overdue first), then new ones: the
    newest game's (`lead_game`) first, then weakest first. New ones stop at today's
    `new_limit` and reviews at MAX_REVIEWS, both counting cards already answered today."""
    today = today or db.today(conn)
    done = _reviewed_today(conn, today)
    introduced = _introduced_today(conn, today)
    review_room = max(0, MAX_REVIEWS - (len(done) - introduced))
    new_room = max(0, new_limit(conn, today) - introduced)
    rows = [
        r
        for r in conn.execute(
            """SELECT c.game_id, c.ply, c.due, m.classification, m.pattern, m.layer FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           JOIN games g ON g.id = c.game_id
           WHERE (c.due IS NULL OR c.due <= %s) AND m.best_uci IS NOT NULL AND c.suspended_at IS NULL
           ORDER BY c.due IS NULL, c.due, g.played_at DESC NULLS LAST, c.ply""",
            (today.isoformat(),),
        ).fetchall()
        if (r["game_id"], r["ply"]) not in done
    ]
    due = [r for r in rows if r["due"] is not None][:review_room]
    new = [r for r in rows if r["due"] is None]
    if new_room and new:
        weak = patterns.weakness(conn, today)
        # A tactic with no chances yet sorts with the average rather than as a weakness.
        average = (sum(weak.values()) / len(weak)) if weak else 1.0
        # The lesson's focus and what each habit costs, from one cached read. Only for the
        # user's real today: Today's "tomorrow" count needs no order.
        trend = game_trend.day_trend(conn, today) if today == db.today(conn) else None
        chosen = trend["focus"] if trend else None
        first = game_trend.SKILLS[chosen["key"]] if chosen else ()
        # Win% a game, not a mistake count: a habit that fails often in positions that arise
        # often is not thereby the weakest, the same reason patterns.weakness is a rate.
        failing = game_trend.by_layer(trend["costs"]) if trend else {}
        # Stable sort: within a rank, newest games first, as fetched. The newest game's slips
        # lead (they are tonight's story); then the habit costing most comes before the
        # tactic you are weakest at.
        lead = lead_game(conn) if today == db.today(conn) else None
        new.sort(
            key=lambda r: (
                r["game_id"] != lead,
                r["layer"] not in first,
                WEAKEST.get(r["classification"], 1),
                -failing.get(r["layer"], 0),
                weak.get(r["pattern"], average),
            )
        )
    return due + new[:new_room]


def lesson_queue(
    conn, today: date | None = None, now: datetime | None = None, remaining: list[db.Row] | None = None
) -> list[db.Row]:
    """Today's remaining cards for the daily lesson: the newest game's new slips first
    (`lead_game`: a newly analysed game leads the night's watch), then the ones you're most
    likely to have forgotten by now (lowest FSRS retrievability), then other new ones in the
    usual order. `remaining` is today's `queue` when the caller has it already."""
    today = today or db.today(conn)
    rows = queue(conn, today) if remaining is None else remaining
    states = {
        (r["game_id"], r["ply"]): r["fsrs"]
        for r in conn.execute("SELECT game_id, ply, fsrs FROM cards WHERE fsrs IS NOT NULL")
    }
    fsrs, when = scheduler(conn), now or datetime.now(UTC)
    lead = lead_game(conn, when)

    def recall(row):
        state = states.get((row["game_id"], row["ply"]))
        if state is None:
            return (-1 if row["game_id"] == lead else 1, 0.0)
        return (0, fsrs.get_card_retrievability(Card.from_dict(json.loads(state)), when))

    return sorted(rows, key=recall)


def has_family(pattern: str | None) -> bool:
    """Whether a card's tactic can be practised in other positions (puzzles.family_puzzle).
    About a third of mistakes carry no nameable tactic; those have no family."""
    return bool(pattern) and pattern not in patterns.NAMELESS


def holds(stability: float, pattern: str | None, family_solved: bool, days: float) -> bool:
    """Whether a card holds the *idea*, not just the one stored position, for `days`: its own
    schedule is out past `days` and, when it has a family, one of its puzzles has been solved.
    Without a solved family member the evidence is that the diagram is known, which is what
    the whole family idea exists to stop counting. A card with no nameable tactic has no
    family and so rests on its schedule alone."""
    return stability >= days and (family_solved or not has_family(pattern))


def is_mastered(stability: float, pattern: str | None, family_solved: bool) -> bool:
    """Long-term memory: the card holds for MASTERED_DAYS (`holds`). The watch story's
    shorter bar, a move that stopped slipping, is watch.stopped."""
    return holds(stability, pattern, family_solved, MASTERED_DAYS)


def _stability(fsrs_json: str | None) -> float:
    return (json.loads(fsrs_json).get("stability") or 0) if fsrs_json else 0


def stats(
    conn,
    today: date | None = None,
    remaining: list[db.Row] | None = None,
    asked: dict | None = None,
    moves: dict | None = None,
) -> dict:
    """The deck's counts. `remaining` (today's `queue`) and `asked` (drill.plan) save working
    them out again when the caller has them already."""
    today = today or db.today(conn)
    cards = conn.execute(
        """SELECT c.game_id, c.ply, c.reviews, c.fsrs, m.pattern FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.suspended_at IS NULL"""
    ).fetchall()
    suspended = conn.execute("SELECT count(*) FROM cards WHERE suspended_at IS NOT NULL").fetchone()[0]
    families = puzzles.families_solved(conn)
    mastered = sum(
        1 for c in cards if is_mastered(_stability(c["fsrs"]), c["pattern"], (c["game_id"], c["ply"]) in families)
    )
    new = sum(1 for c in cards if c["reviews"] == 0)
    done = len(_reviewed_today(conn, today))
    if asked is None:
        from . import drill  # drill uses the scheduler here

        asked = drill.plan(conn, today)
    if moves is None:
        from . import unannounced  # it judges with this module

        moves = unannounced.plan(conn, today)
    if remaining is None:
        remaining = queue(conn, today)
    kinds = conn.execute(
        """SELECT m.classification AS kind, count(*) AS n FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply WHERE c.suspended_at IS NULL
           GROUP BY m.classification"""
    ).fetchall()
    return {
        "kinds": {k: 0 for k in patterns.KINDS} | {r["kind"]: r["n"] for r in kinds if r["kind"] in patterns.KINDS},
        "total": len(cards),
        "mastered": mastered,
        "learning": len(cards) - mastered - new,
        "new": new,
        # Hidden with "Don't show this again": in none of the counts above.
        "suspended": suspended,
        # Threat questions asked on their own (drill.py) and "Your move" items
        # (unannounced.py) are part of the day's positions.
        "today": {
            "done": done + asked["done"] + moves["done"],
            "total": done + len(remaining) + asked["total"] + moves["total"],
        },
    }


def by_pattern(conn) -> list[dict]:
    """The deck's cards per tactic (the mistake's `moves.pattern`), split into mastered,
    learning and new by the same rule as `stats`. Untagged mistakes count as pending; most
    cards first, with the nameless ones ("other", "pending", "positional") last."""
    cards = conn.execute(
        """SELECT c.game_id, c.ply, coalesce(m.pattern, %s) AS pattern, c.reviews, c.fsrs
           FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.suspended_at IS NULL""",
        (patterns.PENDING,),
    ).fetchall()
    families = puzzles.families_solved(conn)
    by: dict[str, dict] = {}
    for c in cards:
        p = by.setdefault(c["pattern"], {"pattern": c["pattern"], "total": 0, "mastered": 0, "learning": 0, "new": 0})
        p["total"] += 1
        if is_mastered(_stability(c["fsrs"]), c["pattern"], (c["game_id"], c["ply"]) in families):
            p["mastered"] += 1
        elif c["reviews"] == 0:
            p["new"] += 1
    for p in by.values():
        p["learning"] = p["total"] - p["mastered"] - p["new"]
    return sorted(by.values(), key=lambda p: (p["pattern"] in patterns.NAMELESS, -p["total"], p["pattern"]))


def mastered_today(conn, today: date | None = None) -> int:
    """How many positions reached long-term memory today (mastered_today_keys)."""
    return len(mastered_today_keys(conn, today))


def mastered_today_keys(conn, today: date | None = None) -> set[tuple[int, int]]:
    """The (game_id, ply) of positions that reached long-term memory today
    (`crossed_today_keys` at MASTERED_DAYS)."""
    return crossed_today_keys(conn, today, MASTERED_DAYS)


def crossed_today_keys(conn, today: date | None, days: float) -> set[tuple[int, int]]:
    """The (game_id, ply) of positions that came to hold for `days` today (`holds`). Two ways
    in, because that needs both the schedule and the family: today's answer carried the
    stability over `days` while the family was already solved, or today's family puzzle was
    solved on a card whose stability was already there."""
    today = today or db.today(conn)
    start, end = db.day_range(conn, today)
    families = puzzles.families_solved(conn)
    crossed = conn.execute(
        """SELECT DISTINCT r.game_id, r.ply, m.pattern FROM card_reviews r
           JOIN moves m ON m.game_id = r.game_id AND m.ply = r.ply
           WHERE r.reviewed_at >= %s AND r.reviewed_at < %s
             AND r.stability_before < %s AND r.stability_after >= %s""",
        (start, end, days, days),
    ).fetchall()
    done = {
        (r["game_id"], r["ply"])
        for r in crossed
        if (r["game_id"], r["ply"]) in families or not has_family(r["pattern"])
    }
    freed = conn.execute(
        """SELECT DISTINCT a.family_game_id AS game_id, a.family_ply AS ply, c.fsrs, m.pattern
           FROM puzzle_attempts a
           JOIN cards c ON c.game_id = a.family_game_id AND c.ply = a.family_ply
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE a.family_game_id IS NOT NULL AND a.success
             AND a.attempted_at >= %s AND a.attempted_at < %s""",
        (start, end),
    ).fetchall()
    done |= {(r["game_id"], r["ply"]) for r in freed if _stability(r["fsrs"]) >= days}
    return done


def mark(rating: str | None, solved: bool) -> str:
    """How a position went, for the marks on the done screens: found, good move, found with
    help (a retry or a hint), or missed."""
    if rating in ("good", "easy"):
        return "found"
    if rating == "hard":
        return "good"
    return "helped" if solved else "missed"


def today_results(conn, today: date | None = None) -> list[dict]:
    """Today's graded answers in the order given (a card's first answer of the day only),
    with what's needed to name the position ("29…Qxc8 vs woolcap"), the card's next due day
    (the Watch page's "back Thursday") and whether it stopped slipping today
    (watch.stopped_today_keys: the star and its line come together)."""
    today = today or db.today(conn)
    rows = conn.execute(
        """SELECT r.game_id, r.ply, r.correct, r.rating, r.solved, m.san, m.pattern, g.opponent, c.due
           FROM card_reviews r
           JOIN moves m ON m.game_id = r.game_id AND m.ply = r.ply
           JOIN games g ON g.id = r.game_id
           LEFT JOIN cards c ON c.game_id = r.game_id AND c.ply = r.ply
           WHERE r.reviewed_at >= %s AND r.reviewed_at < %s ORDER BY r.reviewed_at, r.id""",
        db.day_range(conn, today),
    ).fetchall()
    from . import watch  # the watch story reads the deck

    stopped = watch.stopped_today_keys(conn, today) if rows else set()
    seen, out = set(), []
    for r in rows:
        if (r["game_id"], r["ply"]) in seen:
            continue
        seen.add((r["game_id"], r["ply"]))
        rating = r["rating"] or ("good" if r["correct"] else "again")
        out.append(
            {
                "game_id": r["game_id"],
                "ply": r["ply"],
                "pattern": r["pattern"],
                "correct": bool(r["correct"]),
                "mark": mark(rating, bool(r["solved"])),
                "san": r["san"],
                "opponent": r["opponent"],
                "due": r["due"],
                "stopped": (r["game_id"], r["ply"]) in stopped,
            }
        )
    return out


class GradeUnavailable(RuntimeError):
    """Engine work failed; do not turn uncertainty into a scheduled failure."""


def quality_from_score(mover, eval_best, after):
    sign = 1 if mover == chess.WHITE else -1
    drop = win_pct(sign * eval_best) - win_pct(sign * after)
    return "excellent" if drop <= GOOD_DROP else "good" if drop <= HARD_DROP else "wrong"


def judge(fen: str, uci: str, best_uci: str, eval_best: int | None) -> str:
    """How good an answer is: 'best' (the engine's move, or any mate), 'excellent' (within
    GOOD_DROP points of win chance), 'good' (within HARD_DROP), 'wrong', or 'shown' (no move).
    Needs Stockfish for anything but the engine's own move; without it, only that counts."""
    if uci == SKIP:
        return "shown"
    if uci == best_uci:
        return "best"
    board = chess.Board(fen)
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return "wrong"
    if move not in board.legal_moves:
        return "wrong"
    mover = board.turn
    board.push(move)
    if board.is_checkmate():
        return "best"
    if eval_best is None:
        return "wrong"
    try:
        with timing.call("engine_startup", chess.engine.SimpleEngine.popen_uci, find_engine(None)) as engine:
            info = timing.call("engine_search", engine.analyse, board, chess.engine.Limit(depth=JUDGE_DEPTH))
    except (SystemExit, chess.engine.EngineError, OSError, TimeoutError) as error:
        raise GradeUnavailable("Could not check this move. Try again.") from error
    after = info["score"].white().score(mate_score=10000)
    return quality_from_score(mover, eval_best, after)


def _load_card(conn, game_id: int, ply: int):
    def load():
        return conn.execute(
            """SELECT c.fsrs, c.due, c.reviews, m.best_uci, m.best_san, m.eval_before,
                      m.mate_before, m.pattern, m.practice_grades, m.practice_line
               FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
               WHERE c.game_id = %s AND c.ply = %s""",
            (game_id, ply),
        ).fetchone()

    card = timing.call("card_load", load)
    if card is None:
        # Game review asks before Finish review has added the game's cards: add them now.
        sync(conn)
        card = timing.call("card_load", load)
    if card is None:
        raise KeyError((game_id, ply))
    return card


def card_line(conn, game_id: int, ply: int) -> tuple[str, list[str]]:
    """(FEN, line) a card is served with; its `practice_lines.key` goes out as `line_key`."""
    from . import practice_lines

    card = _load_card(conn, game_id, ply)
    fen = positions.fen_before(conn, game_id, ply)
    return fen, practice_lines.line_for(card, fen)


def answer(
    conn,
    game_id: int,
    ply: int,
    uci: str | None = None,
    *,
    moves: list[str] | None = None,
    line_key: str | None = None,
    hinted: bool = False,
    redo: bool = False,
    seconds: float | None = None,
    today: date | None = None,
    now: datetime | None = None,
) -> dict:
    """Check an answer: `moves` is every move played from the card's position, ending with
    the learner's new move (or SKIP for Show Solution). A correct move with more of the line
    to come returns the opponent's reply and saves nothing. The first finished answer of the
    day grades the card (Again / Hard / Good / Easy) and FSRS schedules it: a wrong move at
    any step, a hint or Show Solution makes it Again; the line's own moves, each within
    EASY_SECONDS on average (`seconds`: thinking time, summed), make it Easy. Later answers
    that day (a retry, or the end-of-session redo with `redo`) only say how good they are,
    and a retry that finishes the line records the position as found with help.

    `uci` alone is the one-move answer of clients from before lines: it is graded against
    the line's first move only."""
    from . import practice_grades, practice_lines

    today = today or db.today(conn)
    card = _load_card(conn, game_id, ply)
    fen = timing.call("position", positions.fen_before, conn, game_id, ply)
    line = practice_lines.line_for(card, fen)
    if moves is None:
        moves, line = [uci], line[:1]
    elif line_key is not None and line_key != practice_lines.key(fen, line):
        raise practice_lines.LineChanged("This position changed. Reopen it before answering.")
    prepared = practice_grades.cached(card, fen)

    def judge_first(move):
        quality = prepared["grades"].get(move) if prepared else None
        return quality or timing.call("grade", judge, fen, move, card["best_uci"], card["eval_before"])

    result = practice_lines.step(fen, line, moves, judge_first)
    line_san = practice_lines.san_line(fen, line)
    line_san[0] = card["best_san"] or line_san[0]
    expected_san = line_san[len(moves) - 1]
    if result["status"] == "continue":
        reply_san = practice_lines.san_line(fen, moves + [result["reply"]])[-1]
        return {"status": "continue", "step": result["step"], "reply_uci": result["reply"], "reply_san": reply_san}
    quality = result["quality"]
    learner_moves = result["step"] + 1
    with timing.stage("schedule_save"):
        passed = quality in ("best", "excellent", "good")
        state = Card.from_dict(json.loads(card["fsrs"])) if card["fsrs"] else Card()
        rating = None
        if (game_id, ply) not in _reviewed_today(conn, today):
            rating = "again" if hinted or not passed else "hard" if quality == "good" else "good"
            if rating == "good" and result["exact"] and seconds is not None and seconds <= EASY_SECONDS * learner_moves:
                rating = "easy"
            when = now or datetime.now(UTC)
            duration = round(seconds * 1000) if seconds is not None else None
            before = state.stability or 0
            state = _review(scheduler(conn), state, RATING[rating], when, game_id, ply, card["reviews"], duration)
            stamp = db.stamp(when)
            conn.execute(
                """UPDATE cards SET fsrs = %s, due = %s, reviews = reviews + 1, lapses = lapses + %s,
                          last_reviewed_at = %s WHERE game_id = %s AND ply = %s""",
                (
                    json.dumps(state.to_dict()),
                    _local_date(conn, state.due),
                    int(rating == "again"),
                    stamp,
                    game_id,
                    ply,
                ),
            )
            conn.execute(
                """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating, quality,
                                             solved, moves, line_key, stability_before, stability_after)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    game_id,
                    ply,
                    stamp,
                    moves[-1],
                    passed and not hinted,
                    rating,
                    quality,
                    passed,
                    " ".join(moves),
                    practice_lines.key(fen, line),
                    before,
                    state.stability or 0,
                ),
            )
        elif passed and not redo:
            # Found on a retry: it still counts as Again, but the done screen says "with help".
            conn.execute(
                """UPDATE card_reviews SET solved = true WHERE id = (
                     SELECT id FROM card_reviews WHERE game_id = %s AND ply = %s
                       AND reviewed_at >= %s AND reviewed_at < %s ORDER BY reviewed_at, id LIMIT 1)""",
                (game_id, ply, *db.day_range(conn, today)),
            )
        due = _local_date(conn, state.due) if card["fsrs"] or rating else None
        explanation, why = coaching(prepared, fen, line, card["mate_before"], moves, result)
        return {
            "status": result["status"],
            "step": result["step"],
            "correct": passed,
            "quality": quality,
            "rating": rating,
            "best_uci": result["expected"],
            "best_san": expected_san,
            "line": {"uci": line, "san": line_san},
            "due": due,
            "mastered": is_mastered(state.stability or 0, card["pattern"], puzzles.family_solved(conn, game_id, ply)),
            "explanation": explanation,
            "why": why,
            # The top moves with a reason each, from the prepared map (never a search).
            "candidates": prepared.get("candidates") if prepared else None,
        }


def preview(conn, game_id: int, ply: int, now: datetime | None = None) -> dict:
    """When the card would come back for each rating if answered now (a dry run of the
    scheduler, nothing saved), and whether that rating would make it long-term; `mastered`
    is whether it is long-term already. The app shows this after the day's graded answer."""
    card = _load_card(conn, game_id, ply)
    state = Card.from_dict(json.loads(card["fsrs"])) if card["fsrs"] else Card()
    fsrs, when = scheduler(conn), now or datetime.now(UTC)
    solved = puzzles.family_solved(conn, game_id, ply)
    nxt = {}
    for name, rating in RATING.items():
        after = _review(fsrs, state, rating, when, game_id, ply, card["reviews"])
        nxt[name] = {
            "due": _local_date(conn, after.due),
            "mastered": is_mastered(after.stability or 0, card["pattern"], solved),
        }
    return {"next": nxt, "mastered": is_mastered(state.stability or 0, card["pattern"], solved)}


def coaching(
    prepared: dict | None, fen: str, line: list[str], mate_before: int | None, moves: list[str], result: dict
) -> tuple[dict | None, dict | None]:
    """(explanation, why) for a finished answer: the prepared reason for a failed first move,
    and the solution's why (prepared, or from board geometry alone; never a search)."""
    from . import explain

    explanation = None
    if result["status"] == "failed" and len(moves) == 1 and prepared:
        explanation = prepared.get("explanations", {}).get(moves[0])
    why = prepared.get("why") if prepared else explain.why(fen, line, mate_before)
    return explanation, why


def hint(conn, game_id: int, ply: int, moves: list[str] | None = None, line_key: str | None = None) -> dict:
    """The move for the current step, for the two-step Hint (the piece, then the arrow):
    `moves` is the even-length list played so far. Asking makes the day's first answer
    count as Again; the client says so when it answers."""
    from . import practice_lines

    try:
        fen, line = card_line(conn, game_id, ply)
    except KeyError:
        # Game review can ask about one of your moves that isn't a card: its best move.
        row = conn.execute("SELECT best_uci FROM moves WHERE game_id = %s AND ply = %s", (game_id, ply)).fetchone()
        if row is None or not row["best_uci"] or moves:
            raise
        return {"best_uci": row["best_uci"], "from": row["best_uci"][:2]}
    if moves is not None and line_key is not None and line_key != practice_lines.key(fen, line):
        raise practice_lines.LineChanged("This position changed. Reopen it before answering.")
    best = practice_lines.hint_move(line, moves or [])
    return {"best_uci": best, "from": best[:2]}


SUSPEND_REASONS = ("engine_wrong", "not_useful", "already_known")


def suspend(conn, game_id: int, ply: int, reason: str) -> bool:
    """Hide a card with a reason ("Don't show this again"): no grade is recorded and its FSRS
    state is kept. Suspending again keeps the first time and reason. False: no such card."""
    if reason not in SUSPEND_REASONS:
        raise ValueError(reason)
    row = conn.execute(
        """UPDATE cards SET suspended_at = coalesce(suspended_at, %s),
                            suspend_reason = coalesce(suspend_reason, %s)
           WHERE game_id = %s AND ply = %s RETURNING 1""",
        (db.stamp(datetime.now(UTC)), reason, game_id, ply),
    ).fetchone()
    return row is not None


def unsuspend(conn, game_id: int, ply: int) -> bool:
    """Show a hidden card again; its schedule resumes where it was. False: no such card."""
    row = conn.execute(
        "UPDATE cards SET suspended_at = NULL, suspend_reason = NULL WHERE game_id = %s AND ply = %s RETURNING 1",
        (game_id, ply),
    ).fetchone()
    return row is not None


def suspended(conn) -> list[dict]:
    """Hidden cards, most recently hidden first, with what Progress lists them by."""
    return [
        dict(r)
        for r in conn.execute(
            """SELECT c.game_id, c.ply, c.suspended_at, c.suspend_reason AS reason, m.san, m.move_number,
                  m.color, m.pattern, g.opponent, g.played_at
           FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           JOIN games g ON g.id = c.game_id
           WHERE c.suspended_at IS NOT NULL ORDER BY c.suspended_at DESC, c.game_id, c.ply"""
        )
    ]


FORECAST_DAYS = 7
RETENTION_DAYS = 30
MIN_RETENTION_ANSWERS = 20
TARGET_RETENTION = 0.9  # FSRS's desired retention (SCHEDULER's default)


def health(conn, today: date | None = None, now: datetime | None = None) -> dict:
    """Whether reviewing works (review deck quality part 6): the next week's due reviews
    (overdue ones count today; new and hidden cards are left out), the share of the last
    RETENTION_DAYS' graded reviews found without Again (each card's first-ever answer left
    out: that is learning, not remembering), and whether FSRS runs on your own parameters."""
    today = today or db.today(conn)
    rows = conn.execute(
        """SELECT greatest(due, %s) AS day, count(*) AS n FROM cards
           WHERE fsrs IS NOT NULL AND due IS NOT NULL AND suspended_at IS NULL AND due < %s
           GROUP BY 1""",
        (today.isoformat(), (today + timedelta(days=FORECAST_DAYS)).isoformat()),
    ).fetchall()
    due = {r["day"]: r["n"] for r in rows}
    days = [(today + timedelta(days=i)).isoformat() for i in range(FORECAST_DAYS)]
    since = db.stamp((now or datetime.now(UTC)) - timedelta(days=RETENTION_DAYS))
    r = conn.execute(
        """WITH first AS (SELECT game_id, ply, min(reviewed_at) AS at FROM card_reviews
                          WHERE rating IS NOT NULL GROUP BY game_id, ply)
           SELECT count(*) AS answers, count(*) FILTER (WHERE r.rating != 'again') AS kept
           FROM card_reviews r JOIN first f ON f.game_id = r.game_id AND f.ply = r.ply
           WHERE r.rating IS NOT NULL AND r.reviewed_at >= %s AND r.reviewed_at > f.at""",
        (since,),
    ).fetchone()
    answers, kept = r["answers"], r["kept"]
    return {
        "forecast": [{"date": d, "due": due.get(d, 0)} for d in days],
        "retention": (
            {"rate": round(kept / answers, 3), "answers": answers, "target": TARGET_RETENTION}
            if answers >= MIN_RETENTION_ANSWERS
            else None
        ),
        "tuned": tuning(conn)["personal"],
        # Critical "Your move" positions found (unannounced.py), beside the first-try rate.
        "noticing": unannounced_noticing(conn, now),
    }


def unannounced_noticing(conn, now: datetime | None = None) -> dict | None:
    from . import unannounced

    return unannounced.noticing(conn, now)


def card_row(conn, game_id: int, ply: int) -> db.Row | None:
    """A card with its move and game, as review shows it."""
    return conn.execute(
        """SELECT c.game_id, c.ply, c.reviews, c.lapses, m.color, m.san,
                  m.uci, m.move_number, m.classification, m.pattern, m.win_pct_before,
                  prev.uci AS prev_uci, g.opponent, pl.avatar_url AS opponent_avatar,
                  g.played_at, g.time_control, g.speed, g.user_outcome
           FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           JOIN games g ON g.id = c.game_id
           LEFT JOIN moves prev ON prev.game_id = m.game_id AND prev.ply = m.ply - 1
           LEFT JOIN players pl ON pl.source = g.source AND pl.handle = lower(g.opponent)
           WHERE c.game_id = %s AND c.ply = %s""",
        (game_id, ply),
    ).fetchone()


def has_card(conn, game_id: int, ply: int) -> bool:
    return conn.execute("SELECT 1 FROM cards WHERE game_id = %s AND ply = %s", (game_id, ply)).fetchone() is not None
