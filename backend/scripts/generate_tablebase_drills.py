"""Generate the Steps endgame drills that need a tablebase (knightly.endgame_drills.TABLEBASE_DATA).

    uv run python scripts/generate_tablebase_drills.py --syzygy DIR [--per-theme 200] [--seed 1]

Queen against pawn and rook against pawn (Steps 4 and 5), the wrong bishop (5+), rook
endings (5, 4+ and 6) and the draws (stalemate, 2+; the draw lessons of 3, 4+, 5 and 6) are
endings of up to five pieces: too big for endgame_drills' own solver and beyond Stockfish's
certainty. Each position here is checked against the Syzygy
win/draw/loss tables: every move of yours in a drill is the only one that keeps your result
(the win, or the draw when you defend). DIR holds the 3-4 piece WDL tables and KRPvKR.rtbw,
from https://tablebase.lichess.ovh/tables/standard/3-4-5-wdl/ (checked against its sha256
list). Half the drills are mirrored so you play both colours. Deterministic for a seed.
"""

import argparse
import csv
import hashlib
import random
import sys

import chess
import chess.syzygy
from generate_endgames import FIELDS, mirrored, setup

from knightly import endgame_drills as eg

MAX_YOURS = 3
WIN, DRAW = 2, 0
# Rough ratings, by how late Steps teaches each (puzzles.target_rating spreads them). New
# themes go last: the sampler shares one random stream, so earlier themes stay as generated.
BASE = {
    "queenVsPawn": 1500,
    "rookVsPawn": 1700,
    "wrongBishop": 1600,
    "rookEndingWin": 1800,
    "rookEndingDraw": 1800,
    "stalemate": 1000,
    "drawBasics": 1300,
    "drawPieces": 1700,
}
# The draw themes' material, as (strong side's pieces, other side's pieces) beside the kings.
DRAW_MATERIAL = {
    "drawBasics": [("P", ""), ("B", "P"), ("N", "P"), ("P", "P")],
    "drawPieces": [("R", "B"), ("R", "N"), ("Q", "P"), ("R", "P")],
}


def value(tb, board: chess.Board) -> int:
    """The result for the side to move: 2 win, 0 draw, -2 loss (cursed results count as draws)."""
    if board.is_checkmate():
        return -2
    if board.is_stalemate() or board.is_insufficient_material():
        return 0
    v = tb.probe_wdl(board)
    return 2 if v == 2 else -2 if v == -2 else 0


def after(tb, board: chess.Board, move: chess.Move) -> int:
    b = board.copy(stack=False)
    b.push(move)
    return -value(tb, b)


def only(tb, board: chess.Board, want: int) -> chess.Move | None:
    """The one move that keeps `want` for the side to move, or None. Never a capture: taking
    the material is no technique."""
    moves = list(board.legal_moves)
    if len(moves) < 3 or value(tb, board) != want:
        return None
    good = [m for m in moves if after(tb, board, m) == want]
    if len(good) != 1 or board.is_capture(good[0]):
        return None
    return good[0]


def line(tb, board: chess.Board, want: int) -> list[chess.Move]:
    """Your only-moves and the opponent's best replies, while each of yours stays the only one."""
    out: list[chess.Move] = []
    b = board.copy()
    for _ in range(MAX_YOURS):
        move = only(tb, b, want)
        if move is None:
            break
        out.append(move)
        b.push(move)
        if b.is_game_over():
            break
        theirs = -want
        replies = [r for r in b.legal_moves if after(tb, b, r) == theirs]
        nxt = None
        for r in replies:
            c = b.copy()
            c.push(r)
            if not c.is_game_over() and only(tb, c, want):
                nxt = r
                break
        if nxt is None:
            break
        out.append(nxt)
        b.push(nxt)
    return out[: len(out) - (1 - len(out) % 2)] if out else out


def stalemates(board: chess.Board) -> bool:
    """Whether some move for the side to move stalemates the other."""
    for m in board.legal_moves:
        b = board.copy(stack=False)
        b.push(m)
        if b.is_stalemate():
            return True
    return False


def place(rng, board: chess.Board, pieces: list[tuple[chess.Piece, list[int]]]) -> bool:
    """Put each piece on a random free square from its list."""
    for piece, squares in pieces:
        free = [s for s in squares if board.piece_at(s) is None]
        if not free:
            return False
        board.set_piece_at(rng.choice(free), piece)
    return True


def near(sq: int, d: int) -> list[int]:
    return [s for s in chess.SQUARES if chess.square_distance(s, sq) <= d]


def advanced_pawn(rng, color: chess.Color) -> int:
    """A pawn on its fourth to seventh rank, where draws are decided."""
    rank = rng.choice((3, 4, 5, 6))
    return chess.square(rng.randrange(8), rank if color == chess.WHITE else 7 - rank)


def sample_draw(rng, theme: str) -> tuple[chess.Board, int] | None:
    """A position from the draw themes, and the result the side to move plays for.

    stalemate: half the time the side in trouble must find the one move that sets a stalemate
    trap; half the time the winning side must find the one win where another move stalemates
    (checked in `fits`). drawBasics and drawPieces: the side to move holds the draw with one
    move only, so every other move loses."""
    W, B = chess.WHITE, chess.BLACK
    board = chess.Board(None)
    if theme == "stalemate":
        strong, weak = rng.choice([("Q", "P"), ("P", ""), ("Q", ""), ("R", ""), ("Q", ""), ("R", "P")])
    else:
        strong, weak = rng.choice(DRAW_MATERIAL[theme])
    pieces: list[tuple[chess.Piece, list[int]]] = []
    if "P" in weak:
        pawn = advanced_pawn(rng, B) if strong != "Q" else chess.square(rng.choice((0, 2, 5, 7)), 1)
        pieces += [(chess.Piece(chess.PAWN, B), [pawn]), (chess.Piece(chess.KING, B), near(pawn, 2))]
    if "P" in strong:
        pawn = advanced_pawn(rng, W)
        pieces += [(chess.Piece(chess.PAWN, W), [pawn]), (chess.Piece(chess.KING, W), near(pawn, 2))]
        if "P" not in weak:
            ahead = chess.square(chess.square_file(pawn), 7)
            pieces.append((chess.Piece(chess.KING, B), near(ahead, 3)))
    if weak == "" and strong in ("Q", "R"):
        # The lone king on the edge, yours beside it: where mate and stalemate sit side by side.
        edge = [s for s in chess.SQUARES if chess.square_file(s) in (0, 7) or chess.square_rank(s) in (0, 7)]
        king = rng.choice(edge)
        pieces += [(chess.Piece(chess.KING, B), [king]), (chess.Piece(chess.KING, W), near(king, 2))]
    for symbol, color in ((strong, W), (weak, B)):
        for ch in symbol:
            if ch != "P":
                pieces.append((chess.Piece.from_symbol(ch if color == W else ch.lower()), list(chess.SQUARES)))
    kings = {p.color for p, _ in pieces if p.piece_type == chess.KING}
    for color in (W, B):
        if color not in kings:
            pieces.append((chess.Piece(chess.KING, color), list(chess.SQUARES)))
    if not place(rng, board, pieces):
        return None
    if theme == "stalemate" and rng.random() < 0.5:
        board.turn, want = W, WIN
    else:
        board.turn, want = rng.choice((W, B)), DRAW
    if not board.is_valid():
        return None
    return board, want


def fits(tb, board: chess.Board, want: int, theme: str, moves: list[chess.Move]) -> bool:
    """The draw themes' extra tests. None of yours is a promotion: queening, like taking, is no
    technique. In the stalemate theme, stalemate is what the drill is about."""
    if theme not in DRAWS:
        return True
    if any(m.promotion for m in moves[::2]):
        return False
    if theme != "stalemate":
        return True
    if want == WIN:
        # Another move stalemates at once: the win has to be found around it.
        return any(m != moves[0] and _stalemate_after(board, m) for m in board.legal_moves)
    after_first = board.copy(stack=False)
    after_first.push(moves[0])
    return stalemates(after_first)


def mate_not_stalemate(board: chess.Board) -> chess.Move | None:
    """The one mating move, where another move stalemates instead, or None."""
    mates = [m for m in board.legal_moves if _mate_after(board, m)]
    if len(mates) != 1 or not any(_stalemate_after(board, m) for m in board.legal_moves):
        return None
    return mates[0]


def _mate_after(board: chess.Board, move: chess.Move) -> bool:
    b = board.copy(stack=False)
    b.push(move)
    return b.is_checkmate()


def _stalemate_after(board: chess.Board, move: chess.Move) -> bool:
    b = board.copy(stack=False)
    b.push(move)
    return b.is_stalemate()


def sample(rng, theme: str) -> tuple[chess.Board, int] | None:
    """A random position for `theme` with White the side with the extra piece, and which result
    the side to move (the learner) is playing for."""
    W, B = chess.WHITE, chess.BLACK
    board = chess.Board(None)
    if theme == "queenVsPawn":
        # Their pawn one step from queening, their king beside it: can you still win?
        pawn = chess.square(rng.randrange(8), 1)
        ok = place(
            rng,
            board,
            [
                (chess.Piece(chess.PAWN, B), [pawn]),
                (chess.Piece(chess.KING, B), near(pawn, 1)),
                (chess.Piece(chess.KING, W), list(chess.SQUARES)),
                (chess.Piece(chess.QUEEN, W), list(chess.SQUARES)),
            ],
        )
    elif theme == "rookVsPawn":
        pawn = chess.square(rng.randrange(8), rng.choice((2, 3, 4)))
        ok = place(
            rng,
            board,
            [
                (chess.Piece(chess.PAWN, B), [pawn]),
                (chess.Piece(chess.KING, B), near(pawn, 2)),
                (chess.Piece(chess.KING, W), near(pawn, 4)),
                (chess.Piece(chess.ROOK, W), list(chess.SQUARES)),
            ],
        )
    elif theme == "wrongBishop":
        # A rook pawn and a bishop that does not cover its queening corner.
        file = rng.choice((0, 7))
        pawn = chess.square(file, rng.choice((4, 5, 6)))
        corner = chess.square(file, 7)
        wrong = [
            s
            for s in chess.SQUARES
            if (chess.square_file(s) + chess.square_rank(s)) % 2
            != (chess.square_file(corner) + chess.square_rank(corner)) % 2
        ]
        ok = place(
            rng,
            board,
            [
                (chess.Piece(chess.PAWN, W), [pawn]),
                (chess.Piece(chess.KING, B), near(corner, 3)),
                (chess.Piece(chess.KING, W), near(pawn, 3)),
                (chess.Piece(chess.BISHOP, W), wrong),
            ],
        )
    else:  # rook endings: king, rook and pawn against king and rook
        pawn = chess.square(rng.randrange(1, 7), rng.choice((3, 4, 5, 6)))
        ok = place(
            rng,
            board,
            [
                (chess.Piece(chess.PAWN, W), [pawn]),
                (chess.Piece(chess.KING, W), near(pawn, 2)),
                (chess.Piece(chess.KING, B), near(chess.square(chess.square_file(pawn), 7), 3)),
                (chess.Piece(chess.ROOK, W), list(chess.SQUARES)),
                (chess.Piece(chess.ROOK, B), list(chess.SQUARES)),
            ],
        )
    if not ok:
        return None
    # The side with the extra piece plays for the win; the defender, for the draw.
    if theme == "wrongBishop":
        strong_to_move = rng.random() < 0.3  # mostly the defender's lesson: run for the corner
    else:
        strong_to_move = theme != "rookEndingDraw"
    board.turn = W if strong_to_move else B
    if not board.is_valid():
        return None
    return board, (WIN if strong_to_move else DRAW)


DRAWS = ("stalemate", "drawBasics", "drawPieces")
MATE_NOT_STALEMATE = 800


def drills(tb, rng, theme: str, per_theme: int) -> list[dict]:
    kept, tries, seen, mates = [], 0, set(), 0
    # Stalemate positions are rare among random ones (about one in a thousand); the rest are not.
    while len(kept) < per_theme and tries < per_theme * (4000 if theme == "stalemate" else 400):
        tries += 1
        got = sample_draw(rng, theme) if theme in DRAWS else sample(rng, theme)
        if not got:
            continue
        board, want = got
        if board.board_fen() in seen:
            continue
        seen.add(board.board_fen())
        try:
            first = mate_not_stalemate(board) if theme == "stalemate" and want == WIN else None
            if first and mates >= per_theme // 2:
                continue  # half the stalemate lesson, at most: the other half asks for more
            moves = [first] if first else line(tb, board, want)
        except (KeyError, chess.syzygy.MissingTableError):
            continue
        if moves and not fits(tb, board, want, theme, moves):
            continue
        pre = setup(board) if moves else None
        if pre is None:
            continue
        before = board.copy(stack=False)
        before.remove_piece_at(pre.to_square)
        before.set_piece_at(pre.from_square, chess.Piece(chess.KING, not board.turn))
        before.turn = not board.turn
        kept.append(
            {
                "theme": theme,
                "fen": before.fen(),
                "moves": [pre.uci(), *(m.uci() for m in moves)],
                "yours": (len(moves) + 1) // 2,
                # Mate rather than stalemate is the lesson's first exercise, and its easiest.
                "base": MATE_NOT_STALEMATE if first else BASE[theme],
            }
        )
        mates += bool(first)
    print(f"{theme}: {len(kept)} kept from {tries} tries", file=sys.stderr)
    return kept


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--syzygy", required=True)
    parser.add_argument("--per-theme", type=int, default=200)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--out", default=str(eg.TABLEBASE_DATA))
    args = parser.parse_args()
    rng = random.Random(args.seed)
    out = []
    with chess.syzygy.open_tablebase(args.syzygy) as tb:
        for theme in BASE:
            out += drills(tb, rng, theme, args.per_theme)
    # A mate-not-stalemate drill can be one generate_endgames already made as a plain mate.
    with open(eg.DATA, newline="") as f:
        seen = {row["PuzzleId"] for row in csv.DictReader(f)}
    written = 0
    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, FIELDS)
        writer.writeheader()
        for i, d in enumerate(out):
            fen, moves = d["fen"], d["moves"]
            if i % 2:
                fen, moves = mirrored(fen, moves)
            pid = "kn" + hashlib.sha1(f"{fen} {' '.join(moves)}".encode()).hexdigest()[:10]
            if pid in seen:
                continue
            seen.add(pid)
            written += 1
            writer.writerow(
                {
                    "PuzzleId": pid,
                    "FEN": fen,
                    "Moves": " ".join(moves),
                    "Rating": d.get("base", BASE[d["theme"]]) + 100 * (d["yours"] - 1),
                    "RatingDeviation": 75,
                    "Popularity": 100,
                    "NbPlays": 1000,
                    "Themes": f"{d['theme']} endgame",
                    "GameUrl": "",
                }
            )
    print(f"wrote {written} drills to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
