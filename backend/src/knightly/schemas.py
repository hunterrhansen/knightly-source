"""Request and response bodies of the HTTP API, as they appear in its OpenAPI contract."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AccountIn(BaseModel):
    source: str
    handle: str


class LinkedAccountOut(BaseModel):
    source: str
    handle: str


class LookupAccountOut(LinkedAccountOut):
    rating: int | None
    rating_kind: str | None
    games: int
    since: str | None


class ImportSummaryOut(BaseModel):
    blunders: int
    mistakes: int
    misses: int
    positions: int
    pattern: str | None


class ImportFindingOut(BaseModel):
    opponent: str | None
    played_at: str | None
    move_number: int
    color: str
    san: str
    best_san: str
    classification: str


class OnboardingOut(BaseModel):
    accounts: list[LinkedAccountOut]
    games: int
    analysed: int
    target: int
    working: bool
    step: str | None
    findings: list[ImportFindingOut]
    summary: ImportSummaryOut


class ImportStatusOut(BaseModel):
    accounts: list[dict]
    queued: list[str]
    current_run: dict | None
    last_run: dict | None


class SlipsOut(BaseModel):
    """A game's moves that slipped past (its review cards) by where they are on the watch
    (watch.py)."""

    on_watch: int
    held: int
    stopped: int


class WeekOut(SlipsOut):
    """The last seven days of games for the Games summary card; hidden while `analysed` is 0."""

    games: int
    analysed: int
    slipped: int


class GameListItemOut(BaseModel):
    # Preserve legacy list metadata while documenting the fields this client consumes.
    model_config = {"extra": "allow"}
    id: int
    opponent: str | None
    played_at: str | None
    speed: str | None
    outcome: str | None
    analysed: bool
    color: Literal["white", "black"] | None
    opponent_rating: int | None
    # The opponent's Chess.com avatar, when their profile has one (players.py). Absent for
    # Lichess and PGN imports, where the app shows their initials.
    opponent_avatar: str | None = None
    opening: str | None
    eco: str | None
    time_control: str | None
    accuracy: float | None
    reviewed_at: str | None
    # Null until the game is analysed; all zero for an analysed game with no slips (Clean).
    slips: SlipsOut | None = None


class GameReviewCountsOut(BaseModel):
    all: int
    to_review: int
    reviewed: int


class SkillGamePartOut(BaseModel):
    found: int
    chances: int


class SkillPracticePartOut(BaseModel):
    solved: int
    tries: int


class SkillPartsOut(BaseModel):
    games: SkillGamePartOut
    practice: SkillPracticePartOut


class SkillPeriodOut(BaseModel):
    score: int | None = Field(ge=0, le=100)
    reason: Literal["few_games", "few_chances"] | None
    successes: int
    attempts: int
    games: int
    excluded: int


class SkillAxisOut(SkillPeriodOut):
    key: Literal["safety", "tactics", "calculation", "converting", "defending"]
    parts: SkillPartsOut | None = None
    previous: SkillPeriodOut | None


class SkillShapeOut(BaseModel):
    version: int
    axes: list[SkillAxisOut] = Field(min_length=5, max_length=5)


class TrendPracticeOut(BaseModel):
    recent: int
    earlier: int


class TrendSkillOut(BaseModel):
    key: Literal["safety", "tactics", "calculation"]
    recent: int
    earlier: int
    cost: float | None
    change: Literal["fewer", "same", "more"] | None
    practice: TrendPracticeOut


class GameTrendOut(BaseModel):
    version: int
    window: int
    games: int
    reason: Literal["few_games"] | None
    since: str | None
    skills: list[TrendSkillOut] = Field(min_length=3, max_length=3)


class OverviewOut(BaseModel):
    """Only `skill_shape` and `game_trend` are typed so far; the other overview fields pass
    through as they are."""

    model_config = ConfigDict(extra="allow")
    skill_shape: SkillShapeOut | None = None
    game_trend: GameTrendOut | None = None


class GamesListOut(BaseModel):
    total: int
    page: int
    page_size: int
    counts: dict[str, int]
    games: list[GameListItemOut]
    review_counts: GameReviewCountsOut
    next_review: GameListItemOut | None
    week: WeekOut


class StreakDayOut(BaseModel):
    date: str
    state: Literal["done", "frozen", "rest", "missed", "none", "today", "upcoming"]
    # A done day's night in its streak (1-based; frozen days add none); null otherwise.
    night: int | None = None


class StreakDaysOut(BaseModel):
    days: list[StreakDayOut]


class UpdateQueuedOut(BaseModel):
    started: bool
    queued: bool


UciStep = Annotated[str, Field(pattern=r"^([a-h][1-8][a-h][1-8][qrbn]?|0000)$")]
LineKey = Annotated[str, Field(pattern=r"^[0-9a-f]{16}$")]


class ThreatAnswerIn(BaseModel):
    expected_day: date | None = None
    game_id: int
    ply: int
    # The opponent's threat, played on the board (UCI), or "none" for No threat.
    answer: Annotated[str, Field(pattern=r"^([a-h][1-8][a-h][1-8][qrbn]?|none)$")]
    seconds: float | None = Field(None, ge=0, le=86400)


class AnswerIn(BaseModel):
    expected_day: date | None = None  # opt-in guard for interrupted native answers
    game_id: int
    ply: int
    # Every move played from the position, learner moves at even indexes, ending with the
    # new learner move (0000: Show Solution). `uci` alone is the one-move answer of clients
    # from before lines.
    moves: list[UciStep] | None = Field(None, min_length=1, max_length=31)
    line_key: LineKey | None = None  # the line the position was served with
    uci: UciStep | None = None
    hinted: bool = False  # took a hint before this first answer: it counts as Again
    seconds: float | None = Field(None, ge=0, le=86400)  # thinking time of the first try (Easy)
    redo: bool = False  # the end-of-session redo: judged, never graded

    @model_validator(mode="after")
    def _one_answer(self):
        if (self.moves is None) == (self.uci is None):
            raise ValueError("Send either moves or uci.")
        return self


class CardIn(BaseModel):
    game_id: int
    ply: int


class SuspendIn(CardIn):
    reason: Literal["engine_wrong", "not_useful", "already_known"]


class SuspendedCardOut(BaseModel):
    game_id: int
    ply: int
    suspended_at: str
    reason: Literal["engine_wrong", "not_useful", "already_known"] | None
    san: str
    move_number: int
    color: str
    pattern: str | None
    opponent: str | None
    played_at: str | None


class UnannouncedAnswerIn(BaseModel):
    game_id: int
    ply: int
    moves: list[UciStep] = Field(min_length=1, max_length=1)
    expected_day: date | None = None
    hinted: bool = False
    seconds: float | None = Field(None, ge=0, le=3600)


class HintIn(BaseModel):
    game_id: int
    ply: int
    moves: list[UciStep] | None = Field(None, max_length=30)  # the moves played so far
    line_key: LineKey | None = None


class PuzzleAnswerIn(BaseModel):
    expected_day: date | None = None
    id: str = Field(pattern=r"^[A-Za-z0-9]{1,16}$")
    moves: list[UciStep] = Field(min_length=1, max_length=31)
    line_key: LineKey | None = None
    hinted: bool = False
    redo: bool = False


class PuzzleHintIn(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9]{1,16}$")
    moves: list[UciStep] = Field(default_factory=list, max_length=30)
    line_key: LineKey | None = None


class StepMarkIn(BaseModel):
    ply: int = Field(ge=1)
    mark: Literal["found", "good", "helped", "missed", "praise", "seen"]


class ReviewIn(BaseModel):
    marks: list[StepMarkIn] = Field(default=[], max_length=200)


class AnalysisIn(BaseModel):
    nodes: int = Field(ge=50_000, le=5_000_000)  # positions Stockfish searches per move


class PracticeIn(BaseModel):
    pace: Literal["light", "standard", "intense"]  # new review positions a day: deck.PACES


class TimezoneIn(BaseModel):
    timezone: str = Field(min_length=1, max_length=64)  # IANA name: "America/Denver"


class WatchIn(BaseModel):
    # Local wall-clock time on a 15-minute grid.
    time: str = Field(pattern=r"^([01][0-9]|2[0-3]):(00|15|30|45)$")
    # The habit after "After I", one line: "finish dinner".
    anchor: str = Field(max_length=200)

    @field_validator("anchor")
    @classmethod
    def one_short_line(cls, value: str) -> str:
        value = value.strip()
        if "\n" in value or "\r" in value or not 2 <= len(value) <= 60:
            raise ValueError("The anchor is one line of 2 to 60 characters.")
        return value


class PositionPreviewIn(BaseModel):
    fen: str = Field(max_length=200)
    moves: list[str] = Field(default=[], max_length=256)


class PublicConfigOut(BaseModel):
    clerk_publishable_key: str | None
    contact: str | None


class AccountLimitsOut(BaseModel):
    history_months: int | None
    max_analysed: int | None
    max_accounts: int


class MeOut(BaseModel):
    admin: bool
    limits: AccountLimitsOut


class HttpErrorOut(BaseModel):
    detail: str


# Responses typed after the fact: their documented fields are checked and typed in the
# contract, and any other field passes through unchanged. A field is optional (`| None`)
# whenever its source column or expression can be NULL, or a response fails validation. Routes using them set
# response_model_exclude_unset, so an optional field the route didn't send stays absent.
class OpenOut(BaseModel):
    model_config = ConfigDict(extra="allow")


class StreakOut(OpenOut):
    """The streak as of today (daily.streak)."""

    count: int
    best: int
    freezes: int
    safe_today: bool
    last_kept: str | None
    # Every night kept, all time; frozen days are not kept.
    nights_total: int
    week: list[StreakDayOut]


class OkOut(BaseModel):
    ok: bool


class AdminOut(OpenOut):
    queued: list[dict]
    running: list[dict]
    failed: list[dict]
    last_day: dict[str, int]
    database_bytes: int
    users: list[dict]


class DoneTotalOut(OpenOut):
    done: int
    total: int


class FocusOut(OpenOut):
    key: Literal["safety", "tactics", "calculation"]
    cost: int | float
    window: int


class AnalysedGamesOut(OpenOut):
    analyzed: int
    pending: int


class PuzzleSessionOut(OpenOut):
    done: int
    session: int
    available: bool


class RatingPreviewOut(OpenOut):
    due: str
    mastered: bool


class DeckCardOut(OpenOut):
    game_id: int
    ply: int
    reviews: int
    lapses: int
    color: str
    san: str
    uci: str
    move_number: int
    classification: str | None
    pattern: str | None
    win_pct_before: float | None
    prev_uci: str | None
    opponent: str | None
    # The opponent's Chess.com avatar (players.py), shown under the board with their name.
    opponent_avatar: str | None = None
    played_at: str | None
    time_control: str | None
    speed: str | None
    user_outcome: str | None
    leech: bool
    fen_before: str | None
    fen_prev: str | None
    feedback: dict | None
    line: list[str | None]  # its one best move when no line is stored, which may be null
    line_key: str
    threat: dict | None
    mastered: bool
    next: dict[str, RatingPreviewOut]


class ExtraWatchOut(BaseModel):
    """An extra watch's progress, and the extra watches kept tonight (this one once done)."""

    done: int
    total: int
    kept: int


class WardLessonOut(BaseModel):
    """One lesson of a ward, and whether the learner is holding it."""

    key: str
    name: str
    track: str
    # Which Steps Method lesson this follows ("2", "3+"). Provenance, not shown to a learner.
    step: str
    held: bool
    # Puzzles of its themes solved first try. 0 for a lesson with no drills yet.
    solves: int
    # The learner's estimated ability on this idea, how unsure that estimate is, and the
    # difficulty it is judged against -- all rating points on the corpus's scale. A lesson
    # is held when ability minus uncertainty clears the bar, not when solves reaches a
    # count: three easy puzzles are three solves and no evidence about a hard idea.
    ability: int = 0
    uncertainty: int = 0
    bar: int = 0
    # False when no corpus can serve it: board vision, the golden rules, thinking ahead.
    teachable: bool


class WardOut(BaseModel):
    """A section of the curriculum. `state` is "cleared", "current", "ahead", or "blocked"
    when the ward's drills do not exist yet -- blocked never clears and never blocks."""

    key: str
    name: str
    index: int
    state: Literal["cleared", "current", "ahead", "blocked"]
    # The first days it was entered and cleared (wards.REACHED_SETTING): forward-only, so a
    # ward that slipped since keeps them. Null while it never has been.
    entered_on: str | None = None
    cleared_on: str | None = None
    lessons: list[WardLessonOut]


class DeckOut(OpenOut):
    """A practice session's state and its next item (`card`, `threat_item`,
    `unannounced_item` or `puzzle`; none when today's are done)."""

    total: int
    new: int
    learning: int
    mastered: int
    suspended: int
    kinds: dict[str, int]
    today: DoneTotalOut
    server_day: str
    # The ward tonight's new material comes from, null before the backend serves wards.
    ward: WardOut | None = None
    # What kind of practice this serving is, after the Steps Method's workbook variants:
    # `taught` the ward's idea announced, `volume` more of an idea already met, `defend`
    # what they threaten or what your move allowed, `unannounced` with no sign anything is
    # there, `review` an earlier post's idea served unannounced for mixed review. Null for a
    # review card, which is the learner's own position rather than a way of serving an idea.
    mode: Literal["taught", "volume", "defend", "unannounced", "review"] | None = None
    games: AnalysedGamesOut
    results: list[dict]
    lesson: DoneTotalOut
    focus: FocusOut | None
    puzzle: dict | None
    puzzles: PuzzleSessionOut
    puzzle_results: list[dict]
    card: DeckCardOut | None
    threat_item: dict | None
    unannounced_item: dict | None
    extra: ExtraWatchOut | None = None  # mode=extra and POST /api/lesson/extra only


class AnswerLineOut(OpenOut):
    uci: list[str]
    san: list[str]


class AnswerOut(OpenOut):
    """A step of a line answer: `continue` with the opponent's reply, or the final result
    (`solved`, `failed` or `shown`) with the grade and the whole line."""

    status: Literal["continue", "solved", "failed", "shown"]
    step: int
    reply_uci: str | None = None
    reply_san: str | None = None
    correct: bool | None = None
    quality: str | None = None
    rating: str | None = None
    best_uci: str | None = None
    best_san: str | None = None
    line: AnswerLineOut | None = None
    due: str | None = None
    mastered: bool | None = None
    explanation: dict | None = None
    why: dict | None = None


class DeckAnswerOut(AnswerOut):
    candidates: list | None = None


class PuzzleAnswerOut(AnswerOut):
    recorded: bool | None = None
    done_today: int | None = None


class UnannouncedAnswerOut(DeckAnswerOut):
    unannounced: str


class ThreatAnswerOut(OpenOut):
    correct: bool
    rating: str | None
    due: str | None
    threats: list[dict]


class HintOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    best_uci: str
    from_: str = Field(alias="from")


class FeedbackOut(BaseModel):
    feedback: dict | None


class LearnMoreOut(BaseModel):
    added: int
    day: str


class SuspendedOut(BaseModel):
    suspended: bool


class EngineLineOut(OpenOut):
    start_fen: str
    moves: list[str]
    summary: str | None


class EngineLinesOut(OpenOut):
    best: EngineLineOut | None = None
    why: EngineLineOut | None = None


class PositionPreviewOut(OpenOut):
    start_fen: str
    moves: list[str]
    san: list[str]
    result: str | None
    eval_cp: int | None
    mate: int | None
    white_win: int | float


class GameMoveOut(OpenOut):
    ply: int
    color: str
    is_user: bool | None  # null when the game's owner is unknown (moves.is_user)
    san: str
    uci: str
    best_san: str | None
    best_uci: str | None
    eval_after: int | None
    mate_after: int | None
    win_pct_before: float | None
    win_pct_after: float | None
    classification: str | None
    clock_left: int | float | None
    time_spent: int | float | None
    pattern: str | None
    layer: str | None
    time_trouble: bool | None
    cause: dict | None
    principle: str | None


class ReviewMarkOut(OpenOut):
    """A stored review mark (StepMarkIn when it was saved)."""

    ply: int
    mark: str


class DeckCardStateOut(BaseModel):
    """A review card of a game, for "What slipped past you" (watch.deck_cards)."""

    ply: int
    state: Literal["on_watch", "held", "stopped"]
    due: str | None  # the next review day (YYYY-MM-DD, local); null while never answered
    label: str
    reason: str | None
    held: int  # right answers in a row, latest first


class GameDetailOut(GameListItemOut):
    account: str | None
    # The account's own Chess.com avatar (players.py), beside the opponent's in the
    # review's Players row. Absent for Lichess, PGN imports and profiles without one.
    user_avatar: str | None = None
    white: str | None
    black: str | None
    white_elo: int | None
    black_elo: int | None
    start_fen: str | None
    san: list[str]
    engine_accuracy: float | None
    opponent_accuracy: float | None
    plies: list[GameMoveOut]
    deck_plies: list[int]
    # The game's review cards (deck_plies once synced) with where each is on the watch.
    deck_cards: list[DeckCardStateOut]
    review_marks: list[ReviewMarkOut]


class ReviewedOut(BaseModel):
    reviewed_at: str


class HomePuzzlesOut(PuzzleSessionOut):
    theme: str | None
    share: float | None


class WatchOut(BaseModel):
    """When the learner keeps their watch, the habit it follows, and the day it was saved."""

    time: str
    anchor: str
    set_on: str


class TonightCardOut(BaseModel):
    """A move row on the Watch page's tonight card (watch.tonight)."""

    game_id: int
    ply: int
    san: str
    label: str
    opponent: str | None
    played_at: str | None
    chip: Literal["new", "again", "almost"] | None
    color: Literal["white", "black"]
    fen: str | None  # the position before the move, for its small board


class TonightGameOut(BaseModel):
    """The newly analysed game whose new slips lead tonight's lesson (deck.lead_game)."""

    id: int
    opponent: str | None
    played_at: str | None
    # Its new slips in tonight's lesson (the rows show up to three of them).
    slipped: int


class TonightOut(BaseModel):
    # New (never answered) positions in tonight's lesson from the last week of games.
    slipped_recent: int
    cards: list[TonightCardOut] = Field(max_length=3)
    # The lesson's items beyond the rows.
    remaining: int
    # The game leading tonight's lesson, whose slips are the rows; None without one.
    game: TonightGameOut | None = None


class JourneyOut(BaseModel):
    """Stars and rank (watch.journey_summary)."""

    stars: int
    rank: str
    rank_reached_on: str | None
    next_rank: str | None
    # The post whose clearing reaches the next rank; null when no post reaches it yet.
    next_post: int | None


class RankOut(BaseModel):
    key: str
    name: str
    # The post whose clearing reaches this rank; null for Page and the Keep.
    post: int | None
    reached_on: str | None


class StarOut(BaseModel):
    game_id: int
    ply: int
    san: str
    label: str
    earned_on: str
    # The card has lapsed out of long-term memory since: the star stays, dimmed.
    dimmed: bool


class NightMilestoneOut(BaseModel):
    nights: int
    reached_on: str | None


class NightsOut(BaseModel):
    total: int
    milestones: list[NightMilestoneOut]


class PathMoveOut(BaseModel):
    """A move row on the path's cards (path.py)."""

    game_id: int
    ply: int
    san: str
    label: str
    opponent: str | None
    color: Literal["white", "black"]
    fen: str | None  # the position before the move, for its small board


class AheadMoveOut(PathMoveOut):
    # Right answers in a row so far.
    held: int
    # A Good answer that day would make it stop slipping (watch.STOPPED_DAYS).
    last_check: bool


class AheadDayOut(BaseModel):
    """A day of the schedule ahead (path.ahead): the moves due then by their FSRS due date."""

    date: str
    due: int
    last_checks: int
    moves: list[AheadMoveOut] = Field(max_length=3)


class HeldOut(BaseModel):
    """What a watch held: answers right, answers wrong and moves that stopped slipping."""

    date: str
    held: int
    slipped: int
    stopped: int


class PathHistoryOut(BaseModel):
    """Every kept night, oldest first (night N is the Nth), and every finished extra watch."""

    nights: list[HeldOut]
    extra: list[HeldOut]


class FirstStarOut(BaseModel):
    """Before any star: the held move closest to stopping slipping (path.first_star)."""

    game_id: int
    ply: int
    san: str
    label: str
    # FSRS stability: the days it is expected to hold, at most `target`.
    days: float
    target: int
    # It also needs one of its tactic family's puzzles solved.
    needs_family: bool


class JourneyMapOut(JourneyOut):
    """The Progress map and the home path (GET /api/journey)."""

    dimmed: int
    ranks: list[RankOut]
    star_list: list[StarOut]
    nights: NightsOut
    # The next seven days, tomorrow first.
    ahead: list[AheadDayOut]
    history: PathHistoryOut
    first_star: FirstStarOut | None
    # Every move in the deck by where it is on the watch: Progress's "Your moves".
    moves: SlipsOut
    # The curriculum, in order: the home path's nodes.
    wards: list[WardOut] = []


class NightMoveOut(PathMoveOut):
    held_then: bool
    # Where it stands now; "hidden" once suspended.
    state: Literal["on_watch", "held", "stopped", "hidden"]
    due: str | None


class KeptNightOut(HeldOut):
    """A kept night's watch (GET /api/journey/night): its moves and where each stands now."""

    night: int
    moves: list[NightMoveOut]


class TodayOut(OpenOut):
    """Today's goal, with the daily review's plan, streak and memory (daily.py)."""

    game: GameListItemOut | None
    new_games: int
    # New games with moves that slipped past you: the home's Games tile badge.
    new_games_slipped: int
    reviewed_today: int
    positions: DoneTotalOut
    deck_total: int
    puzzles: HomePuzzlesOut
    # Null until the learner chooses their watch.
    watch: WatchOut | None
    streak: StreakOut
    # The Watch page's preview of tonight's lesson.
    tonight: TonightOut


class HomeOut(BaseModel):
    today: TodayOut
    journey: JourneyOut


class PatternCountOut(OpenOut):
    """A tactic's tagged moves in the range, by label (blunder, mistake, miss and any other)."""

    pattern: str
    total: int


class PatternsOut(OpenOut):
    range: Literal["30d", "90d", "all"]
    patterns: list[PatternCountOut]
    pending: int
    strength: list[dict]
    memory: list[dict]
    deck_health: dict


class SettingsAccountOut(LinkedAccountOut):
    model_config = ConfigDict(extra="allow")
    synced_through: str | None


class SettingsOut(OpenOut):
    fsrs: dict
    accounts: list[SettingsAccountOut]
    lichess_token: bool
    last_run: dict | None
    earlier_runs: list[dict]
    current_run: dict | None
    running: bool
    engine: str | None
    nodes: int
    pace: str
    timezone: str | None
    day: str
    watch: WatchOut | None
    your_data: dict
    limits: AccountLimitsOut
    database: dict | None
    backups: dict | None


class AnalysisOut(BaseModel):
    nodes: int


class PracticeOut(BaseModel):
    pace: Literal["light", "standard", "intense"]


class TimezoneOut(BaseModel):
    timezone: str
    day: str
