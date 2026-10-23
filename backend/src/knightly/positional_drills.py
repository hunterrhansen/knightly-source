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

Only ideas whose check is reliable are here. The plan lessons (PLAN_IDEAS, a second file,
PLANS_DATA) need checks of their own: some answers are captures (which minor piece takes),
some come from a won position (trade when ahead, the king in a won ending), and the check
names the plan the move belongs to -- a lever, a passed pawn made, a bad bishop freed -- not
the plan itself, which no board test can name.
"""

import csv
from pathlib import Path

import chess

from . import db, positional

DATA = Path(__file__).with_name("data") / "positional_drills.csv"
PLANS_DATA = Path(__file__).with_name("data") / "positional_plans.csv"

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


# --- the plan lessons ------------------------------------------------------------------------

# Material counted as the lessons count it: ahead means at least this many pawns' worth.
AHEAD = 2
# How much of a bishop's own pawns on its colour make it bad.
BAD_SHARE = 0.6
# Opening advantage: at least this many more minor pieces developed than the opponent.
LEAD = 2


def material(board: chess.Board, color: chess.Color) -> int:
    """`color`'s material minus the other side's, in pawns."""
    return sum(
        VALUES[p.piece_type] * (1 if p.color == color else -1)
        for p in board.piece_map().values()
        if p.piece_type != chess.KING
    )


def _offers_trade(board: chess.Board, move: chess.Move) -> bool:
    """A piece (not a pawn or the king) moving to where an enemy piece of the same value
    attacks it, with something of ours defending it: an exchange offered."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type in (chess.KING, chess.PAWN):
        return False
    after = board.copy(stack=False)
    after.push(move)
    them = after.attackers(not piece.color, move.to_square)
    if not any(VALUES[after.piece_type_at(sq)] == VALUES[piece.piece_type] for sq in them):
        return False
    if any(VALUES[after.piece_type_at(sq)] < VALUES[piece.piece_type] for sq in them):
        return False
    return bool(after.attackers(piece.color, move.to_square))


def trade(board: chess.Board, move: chess.Move) -> bool:
    """Ahead by AHEAD or more, offering to trade a piece."""
    return material(board, board.turn) >= AHEAD and _offers_trade(board, move)


def _minors_home(board: chess.Board, color: chess.Color) -> int:
    home = 0 if color == chess.WHITE else 7
    return sum(
        1 for t in (chess.KNIGHT, chess.BISHOP) for sq in board.pieces(t, color) if chess.square_rank(sq) == home
    )


def _lever(board: chess.Board, move: chess.Move) -> bool:
    """A pawn move after which that pawn attacks an enemy pawn."""
    if board.piece_type_at(move.from_square) != chess.PAWN or move.promotion:
        return False
    after = board.copy(stack=False)
    after.push(move)
    return bool(after.attacks(move.to_square) & after.pieces(chess.PAWN, not board.turn))


def open_lines(board: chess.Board, move: chess.Move) -> bool:
    """In the opening, ahead in development by LEAD minor pieces, a pawn lever (a pawn taking a
    pawn included) that starts opening the position."""
    if board.fullmove_number > OPENING_MOVES + 3:
        return False
    if _minors_home(board, not board.turn) - _minors_home(board, board.turn) < LEAD:
        return False
    if board.is_capture(move):
        return board.piece_type_at(move.from_square) == chess.PAWN and board.piece_type_at(move.to_square) == chess.PAWN
    return _lever(board, move)


def _loose_pawns(board: chess.Board, color: chess.Color) -> set[int]:
    return {
        sq
        for sq in board.pieces(chess.PAWN, color)
        if board.is_attacked_by(not color, sq) and not board.is_attacked_by(color, sq)
    }


def gambit(board: chess.Board, move: chess.Move) -> bool:
    """In the opening, a quiet move that leaves a pawn of ours to be taken: material for time."""
    if board.fullmove_number > OPENING_MOVES + 3:
        return False
    after = board.copy(stack=False)
    after.push(move)
    return bool(_loose_pawns(after, board.turn) - _loose_pawns(board, board.turn))


def _passed(board: chess.Board, square: chess.Square) -> bool:
    color = board.color_at(square)
    file, rank = chess.square_file(square), chess.square_rank(square)
    for sq in board.pieces(chess.PAWN, not color):
        f, r = chess.square_file(sq), chess.square_rank(sq)
        if abs(f - file) <= 1 and (r > rank if color == chess.WHITE else r < rank):
            return False
    return True


def pawn_play(board: chess.Board, move: chess.Move) -> bool:
    """Past the opening, a pawn move that is a lever or makes the pawn passed."""
    if board.fullmove_number <= OPENING_MOVES or board.piece_type_at(move.from_square) != chess.PAWN:
        return False
    if move.promotion:
        return False
    after = board.copy(stack=False)
    after.push(move)
    return _lever(board, move) or (not _passed(board, move.from_square) and _passed(after, move.to_square))


def _bad(board: chess.Board, square: chess.Square) -> bool:
    """A bishop most of whose own pawns (BAD_SHARE, three or more) stand on its colour."""
    color = board.color_at(square)
    light = chess.BB_SQUARES[square] & chess.BB_LIGHT_SQUARES
    pawns = list(board.pieces(chess.PAWN, color))
    same = [sq for sq in pawns if bool(chess.BB_SQUARES[sq] & chess.BB_LIGHT_SQUARES) == bool(light)]
    return len(same) >= 3 and len(same) >= BAD_SHARE * len(pawns)


def bad_bishop(board: chess.Board, move: chess.Move) -> bool:
    """A bad bishop either freed (FREED more safe squares) or offered in trade for theirs."""
    if board.piece_type_at(move.from_square) != chess.BISHOP or not _bad(board, move.from_square):
        return False
    if board.is_attacked_by(not board.turn, move.from_square):
        return False  # saving it, not improving it
    after = board.copy(stack=False)
    after.push(move)
    attackers = after.attackers(not board.turn, move.to_square)
    if any(after.piece_type_at(sq) == chess.BISHOP for sq in attackers) and _offers_trade(board, move):
        return True
    after.turn = board.turn
    after.ep_square = None
    if after.is_check():
        return False
    return mobility(after, move.to_square) >= mobility(board, move.from_square) + FREED


def minor_choice(board: chess.Board, move: chess.Move) -> bool:
    """A bishop or knight taking a piece or pawn that the other kind of minor piece could also
    take: which one to give up is the question."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type not in (chess.KNIGHT, chess.BISHOP) or not board.is_capture(move):
        return False
    other = chess.BISHOP if piece.piece_type == chess.KNIGHT else chess.KNIGHT
    return any(
        board.piece_type_at(m.from_square) == other
        for m in board.generate_legal_captures(to_mask=chess.BB_SQUARES[move.to_square])
    )


def endgame(board: chess.Board) -> bool:
    """No queens, and at most two pieces (not pawns) a side."""
    if board.pieces(chess.QUEEN, chess.WHITE) or board.pieces(chess.QUEEN, chess.BLACK):
        return False
    for color in (chess.WHITE, chess.BLACK):
        pieces = sum(len(board.pieces(t, color)) for t in (chess.KNIGHT, chess.BISHOP, chess.ROOK))
        if pieces > 2:
            return False
    return True


def _king_reach(board: chess.Board, square: chess.Square, color: chess.Color) -> int:
    """Distance to the nearest of the centre and the other side's pawns."""
    targets = list(CENTRE) + list(board.pieces(chess.PAWN, not color))
    return min(chess.square_distance(square, t) for t in targets)


def king_activity(board: chess.Board, move: chess.Move) -> bool:
    """In an ending you are ahead in (by a pawn or more), the king stepping nearer the centre
    or their pawns."""
    if board.piece_type_at(move.from_square) != chess.KING or board.is_castling(move):
        return False
    if not endgame(board) or material(board, board.turn) < 1:
        return False
    return _king_reach(board, move.to_square, board.turn) < _king_reach(board, move.from_square, board.turn)


# Theme -> check, for the plan lessons. Our themes, none a Lichess theme name.
PLAN_IDEAS = {
    "openLines": open_lines,
    "trade": trade,
    "gambit": gambit,
    "pawnPlay": pawn_play,
    "badBishop": bad_bishop,
    "minorChoice": minor_choice,
    "kingActivity": king_activity,
}
PLAN_THEMES = tuple(PLAN_IDEAS)
# The answers that are captures by design: which minor piece takes, a pawn taking a pawn.
TAKES = {"minorChoice", "openLines"}
# Ideas practised from a position already better: the lesson is converting it.
CONVERTING = {"trade", "kingActivity"}


def plan_carries(board: chess.Board, move: chess.Move) -> list[str]:
    """Every plan idea a legal move carries. Quiet, as `carries` asks, except for the ideas in
    TAKES; never a check, a promotion, or a threat to a piece."""
    if move not in board.legal_moves or board.gives_check(move) or move.promotion:
        return []
    out = []
    for theme, check in PLAN_IDEAS.items():
        if board.is_capture(move) and theme not in TAKES:
            continue
        if not board.is_capture(move) and theme == "minorChoice":
            continue
        if not board.is_capture(move) and threatens(board, move):
            continue
        if check(board, move):
            out.append(theme)
    return out


def load(conn: db.Connection, path: Path = DATA) -> int:
    """Store the generated drills beside the Lichess corpus; returns how many were new."""
    if path == DATA and PLANS_DATA.exists():
        return _load(conn, DATA) + _load(conn, PLANS_DATA)
    return _load(conn, path)


def _load(conn: db.Connection, path: Path) -> int:
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
