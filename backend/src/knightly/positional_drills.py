"""Positional drills: "find the best move" positions where the one clearly best move is a
positional idea, the way the Steps Method's positional lessons exercise it ("play the best
move").

Lichess's puzzle file cannot supply these: every puzzle there is a mistake a forcing line
punishes. So they are generated (`backend/scripts/generate_positional.py`) from the Lichess
broadcast database (over-the-board tournament games, released CC0 by Lichess), and every one
is checked rather than guessed:

- **One clearly best move.** Stockfish at VERIFY_DEPTH puts it at least GAP centipawns above
  the second-best move, and it is quiet: no capture, check or promotion, no threat to a piece,
  no tactic in the engine's line, and the second-best move does not simply drop material (then
  the best move would be a defence, not the idea). Practice judges against one move (puzzles.answer), so a near-tie would mark a
  good move wrong.
- **The move is the lesson's idea**, by a cheap board-geometry check (IDEAS below): a rook to
  an open file, a knight to a square no pawn can chase it from, an undeveloped minor piece
  leaving the back rank. A check here is measured, never inferred, like positional.py's.
- **A strong player chose it.** The move played in the game is the engine's best, so the
  answer is a human move, not an engine-only one.

The generator writes DATA in the Lichess puzzle file's layout (the opponent's previous move,
then the answer), plus the engine margin it verified, and `load` stores it beside the corpus
(`knightly positional`), themed so the curriculum's positional lessons draw on it.

Only ideas whose check is reliable are here. Mini-plans, strategy, using pawns, bishop or
knight, material and time, the advantage in the ending and the draw lessons stay without
drills: no board-geometry test says a move expresses them.
"""

import csv
from pathlib import Path

import chess

from . import db, positional

DATA = Path(__file__).with_name("data") / "positional_drills.csv"

GAP = 80  # the best move beats the second-best by at least this, in centipawns
VERIFY_DEPTH = 20  # ...at this search depth, recorded per drill

# Opening ideas only count this early: past it, a pawn to the centre or a knight leaving home
# is doing something else.
OPENING_MOVES = 12
CENTRE = (chess.D4, chess.E4, chess.D5, chess.E5)
# Activity: the piece is your least mobile and gains at least this many safe squares.
STUCK = 2
FREED = 3

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100}


def _quiet(board: chess.Board, move: chess.Move) -> bool:
    return not (board.is_capture(move) or board.gives_check(move) or move.promotion)


def development(board: chess.Board, move: chess.Move) -> bool:
    """A minor piece leaving the back rank while another is still at home (positional.py), and
    not a knight to the rim: in the hand-checked sample those (Na6) were guarding c7 against a
    fork, a defence rather than development."""
    if board.piece_type_at(move.from_square) == chess.KNIGHT and chess.square_file(move.to_square) in (0, 7):
        return False
    return positional.development(board, move) is not None


def centre(board: chess.Board, move: chess.Move) -> bool:
    """A pawn stepping onto d4, e4, d5 or e5 in the opening."""
    piece = board.piece_at(move.from_square)
    return (
        piece is not None
        and piece.piece_type == chess.PAWN
        and move.to_square in CENTRE
        and board.fullmove_number <= OPENING_MOVES
    )


def castle(board: chess.Board, move: chess.Move) -> bool:
    return board.is_castling(move)


def open_file(board: chess.Board, move: chess.Move) -> bool:
    """A rook to a file with no pawns, or none of ours (positional.py)."""
    return positional.open_file(board, move) is not None


def strong_square(board: chess.Board, move: chess.Move) -> bool:
    """A knight to a square in their half that no pawn of theirs can ever attack, held by a
    pawn of ours (positional.outpost)."""
    return positional.outpost(board, move) is not None


def _weak(board: chess.Board, square: chess.Square) -> bool:
    """An isolated pawn (no pawn of its own on a neighbouring file) or a backward one (none
    level with or behind it on a neighbouring file, and its stop square watched by an enemy
    pawn): no pawn can ever defend it."""
    color = board.color_at(square)
    file, rank = chess.square_file(square), chess.square_rank(square)
    friends = [s for s in board.pieces(chess.PAWN, color) if abs(chess.square_file(s) - file) == 1]
    if not friends:
        return True
    step = 1 if color == chess.WHITE else -1
    behind = [s for s in friends if (chess.square_rank(s) - rank) * step <= 0]
    if behind:
        return False
    stop = rank + step
    if not 0 <= stop <= 7:
        return False
    return bool(board.attackers(not color, chess.square(file, stop)) & board.pieces(chess.PAWN, not color))


def weak_pawn(board: chess.Board, move: chess.Move) -> bool:
    """A piece (not the king or a pawn) moving to attack an isolated or backward enemy pawn it
    did not attack before."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type in (chess.KING, chess.PAWN) or board.is_capture(move):
        return False
    after = board.copy(stack=False)
    after.push(move)
    before = board.attacks(move.from_square)
    for sq in after.attacks(move.to_square) & after.pieces(chess.PAWN, not piece.color):
        if sq not in before and _weak(after, sq):
            return True
    return False


def _safe(board: chess.Board, move: chess.Move) -> bool:
    """The moving piece is safe where it lands: no cheaper enemy piece attacks the square, and
    if anything attacks it, something else of ours defends it."""
    piece = board.piece_at(move.from_square)
    attackers = board.attackers(not board.turn, move.to_square)
    if any(VALUES[board.piece_type_at(sq)] < VALUES[piece.piece_type] for sq in attackers):
        return False
    if not attackers:
        return True
    return bool(board.attackers(board.turn, move.to_square) - chess.SquareSet([move.from_square]))


def mobility(board: chess.Board, square: chess.Square) -> int:
    """Safe squares for the piece on `square`, which belongs to the side to move."""
    return sum(1 for m in board.generate_legal_moves(from_mask=chess.BB_SQUARES[square]) if _safe(board, m))


def activity(board: chess.Board, move: chess.Move) -> bool:
    """Your least mobile piece (at most STUCK safe squares, a knight, bishop, rook or queen,
    not under attack) moving to where it has at least FREED more."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type in (chess.KING, chess.PAWN):
        return False
    if board.is_attacked_by(not board.turn, move.from_square):
        return False  # moving an attacked piece is saving it, not activating it
    pieces = [
        sq
        for sq, p in board.piece_map().items()
        if p.color == board.turn and p.piece_type not in (chess.KING, chess.PAWN)
    ]
    if len(pieces) < 2:
        return False
    mine = mobility(board, move.from_square)  # the cheap test first: most pieces are not stuck
    if mine > STUCK or any(mobility(board, sq) < mine for sq in pieces):
        return False
    after = board.copy(stack=False)
    after.push(move)
    after.turn = board.turn  # count its squares as if it were our move again
    after.ep_square = None
    if after.is_check():
        return False
    return mobility(after, move.to_square) >= mine + FREED


# Theme -> the check that the answer carries it. Our themes, beside Lichess's in
# `lichess_puzzles.themes`; none is a Lichess theme name.
IDEAS = {
    "development": development,
    "centre": centre,
    "castleEarly": castle,
    "openFile": open_file,
    "strongSquare": strong_square,
    "weakPawn": weak_pawn,
    "activity": activity,
}
THEMES = tuple(IDEAS)


def threatens(board: chess.Board, move: chess.Move) -> bool:
    """The move newly attacks an enemy piece (not a pawn or the king) that is undefended or
    worth more than the mover: then the point may be the threat, not the idea."""
    mover = board.piece_at(move.from_square)
    after = board.copy(stack=False)
    after.push(move)
    before = board.attacks(move.from_square)
    them = not mover.color
    for sq in after.attacks(move.to_square):
        target = after.piece_at(sq)
        if target is None or target.color != them or target.piece_type in (chess.PAWN, chess.KING):
            continue
        if sq in before:
            continue
        if VALUES[target.piece_type] > VALUES[mover.piece_type] or not after.is_attacked_by(them, sq):
            return True
    return False


def carries(board: chess.Board, move: chess.Move) -> list[str]:
    """Every idea a quiet legal move carries, in IDEAS order. None for a move that threatens a
    piece: a drill must be about the idea, and a threat is a tactic's start."""
    if move not in board.legal_moves or not _quiet(board, move) or threatens(board, move):
        return []
    return [theme for theme, check in IDEAS.items() if check(board, move)]


def load(conn: db.Connection, path: Path = DATA) -> int:
    """Store the generated drills beside the Lichess corpus; returns how many were new."""
    added = 0
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            cur = conn.execute(
                """INSERT INTO lichess_puzzles (puzzle_id, fen, moves, rating, popularity, plays, themes, url)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (
                    row["PuzzleId"],
                    row["FEN"],
                    row["Moves"],
                    int(row["Rating"]),
                    int(row["Popularity"]),
                    int(row["NbPlays"]),
                    row["Themes"],
                    row["GameUrl"] or None,
                ),
            )
            added += cur.rowcount
    return added
