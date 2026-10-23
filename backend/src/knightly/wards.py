"""Where the learner is in the curriculum, and what that means tonight.

docs/specs/2026-10-20-curriculum-wards-design.md. `curriculum.WARDS` is the ordered course;
this is the part that says which ward someone is in, when it is cleared, and which drills it
asks for. Nothing read WARDS before this module.

### A lesson is held at the Steps Method's bar

The Steps Method gives each lesson about three workbook pages of twelve positions, and a
pupil who gets 80% of a page right is at that level; three or more misses on a page means it
needs another pass. So a lesson is held when, since its post was reached:

- `BASIC_VOLUME` positions of it have been answered (its basic workbook's worth), and at least
  `PAGE_RIGHT` of the last `PAGE` were right first try, or
- a card of your own carrying that tactic is held (`deck.holds`: FSRS stability past the bar
  *and* a family member solved elsewhere), or your games already show the drill's skill, and
  one page here is at the bar. Steps' real gate is the games: what they show needs only one
  page of proof, not the whole volume.

Either route counts, because they are evidence about the same thing from different sources:
the first is "you kept it from your own game", the second "you kept it in practice". A lesson
the corpus cannot serve and your games have never produced stays unheld, and its ward stays
current -- which is honest, and is why ward 1 (board vision, no corpus at all) will sit there
until its drills are built.

### Every post is walked

Only evidence from after a learner reaches a post counts toward it (`entered_at` in the
record), so history never skips one: 325 puzzles solved before the wards existed once cleared
six posts on the day they launched. A post is reached when the one before it clears, and a
post once cleared stays cleared (the record moves forward only).

### Rating places you; it never advances you

`standing.rating()` picks where a learner *starts*, so a 1400 does not drill mate in one. It
does nothing after that: wards advance on held lessons alone. A rating that climbs while the
ideas are not held is exactly the case the curriculum exists to catch.

### Nothing here gates a review

`current` says what new material tonight draws on. It never touches the deck's due cards: a
night with forty reviews and no appetite serves the forty, and the ward does not move.
"""

import json
import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from . import curriculum, db, deck, drill, endgame_drills, endgames, patterns, puzzles

# The Steps Method's bar (see the module docstring): a lesson's basic volume, a workbook page,
# and how many of a page must be right (80%).
BASIC_VOLUME = 36
PAGE = 12
PAGE_RIGHT = 10
# An idea's own Elo, seeded from the learner's overall puzzle ability. Absent evidence about
# forks specifically, assume they are as good at forks as they are at everything, which is
# the same prior `patterns.weakness` shrinks toward.
IDEA_K = 32
# Uncertainty around an idea's estimate, in rating points. An Elo's standard error falls
# roughly as 1/sqrt(n); SIGMA_0 is the spread before any evidence at all, and SIGMA_FLOOR
# stops a long history from ever reading as certainty it has not earned.
SIGMA_0 = 350.0
SIGMA_FLOOR = 60.0
# An idea we are very unsure about is worth serving to find out, even when its estimate
# looks fine. This is the explore half of the priority the weakness model asks for.
PROBE_SIGMA = 250.0
# Everyone starts at the first ward. Placing by rating was tried and removed: it compares a
# Chess.com rapid rating against Lichess puzzle ratings, which are different scales by an
# unmeasured amount (see `puzzles.ability`), and the only ward statistic available to compare
# against is p10 -- "where a theme's easiest examples happen to live", the very signal this
# curriculum replaced. Placing on it sent a 1400 straight to the last ward.
#
# Clearing does the work instead: a ward goes as soon as its lessons are held. Reinstate
# placement when the rating mapping is measured, not before (issue #325).
FIRST_WARD = 1


@dataclass(frozen=True)
class LessonState:
    lesson: curriculum.Lesson
    held: bool
    # Positions of it answered since its post was reached, and how many were right first try.
    answered: int = 0
    solves: int = 0
    # Right first try among the last PAGE answered: the page the bar is judged on.
    page_right: int = 0
    # The learner's estimated ability on this idea and how unsure we are, both in rating
    # points on the corpus's scale; `bar` is the difficulty the estimate is judged against.
    theta: float = 0.0
    sigma: float = SIGMA_0
    bar: float = 0.0

    @property
    def probe(self) -> float:
        """How much serving this would tell us. High when the estimate is a guess."""
        return self.sigma / SIGMA_0


@dataclass(frozen=True)
class WardState:
    ward: curriculum.Ward
    index: int
    state: str  # cleared | current | blocked | ahead
    lessons: tuple[LessonState, ...]

    @property
    def cleared(self) -> bool:
        """Held on every lesson we can actually teach.

        A lesson with no themes can never be held -- there is nothing to solve and no tactic
        to match a card against -- so gating on it would park the learner forever. Seven of
        the eighteen wards contain one. They stay visible as unheld, because they are things
        the learner has genuinely not been taught, but they do not block the ward."""
        teachable = [lesson for lesson in self.lessons if lesson.lesson.servable]
        return bool(teachable) and all(lesson.held for lesson in teachable)

    @property
    def servable(self) -> bool:
        """Whether any of this ward's lessons has drills to serve. Ward 1 -- board vision,
        attacking and defending, the profitable exchange -- has none: Lichess has no theme
        for any of them, so it waits on drills of our own."""
        return any(lesson.lesson.servable for lesson in self.lessons)


def _answers(conn, today: date | None = None) -> list[tuple[str, list[str], bool]]:
    """Puzzle first tries over RECENT_DAYS, oldest first: (when, themes, right). Counted per
    lesson from the day its post was reached (`_since`).

    **Every source, not just ours.** A puzzle solved on Lichess is the same evidence as one
    solved here, and `puzzles.ability` has always counted both. Windowed, because holding an
    idea is a claim about now: someone returning after a year does not skip half the course
    on evidence that has decayed."""
    since = db.stamp(
        datetime.combine(today or db.today(conn), datetime.min.time()) - timedelta(days=patterns.RECENT_DAYS)
    )
    rows = conn.execute(
        """SELECT attempted_at, themes, success FROM puzzle_attempts
           WHERE themes IS NOT NULL AND attempted_at >= %s ORDER BY attempted_at, id""",
        (since,),
    ).fetchall()
    return [
        (
            r["attempted_at"],
            json.loads(r["themes"]) if isinstance(r["themes"], str) else (r["themes"] or []),
            bool(r["success"]),
        )
        for r in rows
    ]


def _drill_answers(conn, today: date | None = None) -> list[tuple[str, str, bool]]:
    """Drill first answers over RECENT_DAYS, oldest first: (when, drill kind, right). How a
    lesson with no Lichess theme is held. Graded answers only (`rating IS NOT NULL`), as the
    deck counts them."""
    since = db.stamp(
        datetime.combine(today or db.today(conn), datetime.min.time()) - timedelta(days=patterns.RECENT_DAYS)
    )
    rows = conn.execute(
        """SELECT r.reviewed_at, t.kind, r.correct FROM threat_reviews r
           JOIN threat_cards t ON t.game_id = r.game_id AND t.ply = r.ply
           WHERE r.rating IS NOT NULL AND r.reviewed_at >= %s
           ORDER BY r.reviewed_at, r.id""",
        (since,),
    ).fetchall()
    return [(r["reviewed_at"], r["kind"], bool(r["correct"])) for r in rows]


def page(results: list[bool]) -> tuple[int, int, int]:
    """(answered, right, right on the last PAGE) for one lesson's answers, oldest first."""
    return len(results), sum(results), sum(results[-PAGE:])


def held_at_bar(answered: int, page_right: int, volume: int = BASIC_VOLUME) -> bool:
    """The Steps bar: `volume` answered and PAGE_RIGHT of the last PAGE right."""
    return answered >= volume and page_right >= PAGE_RIGHT


def _since(entry: dict | None) -> str | None:
    """When a post was reached, as the tables stamp time; None before it is."""
    if not entry:
        return None
    return entry.get("entered_at") or (f"{entry['entered']}T00:00:00Z" if entry.get("entered") else None)


def _attempts(conn, today: date | None = None) -> list[dict]:
    """Every rated puzzle try in the window, oldest first, with its themes. One read: the
    per-idea estimates all replay over the same rows."""
    since = db.stamp(
        datetime.combine(today or db.today(conn), datetime.min.time()) - timedelta(days=patterns.RECENT_DAYS)
    )
    rows = conn.execute(
        """SELECT themes, success, puzzle_rating FROM puzzle_attempts
           WHERE themes IS NOT NULL AND puzzle_rating IS NOT NULL AND attempted_at >= %s
           ORDER BY attempted_at, id""",
        (since,),
    ).fetchall()
    out = []
    for r in rows:
        themes = json.loads(r["themes"]) if isinstance(r["themes"], str) else (r["themes"] or [])
        out.append({"themes": set(themes), "success": bool(r["success"]), "rating": r["puzzle_rating"]})
    return out


def estimate(attempts: list[dict], themes: tuple[str, ...], seed: float) -> tuple[float, float, int]:
    """(theta, sigma, n) for one idea: an Elo over the tries carrying any of its themes.

    Seeded from the learner's overall puzzle ability, because absent evidence about forks
    specifically the best guess is that they are as good at forks as at everything else --
    the same prior `patterns.weakness` shrinks thin motifs toward.

    Sigma falls as evidence accumulates, roughly as an Elo's standard error does, and never
    below SIGMA_FLOOR: a hundred fork puzzles is strong evidence, not certainty.
    """
    theta, n = float(seed), 0
    for a in attempts:
        if not (a["themes"] & set(themes)):
            continue
        expected = 1 / (1 + 10 ** ((a["rating"] - theta) / 400))
        theta += IDEA_K * ((1 if a["success"] else 0) - expected)
        n += 1
    sigma = max(SIGMA_FLOOR, SIGMA_0 / math.sqrt(1 + n))
    return theta, sigma, n


_BANDS: dict[int, dict[str, float]] = {}


def bands(conn) -> dict[str, float]:
    """Each ward's typical drill difficulty, keyed by ward. Cached on the corpus size: the
    bands are a property of the corpus and not of the learner, and `state` runs on every
    deck read, so deriving eighteen of them per request would be eighteen queries for an
    answer that only changes when the puzzles are re-imported."""
    size = conn.execute("SELECT count(*) FROM lichess_puzzles").fetchone()[0]
    if size not in _BANDS:
        _BANDS[size] = {r["key"]: float(r["median"] or 0) for r in curriculum.derive(conn)}
    return _BANDS[size]


def _held_tactics(conn) -> set[str]:
    """Tactics the learner holds from their own games: a card past the bar whose family has
    been met elsewhere (`deck.holds`), which is the same test a star uses."""
    families = puzzles.families_solved(conn)
    rows = conn.execute(
        """SELECT c.game_id, c.ply, c.fsrs, m.pattern FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.suspended_at IS NULL AND m.pattern IS NOT NULL"""
    ).fetchall()
    return {
        r["pattern"]
        for r in rows
        if deck.holds(
            deck._stability(r["fsrs"]), r["pattern"], (r["game_id"], r["ply"]) in families, deck.MASTERED_DAYS
        )
    }


def entry(conn, at: int | None = None) -> int:
    """The ward a learner starts in. Always the first: see FIRST_WARD for why rating does
    not place anyone, and why clearing is trusted to move a strong player along quickly."""
    return FIRST_WARD


def state(conn, at: int | None = None, today: date | None = None) -> list[WardState]:
    """Every ward with its lessons' evidence: cleared behind, one current, the rest ahead."""
    answers, held_tactics, drills = _answers(conn), _held_tactics(conn), _drill_answers(conn)
    attempts, overall, band = _attempts(conn), float(puzzles.ability(conn)), bands(conn)
    reached = db.get_setting(conn, REACHED_SETTING) or {}
    start = entry(conn, at)
    out: list[WardState] = []
    current_found = False
    for index, ward in enumerate(curriculum.WARDS, start=1):
        # Only what was answered since this post was reached counts toward it; a post not
        # yet reached has nothing.
        since = _since(reached.get(ward.key))
        lessons = []
        for lesson in ward.lessons:
            # A lesson is evidenced by its puzzle themes, or by the drill that teaches it
            # where no theme exists (ward 1), or by a card of your own carrying the tactic.
            themes = set(lesson.themes)
            results = (
                [] if since is None else [right for at_, ts, right in answers if at_ >= since and themes & set(ts)]
            )
            if lesson.drill and since is not None:
                drilled = [right for at_, kind, right in drills if at_ >= since and kind == lesson.drill]
                results = max(results, drilled, key=len)
            answered, solves, page_right = page(results)
            # The estimate no longer decides holding (the Steps bar does); it still orders
            # what is worth serving (`priority`).
            theta, sigma, _ = estimate(attempts, lesson.themes, overall)
            bar = band.get(ward.key, 0.0)
            by_practice = lesson.servable and held_at_bar(answered, page_right)
            # Held by the games themselves: a card carrying the tactic for a themed lesson,
            # or -- for a lesson taught by a drill -- the learner already doing it at the
            # board. Those still show one page here, at the bar.
            by_game = any(theme in held_tactics for theme in lesson.themes)
            if not by_game and lesson.drill:
                by_game = drill.held_in_games(conn, lesson.drill)
            held = by_practice or (by_game and held_at_bar(answered, page_right, PAGE))
            lessons.append(LessonState(lesson, held, answered, solves, page_right, theta, sigma, bar))
        teachable = [lesson for lesson in lessons if lesson.lesson.servable]
        done = bool(teachable) and all(lesson.held for lesson in teachable)
        servable = bool(teachable)
        if index < start or ((reached.get(ward.key) or {}).get("cleared") and not current_found):
            label = "cleared"  # placed past it, or cleared once: the walk moves forward only
        elif not servable and not done:
            # Its drills do not exist yet. It must not read as cleared -- that would claim
            # the learner has an idea nobody has taught them -- and it must not trap them
            # either, since nothing it asks for can ever be answered.
            label = "blocked"
        elif done and not current_found:
            label = "cleared"
        elif not current_found:
            label, current_found = "current", True
        else:
            label = "ahead"
        out.append(WardState(ward, index, label, tuple(lessons)))
    if not current_found and out:  # every ward held: stay in the last rather than fall off
        last = out[-1]
        out[-1] = WardState(last.ward, last.index, "current", last.lessons)
    # The post just reached starts counting now, whichever read noticed it first (practice
    # may move the learner on before the path is next drawn).
    now_at = next(w for w in out if w.state == "current")
    if now_at.ward.key not in reached:
        reached = {**reached, now_at.ward.key: _entered(conn, today)}
        db.set_setting(conn, REACHED_SETTING, reached)
    return out


def _entered(conn, today: date | None = None) -> dict:
    """A record entry for a post reached now."""
    return {
        "entered": (today or db.today(conn)).isoformat(),
        "entered_at": db.stamp(datetime.now(UTC)),
        "cleared": None,
    }


def current(conn, at: int | None = None) -> WardState:
    """The ward tonight's new material comes from: the first unfinished one that can
    actually be served. A blocked ward is skipped for serving and stays visible as
    unfinished, so the gap is honest rather than hidden."""
    return next(w for w in state(conn, at) if w.state == "current")


def drill_themes(conn, at: int | None = None) -> list[tuple[str, str | None]]:
    """(theme, shape) pairs the current ward wants drilled, its unheld lessons first."""
    return _themes_of(current(conn, at))


def priority(lesson: LessonState) -> float:
    """How much this lesson is worth serving: how far below its bar the learner is thought
    to be, plus what serving it would teach us about an estimate we are unsure of.

    The second term is the explore half the weakness model asks for. Without it an idea we
    know nothing about never gets picked, because a guessed estimate sits at the learner's
    overall ability and so rarely looks like a deficit."""
    deficit = max(0.0, lesson.bar - lesson.theta)
    return deficit + PROBE_SIGMA * lesson.probe


def _themes_of(ward: WardState) -> list[tuple[str, str | None]]:
    """A ward's (theme, shape) pairs, worth-serving first: unheld before held, and within
    each the biggest deficit-plus-probe. Held lessons stay in the list so a nearly finished
    ward still has something to serve."""
    ordered = sorted(ward.lessons, key=lambda lesson: (lesson.held, -priority(lesson)))
    pairs: list[tuple[str, str | None]] = []
    for lesson in ordered:
        pairs.extend((theme, lesson.lesson.shape) for theme in lesson.lesson.themes)
    # Practice themes last: volume for a drill-taught lesson, never ahead of real themes.
    for lesson in ordered:
        pairs.extend((theme, None) for theme in lesson.lesson.practice if (theme, None) not in pairs)
    return pairs


def current_drills(conn, at: int | None = None) -> list[str]:
    """The drill kinds (drill.py) that teach the current post's lessons from the learner's own
    games, unheld lessons first: what its idea slots serve before any puzzle."""
    ward = current(conn, at)
    ordered = sorted(ward.lessons, key=lambda lesson: lesson.held)
    return list(dict.fromkeys(lesson.lesson.drill for lesson in ordered if lesson.lesson.drill))


# How many moves of yours a lesson's puzzles ask for, by the Steps Method step it comes from:
# the method deepens calculation on purpose, half a move in Step 1 (one move wins), one and a
# half in Step 2, two and a half by Step 4. Our generated endgame drills are technique lines
# and keep their length.
DEPTH = {"1": 1, "1+": 1, "2": 2, "2+": 2, "2ta": 2, "3": 2, "3+": 3, "4": 3}


def depth(lesson: curriculum.Lesson, theme: str) -> int | None:
    """The most moves of yours a puzzle for this lesson's `theme` should ask for, or None."""
    return None if theme in endgame_drills.THEMES else DEPTH.get(lesson.step)


def ward_puzzle(conn, today: date | None = None, at: int | None = None) -> dict | None:
    """A puzzle for the current ward: its unheld lessons first, respecting each lesson's
    shape. None when the ward has nothing the corpus can serve -- the caller falls back to
    the weakness order rather than serving nothing."""
    today = today or db.today(conn)
    ward = current(conn, at)  # one pass over the evidence, not one per theme
    deepest: dict[str, int | None] = {}
    for lesson in ward.lessons:
        for theme in (*lesson.lesson.themes, *lesson.lesson.practice):
            deepest.setdefault(theme, depth(lesson.lesson, theme))
    for theme, shape in _themes_of(ward):
        puzzle = puzzles.themed_puzzle(conn, theme, today, deepest.get(theme))
        if puzzle and (shape is None or endgames.matches(puzzle["fen_prev"], shape)):
            return {**puzzle, "ward": ward.ward.key, "theme": theme}
    return None


# Days until a lesson from a passed post comes back for review, by how many of its reviews in
# a row were right: a miss starts it over. Expanding intervals, as any spaced-repetition
# schedule; each review is a fresh position of the idea, never one seen before.
REVIEW_DAYS = (2, 4, 8, 16, 32, 64, 128)


def review_schedule(conn, today: date | None = None, at: int | None = None) -> list[tuple[date, LessonState]]:
    """Every lesson with puzzle themes in a post the learner has passed, with the day it is due
    for review, soonest first. Its clock starts the day its post was cleared; answers on its
    themes since then move it along REVIEW_DAYS, a wrong one back to the start."""
    today = today or db.today(conn)
    states = state(conn, at)
    current_index = next(w.index for w in states if w.state == "current")
    reached = db.get_setting(conn, REACHED_SETTING) or {}
    answers = _answers(conn, today)
    out = []
    for ward in states:
        if ward.index >= current_index:
            continue
        cleared = (reached.get(ward.ward.key) or {}).get("cleared") or today.isoformat()
        for lesson in ward.lessons:
            themes = set(lesson.lesson.themes) | set(lesson.lesson.practice)
            if not themes:
                continue
            last, streak = date.fromisoformat(cleared), 0
            for at_, ts, right in answers:
                if at_[:10] < cleared or not themes & set(ts):
                    continue
                last = max(last, date.fromisoformat(at_[:10]))
                streak = streak + 1 if right else 0
            due = last + timedelta(days=REVIEW_DAYS[min(streak, len(REVIEW_DAYS) - 1)])
            out.append((due, lesson))
    return sorted(out, key=lambda pair: (pair[0], pair[1].lesson.key))


def review_puzzle(conn, today: date | None = None, at: int | None = None) -> dict | None:
    """A fresh puzzle for the lesson from a passed post that is most overdue for review, for the
    watch's mixed review: served unannounced, so the learner has to recognise which idea it
    is (the Steps Method's Mix, used during the next step). None before the learner has
    passed a post with puzzles."""
    today = today or db.today(conn)
    for _, lesson in review_schedule(conn, today, at):
        themes = list(lesson.lesson.themes) + [t for t in lesson.lesson.practice if t not in lesson.lesson.themes]
        for theme in themes:
            puzzle = puzzles.themed_puzzle(conn, theme, today, depth(lesson.lesson, theme))
            shape = lesson.lesson.shape if theme in lesson.lesson.themes else None
            if puzzle and (shape is None or endgames.matches(puzzle["fen_prev"], shape)):
                return puzzle
    return None


# The forward-only record of wards reached (docs/specs/2026-10-20-ward-path-design.md,
# "Posts reached and ranks"): {ward key: {"entered": day, "cleared": day | None}}. State is
# derived on every read and can regress when a held card lapses; this cannot. First dates
# only, never unset, so a rank stays reached and a ward that slipped and cleared again is
# not news.
REACHED_SETTING = "wards_reached"
# A rank castle stands after every third ward (watch.RANKS keys, Squire I onward). Knight
# III stands at the keep, beyond the wards built so far, and no ward reaches it.
POSTS_PER_RANK = 3
POST_RANKS = ("squire-1", "squire-2", "squire-3", "knight-1", "knight-2")


def record(conn, states: list[WardState], today: date) -> dict:
    """Stamp the first day each ward was entered and cleared. A cleared ward was entered
    too; the current one is entered. Writes only when something is new."""
    saved = db.get_setting(conn, REACHED_SETTING) or {}
    reached = {key: dict(value) for key, value in saved.items()}
    day = today.isoformat()
    now = db.stamp(datetime.now(UTC))
    for ward in states:
        if ward.state not in ("current", "cleared"):
            continue
        entry = reached.setdefault(ward.ward.key, {"entered": day, "entered_at": now, "cleared": None})
        entry.setdefault("entered", day)
        if ward.state == "cleared" and not entry.get("cleared"):
            entry["cleared"] = day
    if reached != saved:
        db.set_setting(conn, REACHED_SETTING, reached)
    return reached


def post_ranks(conn) -> dict[str, str]:
    """{rank key: day} for each rank castle every ward before it has ever cleared, from the
    record alone (cheap enough for /api/home). A ward nothing can serve never counts for or
    against a rank; the day is the last of those wards' first clears."""
    reached = db.get_setting(conn, REACHED_SETTING) or {}
    out: dict[str, str] = {}
    for i, key in enumerate(POST_RANKS, start=1):
        before = [w for w in curriculum.WARDS[: i * POSTS_PER_RANK] if any(lesson.servable for lesson in w.lessons)]
        days = [(reached.get(w.key) or {}).get("cleared") for w in before]
        if not before or not all(days):
            break
        out[key] = max(d for d in days if d)
    return out


def as_json(ward: WardState, reached: dict | None = None) -> dict:
    """One ward as the API sends it (schemas.WardOut)."""
    entry = (reached or {}).get(ward.ward.key) or {}
    return {
        "key": ward.ward.key,
        "name": ward.ward.name,
        "index": ward.index,
        "state": ward.state,
        "entered_on": entry.get("entered"),
        "cleared_on": entry.get("cleared"),
        "lessons": [
            {
                "key": lesson.lesson.key,
                "name": lesson.lesson.name,
                "track": lesson.lesson.track,
                "step": lesson.lesson.step,
                "held": lesson.held,
                "solves": lesson.solves,
                "answered": lesson.answered,
                "page_right": lesson.page_right,
                "ability": round(lesson.theta),
                "uncertainty": round(lesson.sigma),
                "bar": round(lesson.bar),
                "teachable": lesson.lesson.servable,
            }
            for lesson in ward.lessons
        ],
    }


def path(conn, today: date | None = None, at: int | None = None) -> list[dict]:
    """Every ward in order, as the home path's nodes, with the first days each was entered
    and cleared. Records them, so call it in a transaction."""
    today = today or db.today(conn)
    states = state(conn, at, today)
    reached = record(conn, states, today)
    return [as_json(w, reached) for w in states]
