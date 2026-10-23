"""The curriculum: eighteen wards of lessons in the Steps Method's order.

A pile of drills is not a path. This is the spine: the app picks *a lesson* to work on and
then any good drill for it, rather than hunting for a puzzle that resembles one particular
blunder. Choosing a drill per mistake needs a tagger right about *this* position; choosing a
lesson needs one right on average across a few hundred, where errors cancel. Every training
method with a following (the Steps Method, Chessable's courses, the Woodpecker Method) is a
curriculum plus volume, and none matches drills to individual mistakes.
"""

from dataclasses import dataclass

# --- wards: the Steps Method's ordering, in units a learner clears in a week or three -------
#
# docs/specs/2026-10-20-curriculum-wards-design.md. The lesson order below is the Steps
# Method's (Rob Brunia and Cor van Wijgerden, stappenmethode.nl), read from their own freely
# published trainer manuals for Steps 1-6. We take the *order* -- which is not protectable --
# and draw every exercise from Lichess's CC0 corpus. Their exercises and wording are not
# reproduced, the ward names are ours, and no endorsement is implied.
#
# Why their order rather than one derived from the corpus: percentiles of Lichess puzzle
# ratings measure where easy examples of a theme happen to live, not where a teacher should
# introduce it. Steps is the latter.

# The seven threads that run concurrently through the Steps, rather than one after another.
TRACKS = ("tactic", "defence", "mate", "endgame", "calculation", "opening", "positional")


@dataclass(frozen=True)
class Lesson:
    """One lesson of a ward. `step` records where in the Steps Method it comes from, so the
    mapping stays auditable; `themes` are the Lichess labels its drills are drawn from, empty
    where no theme exists and the lesson needs a drill of our own."""

    key: str
    name: str
    track: str
    step: str  # "1+", "2", "3+", ... as the manuals number them
    themes: tuple[str, ...] = ()
    # An `endgames.SHAPES` key narrowing the theme to positions the technique can be
    # practised from. Lichess tags which pieces are left, not which technique, so
    # `pawnEndgame` alone covers a two-pawn race and a seven-pawn middlegame remnant alike.
    shape: str | None = None
    # A `drill.py` kind that teaches this lesson from the learner's own games, for the
    # lessons no Lichess theme covers. Ward 1 is entirely these.
    drill: str | None = None
    # Lichess themes that give a drill-taught lesson honest volume once the learner's own
    # positions run out: served as the post's idea, never counted as evidence that it is held
    # (that stays with the drill). Ward 1's lessons take easy loose-piece puzzles.
    practice: tuple[str, ...] = ()

    @property
    def servable(self) -> bool:
        """Whether anything can supply drills for this: the corpus, or a drill of our own."""
        return bool(self.themes) or bool(self.drill)


@dataclass(frozen=True)
class Ward:
    """A section of the path: a few lessons that are learned together."""

    key: str
    name: str
    lessons: tuple[Lesson, ...]

    @property
    def themes(self) -> tuple[str, ...]:
        return tuple(dict.fromkeys(t for lesson in self.lessons for t in lesson.themes))

    @property
    def steps(self) -> tuple[str, ...]:
        return tuple(dict.fromkeys(lesson.step for lesson in self.lessons))


def _w(key: str, name: str, *lessons: Lesson) -> Ward:
    return Ward(key, name, lessons)


def _l(
    key: str,
    name: str,
    track: str,
    step: str,
    *themes: str,
    shape: str | None = None,
    drill: str | None = None,
    practice: tuple[str, ...] = (),
) -> Lesson:
    return Lesson(key, name, track, step, themes, shape, drill, practice)


# The whole Steps Method from 1-plus to 6, in its order: eighteen posts on the walls (Steps 1-3,
# with some 3+ and 4), then the Keep (the rest of 3 and 3+, then 4 and 4+), the March (5 and 5+)
# and the Citadel (6). Step 1's basic lessons are the rules of chess and are dropped: everyone
# here already plays online. Lesson names are the Steps Method's own terms
# (decided 2026-10-23), which differ from common usage in places: "X-ray attack" is a skewer,
# "luring away" is deflection. Their step numbers are never shown as Knightly's progress.
WARDS: tuple[Ward, ...] = (
    _w(
        "board-vision",
        "What the board is saying",
        _l("board-vision", "Board vision", "defence", "1+", drill="vision", practice=("hangingPiece",)),
        _l("attack-defend", "Attacking and defending", "defence", "1+", drill="vision", practice=("hangingPiece",)),
        _l("exchange", "The profitable exchange", "tactic", "1", drill="vision", practice=("hangingPiece",)),
    ),
    _w(
        "mate-in-one",
        "Mate in one",
        _l("mate-in-one", "Mate in one", "mate", "1", "mateIn1"),
        # Mating with the queen first (generated, endgame_drills.py), then the corpus's.
        _l("creating-mate", "Mating with the queen", "mate", "1+", "queenMate", "mateIn1"),
    ),
    _w(
        "loose-pieces",
        "Pieces left loose",
        _l("winning-material", "Winning material", "tactic", "1+", "hangingPiece"),
        _l("activity", "Activity", "positional", "2", "activity"),
    ),
    _w(
        "double-attack",
        "The double attack",
        _l("double-attack", "Double attack", "tactic", "2", "fork"),
        _l("double-attack-king", "Double attack with other pieces", "tactic", "2", "fork", "doubleCheck"),
    ),
    _w(
        "mate-in-two",
        "Mate in two",
        # Steps teaches the back rank inside its mate lessons, not as a lesson of its own.
        _l("mate-in-two", "Mate in two", "mate", "2", "mateIn2", "backRankMate"),
        _l("mating-rook", "Mating with the rook", "mate", "2", "rookMate"),
    ),
    _w(
        "the-pin",
        "The pin",
        _l("pin", "The pin", "tactic", "2", "pin"),
        _l("golden-rules", "The three golden rules", "opening", "2", "development", "centre", "castleEarly"),
    ),
    _w(
        "remove-the-defender",
        "Removing the defender",
        _l("eliminating-defence", "Eliminating the defence", "tactic", "2", "capturingDefender"),
        _l("opening-principles", "The opening", "opening", "2+", "development", "centre", "castleEarly"),
    ),
    _w(
        "discovered-attack",
        "The discovered attack",
        _l("discovered-attack", "Discovered attack", "tactic", "2", "discoveredAttack"),
    ),
    _w(
        "defending-mate",
        "Seeing mate coming",
        _l("defending-mate", "Defending against mate", "defence", "2", "defensiveMove"),
        _l("stalemate", "Stalemate", "endgame", "2+", "stalemate"),
    ),
    _w(
        "in-between",
        "The in-between move",
        _l("intermezzo", "The intermediate move", "tactic", "2", "intermezzo"),
        _l("thinking-ahead", "Thinking ahead", "calculation", "2ta", "short"),
    ),
    _w(
        "pawn-endings",
        "Pawn endings",
        _l("pawn-endings", "Simple pawn endings", "endgame", "2+", "opposition", "pawnEndgame", shape="simple"),
        _l("passed-pawn", "Defending against a passed pawn", "defence", "2+", "advancedPawn"),
    ),
    _w(
        "double-check",
        "Discovered and double check",
        _l("discovered-check", "Discovered check", "tactic", "3", "discoveredCheck"),
        _l("double-check", "Double check", "tactic", "3", "doubleCheck"),
    ),
    _w(
        "pinned-pieces",
        "Attacking a pinned piece",
        _l("attacking-pinned", "Attacking a pinned piece", "tactic", "3", "pin"),
        _l("defending-pin", "Defending against a pin", "defence", "3", "defensiveMove"),
    ),
    _w(
        "x-ray",
        "X-ray and skewer",
        _l("x-ray", "X-ray protection", "tactic", "3", "xRayAttack"),
        _l("skewer", "X-ray attack", "tactic", "3", "skewer"),
    ),
    _w(
        "square-of-the-pawn",
        "The square of the pawn",
        _l("square-of-pawn", "The square of the pawn", "endgame", "3", "squareOfPawn"),
        _l("promotion", "Queening a pawn", "endgame", "3", "promotion"),
        _l("key-squares", "Key squares", "endgame", "3", "keySquares"),
    ),
    _w(
        "mating-patterns",
        "Mating patterns",
        _l(
            "mating-nets",
            "Mate after gaining access",
            "mate",
            "3",
            "arabianMate",
            "anastasiaMate",
            "bodenMate",
            "doubleBishopMate",
            "dovetailMate",
            "hookMate",
            "operaMate",
            "smotheredMate",
            "vukovicMate",
        ),
        _l("threats", "Defending against a threat", "defence", "3", "defensiveMove"),
    ),
    _w(
        "trapping",
        "Trapping a piece",
        _l("trapping", "Trapping a piece", "tactic", "4+", "trappedPiece"),
        _l("mobility", "Mobility", "positional", "3", "activity"),
    ),
    _w(
        "luring",
        "Luring and interference",
        _l("luring", "Luring", "tactic", "4", "attraction"),
        _l("interfering", "Interference", "tactic", "4", "interference"),
        _l("deflection", "Luring away", "tactic", "4", "deflection"),
        _l("clearing", "Clearing", "tactic", "4", "clearance"),
    ),
    # --- Part II, the Keep: the rest of Steps 3 and 3+, then Steps 4 and 4+ (2026-10-23) -----
    # In the method's own order. Positional lessons draw generated "find the best move" drills
    # whose answer a board check ties to the idea (positional_drills.py): the open file, strong
    # squares, weak pawns, activity, development, and for the plan lessons (PLAN_IDEAS) a lever,
    # a passed pawn made, a trade when ahead, a pawn given for time, a bad bishop freed, which
    # minor piece takes, the king in a better ending. Mini-plans and strategy draw several;
    # the later openings draw the opening rules again, deeper. Endgame-rule lessons draw
    # generated drills checked exactly (endgame_drills: rookPawn, and the Syzygy-checked
    # queenVsPawn, rookVsPawn, wrongBishop, rookEndingWin/Draw, and the draws: stalemate,
    # drawBasics, drawPieces); the rest draw the corpus's `simple` endgames.
    _w(
        "defending-double-attack",
        "Defending against a double attack",
        _l("defending-double-attack", "Defending against a double attack", "defence", "3", "defensiveMove"),
        _l("draw-3", "Draw", "endgame", "3", "drawBasics", "stalemate"),
    ),
    _w(
        "mini-plan",
        "The mini plan",
        _l("mini-plan", "Mini plan", "positional", "3", "activity", "weakPawn"),
        _l("rook-pawn", "The rook pawn", "endgame", "3+", "rookPawn"),
    ),
    _w(
        "vulnerability-opening",
        "Vulnerability in the opening",
        _l("vulnerability-opening", "Vulnerability in the opening", "opening", "3+", "attackingF2F7", "hangingPiece"),
        _l("underpromotion", "Underpromotion", "endgame", "3+", "underPromotion"),
    ),
    _w(
        "pinning",
        "Pinning",
        _l("development", "Development", "opening", "3+", "development"),
        _l("pinning", "Pinning", "tactic", "3+", "pin"),
    ),
    _w(
        "blocking",
        "Blocking",
        _l("opening-advantage", "Opening advantage", "opening", "4", "openLines"),
        _l("blocking", "Blocking", "mate", "4", "smotheredMate", "attraction"),
    ),
    _w(
        "pin-luring",
        "The pin: luring",
        _l("pin-luring", "The pin: luring", "tactic", "4", "pin", "attraction"),
        _l("passed-pawn-4", "The passed pawn", "endgame", "4", "advancedPawn"),
    ),
    _w(
        "the-magnet",
        "The magnet",
        _l("eliminating-double-attack", "Eliminating the defence: double attack", "tactic", "4", "capturingDefender"),
        _l("magnet", "The magnet", "mate", "4", "exposedKing", "sacrifice"),
    ),
    _w(
        "weak-pawns",
        "Weak pawns",
        _l("weak-pawns", "Weak pawns", "positional", "4", "weakPawn"),
        _l("material-advantage", "Material advantage", "endgame", "4", "trade"),
    ),
    _w(
        "attack-on-the-king",
        "Attack on the king",
        _l("chasing-targeting", "Chasing and targeting", "tactic", "4", "fork", "deflection"),
        _l("king-attack-4", "Attack on the king", "mate", "4", "kingsideAttack"),
    ),
    _w(
        "seventh-rank",
        "Seventh rank and endgame strategy",
        _l("seventh-rank-4", "Seventh rank", "endgame", "4", "rookEndgame", shape="simple"),
        _l("endgame-strategy", "Endgame strategy", "endgame", "4", "zugzwang", "pawnEndgame"),
        _l("queen-against-pawn", "Queen against pawn", "endgame", "4", "queenVsPawn"),
    ),
    _w(
        "attacking-the-king",
        "Attacking the king",
        _l("attacking-king-4p", "Attacking the king", "mate", "4+", "kingsideAttack", "exposedKing"),
        _l("opening-traps", "Vulnerability in the opening: traps", "opening", "4+", "attackingF2F7"),
    ),
    _w(
        "interference-blocking",
        "Interference and blocking",
        _l("interference-4p", "Interference", "tactic", "4+", "interference"),
        _l("blocking-4p", "Blocking", "mate", "4+", "smotheredMate"),
        _l("draws-4p", "Draws", "endgame", "4+", "drawBasics"),
    ),
    _w(
        "mini-plans",
        "Mini-plans and batteries",
        _l("mini-plans-4p", "Mini-plans", "positional", "4+", "activity", "weakPawn", "openFile", "strongSquare"),
        _l("pawn-endings-4p", "Pawn endings", "endgame", "4+", "pawnEndgame", "zugzwang"),
        _l("batteries", "Discovered attack", "tactic", "4+", "discoveredAttack", "discoveredCheck"),
    ),
    _w(
        "endgame-technique",
        "Endgame technique",
        _l("endgame-technique", "Endgame technique", "endgame", "4+", "rookEndingWin"),
        _l("chess-problems", "Chess problems", "calculation", "4+", "quietMove"),
    ),
    # --- Part III, the March: Steps 5 and 5+ ---------------------------------------------------
    _w(
        "material-and-time",
        "Material and time",
        _l("material-and-time", "Material and time", "positional", "5", "gambit"),
        _l("mate-5", "Mate", "mate", "5", "mateIn3"),
    ),
    _w(
        "breakthrough",
        "Breakthrough",
        _l("breakthrough", "Breakthrough", "endgame", "5", "advancedPawn", "pawnEndgame"),
        _l("using-pawns", "Using pawns", "positional", "5", "pawnPlay"),
    ),
    _w(
        "pawn-race",
        "Pawn race",
        _l("pawn-race", "Pawn race", "endgame", "5", "promotion", "pawnEndgame"),
        _l("seventh-rank-5", "Seventh rank", "endgame", "5", "rookEndgame"),
    ),
    _w(
        "discovery-and-pin",
        "Discovered attack and pin",
        _l("discovered-attack-5", "Discovered attack", "tactic", "5", "discoveredAttack", "clearance"),
        _l("pin-5", "Pin", "tactic", "5", "pin"),
    ),
    _w(
        "rook-against-pawn",
        "Rook against pawn",
        _l("opening-5", "The opening", "opening", "5", "development", "centre", "castleEarly"),
        _l("rook-against-pawn", "Rook against pawn", "endgame", "5", "rookVsPawn"),
    ),
    _w(
        "strong-square",
        "Strong square",
        _l("strong-square", "Strong square", "positional", "5", "strongSquare"),
        _l("defending-5", "Defending", "defence", "5", "defensiveMove"),
    ),
    _w(
        "rook-endings",
        "Rook endings",
        _l("rook-endings", "Rook endings", "endgame", "5", "rookEndingWin", "rookEndingDraw"),
        _l("king-attack-5", "Attack on the king", "mate", "5", "kingsideAttack", "sacrifice"),
    ),
    _w(
        "open-file",
        "Open file",
        _l("open-file", "Open file", "positional", "5", "openFile"),
        _l("draw-5", "Draw", "endgame", "5", "drawPieces"),
    ),
    _w(
        "king-in-the-middle",
        "King in the middle",
        _l("activity-5p", "Activity", "positional", "5+", "activity"),
        _l("pawn-endings-5p", "Pawn endings", "endgame", "5+", "pawnEndgame", "zugzwang"),
        _l("king-in-middle-5p", "King in the middle", "mate", "5+", "exposedKing"),
    ),
    _w(
        "wrong-bishop",
        "The wrong bishop",
        _l("wrong-bishop", "The wrong bishop", "endgame", "5+", "wrongBishop"),
        _l("vulnerability-5p", "Vulnerability", "tactic", "5+", "trappedPiece", "hangingPiece"),
        _l("queen-endings", "Queen endings", "endgame", "5+", "queenEndgame"),
    ),
    _w(
        "zugzwang",
        "Zugzwang",
        _l("defending-5p", "Defending", "defence", "5+", "defensiveMove"),
        _l("eternal-pins", "Eternal pins", "tactic", "5+", "pin"),
        _l("bishop-against-pawns", "Bishop against pawns", "endgame", "5+", "bishopEndgame", shape="simple"),
        _l("zugzwang", "Zugzwang", "endgame", "5+", "zugzwang"),
    ),
    # --- Part IV, the Citadel: Step 6 (a self-study book, chapters rather than lessons) --------
    _w(
        "citadel-gate",
        "The king in the middle",
        _l("king-in-middle-6", "The king in the middle", "mate", "6", "exposedKing", "sacrifice"),
        _l("passed-pawn-6", "The passed pawn", "endgame", "6", "advancedPawn", "promotion"),
        _l("strategy", "Strategy", "positional", "6", "pawnPlay", "strongSquare", "weakPawn", "badBishop"),
    ),
    _w(
        "citadel-walls",
        "Mobility and the opening",
        _l("mobility-6", "Mobility", "positional", "6", "activity"),
        _l("draw-6", "Draw", "endgame", "6", "drawPieces", "rookEndingDraw"),
        _l("opening-6", "The opening", "opening", "6", "development", "centre", "castleEarly"),
    ),
    _w(
        "citadel-hall",
        "Tactics",
        _l("tactics-6", "Tactics", "tactic", "6", "sacrifice", "deflection", "attraction"),
        _l("pawn-ending-6", "Pawn ending", "endgame", "6", "pawnEndgame"),
        _l("bishop-or-knight", "Bishop or knight?", "positional", "6", "minorChoice"),
    ),
    _w(
        "castellans-tower",
        "King's attack and the ending",
        _l("kings-attack-6", "King's attack", "mate", "6", "kingsideAttack", "mateIn3"),
        _l("advantage-ending", "Advantage in the ending", "positional", "6", "kingActivity"),
        _l("bishops", "Bishops", "positional", "6", "badBishop"),
        _l("defending-6", "Defending", "defence", "6", "defensiveMove"),
        _l("rook-endgame-6", "Rook endgame", "endgame", "6", "rookEndingDraw", "rookEndingWin"),
    ),
)

BY_WARD = {ward.key: ward for ward in WARDS}
LESSONS = {lesson.key: lesson for ward in WARDS for lesson in ward.lessons}


def derive(conn) -> list[dict]:
    """Each ward's measured difficulty, from the stored corpus.

    The band is an *output*: Steps fixes the order, the corpus says how hard its drills
    actually are. Where a ward's p10 sits far above the wards before it, the corpus cannot
    support the pedagogy at that point, and that disagreement is the thing worth reading --
    not something to smooth over by quietly moving the ward.
    """
    out = []
    for index, ward in enumerate(WARDS, start=1):
        themes = ward.themes
        row = {
            "index": index,
            "key": ward.key,
            "name": ward.name,
            "steps": ward.steps,
            "themes": themes,
            "lessons": len(ward.lessons),
            "unservable": tuple(lesson.key for lesson in ward.lessons if not lesson.servable),
        }
        if themes:
            like = " OR ".join("(' ' || themes || ' ') LIKE %s" for _ in themes)
            r = conn.execute(
                f"""SELECT count(*) AS n, min(rating) AS lo,
                           percentile_disc(0.1) WITHIN GROUP (ORDER BY rating) AS p10,
                           percentile_disc(0.5) WITHIN GROUP (ORDER BY rating) AS median,
                           count(*) FILTER (WHERE rating < 900) AS easy
                    FROM lichess_puzzles WHERE {like}""",
                tuple(f"% {t} %" for t in themes),
            ).fetchone()
            row |= {"n": r["n"], "lo": r["lo"], "p10": r["p10"], "median": r["median"], "easy": r["easy"]}
        else:
            row |= {"n": 0, "lo": None, "p10": None, "median": None, "easy": 0}
        out.append(row)
    return out
