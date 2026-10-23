"""Basic endgames as drills: generated positions with one right move, verified exactly.

The Lichess corpus cannot teach endgame technique (endgames.py says why): a puzzle there is
"find the winning move", and the opposition, key squares and the square of the pawn are "know
the method". So these are generated, and every one is checked rather than guessed:

- **King and pawn against king** is solved exactly here (`solve_kpk`), by the classical
  retrograde method: every position is a win or a draw, and a drill is a position where
  exactly one move keeps the result. Stockfish is no help for this: it scores a dead draw
  (white Ke1, Pe2 against Ke5, white to move) at +0.37.
- **Queen and rook mates** (KQK, KRK) are proved by Stockfish's mate search in the generator
  (`backend/scripts/generate_endgames.py`): a reported mate is a real one, and a position is
  kept only when its first move is the only mate that fast.

The generator writes DATA in the Lichess puzzle file's layout, and `load` stores it beside the
corpus (`knightly endgames`), themed so the curriculum's endgame lessons draw on it. These
themes are ours, not Lichess's: keySquares, opposition, squareOfPawn, rookPawn (the rook
pawn's own wins and draws, Steps 3+), queenMate, rookMate.
"""

import csv
from pathlib import Path

import chess

from . import db

DATA = Path(__file__).with_name("data") / "endgame_drills.csv"
# Four- and five-piece endings checked against the Syzygy tables (scripts/generate_tablebase_drills.py).
TABLEBASE_DATA = Path(__file__).with_name("data") / "tablebase_drills.csv"
# Our themes, beside Lichess's in `lichess_puzzles.themes`.
THEMES = (
    "keySquares",
    "opposition",
    "squareOfPawn",
    "rookPawn",
    "queenMate",
    "rookMate",
    "queenVsPawn",
    "rookVsPawn",
    "wrongBishop",
    "rookEndingWin",
    "rookEndingDraw",
)

WIN, DRAW = 1, 0


def _king_moves(sq: int) -> list[int]:
    return list(chess.SquareSet(chess.BB_KING_ATTACKS[sq]))


KING = [_king_moves(sq) for sq in range(64)]


def _adjacent(a: int, b: int) -> bool:
    return chess.square_distance(a, b) <= 1


def _pawn_attacks(p: int) -> tuple[int, ...]:
    """Squares a white pawn on `p` attacks."""
    return tuple(chess.SquareSet(chess.BB_PAWN_ATTACKS[chess.WHITE][p]))


def _index(wk: int, bk: int, p: int, black: bool) -> int:
    return ((wk * 64 + bk) * 64 + p) * 2 + int(black)


def _valid(wk: int, bk: int, p: int, black: bool) -> bool:
    """A legal KPK position: white king and pawn against the black king, the pawn on ranks 2-7,
    nothing on one square, kings apart, and white (not to move) never in check."""
    if len({wk, bk, p}) < 3 or _adjacent(wk, bk) or not 8 <= p < 56:
        return False
    # With white to move, black's king must not stand in check from the pawn.
    return black or bk not in _pawn_attacks(p)


def _white_moves(wk: int, bk: int, p: int) -> list[tuple[int, int, int] | str]:
    """White's moves as positions (black to move), or "promote" for a safe queening."""
    out: list[tuple[int, int, int] | str] = []
    for to in KING[wk]:
        if to != p and not _adjacent(to, bk):
            out.append((to, bk, p))
    ahead = p + 8
    if ahead not in (wk, bk):
        if ahead >= 56:
            # Queening wins unless the black king takes the new queen.
            if not _adjacent(bk, ahead) or _adjacent(wk, ahead):
                out.append("promote")
        else:
            out.append((wk, bk, ahead))
            two = p + 16
            if p < 16 and two not in (wk, bk):
                out.append((wk, bk, two))
    return out


def _black_moves(wk: int, bk: int, p: int) -> list[tuple[int, int, int] | str]:
    """Black's moves as positions (white to move), or "capture" for taking a lone pawn."""
    attacked = set(_pawn_attacks(p))
    out: list[tuple[int, int, int] | str] = []
    for to in KING[bk]:
        if _adjacent(to, wk) or to in attacked:
            continue
        if to == p:
            out.append("capture")  # the pawn is undefended (the king is not next to it)
        else:
            out.append((wk, to, p))
    return out


def solve_kpk() -> bytearray:
    """Every KPK position's result for white: WIN or DRAW, by `_index`. Invalid positions are
    DRAW and never read. The classical method: mark the immediate wins and draws, then let wins
    flow backwards until nothing changes; what is left is a draw."""
    size = 64 * 64 * 64 * 2
    result = bytearray(size)  # all DRAW
    pending: list[tuple[int, list, bool]] = []
    for wk in range(64):
        for bk in range(64):
            for p in range(8, 56):
                for black in (False, True):
                    if not _valid(wk, bk, p, black):
                        continue
                    i = _index(wk, bk, p, black)
                    if black:
                        moves = _black_moves(wk, bk, p)
                        if not moves:
                            # Mated by the pawn, or stalemated.
                            result[i] = WIN if bk in _pawn_attacks(p) else DRAW
                        elif "capture" not in moves:
                            pending.append((i, [_index(*m, False) for m in moves], True))
                    else:
                        moves = _white_moves(wk, bk, p)
                        if "promote" in moves:
                            result[i] = WIN
                        elif moves:
                            pending.append((i, [_index(*m, True) for m in moves], False))
    changed = True
    while changed:
        changed = False
        still = []
        for i, nexts, black in pending:
            won = all(result[n] == WIN for n in nexts) if black else any(result[n] == WIN for n in nexts)
            if won:
                result[i] = WIN
                changed = True
            else:
                still.append((i, nexts, black))
        pending = still
    return result


def kpk_result(table: bytearray, board: chess.Board) -> int:
    """WIN or DRAW for the side with the pawn, in a KPK position. Black's pawn is read as
    white's on the mirrored board."""
    pawns = board.pieces(chess.PAWN, chess.WHITE) | board.pieces(chess.PAWN, chess.BLACK)
    (p,) = pawns
    strong = board.color_at(p)
    if strong == chess.BLACK:
        board = board.mirror()
        p = chess.square_mirror(p)
    wk, bk = board.king(chess.WHITE), board.king(chess.BLACK)
    return table[_index(wk, bk, p, board.turn == chess.BLACK)]


def load(conn: db.Connection, paths: tuple[Path, ...] = (DATA, TABLEBASE_DATA)) -> int:
    """Store the generated drills beside the Lichess corpus; returns how many were new."""
    added = 0
    for path in paths:
        added += _load_file(conn, path)
    return added


def _load_file(conn: db.Connection, path: Path) -> int:
    added = 0
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            cur = conn.execute(
                """INSERT INTO lichess_puzzles (puzzle_id, fen, moves, rating, popularity, plays, themes, url)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, NULL) ON CONFLICT DO NOTHING""",
                (
                    row["PuzzleId"],
                    row["FEN"],
                    row["Moves"],
                    int(row["Rating"]),
                    int(row["Popularity"]),
                    int(row["NbPlays"]),
                    row["Themes"],
                ),
            )
            added += cur.rowcount
    return added
