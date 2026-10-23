"""Positional drills (positional_drills.py): the idea checks and the generated drills."""

import csv
import shutil

import chess
import chess.engine
import pytest

from knightly import curriculum, db, positional_drills, puzzles, wards

# A lesson needs this many drills before its themes can carry it: Steps holds a lesson after
# three pages of twelve (wards.BASIC_VOLUME), and a learner should not meet repeats.
MIN_PER_LESSON = 100


def carries(fen: str, uci: str) -> list[str]:
    return positional_drills.carries(chess.Board(fen), chess.Move.from_uci(uci))


@pytest.mark.parametrize(
    ("fen", "uci", "idea", "expected"),
    [
        # 1.e4 e5: Nf3 develops a knight with the rest still at home; a3 does not.
        ("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "g1f3", "development", True),
        ("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "a2a3", "development", False),
        # A pawn to the centre counts in the opening, not on move 20.
        ("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2e4", "centre", True),
        ("4k3/8/8/8/8/8/4P3/4K3 w - - 0 20", "e2e4", "centre", False),
        ("r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 8", "e1g1", "castleEarly", True),
        # A rook to the empty d-file, not behind its own f-pawn.
        ("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "a1d1", "openFile", True),
        ("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "a1f1", "openFile", False),
        # Nd5, held by e4, where no black c- or e-pawn can ever chase it...
        ("4k3/pp3ppp/3p4/8/4P3/2N5/PP3PPP/4K3 w - - 0 1", "c3d5", "strongSquare", True),
        # ...but a c7 pawn can come to c6.
        ("4k3/ppp2ppp/3p4/8/4P3/2N5/PP3PPP/4K3 w - - 0 1", "c3d5", "strongSquare", False),
        # Bb3 hits the isolated d5 pawn; with a c6 pawn behind it, d5 is no longer weak.
        ("4k3/pp3ppp/8/3p4/8/8/PP3PPP/3BK3 w - - 0 1", "d1b3", "weakPawn", True),
        ("4k3/pp3ppp/2p5/3p4/8/8/PP3PPP/3BK3 w - - 0 1", "d1b3", "weakPawn", False),
        # The cornered knight (two squares) to b3 (six); the free rook moving is not that.
        ("6k1/5ppp/8/8/8/8/5PPP/N2R2K1 w - - 0 1", "a1b3", "activity", True),
        ("6k1/5ppp/8/8/8/8/5PPP/N2R2K1 w - - 0 1", "d1d4", "activity", False),
    ],
)
def test_each_idea_check_recognises_its_idea(fen, uci, idea, expected):
    assert (idea in carries(fen, uci)) is expected


@pytest.mark.parametrize(
    ("fen", "uci", "idea", "expected"),
    [
        # A rook up, Rd1 offers the rook trade (Ra1 guards d1); level, the same move is no lesson.
        ("2kr4/5ppp/8/8/8/8/5PPP/R3R1K1 w - - 0 30", "e1d1", "trade", True),
        ("1rkr4/5ppp/8/8/8/8/5PPP/R3R1K1 w - - 0 30", "e1d1", "trade", False),
        # A rook up in an ending: Kg2 walks toward the centre; Kh2 gets no nearer.
        ("7k/p7/8/8/8/8/P7/3R3K w - - 0 40", "h1g2", "kingActivity", True),
        ("7k/p7/8/8/8/8/P7/3R3K w - - 0 40", "h1h2", "kingActivity", False),
        # c5 strikes at d6 (a lever); b5 leaves a5 behind and is passed; c4 does neither.
        ("4k3/8/3p4/8/2P5/8/8/4K3 w - - 0 20", "c4c5", "pawnPlay", True),
        ("4k3/8/8/p7/1P6/8/8/4K3 w - - 0 20", "b4b5", "pawnPlay", True),
        ("4k3/8/3p4/8/8/2P5/8/4K3 w - - 0 20", "c3c4", "pawnPlay", False),
        # Bishop or knight can take on d5; with no bishop, there is no choice.
        ("4k3/8/8/3p4/4B3/2N5/8/4K3 w - - 0 20", "c3d5", "minorChoice", True),
        ("4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 20", "c3d5", "minorChoice", False),
        # The Queen's Gambit offers c4 to the d5 pawn; e3 offers nothing.
        ("rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", "c2c4", "gambit", True),
        ("rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", "e2e3", "gambit", False),
        # Three pieces out against none, d4 strikes at e5; d3 opens nothing.
        ("rnbqkbnr/pppp1ppp/8/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5", "d2d4", "openLines", True),
        ("rnbqkbnr/pppp1ppp/8/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5", "d2d3", "openLines", False),
        # The c1 bishop behind its own dark-square pawns gets out to d2; behind light-square
        # pawns it is a good bishop, and the same move frees nothing bad.
        ("6k1/5ppp/8/8/3P4/4P3/1P3P2/2B3K1 w - - 0 25", "c1d2", "badBishop", True),
        ("6k1/5ppp/8/8/2P5/1P1P4/P3P3/2B3K1 w - - 0 25", "c1d2", "badBishop", False),
    ],
)
def test_each_plan_idea_check_recognises_its_idea(fen, uci, idea, expected):
    carried = positional_drills.plan_carries(chess.Board(fen), chess.Move.from_uci(uci))
    assert (idea in carried) is expected


def test_a_move_that_threatens_a_piece_carries_no_idea():
    # Rd1 takes the open file, but it also attacks the loose knight: the drill would be the threat.
    assert carries("6k1/5ppp/8/3n4/8/8/5PPP/R5K1 w - - 0 1", "a1d1") == []


def test_an_attacked_piece_moving_away_is_not_activity():
    # The cornered knight is attacked by the bishop on c3: moving it is a rescue.
    assert "activity" not in carries("6k1/5ppp/8/8/8/2b5/5PPP/N2R2K1 w - - 0 1", "a1b3")


def drills():
    rows = []
    for path in (positional_drills.DATA, positional_drills.PLANS_DATA):
        with open(path, newline="") as f:
            rows += list(csv.DictReader(f))
    return rows


def answer_position(row) -> tuple[chess.Board, chess.Move]:
    board = chess.Board(row["FEN"])
    prev, answer = (chess.Move.from_uci(u) for u in row["Moves"].split())
    assert prev in board.legal_moves, row["PuzzleId"]
    board.push(prev)
    return board, answer


def test_every_drill_is_legal_and_its_answer_carries_its_idea():
    rows = drills()
    assert len({r["PuzzleId"] for r in rows}) == len(rows)
    for row in rows:
        board, answer = answer_position(row)
        assert answer in board.legal_moves, row["PuzzleId"]
        idea = row["Themes"].split()[0]
        if idea in positional_drills.PLAN_THEMES:
            assert idea in positional_drills.plan_carries(board, answer), row["PuzzleId"]
        else:
            assert idea in positional_drills.THEMES
            assert idea in positional_drills.carries(board, answer), row["PuzzleId"]


def test_every_drill_records_a_clear_engine_margin():
    for row in drills():
        assert int(row["Gap"]) >= positional_drills.GAP, row["PuzzleId"]
        assert int(row["Depth"]) >= positional_drills.VERIFY_DEPTH, row["PuzzleId"]


def test_every_lesson_given_a_positional_theme_has_enough_drills():
    by_theme: dict[str, int] = {}
    for row in drills():
        for theme in row["Themes"].split():
            by_theme[theme] = by_theme.get(theme, 0) + 1
    for lesson in curriculum.LESSONS.values():
        ours = [t for t in lesson.themes if t in positional_drills.THEMES + positional_drills.PLAN_THEMES]
        if ours:
            assert sum(by_theme.get(t, 0) for t in ours) >= MIN_PER_LESSON, lesson.key


@pytest.mark.skipif(not shutil.which("stockfish"), reason="stockfish not installed")
def test_the_engine_still_finds_each_ideas_answer_alone():
    # Two drills per idea, re-searched: the recorded answer is still the one best move. A
    # tolerance on the margin, since another Stockfish build scores a little differently.
    sample: dict[str, list[dict]] = {}
    for row in drills():
        sample.setdefault(row["Themes"].split()[0], [])
        if len(sample[row["Themes"].split()[0]]) < 2:
            sample[row["Themes"].split()[0]].append(row)
    with chess.engine.SimpleEngine.popen_uci(shutil.which("stockfish")) as engine:
        for rows in sample.values():
            for row in rows:
                board, answer = answer_position(row)
                infos = engine.analyse(board, chess.engine.Limit(depth=16), multipv=2)
                assert infos[0]["pv"][0] == answer, row["PuzzleId"]
                gap = infos[0]["score"].pov(board.turn).score(mate_score=100_000) - infos[1]["score"].pov(
                    board.turn
                ).score(mate_score=100_000)
                assert gap >= positional_drills.GAP // 2, row["PuzzleId"]


def test_loaded_drills_teach_the_golden_rules(db_url, monkeypatch):
    conn = db.connect(db_url)
    assert positional_drills.load(conn) == len(drills())
    assert positional_drills.load(conn) == 0, "loading again adds nothing"
    ward = next(w for w in wards.state(conn) if w.ward.key == "the-pin")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    served = puzzles.idea_puzzle(conn)
    assert served["taught"] is True
    themes = conn.execute("SELECT themes FROM lichess_puzzles WHERE puzzle_id = %s", (served["id"],)).fetchone()[0]
    assert themes.split()[0] in ("development", "centre", "castleEarly")
