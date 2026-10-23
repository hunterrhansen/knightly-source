"""Endgames: selecting positions a technique can be practised from.

The Steps Method teaches endgames from Step 2 on -- simple pawn endings, the square of the
pawn, key squares, rook against pawn, rook endings -- and `curriculum.py` had none of them.
This module is what lets the endgame track draw drills, and it exists because the obvious
route does not work.

### Why the corpus cannot simply be filtered by theme

Lichess tags an endgame by **which pieces are left** (`pawnEndgame`, `rookEndgame`, ...), not
by which technique the position teaches. `pawnEndgame` is 14,213 stored puzzles and covers
everything from a two-pawn race to a seven-pawn middlegame remnant, so a "square of the pawn"
lesson and a "pawn endings" lesson drawing on that tag get the identical pool.

Worse, the canonical teaching positions are largely **absent**. Measured over the stored
corpus: 374 distinct material signatures among the pawn and rook endgames, only 429 positions
with nothing but kings and at most two pawns, and effectively no bare king-and-pawn-against-
king at all. That is not an accident of sampling. A Lichess puzzle is "find the winning
move"; endgame technique is "know the method", and a position with one forced idea and no
tactic never becomes a puzzle. **The corpus can supply endgames as a setting. It cannot
supply the Lucena position, Philidor, or the opposition**, and building those means
generating and verifying them: `endgame_drills.py` does that for king and pawn against king
(the opposition, key squares, the square of the pawn) and the queen and rook mates, and the
endgame lessons draw on its themes rather than on these filters.

### What this does instead

Two filters that narrow the setting far enough to be worth practising, both pure geometry:

- `simple` -- few enough pieces that the position is about technique rather than a
  middlegame that happens to be tagged as an ending.
- `racing` -- a passed pawn whose promotion race against the defending king is close, which
  is the question the square of the pawn answers.

**Neither is validated.** `racing` alone fires on 33,027 of 100,215 stored puzzles, which is
far too broad to call a detector; it earns its place only in conjunction with `simple`, where
the two together select 3,666 positions (1,513 under 1000). Treat them as selection filters
with unmeasured precision, not as labels to show a learner -- the same bar that got
`capturingDefender` rejected at 0.24 applies to anything that would name an idea out loud.
"""

import chess

# Pieces (not pawns, not kings) left on the board for a position to be about technique. One
# allows a rook ending; zero is a pure pawn ending.
SIMPLE_PIECES = 1
PIECE_TYPES = (chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT)
# How close the promotion race has to be for it to be the point of the position.
RACE_MARGIN = 1
# Pawns a side for a position to be bare enough that king play decides it -- the opposition
# and key squares. Two keeps 1,498 of the stored pawn endings (751 under 1000); one would
# keep 439, which is too thin to practise from for long.
BARE_PAWNS = 2


def pieces_left(board: chess.Board) -> int:
    """Pieces other than kings and pawns, both sides."""
    return sum(len(board.pieces(p, c)) for p in PIECE_TYPES for c in (chess.WHITE, chess.BLACK))


def signature(board: chess.Board) -> str:
    """The material as "KRP v KP": what is left, by side, heaviest first."""

    def side(colour: chess.Color) -> str:
        return "".join(chess.piece_symbol(p).upper() * len(board.pieces(p, colour)) for p in (*PIECE_TYPES, chess.PAWN))

    return f"K{side(chess.WHITE)} v K{side(chess.BLACK)}"


def simple(board: chess.Board, limit: int = SIMPLE_PIECES) -> bool:
    """Whether this is a simple ending: at most `limit` pieces besides kings and pawns."""
    return pieces_left(board) <= limit


def passers(board: chess.Board, colour: chess.Color) -> list[chess.Square]:
    """`colour`'s passed pawns: no enemy pawn ahead on its file or either neighbour."""
    them = not colour
    out = []
    for sq in board.pieces(chess.PAWN, colour):
        f, r = chess.square_file(sq), chess.square_rank(sq)
        ahead = range(r + 1, 8) if colour == chess.WHITE else range(0, r)
        if not any(
            board.piece_at(chess.square(nf, nr)) == chess.Piece(chess.PAWN, them)
            for nf in range(max(0, f - 1), min(8, f + 2))
            for nr in ahead
        ):
            out.append(sq)
    return out


def racing(board: chess.Board, margin: int = RACE_MARGIN) -> bool:
    """Whether a passed pawn's run at promotion is close enough to the defending king's
    chase to be the question -- the square of the pawn, in other words.

    Geometry only: the pawn's distance to its promotion square against the king's, with a
    move's credit when it is the defender's turn. It says nothing about whether the race is
    actually winnable, which needs a search; it says the race is worth asking about.
    """
    for colour in (chess.WHITE, chess.BLACK):
        them = not colour
        king = board.king(them)
        if king is None:
            continue
        for sq in passers(board, colour):
            queen = chess.square(chess.square_file(sq), 7 if colour == chess.WHITE else 0)
            chase = chess.square_distance(king, queen) - (1 if board.turn == them else 0)
            if abs(chase - chess.square_distance(sq, queen)) <= margin:
                return True
    return False


def bare(board: chess.Board, pawns: int = BARE_PAWNS) -> bool:
    """Kings and a pawn or two: where the opposition and key squares decide the game rather
    than a tactic. `simple` cannot do this job -- Lichess's `pawnEndgame` tag already means
    no pieces, so filtering on piece count alone changes nothing for a pawn ending."""
    return (
        pieces_left(board) == 0
        and max(len(board.pieces(chess.PAWN, chess.WHITE)), len(board.pieces(chess.PAWN, chess.BLACK))) <= pawns
    )


SHAPES = {"simple": simple, "racing": lambda b: simple(b) and racing(b), "bare": bare}


def matches(fen: str, shape: str | None) -> bool:
    """Whether `fen` fits a named shape. An unknown or absent shape matches everything, so a
    lesson that asks for no shape is served by theme alone."""
    test = SHAPES.get(shape) if shape else None
    if test is None:
        return True
    try:
        return test(chess.Board(fen))
    except ValueError:
        return False
