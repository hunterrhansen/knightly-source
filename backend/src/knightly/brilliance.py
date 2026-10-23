"""Great and Brilliant moves.

Chess.com publishes what these mean but not how it finds them. The rules here follow the
approach of WintrChess (github.com/WintrCat/wintrchess, an open-source game reviewer),
rewritten from its description rather than copied:

- A move only qualifies if it mattered: not when the second-best move would still have been
  completely winning, not when escaping check, and not a queen promotion. Brilliant also
  needs the mover not to be worse after it; Great doesn't (holding a lost-looking position
  with the only move is exactly what Chess.com praises).
- GREAT: the engine's top move, when its second choice would have cost at least
  great_gap(rating) points of win chance (Chess.com is more generous with new players), and
  the move isn't an obvious capture or played with a forced mate already in hand. A capture
  is obvious when another move takes the same piece, when it takes straight back what the
  opponent's last move took, or when it takes free material that didn't get there by
  capturing. Taking back later, as the only move (after an in-between move), stays eligible.
- BRILLIANT: a top move that leaves one of the mover's pieces en prise (judged on the board,
  so a sacrifice the opponent should decline still counts, as on Chess.com), unless it was
  just moving a piece out of danger, the piece was trapped anyway, or taking it walks into
  an equal or bigger counter-threat.

Everything is from the mover's point of view, evals in centipawns.
"""

import chess

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100}
WINNING_CP = 700  # the second-best move still this good: winning anyway, nothing critical
GREAT_GAP = 10  # win% the second-best move would have lost (inaccuracy/mistake boundary)
# Below the first rating the gap is 8 points, from it to the second 10, above that 12.
GREAT_GAP_BANDS = (1200, 1800)
MATE_CP = 10000  # as in analyze.py


def _value(board: chess.Board, square: chess.Square) -> int:
    piece = board.piece_at(square)
    return VALUES[piece.piece_type] if piece else 0


def _attackers(board: chess.Board, color: chess.Color, square: chess.Square) -> list[chess.Square]:
    """Pieces of `color` that could take on `square` (or recapture there): pinned pieces only
    if they stay on their pin line, the king only if it wouldn't be taken back. Defending,
    one enemy piece covering the square is the capturer itself, so it takes a second."""
    defending = board.color_at(square) == color
    others = len(board.attackers(not color, square)) - (1 if defending else 0)
    out = []
    for a in board.attackers(color, square):
        if board.is_pinned(color, a) and square not in board.pin(color, a):
            continue
        if a == board.king(color) and others > 0:
            continue
        out.append(a)
    return out


def _all_attackers(board: chess.Board, square: chess.Square) -> tuple[list, list]:
    """Every piece of each side that can join in on `square`, including ones lined up
    behind others (a rook behind a rook, a bishop behind the queen that captures first):
    peel off each layer of attackers and look again. Returns (white, black) squares."""
    b = board.copy(stack=False)
    found = {chess.WHITE: [], chess.BLACK: []}
    while True:
        layer = {
            c: _attackers(b, c, square) if not found[c] else list(b.attackers(c, square))
            for c in (chess.WHITE, chess.BLACK)
        }
        if not layer[chess.WHITE] and not layer[chess.BLACK]:
            return found[chess.WHITE], found[chess.BLACK]
        for c, squares in layer.items():
            for sq in squares:
                found[c].append(sq)
                b.remove_piece_at(sq)


def is_safe(board: chess.Board, square: chess.Square, captured: int = 0) -> bool:
    """Whether the piece on `square` can be left where it is. `captured` is the value of
    what the move that put it there took, for the rook-for-two-minors exception."""
    piece = board.piece_at(square)
    direct = _attackers(board, not piece.color, square)
    if not direct:
        return True
    white, black = _all_attackers(board, square)
    attackers, defenders = (black, white) if piece.color == chess.WHITE else (white, black)
    value = VALUES[piece.piece_type]
    lowest = min(_value(board, a) for a in direct)
    # A rook that took a minor piece and can only be won back by another minor, with a
    # recapture: two minors for a rook is a fair trade, not a sacrifice.
    if piece.piece_type == chess.ROOK and captured == 3 and len(attackers) == 1 and defenders and lowest == 3:
        return True
    if lowest < value:
        return False
    if len(attackers) <= len(defenders):
        return True
    if value < lowest and any(_value(board, d) < lowest for d in defenders):
        return True
    return any(board.piece_type_at(d) == chess.PAWN for d in defenders)


def unsafe_pieces(board: chess.Board, color: chess.Color, captured: int = 0) -> list[chess.Square]:
    """`color`'s pieces (not pawns or the king) that are en prise, ignoring any worth no
    more than what the last move captured (taking a queen with a rook isn't a rook sac)."""
    return [
        sq
        for pt in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
        for sq in board.pieces(pt, color)
        if VALUES[pt] > captured and not is_safe(board, sq, captured)
    ]


def _counter_threats(board: chess.Board, color: chess.Color, threatened: chess.Square, value: int) -> set[chess.Square]:
    """`color`'s own en prise pieces, other than on `threatened`, worth at least `value`."""
    return {sq for sq in unsafe_pieces(board, color) if sq != threatened and _value(board, sq) >= value}


def _mate_in_one(board: chess.Board) -> bool:
    for move in board.legal_moves:
        board.push(move)
        mate = board.is_checkmate()
        board.pop()
        if mate:
            return True
    return False


def _leaves_bigger_threat(board: chess.Board, threatened: chess.Square, capture: chess.Move) -> bool:
    """After the opponent takes the threatened piece with `capture`, are they left with a
    piece of theirs worth as much en prise (the capturer included: taking a "hanging" bishop
    with the queen, when that unpins the knight that guards it, loses the queen), or (for
    anything less than a queen) mated?"""
    value = _value(board, threatened)
    taker = board.turn
    after = board.copy(stack=False)
    after.push(capture)
    if _counter_threats(after, taker, threatened, value):
        return True
    if _value(after, threatened) >= value and not is_safe(after, threatened):
        return True
    return value < VALUES[chess.QUEEN] and _mate_in_one(after)


def _creates_bigger_threat(board: chess.Board, threatened: chess.Square, move: chess.Move) -> bool:
    """Whether `move` (by the threatened piece's side) newly leaves one of their pieces worth
    as much en prise, or (for anything less than a queen) allows mate in one."""
    value = _value(board, threatened)
    color = board.turn
    before = _counter_threats(board, color, threatened, value)
    after = board.copy(stack=False)
    after.push(move)
    if _counter_threats(after, color, move.to_square, value) - before:
        return True
    return value < VALUES[chess.QUEEN] and _mate_in_one(after)


def is_trapped(board: chess.Board, square: chess.Square) -> bool:
    """En prise where it stands and on every square it can go to (or going there hands the
    opponent a bigger threat)."""
    color = board.color_at(square)
    b = board.copy(stack=False)
    b.turn = color
    b.ep_square = None
    if is_safe(b, square):
        return False
    for move in b.legal_moves:
        if move.from_square != square:
            continue
        if _creates_bigger_threat(b, square, move):
            continue
        escaped = b.copy(stack=False)
        escaped.push(move)
        if is_safe(escaped, move.to_square):
            return False
    return True


def great_gap(rating: int | None) -> int:
    """GREAT_GAP for a mover of this rating (unknown counts as the middle band)."""
    if rating is None:
        return GREAT_GAP
    low, high = GREAT_GAP_BANDS
    return GREAT_GAP - 2 if rating < low else GREAT_GAP + 2 if rating > high else GREAT_GAP


def _mattered(before: chess.Board, move: chess.Move, cp_after: int, cp_second: int | None) -> bool:
    """The checks Great and Brilliant share: the move had to be found, it wasn't forced."""
    if (cp_second if cp_second is not None else cp_after) >= WINNING_CP:
        return False  # completely winning even without it
    if move.promotion == chess.QUEEN:
        return False
    return not before.is_check()  # getting out of check is forced, not found


def is_great(
    before: chess.Board,
    move: chess.Move,
    is_best: bool,
    win_before: float,
    win_second: float | None,
    cp_after: int,
    cp_second: int | None,
    rating: int | None = None,
    took_on: chess.Square | None = None,
    just_took: chess.Square | None = None,
) -> bool:
    """`took_on` is a square whose piece got there by capturing, to tell taking back from
    taking free material; `just_took` where the opponent's last move captured; `rating` is
    the mover's. Both squares None when there is none."""
    if not is_best or win_second is None or not _mattered(before, move, cp_after, cp_second):
        return False
    if cp_after >= MATE_CP - 1000:
        return False  # finding a move with mate in hand isn't critical
    if _obvious_capture(before, move, took_on, just_took):
        return False
    return win_before - win_second >= great_gap(rating)


def _obvious_capture(
    before: chess.Board, move: chess.Move, took_on: chess.Square | None, just_took: chess.Square | None
) -> bool:
    """Two ways to take the same piece, taking straight back, or taking one the opponent
    simply left en prise. Which move the engine ranked second isn't stored, so "another way
    to take it" is judged from the board."""
    if not before.is_capture(move) or before.is_en_passant(move):
        return False
    target = move.to_square
    if target == just_took:
        return True
    if any(m != move and m.to_square == target and before.is_capture(m) for m in before.legal_moves):
        return True
    return target != took_on and not is_safe(before, target)


def is_brilliant(before: chess.Board, move: chess.Move, cp_after: int, cp_second: int | None) -> bool:
    """`move` must already be the top move or as good (the caller checks)."""
    if move.promotion or cp_after < 0 or not _mattered(before, move, cp_after, cp_second):
        return False  # a Brilliant leaves the mover no worse
    mover = before.turn
    captured = 0
    if before.is_capture(move):
        captured = 1 if before.is_en_passant(move) else _value(before, move.to_square)
    after = before.copy(stack=False)
    after.push(move)
    was_unsafe = unsafe_pieces(before, mover)
    unsafe = unsafe_pieces(after, mover, captured)
    if not unsafe:
        return False
    if not after.is_check() and len(unsafe) < len(was_unsafe):
        return False  # moving a piece to safety, not giving one up
    # Not a real sacrifice if every way of taking every en prise piece backfires.
    if all(
        _leaves_bigger_threat(after, sq, capture)
        for sq in unsafe
        for capture in after.legal_moves
        if capture.to_square == sq
    ):
        return False
    was_trapped = [sq for sq in was_unsafe if is_trapped(before, sq)]
    trapped = [sq for sq in unsafe if is_trapped(after, sq)]
    if len(trapped) == len(unsafe) or move.from_square in was_trapped or len(trapped) < len(was_trapped):
        return False  # it was lost anyway
    return True
