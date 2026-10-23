"""Puzzles for the tactics you miss, from the Lichess puzzle database (CC0).

`import_file` streams lichess_db_puzzle.csv(.zst) from database.lichess.org and keeps only
what Knightly serves: well-liked, often-played puzzles in the themes your mistakes are
tagged with (patterns.THEMES), up to PER_THEME each. A few MB, out of a 300 MB download.

A Lichess puzzle starts one move early: `moves[0]` is the opponent's move that sets it up,
then you and they alternate, your moves at odd indexes. Answers are kept in puzzle_attempts
with source "knightly", next to your Lichess puzzle history.

Daily practice serves up to SESSION of them once today's own-game cards are done, drawn from
the ward the learner is working through (wards.ward_puzzle) and falling back to the tactic
they are weakest at (patterns.weakness) when the ward has nothing the corpus can serve. They
are graded on the server move by move
(practice_lines.step):
the first finished try records success or failure; retries and redos record nothing.
"""

import csv
import io
import json
import math
import random
import shutil
import subprocess
from datetime import UTC, date, datetime
from pathlib import Path

import chess

from . import db, patterns, practice_lines
from .patterns import THEMES

SOURCE = patterns.PUZZLE_SOURCE
# Themes the corpus is stocked by. `patterns.THEMES` is only what our own tagger can name on
# your mistakes (7); Lichess labels its 6.1M puzzles with about seventy, so stocking by our
# seven kept a corpus shaped to the tagger rather than to what is worth practising. Ideas we
# could never serve -- deflection, interference, a trapped piece, mate in a named number of
# moves, which endgame it is -- are here. Phase and length tags are not: nearly every puzzle
# carries one, so they would fill the quota without making the corpus any broader. They are
# still stored on whatever is kept, and `family_puzzle` narrows by them.
KEEP_THEMES = (
    # Tactical motifs.
    "advancedPawn",
    "attackingF2F7",
    "attraction",
    "capturingDefender",
    "clearance",
    "defensiveMove",
    "deflection",
    "discoveredAttack",
    "discoveredCheck",
    "doubleCheck",
    "enPassant",
    "exposedKing",
    "fork",
    "hangingPiece",
    "interference",
    "intermezzo",
    "kingsideAttack",
    "pin",
    "promotion",
    "queensideAttack",
    "quietMove",
    "sacrifice",
    "skewer",
    "trappedPiece",
    "underPromotion",
    "xRayAttack",
    "zugzwang",
    # Mates, including how far off and the named patterns.
    "mate",
    "mateIn1",
    "mateIn2",
    "mateIn3",
    "mateIn4",
    "mateIn5",
    "anastasiaMate",
    "arabianMate",
    "backRankMate",
    "bodenMate",
    "doubleBishopMate",
    "dovetailMate",
    "hookMate",
    "operaMate",
    "smotheredMate",
    "vukovicMate",
    # Endgames, by what is left on the board.
    "bishopEndgame",
    "knightEndgame",
    "pawnEndgame",
    "queenEndgame",
    "queenRookEndgame",
    "rookEndgame",
)
PER_THEME = 3000  # puzzles kept per theme, spread evenly over BAND_WIDTH rating bands
# Each theme's quota is filled per rating band, not in file order. Lichess ships the file in
# puzzle-id order, which is random with respect to rating, so an unstratified quota samples a
# theme across its whole range -- and a theme's easy end is then underrepresented in exact
# proportion to how rare easy examples of it are. Measured before this changed: 4,211 pin
# puzzles under 900 passed the filters, and the corpus stored 119 of them, because pin's
# median is 1584. That is the band `target_rating` serves a 900-rated learner from.
BAND_WIDTH = 200
MIN_POPULARITY = 85  # Lichess's -100..100 vote score
MIN_PLAYS = 200  # low enough that the rarer named mates can still fill
RATING_RANGE = (500, 2200)
DEFAULT_TARGET = 1200  # the seed with no games to read a rating from
NEAR = 150  # serve puzzles within this many points of the target first
SESSION = 5  # puzzles in a lesson; Home's step is done after this many a day
# Where practice should land. The optimal-challenge literature puts learning near 85%; we
# aim slightly below it because a miss here is cheap and the corpus thins at the easy end.
TARGET_ACCURACY = 0.80
K_FACTOR = 24  # Elo step per answer once the rating has settled
# Until this many answers the seed is a guess from a different rating scale, so move fast.
PROVISIONAL = 20
PROVISIONAL_K = 80
ACCURACY_WINDOW = 50  # answers `accuracy` reports over
# How far below your ability a puzzle has to sit to be solved TARGET_ACCURACY of the time.
# Elo expects E = 1 / (1 + 10 ** ((puzzle - you) / 400)); setting E = 0.80 puts the puzzle
# 241 points below you, so this is what `target_rating` subtracts. At 0.50 it would be 0,
# which is the point: an Elo alone would serve you coin-flips.
EASIER_BY = round(400 * math.log10(TARGET_ACCURACY / (1 - TARGET_ACCURACY)))


def _rows(path: Path):
    """CSV rows from the .csv or .csv.zst file, decompressed as a stream."""
    if path.suffix == ".zst":
        zstd = shutil.which("zstd")
        if not zstd:
            raise SystemExit("Needs the zstd tool to unpack the file: brew install zstd")
        proc = subprocess.Popen([zstd, "-dc", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        finished = False
        try:
            yield from csv.DictReader(io.TextIOWrapper(proc.stdout, encoding="utf-8"))
            finished = True
        finally:
            if proc.poll() is None:
                proc.kill()  # we stopped reading early: enough puzzles kept
            proc.stdout.close()
            err = proc.stderr.read().decode(errors="replace").strip()
            proc.stderr.close()
            if proc.wait() and finished:
                raise SystemExit(f"Couldn't unpack {path.name}: {err}")
    else:
        with open(path, newline="", encoding="utf-8") as f:
            yield from csv.DictReader(f)


def bands() -> tuple[int, ...]:
    """The low edge of each rating band the quota is spread over."""
    lo, hi = RATING_RANGE
    return tuple(range(lo, hi + 1, BAND_WIDTH))


def _band(rating: int) -> int:
    lo, _ = RATING_RANGE
    return lo + (rating - lo) // BAND_WIDTH * BAND_WIDTH


def import_file(conn: db.Connection, path: str | Path, log=print) -> dict[str, int]:
    """Replace the stored puzzles with a fresh pick from a Lichess puzzle file. Returns how
    many were kept per theme.

    Each theme's PER_THEME is spread evenly across the rating bands rather than taken in file
    order, so the easy end of every theme is stocked as deeply as the hard end wherever the
    material exists. A theme with nothing easy (en passant starts at 778, mate in five at 939)
    simply leaves those bands short rather than borrowing from the ones above.
    """
    per_band = max(1, PER_THEME // len(bands()))
    kept: dict[str, int] = {t: 0 for t in KEEP_THEMES}
    filled: dict[tuple[str, int], int] = {}
    batch, seen = [], 0
    lo, hi = RATING_RANGE
    for row in _rows(Path(path)):
        seen += 1
        if seen % 1_000_000 == 0:
            log(f"  {seen:,} puzzles read, {sum(kept.values()):,} kept")
        try:
            rating, popularity, plays = int(row["Rating"]), int(row["Popularity"]), int(row["NbPlays"])
        except (KeyError, ValueError):
            continue
        if not (lo <= rating <= hi) or popularity < MIN_POPULARITY or plays < MIN_PLAYS:
            continue
        themes = row["Themes"].split()
        band = _band(rating)
        mine = [t for t in KEEP_THEMES if t in themes and filled.get((t, band), 0) < per_band]
        if not mine:
            continue
        for t in mine:
            kept[t] += 1
            filled[(t, band)] = filled.get((t, band), 0) + 1
        batch.append(
            (row["PuzzleId"], row["FEN"], row["Moves"], rating, popularity, plays, row["Themes"], row.get("GameUrl"))
        )
        # Every band of every theme full: nothing later in the file can be kept. Rare now --
        # the thin bands (en passant below 778) never fill, so this usually reads the lot.
        if len(filled) == len(KEEP_THEMES) * len(bands()) and all(n >= per_band for n in filled.values()):
            break
    with conn:
        conn.execute("DELETE FROM lichess_puzzles")
        conn.executemany(
            """INSERT INTO lichess_puzzles
               (puzzle_id, fen, moves, rating, popularity, plays, themes, url)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
            batch,
        )
    log(f"Kept {len(batch):,} of {seen:,} puzzles")
    return kept


def ability(conn) -> int:
    """Your puzzle rating: an Elo replayed over every first try, newest last.

    Derived, never stored, like the streak -- replaying `puzzle_attempts` in order gives the
    same answer however often it is asked, and a change to K or the seed takes effect without
    a backfill. First tries only, which is what the table holds.

    Seeded from your rating in real games (`standing.rating`) rather than a flat
    DEFAULT_TARGET, so a 600 and a 1500 do not start in the same place. The two scales are
    not the same -- a Chess.com rapid 900 is not a Lichess puzzle 900 -- so the seed is a
    starting point the update corrects, not a claim; PROVISIONAL keeps K high until it has.
    Measuring the mapping between the two is open work.
    """
    from . import standing  # it reads games; nothing there reads puzzles

    seed = standing.rating(conn) or DEFAULT_TARGET
    rows = conn.execute(
        """SELECT success, puzzle_rating FROM puzzle_attempts
           WHERE puzzle_rating IS NOT NULL ORDER BY attempted_at, id"""
    ).fetchall()
    rating = float(seed)
    for n, r in enumerate(rows):
        expected = 1 / (1 + 10 ** ((r["puzzle_rating"] - rating) / 400))
        k = PROVISIONAL_K if n < PROVISIONAL else K_FACTOR
        rating += k * ((1 if r["success"] else 0) - expected)
    return round(rating)


def target_rating(conn) -> int:
    """The puzzle rating to serve: below your `ability`, by enough to land near
    TARGET_ACCURACY.

    Not your ability itself. An Elo converges on the difficulty you beat half the time, and
    half is the wrong place to practise: the optimal-challenge literature puts learning near
    80-85% success, and the Steps Method reached the same conclusion by hand -- its Plus
    workbooks exist to supply more material at one level "without losing motivation, which
    often occurs when the difficulty level is too high". EASIER_BY is that accuracy expressed
    as a rating gap, so the two numbers cannot drift apart.
    """
    return max(RATING_RANGE[0], ability(conn) - EASIER_BY)


def accuracy(conn, last: int = ACCURACY_WINDOW) -> float | None:
    """Your first-try success rate over the last `last` puzzles, or None below a tenth of
    the window. The control signal for whether `target_rating` is landing where it should:
    persistently above TARGET_ACCURACY means the puzzles are too easy, below means too hard.
    """
    rows = conn.execute(
        """SELECT success FROM puzzle_attempts
           WHERE puzzle_rating IS NOT NULL ORDER BY attempted_at DESC, id DESC LIMIT %s""",
        (last,),
    ).fetchall()
    if len(rows) < max(1, last // 10):
        return None
    return sum(1 for r in rows if r["success"]) / len(rows)


def available(conn) -> bool:
    return conn.execute("SELECT 1 FROM lichess_puzzles LIMIT 1").fetchone() is not None


def next_puzzle(conn, theme: str, rng: random.Random | None = None) -> dict | None:
    """A puzzle in `theme` you haven't tried here, near your target rating (widening if
    none is), or None."""
    target = target_rating(conn)
    for spread in (NEAR, NEAR * 3, 10_000):
        rows = conn.execute(
            """SELECT * FROM lichess_puzzles p
               WHERE (' ' || p.themes || ' ') ILIKE %s AND abs(p.rating - %s) <= %s
                 AND p.puzzle_id NOT IN (SELECT puzzle_id FROM puzzle_attempts WHERE source = %s)
               LIMIT 50""",
            (f"% {theme} %", target, spread, SOURCE),
        ).fetchall()
        if rows:
            r = (rng or random).choice(rows)
            return {
                "id": r["puzzle_id"],
                "fen": r["fen"],
                "moves": r["moves"].split(),
                "rating": r["rating"],
                "themes": r["themes"].split(),
                "url": r["url"],
            }
    return None


def record(
    conn, puzzle_id: str, correct: bool, now: datetime | None = None, family: tuple[int, int] | None = None
) -> None:
    """Keep a finished first try. `family` is the card this puzzle was served for, if any."""
    p = conn.execute("SELECT * FROM lichess_puzzles WHERE puzzle_id = %s", (puzzle_id,)).fetchone()
    if p is None:
        raise KeyError(puzzle_id)
    moves = p["moves"].split()
    conn.execute(
        """INSERT INTO puzzle_attempts
           (source, puzzle_id, attempted_at, success, fen, last_move, solution, themes,
            puzzle_rating, plays, url, family_game_id, family_ply)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
        (
            SOURCE,
            puzzle_id,
            db.stamp(now or datetime.now(UTC)),
            correct,
            p["fen"],
            moves[0],
            " ".join(moves[1:]),
            json.dumps(p["themes"].split()),
            p["rating"],
            p["plays"],
            p["url"],
            family[0] if family else None,
            family[1] if family else None,
        ),
    )


def done_today(conn, today: date | None = None) -> int:
    today = today or db.today(conn)
    return conn.execute(
        """SELECT count(*) FROM puzzle_attempts
           WHERE source = %s AND attempted_at >= %s AND attempted_at < %s""",
        (SOURCE, *db.day_range(conn, today)),
    ).fetchone()[0]


def _attempted(conn, puzzle_id: str) -> bool:
    return (
        conn.execute(
            "SELECT 1 FROM puzzle_attempts WHERE source = %s AND puzzle_id = %s", (SOURCE, puzzle_id)
        ).fetchone()
        is not None
    )


def _exercise(row) -> dict:
    """A puzzle as practice serves it: the setup move played in, and its solution, which
    the app judges instantly (the answer endpoint still re-grades what it records)."""
    moves = row["moves"].split()
    board = chess.Board(row["fen"])
    board.push(chess.Move.from_uci(moves[0]))
    fen_before = board.fen()
    return {
        "id": row["puzzle_id"],
        "fen_prev": row["fen"],
        "prev_uci": moves[0],
        "fen_before": fen_before,
        "color": "white" if board.turn == chess.WHITE else "black",
        "themes": row["themes"].split(),
        "rating": row["rating"],
        "line": moves[1:],
        "line_key": practice_lines.key(fen_before, moves[1:]),
    }


def _playable(row) -> bool:
    moves = row["moves"].split()
    return len(moves) >= 2 and len(moves) % 2 == 0 and practice_lines._legal(row["fen"], moves)


def _pick(
    conn, theme: str, seed: str, target: int, phase: str | None = None, max_moves: int | None = None
) -> dict | None:
    """A playable puzzle in `theme` you haven't tried here, near `target` (widening if none
    is), picked by `seed` so a reload serves the same one. "mate" leaves out back-rank
    mates, as patterns.strength counts them. `phase` narrows to Lichess's own phase tag;
    `max_moves` to lines where you play at most that many moves."""
    back_rank = " AND (' ' || p.themes || ' ') NOT ILIKE '%% backRankMate %%'" if theme == "mate" else ""
    in_phase = " AND (' ' || p.themes || ' ') ILIKE %s" if phase else ""
    extra = (f"% {phase} %",) if phase else ()
    if max_moves:
        # The line is the setting-up move, then yours and theirs in turn: 2n moves for n of yours.
        in_phase += " AND array_length(string_to_array(p.moves, ' '), 1) <= %s"
        extra = (*extra, 2 * max_moves)
    for spread in (NEAR, NEAR * 3, 10_000):
        rows = conn.execute(
            f"""SELECT * FROM lichess_puzzles p
               WHERE (' ' || p.themes || ' ') ILIKE %s AND abs(p.rating - %s) <= %s{back_rank}{in_phase}
                 AND p.puzzle_id NOT IN (SELECT puzzle_id FROM puzzle_attempts WHERE source = %s)
               ORDER BY p.puzzle_id LIMIT 50""",
            (f"% {theme} %", target, spread, *extra, SOURCE),
        ).fetchall()
        rows = [r for r in rows if _playable(r)]
        if rows:
            return _exercise(random.Random(seed).choice(rows))
    return None


def idea_puzzle(conn, today: date | None = None) -> dict | None:
    """The watch's next puzzle on tonight's idea, or None when none are stored. The pick is
    stable within a day, so reloading serves the same puzzle."""
    today = today or db.today(conn)
    if not available(conn):
        return None
    # The curriculum decides first: the current ward's unheld lessons, at the ward's shape
    # and your target rating (wards.ward_puzzle). It is a preference, never a gate -- a ward
    # the corpus cannot serve falls through to the weakness order rather than serving
    # nothing, and due cards were already dealt with before this is reached.
    from . import wards  # it reads puzzles, so the import is local

    if chosen := wards.ward_puzzle(conn, today):
        # `taught`: the post's own idea, which the watch announces (routes/practice.py).
        return {**{k: v for k, v in chosen.items() if k not in ("ward", "theme")}, "taught": True}
    # No ward drill available: the tactic you are weakest at (patterns.weakness), then the rest.
    weak = patterns.weakness(conn, today)
    preferred = min(weak, key=weak.get) if weak else None
    target = target_rating(conn)
    for theme in [preferred] + [t for t in THEMES if t != preferred] if preferred else THEMES:
        if puzzle := _pick(conn, theme, today.isoformat(), target):
            return puzzle
    return None


def themed_puzzle(conn, theme: str, today: date, max_moves: int | None = None) -> dict | None:
    """The next puzzle in `theme`, stable within a day; at most `max_moves` of yours when it
    has one that short, any length otherwise."""
    seed, target = f"{today.isoformat()}:{theme}", target_rating(conn)
    if max_moves and (short := _pick(conn, theme, seed, target, max_moves=max_moves)):
        return short
    return _pick(conn, theme, seed, target)


def _line(conn, puzzle_id: str):
    p = conn.execute("SELECT * FROM lichess_puzzles WHERE puzzle_id = %s", (puzzle_id,)).fetchone()
    if p is None or not _playable(p):
        raise KeyError(puzzle_id)
    exercise = _exercise(p)
    return p, exercise["fen_before"], p["moves"].split()[1:]


def answer(
    conn,
    puzzle_id: str,
    moves: list[str],
    *,
    line_key: str | None = None,
    redo: bool = False,
    hinted: bool = False,
    today: date | None = None,
    now: datetime | None = None,
) -> dict:
    """Check a puzzle answer, move by move, like deck.answer. Only the line's moves (or a
    mate) count. The first finished try records success, false after a wrong move, a hint or
    Show Solution; retries and redos record nothing."""
    p, fen, line = _line(conn, puzzle_id)
    if line_key is not None and line_key != practice_lines.key(fen, line):
        raise practice_lines.LineChanged("This puzzle changed. Reopen it before answering.")
    result = practice_lines.step(fen, line, moves)
    expected_san = practice_lines.san_line(fen, moves[:-1] + [result["expected"]])[-1]
    if result["status"] == "continue":
        return {
            "status": "continue",
            "step": result["step"],
            "reply_uci": result["reply"],
            "reply_san": practice_lines.san_line(fen, moves + [result["reply"]])[-1],
        }
    from . import deck, puzzle_feedback

    exercise = _exercise(p)
    explanation, why = deck.coaching(puzzle_feedback.cached(conn, exercise), fen, line, None, moves, result)
    solved = result["status"] == "solved"
    recorded = False
    if not redo and not _attempted(conn, puzzle_id):
        record(conn, puzzle_id, solved and not hinted, now, family=_family_of(conn, puzzle_id, today))
        recorded = True
    return {
        "status": result["status"],
        "step": result["step"],
        "correct": solved,
        "quality": result["quality"],
        "rating": None,
        "best_uci": result["expected"],
        "best_san": expected_san,
        "line": {"uci": line, "san": practice_lines.san_line(fen, line)},
        "due": None,
        "mastered": False,
        "recorded": recorded,
        "done_today": done_today(conn, today),
        "explanation": explanation,
        "why": why,
    }


def hint(conn, puzzle_id: str, moves: list[str], line_key: str | None = None) -> dict:
    _, fen, line = _line(conn, puzzle_id)
    if line_key is not None and line_key != practice_lines.key(fen, line):
        raise practice_lines.LineChanged("This puzzle changed. Reopen it before answering.")
    best = practice_lines.hint_move(line, moves)
    return {"best_uci": best, "from": best[:2]}


def today_results(conn, today: date | None = None) -> list[dict]:
    """Today's practice puzzles, first tries only, in the order played."""
    rows = conn.execute(
        """SELECT puzzle_id, success, puzzle_rating, themes FROM puzzle_attempts
           WHERE source = %s AND attempted_at >= %s AND attempted_at < %s ORDER BY attempted_at, id""",
        (SOURCE, *db.day_range(conn, today or db.today(conn))),
    ).fetchall()
    return [
        {
            "id": r["puzzle_id"],
            "correct": bool(r["success"]),
            "rating": r["puzzle_rating"],
            "themes": json.loads(r["themes"]) if r["themes"] else [],
        }
        for r in rows
    ]


def family_puzzle(conn, game_id: int, ply: int, today: date | None = None) -> dict | None:
    """A puzzle carrying the same tactic as one of your review cards: the card's family.

    A card is one position, and spacing it only ever shows that position again, so what gets
    learnt can be the diagram rather than the idea. Chess skill is recognising the idea across
    positions (Chase and Simon's chunks, grown into Gobet's templates), which needs the same
    motif in different places. Lichess has already labelled millions of positions by motif, so
    the family is drawn from there.

    Matched on the card's tactic, preferring its phase, at your usual target rating. None when
    the card has no nameable tactic -- about a third of mistakes -- or nothing unseen matches."""
    today = today or db.today(conn)
    card = conn.execute(
        """SELECT m.pattern, m.phase FROM cards c
           JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
           WHERE c.game_id = %s AND c.ply = %s""",
        (game_id, ply),
    ).fetchone()
    if card is None or not card["pattern"] or card["pattern"] in patterns.NAMELESS:
        return None
    seed = f"{today.isoformat()}:{game_id}:{ply}"
    # The phase narrows first: a rook endgame fork is a different skill from one out of the
    # opening. Without a match there, the motif alone still carries the idea.
    for phase in (card["phase"], None):
        if puzzle := _pick(conn, card["pattern"], seed, target_rating(conn), phase=phase):
            return puzzle
    return None


def family_solved(conn, game_id: int, ply: int) -> bool:
    """Whether a family member of this card has been solved: what mastery needs beyond the
    card's own schedule, so "mastered" means the idea rather than the one position."""
    return conn.execute(
        """SELECT EXISTS (SELECT 1 FROM puzzle_attempts
                          WHERE family_game_id = %s AND family_ply = %s AND success)""",
        (game_id, ply),
    ).fetchone()[0]


def families_solved(conn) -> set[tuple[int, int]]:
    """Every card with a family member solved, for the deck's counts in one query."""
    return {
        (r["family_game_id"], r["family_ply"])
        for r in conn.execute(
            """SELECT DISTINCT family_game_id, family_ply FROM puzzle_attempts
           WHERE family_game_id IS NOT NULL AND success"""
        )
    }


def family_due(conn, today: date | None = None) -> tuple[int, int] | None:
    """The card whose family is owed a puzzle: the newest position you answered for the first
    time today that has a nameable tactic and has not had one served yet.

    New positions only. The point of a family is varied re-encoding at the moment the idea is
    first met, and serving one after every review would roughly double the day's length."""
    today = today or db.today(conn)
    start, end = db.day_range(conn, today)
    row = conn.execute(
        """SELECT r.game_id, r.ply FROM card_reviews r
           JOIN moves m ON m.game_id = r.game_id AND m.ply = r.ply
           WHERE r.reviewed_at >= %s AND r.reviewed_at < %s AND r.rating IS NOT NULL
             AND m.pattern IS NOT NULL AND m.pattern <> ALL(%s)
             AND NOT EXISTS (SELECT 1 FROM card_reviews e
                             WHERE e.game_id = r.game_id AND e.ply = r.ply AND e.reviewed_at < %s)
             AND NOT EXISTS (SELECT 1 FROM puzzle_attempts a
                             WHERE a.family_game_id = r.game_id AND a.family_ply = r.ply)
           ORDER BY r.reviewed_at DESC, r.id DESC LIMIT 1""",
        (start, end, list(patterns.NAMELESS), start),
    ).fetchone()
    return (row["game_id"], row["ply"]) if row else None


def _family_of(conn, puzzle_id: str, today: date | None = None) -> tuple[int, int] | None:
    """The card this puzzle was served for, worked out again rather than taken from the
    client: `family_due` and `family_puzzle` are both deterministic for the day, and the
    attempt that would change `family_due` is the one being written now. Then the held move
    tonight's extra watch serves a family puzzle for (extra.family_served), likewise."""
    today = today or db.today(conn)
    owed = family_due(conn, today)
    served = family_puzzle(conn, *owed, today) if owed else None
    if served and served["id"] == puzzle_id:
        return owed
    from . import extra  # an extra watch also serves family puzzles for held moves

    return extra.family_served(conn, puzzle_id, today)
