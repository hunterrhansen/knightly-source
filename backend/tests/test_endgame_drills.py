"""Basic endgames (endgame_drills.py): the exact KPK solver and the generated drills."""

import csv

import chess
import pytest

from knightly import db, endgame_drills, puzzles, wards


@pytest.fixture(scope="module")
def table():
    return endgame_drills.solve_kpk()


@pytest.mark.parametrize(
    ("fen", "result"),
    [
        # Black's king in front with three ranks to spare: a draw whoever moves. Stockfish
        # scores this +0.37, which is why the solver exists.
        ("8/8/8/4k3/8/8/4P3/4K3 w - - 0 1", endgame_drills.DRAW),
        # White's king in front of its pawn with the opposition: a win.
        ("8/8/8/4k3/8/4K3/4P3/8 b - - 0 1", endgame_drills.WIN),
        # King on the sixth in front of the pawn wins whoever is to move.
        ("4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", endgame_drills.WIN),
        ("4k3/8/4K3/4P3/8/8/8/8 b - - 0 1", endgame_drills.WIN),
        # The same with the defender to move from the side squares: still drawn in front.
        ("4k3/8/8/4K3/4P3/8/8/8 b - - 0 1", endgame_drills.DRAW),
        # A rook's pawn with the defending king in the corner is a draw.
        ("7k/8/6K1/7P/8/8/8/8 w - - 0 1", endgame_drills.DRAW),
        # Stalemate is a draw, not a win.
        ("k7/P7/K7/8/8/8/8/8 b - - 0 1", endgame_drills.DRAW),
        # Outside the square: the pawn runs home.
        ("8/8/8/8/8/k6P/8/K7 b - - 0 1", endgame_drills.WIN),
        # The same with Black's pawn, read from the mirrored board.
        ("k7/8/K6p/8/8/8/8/8 w - - 0 1", endgame_drills.WIN),
    ],
)
def test_the_solver_knows_the_classical_king_and_pawn_positions(table, fen, result):
    assert endgame_drills.kpk_result(table, chess.Board(fen)) == result


def drills():
    with open(endgame_drills.DATA, newline="") as f:
        return list(csv.DictReader(f))


def test_there_are_drills_for_every_endgame_theme():
    by_theme = {t: 0 for t in endgame_drills.THEMES}
    for row in drills():
        by_theme[row["Themes"].split()[0]] += 1
    assert all(n >= 100 for n in by_theme.values()), by_theme


def test_every_mate_drill_ends_in_checkmate_on_your_move():
    for row in drills():
        if row["Themes"].split()[0] not in ("queenMate", "rookMate"):
            continue
        board = chess.Board(row["FEN"])
        moves = row["Moves"].split()
        for uci in moves:
            move = chess.Move.from_uci(uci)
            assert move in board.legal_moves, (row["PuzzleId"], uci)
            board.push(move)
        assert board.is_checkmate(), row["PuzzleId"]
        assert len(moves) % 2 == 0  # the opponent's setting-up move, then yours last


def test_every_king_and_pawn_drill_has_only_one_right_move_each_time(table):
    for row in drills():
        if row["Themes"].split()[0] not in ("keySquares", "opposition", "squareOfPawn", "rookPawn"):
            continue
        board = chess.Board(row["FEN"])
        moves = [chess.Move.from_uci(u) for u in row["Moves"].split()]
        board.push(moves[0])  # the opponent's setting-up move
        for i, move in enumerate(moves[1:]):
            if i % 2 == 0:  # yours
                pawn = next(iter(board.pieces(chess.PAWN, chess.WHITE) | board.pieces(chess.PAWN, chess.BLACK)))
                want = endgame_drills.WIN if board.turn == board.color_at(pawn) else endgame_drills.DRAW
                right = []
                for m in board.legal_moves:
                    if m.promotion:
                        continue  # checked by the generator's queening rule, not the table
                    after = board.copy()
                    after.push(m)
                    result = endgame_drills.kpk_result(table, after) if after.pawns else endgame_drills.DRAW
                    if result == want:
                        right.append(m)
                # Your move is the only one that keeps the result (a queening answer: no other).
                assert right == ([] if move.promotion else [move]), (row["PuzzleId"], i)
            board.push(move)


def test_loaded_drills_teach_the_key_squares_lesson(db_url, monkeypatch):
    conn = db.connect(db_url)
    assert endgame_drills.load(conn) == len(drills())
    assert endgame_drills.load(conn) == 0, "loading again adds nothing"
    ward = next(w for w in wards.state(conn) if w.ward.key == "square-of-the-pawn")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    served = puzzles.idea_puzzle(conn)
    assert served["taught"] is True
    themes = conn.execute("SELECT themes FROM lichess_puzzles WHERE puzzle_id = %s", (served["id"],)).fetchone()[0]
    assert themes.split()[0] in ("squareOfPawn", "keySquares")
