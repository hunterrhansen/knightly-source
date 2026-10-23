import json

import chess
import chess.engine
from conftest import add_blunder_card
from fastapi.testclient import TestClient

from knightly import api, db, explain, jobs, practice_grades, puzzle_feedback, puzzles


def info(cp=None, mate=None, pv=(), turn=chess.WHITE, depth=14):
    """A search result after the learner's move: score from `turn`'s side, the given PV."""
    score = chess.engine.Mate(mate) if mate is not None else chess.engine.Cp(cp)
    return {"score": chess.engine.PovScore(score, turn), "pv": [chess.Move.from_uci(m) for m in pv], "depth": depth}


def wrong(fen, uci, result, solution=None):
    return explain.explain_wrong(chess.Board(fen), uci, result, solution)


# 1.f3 e5: White to move.
FOOLS = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2"
# White's knight on b3; Black's pawn on d6 covers c5.
LOOSE_SQUARE = "k7/8/3p4/8/8/1N6/8/K7 w - - 0 1"
# Black's knight on d4 can fork White's king on a1 and queen on e1 from c2.
FORKABLE = "k7/8/8/8/3n4/8/7P/K3Q3 w - - 0 1"


def test_a_move_into_mate_says_so_from_the_engine_score():
    reason = wrong(FOOLS, "g2g4", info(mate=-1, pv=["d8h4"]))
    assert reason == {
        "reply_uci": "d8h4",
        "reply_san": "Qh4#",
        "reason_kind": "mate",
        "reason_text": "This allows mate: Qh4#.",
    }
    longer = wrong(FOOLS, "g2g4", info(mate=-2, pv=["d8h4"]))
    assert longer["reason_text"] == "This walks into mate in 2."


def test_a_piece_left_where_it_can_be_taken_is_dropped():
    reason = wrong(LOOSE_SQUARE, "b3c5", info(cp=-300, pv=["d6c5", "a1b2"]))
    assert reason["reason_kind"] == "hangingPiece"
    assert reason["reason_text"] == "That drops your knight to dxc5."


def test_a_capture_that_is_taken_back_with_interest_loses_material():
    # Bxf7+ Kxf7: a bishop for a pawn.
    italian = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1"
    reason = wrong(italian, "c4f7", info(cp=-200, pv=["e8f7", "e1g1"]))
    assert reason["reason_text"] == "That loses material to Kxf7."


def test_an_even_trade_in_the_reply_line_is_not_a_loss():
    # Black takes the knight, the queen takes back: nothing is lost.
    fen = "k7/8/2n5/8/3N4/8/8/K2Q4 w - - 0 1"
    assert wrong(fen, "a1b1", info(cp=0, pv=["c6d4", "d1d4"])) is None
    # The recapture counts even when it falls just past the counted plies.
    _, gained, _ = explain._walk(
        chess.Board("k7/8/2n5/8/3N4/8/8/1K1Q4 b - - 0 1"), [chess.Move.from_uci(m) for m in ["c6d4", "d1d4"]], limit=1
    )
    assert gained[chess.BLACK] == gained[chess.WHITE] == 3


def test_a_fork_is_named_only_with_its_targets_and_when_it_wins_material():
    reason = wrong(FORKABLE, "h2h3", info(cp=-900, pv=["d4c2", "a1b2", "c2e1"]))
    assert (reason["reason_kind"], reason["reason_text"]) == ("fork", "Nc2+ forks your king and queen.")
    # The engine's line takes nothing: no fork is claimed.
    escaped = wrong(FORKABLE, "h2h3", info(cp=-150, pv=["d4c2", "a1b2", "c2e3"]))
    assert escaped["reason_kind"] == "eval"


def test_a_safe_move_that_misses_a_win_points_at_it_without_naming_the_move():
    solution = {"why_kind": "mate", "why_text": "Mate in 2."}
    reason = wrong(LOOSE_SQUARE, "a1b1", info(cp=50, pv=["a8b8"]), solution)
    assert reason["reason_kind"] == "missed"
    assert reason["reason_text"] == "Safe, but there’s a stronger move here. Look for a way to give mate."
    # Without a stronger idea to point at, a move that loses nothing gets no reason.
    assert wrong(LOOSE_SQUARE, "a1b1", info(cp=50, pv=["a8b8"])) is None


def test_no_line_means_no_explanation():
    assert wrong(LOOSE_SQUARE, "b3c5", {"score": info(cp=-300)["score"], "depth": 14}) is None


def test_why_names_mate_tactics_and_banked_material():
    after_f3_e5_g4 = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    assert explain.why(after_f3_e5_g4, ["d8h4"]) == {"why_kind": "mate", "why_text": "Checkmate."}
    fork = "k7/8/8/8/3n4/8/7P/K3Q3 b - - 0 1"
    assert explain.why(fork, ["d4c2", "a1b2", "c2e1"]) == {
        "why_kind": "fork",
        "why_text": "Fork: the knight hits king and queen.",
    }
    assert explain.why("k7/8/8/8/8/8/p7/K7 w - - 0 1", ["a1a2"]) == {
        "why_kind": "material",
        "why_text": "This wins a pawn.",
    }
    # The rook is taken back at once: the line wins nothing to claim.
    assert explain.why("k7/r7/8/8/8/8/8/R6K w - - 0 1", ["a1a7"]) is None
    assert explain.why(chess.STARTING_FEN, ["e2e4"], mate_before=3) == {"why_kind": "mate", "why_text": "Mate in 3."}
    assert explain.why(chess.STARTING_FEN, ["e2e5"]) is None


class Engine:
    """Every move but the known best leaves a knight en prise to the engine's reply."""

    id = {"name": "Testfish 1"}

    def __init__(self, depth=14):
        self.depth = depth

    def analyse(self, board, limit, multipv=None):
        return info(
            cp=-300,
            pv=["d6c5"] if board.is_legal(chess.Move.from_uci("d6c5")) else [],
            turn=chess.WHITE,
            depth=self.depth,
        )


def test_grade_maps_keep_explanations_from_the_grading_search_only():
    value = practice_grades.compute(LOOSE_SQUARE, "a1b2", 0, Engine(), line=["a1b2"])
    assert value["grades"]["b3c5"] == "wrong"
    assert value["explanations"]["b3c5"]["reason_text"] == "That drops your knight to dxc5."
    # Moves graded wrong without a reply line get no explanation; the best move none at all.
    assert "a1b2" not in value["explanations"]
    assert all(value["grades"][m] == "wrong" for m in value["explanations"])
    capped = practice_grades.compute(LOOSE_SQUARE, "a1b2", 0, Engine(depth=3), line=["a1b2"])
    assert capped["explanations"] == {}


def test_a_changed_line_invalidates_the_map():
    key = practice_grades.fingerprint(LOOSE_SQUARE, "a1b2", 0, "Testfish 1", ["a1b2"])
    assert key != practice_grades.fingerprint(LOOSE_SQUARE, "a1b2", 0, "Testfish 1", ["a1b2", "a8b8", "b2c3"])
    assert key != practice_grades.fingerprint(LOOSE_SQUARE, "a1b2", 0, "Testfish 1", ["a1b2"], mate_before=4)


def test_a_failed_first_move_returns_its_prepared_explanation(db_url, monkeypatch):
    from knightly import deck

    conn = db.connect(db_url)
    gid = add_blunder_card(conn, "explain")
    monkeypatch.setattr(practice_grades, "engine_revision", lambda: "Testfish 1")
    value = practice_grades.compute(chess.STARTING_FEN, "e2e4", 30, Engine(), line=["e2e4"])
    reason = {"reply_uci": "e7e5", "reply_san": "e5", "reason_kind": "eval", "reason_text": "Test reason."}
    value["grades"]["a2a3"], value["explanations"]["a2a3"] = "wrong", reason
    conn.execute("UPDATE moves SET practice_grades = %s::jsonb WHERE game_id = %s", (json.dumps(value), gid))
    failed = deck.answer(conn, gid, 1, moves=["a2a3"])
    assert failed["status"] == "failed" and failed["explanation"] == reason
    solved = deck.answer(conn, gid, 1, moves=["e2e4"])
    assert solved["explanation"] is None and solved["why"] == value["why"]
    conn.close()


FORK_PUZZLE = "k7/8/8/8/3n4/8/7P/K3Q3 w - - 0 1"


def test_puzzle_feedback_is_prepared_by_the_worker_never_the_deck_get(db_url, tmp_path, monkeypatch):
    csv = tmp_path / "p.csv"
    csv.write_text(
        "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags\n"
        f"aaaaa,{FORK_PUZZLE},h2h3 d4c2 a1b2 c2e1,1200,75,95,1000,fork short,https://lichess.org/x,\n"
    )
    with db.connect(db_url) as conn:
        puzzles.import_file(conn, csv, log=lambda *a: None)
    monkeypatch.setattr(practice_grades, "engine_revision", lambda: "Testfish 1")

    def no_engine(*args):
        raise AssertionError("the deck GET must not search")

    monkeypatch.setattr(chess.engine.SimpleEngine, "popen_uci", no_engine)
    client = TestClient(api.create_app(db_url))
    puzzle = client.get("/api/deck").json()["puzzle"]
    assert puzzle["feedback"] is None
    with db.connect(db_url) as conn:
        assert "practice" in jobs.pending(conn)
        exercise = puzzle_feedback.pending(conn)
        puzzle_feedback.prepare(conn, exercise, PuzzleEngine(), "Testfish 1")
    feedback = client.get("/api/deck").json()["puzzle"]["feedback"]
    assert feedback["why"] == {"why_kind": "fork", "why_text": "Fork: the knight hits king and queen."}
    assert feedback["explanations"]["d4e2"]["reason_text"] == "That drops your knight to Qxe2."
    answer = client.post(
        "/api/puzzles/answer", json={"id": "aaaaa", "moves": ["d4e2"], "line_key": puzzle["line_key"]}
    ).json()
    assert answer["status"] == "failed" and answer["explanation"] == feedback["explanations"]["d4e2"]

    # Another user sees none of it.
    with db.connect(db_url) as owner:
        from knightly import users

        other = db.connect(db_url, migrate=False, user_id=users.ensure(owner, "user_other"))
        assert other.execute("SELECT count(*) FROM puzzle_feedback").fetchone()[0] == 0
        other.close()


class PuzzleEngine:
    """Only a knight dropped on e2 has a reply line: the queen takes it."""

    id = {"name": "Testfish 1"}

    def analyse(self, board, limit, multipv=None):
        take = chess.Move.from_uci("e1e2")
        pv = ["e1e2"] if board.is_legal(take) and board.piece_type_at(chess.E2) == chess.KNIGHT else []
        return info(cp=-300, pv=pv, turn=chess.BLACK, depth=14)
