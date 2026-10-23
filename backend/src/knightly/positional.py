"""Why a move is good when no tactic explains it.

Every reason the coach could give was tactical or material: a fork, a pin, a mate, what the
move wins. Mapped against the Steps Method's 62 base lessons (steps 2-5, beginner to 2000),
that vocabulary expresses 13 of them -- and nearly all of those sit in step 2. From step 3
on, where the curriculum turns toward position, the coach had nothing to say and fell back
to printing the evaluation, which is the one thing the learner can already read off an
engine.

So these are the words it was missing. They are all *measured*, not inferred: whether a
knight left the back rank, whether a file has pawns on it, whether a square can ever be
attacked by a pawn again. Nothing here needs a model, and nothing here can hallucinate --
a wrong explanation teaches a wrong idea, which is worse than saying nothing at all.

Soundness comes from the caller. These run only on moves the engine already put in its top
three, so "pushes the pawn to drive the bishop back" cannot be recommending a losing push:
the search has already said the move is good. This module only says *what kind of good*.
"""

import chess

# Kept here rather than imported: `patterns` depends on this module, so anything this module
# imports from the package would close a cycle (patterns -> positional -> explain -> patterns).
# A leaf is worth one small table.
NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}


def _name(piece_type: int) -> str:
    return NAMES[piece_type]


# Enough of the back rank still at home to call a move "developing". Below this the side has
# finished developing and a knight stepping out is doing something else.
UNDEVELOPED = 2
# A knight is only on an outpost in their half: the fifth rank or beyond.
OUTPOST_RANK = 4
FILES = "abcdefgh"


def _file(square: chess.Square) -> str:
    return FILES[chess.square_file(square)]


def _home(color: chess.Color) -> int:
    return 0 if color == chess.WHITE else 7


def _ahead(color: chess.Color, rank: int, other: int) -> bool:
    """Whether `other` is further up the board than `rank`, from `color`'s side."""
    return other > rank if color == chess.WHITE else other < rank


def development(board: chess.Board, move: chess.Move) -> str | None:
    """A minor piece leaving the back rank while the rest of it is still at home."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type not in (chess.KNIGHT, chess.BISHOP):
        return None
    home = _home(piece.color)
    if chess.square_rank(move.from_square) != home or chess.square_rank(move.to_square) == home:
        return None
    still = sum(
        1
        for sq in chess.SquareSet(chess.BB_RANKS[home])
        if (p := board.piece_at(sq)) and p.color == piece.color and p.piece_type in (chess.KNIGHT, chess.BISHOP)
    )
    return f"Develops the {_name(piece.piece_type)} off the back rank." if still >= UNDEVELOPED else None


def king_safety(board: chess.Board, move: chess.Move) -> str | None:
    """Castling, which is the one king move the learner can always recognise."""
    if not board.is_castling(move):
        return None
    side = "short" if chess.square_file(move.to_square) > chess.square_file(move.from_square) else "long"
    return f"Castles {side} and gets the king out of the centre."


def seventh_rank(board: chess.Board, move: chess.Move) -> str | None:
    """A rook or queen reaching the seventh, where it hits pawns that cannot run."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type not in (chess.ROOK, chess.QUEEN):
        return None
    seventh = 6 if piece.color == chess.WHITE else 1
    if chess.square_rank(move.to_square) != seventh:
        return None
    pawns = any(
        (p := board.piece_at(sq)) and p.color != piece.color and p.piece_type == chess.PAWN
        for sq in chess.SquareSet(chess.BB_RANKS[seventh])
    )
    king = board.king(not piece.color)
    if not pawns and (king is None or chess.square_rank(king) != _home(not piece.color)):
        return None
    return f"Puts the {_name(piece.piece_type)} on the seventh, behind their pawns."


def outpost(board: chess.Board, move: chess.Move) -> str | None:
    """A knight landing where no pawn can ever chase it, held by one of our own.

    "Strong square" is a step 5 lesson and the clearest positional idea to show, because the
    reason it is strong is visible: there is no pawn left that could attack the square."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type != chess.KNIGHT:
        return None
    rank, file = chess.square_rank(move.to_square), chess.square_file(move.to_square)
    forward = rank if piece.color == chess.WHITE else 7 - rank
    if forward < OUTPOST_RANK:
        return None
    neighbours = [f for f in (file - 1, file + 1) if 0 <= f <= 7]
    for f in neighbours:  # a pawn of theirs that could still come down and hit the square
        for r in range(8):
            p = board.piece_at(chess.square(f, r))
            if p and p.color != piece.color and p.piece_type == chess.PAWN and _ahead(piece.color, rank, r):
                return None
    held = any(
        (p := board.piece_at(chess.square(f, rank - 1 if piece.color == chess.WHITE else rank + 1)))
        and p.color == piece.color
        and p.piece_type == chess.PAWN
        for f in neighbours
    )
    if not held:
        return None
    return f"Plants the knight on {chess.square_name(move.to_square)}, where no pawn can chase it."


def open_file(board: chess.Board, move: chess.Move) -> str | None:
    """A rook taking a file with no pawns on it, or none of ours."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type != chess.ROOK:
        return None
    file = chess.square_file(move.to_square)
    if chess.square_file(move.from_square) == file:
        return None  # already on it; the rook is doing something else
    pawns = [p for r in range(8) if (p := board.piece_at(chess.square(file, r))) and p.piece_type == chess.PAWN]
    if not pawns:
        return f"Takes the open {_file(move.to_square)}-file with the rook."
    if all(p.color != piece.color for p in pawns):
        return f"Puts the rook on the half-open {_file(move.to_square)}-file, facing their pawn."
    return None


def space(board: chess.Board, move: chess.Move) -> str | None:
    """A pawn pushing forward to drive a piece back.

    The engine has already graded the move, so the push is sound; what this adds is *why* it
    was worth making, which is the question a learner weighing two quiet moves is asking."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type != chess.PAWN or board.is_capture(move):
        return None
    after = board.copy()
    after.push(move)
    for square in after.attacks(move.to_square):
        target = after.piece_at(square)
        if target and target.color != piece.color and target.piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK):
            if square in board.attacks(move.from_square):
                continue  # it was already under this pawn's eye; the push changed nothing
            return f"Pushes the pawn to drive the {_name(target.piece_type)} back."
    return None


def connects_rooks(board: chess.Board, move: chess.Move) -> str | None:
    """The last piece stepping out from between the rooks, so they defend each other."""
    piece = board.piece_at(move.from_square)
    if piece is None:
        return None

    def joined(b: chess.Board) -> bool:
        rooks = list(b.pieces(chess.ROOK, piece.color))
        return len(rooks) == 2 and rooks[1] in b.attacks(rooks[0])

    after = board.copy()
    after.push(move)
    return "Connects the rooks." if joined(after) and not joined(board) else None


# Most specific first: a knight reaching an outpost is a sharper thing to be told than that
# the same move happened to develop it.
ORDER = (
    ("kingSafety", king_safety),
    ("seventhRank", seventh_rank),
    ("outpost", outpost),
    ("openFile", open_file),
    ("space", space),
    ("development", development),
    ("connectedRooks", connects_rooks),
)


def reason(board: chess.Board, move: chess.Move) -> tuple[str, str] | None:
    """The idea to *show* for `move`, as (kind, text): the most specific one it carries."""
    if move not in board.legal_moves:
        return None
    for kind, rule in ORDER:
        if text := rule(board, move):
            return kind, text
    return None


def ideas(board: chess.Board, move: chess.Move) -> frozenset[str]:
    """Every positional idea `move` carries, for asking whether two moves share one.

    Showing a move and crediting one are different questions. A rook that takes the open file
    and lands on the seventh is worth describing by the seventh -- the sharper thing to say --
    but a learner who played it has done both, and `reason` alone cannot say so: it stops at
    the first rule that fires. Crediting on the top idea alone counted that rook as missing
    the open file, which is how `space` came out at 11% and `seventhRank` at 0%."""
    if move not in board.legal_moves:
        return frozenset()
    return frozenset(kind for kind, rule in ORDER if rule(board, move))
