"""Generate the basic-endgame drills (knightly.endgame_drills.DATA).

    uv run python scripts/generate_endgames.py [--engine PATH] [--per-theme 300] [--seed 1]

King and pawn against king comes from the exact solver (endgame_drills.solve_kpk); the queen
and rook mates are proved by Stockfish's mate search. Every drill is a line in which each of
your moves is the only one that keeps the result (KPK) or mates that fast (KQK, KRK), after
the opponent's setting-up move, as Lichess lays its puzzles out. Half are mirrored so you
play both colours. Deterministic for a seed and engine version; the output is committed.
"""

import argparse
import csv
import random
import sys

import chess
import chess.engine

from knightly import endgame_drills as eg

MAX_YOURS = 3  # your moves in a line at most
FIELDS = ["PuzzleId", "FEN", "Moves", "Rating", "RatingDeviation", "Popularity", "NbPlays", "Themes", "GameUrl"]
# Rough ratings, so the target-rating pick spreads them (puzzles.target_rating); a longer line
# is harder. Lichess's own pawnEndgame puzzles under 1200 are the reference.
BASE = {"squareOfPawn": 900, "keySquares": 1050, "opposition": 1200, "queenMate": 650, "rookMate": 750}


# --- king and pawn against king (exact) ------------------------------------------------------


def kpk_after(table, board: chess.Board, move: chess.Move) -> int:
    """The result for the side with the pawn after `move`: WIN or DRAW."""
    b = board.copy()
    b.push(move)
    if move.promotion:
        if b.is_checkmate():
            return eg.WIN
        if b.is_stalemate():
            return eg.DRAW
        # A new queen wins unless the lone king takes it at once.
        taken = chess.square_distance(b.king(b.turn), move.to_square) == 1 and not b.is_attacked_by(
            not b.turn, move.to_square
        )
        return eg.DRAW if taken else eg.WIN
    if not (b.pieces(chess.PAWN, chess.WHITE) or b.pieces(chess.PAWN, chess.BLACK)):
        return eg.DRAW  # the pawn was taken
    return eg.kpk_result(table, b)


def kpk_only(table, board: chess.Board) -> chess.Move | None:
    """The one move that keeps the mover's best result, or None (none, or several)."""
    pawn_sq = next(iter(board.pieces(chess.PAWN, chess.WHITE) | board.pieces(chess.PAWN, chess.BLACK)))
    strong = board.turn == board.color_at(pawn_sq)
    want = eg.WIN if strong else eg.DRAW
    if eg.kpk_result(table, board) != want:
        return None
    moves = [m for m in board.legal_moves if m.promotion in (None, chess.QUEEN)]
    good = [m for m in moves if kpk_after(table, board, m) == want]
    # Taking the pawn is no technique: a drill's answer is never a capture.
    if len(good) != 1 or len(moves) < 3 or board.is_capture(good[0]):
        return None
    return good[0]


def kpk_line(table, board: chess.Board) -> list[chess.Move]:
    """Your only-moves and the opponent's replies, while each of yours stays the only one."""
    line: list[chess.Move] = []
    b = board.copy()
    for _ in range(MAX_YOURS):
        move = kpk_only(table, b)
        if move is None:
            break
        line.append(move)
        b.push(move)
        if move.promotion or b.is_game_over():
            break
        # The opponent keeps their own best result, choosing a reply that leaves you one move.
        replies = [r for r in b.legal_moves if not (r.promotion and r.promotion != chess.QUEEN)]
        nxt = None
        for r in replies:
            c = b.copy()
            c.push(r)
            if (c.pieces(chess.PAWN, chess.WHITE) or c.pieces(chess.PAWN, chess.BLACK)) and kpk_only(table, c):
                nxt = r
                break
        if nxt is None:
            break
        line.append(nxt)
        b.push(nxt)
    # A line ends on your move.
    if len(line) % 2 == 0:
        line = line[:-1]
    return line


def kpk_theme(board: chess.Board, move: chess.Move) -> str:
    """Which idea a KPK only-move is about."""
    pawn_sq = next(iter(board.pieces(chess.PAWN, chess.WHITE) | board.pieces(chess.PAWN, chess.BLACK)))
    strong = board.color_at(pawn_sq)
    if board.turn == strong:
        return "squareOfPawn" if board.piece_type_at(move.from_square) == chess.PAWN else "keySquares"
    queening = chess.square(chess.square_file(pawn_sq), 7 if strong == chess.WHITE else 0)
    before = chess.square_distance(move.from_square, queening)
    after = chess.square_distance(move.to_square, queening)
    far = chess.square_distance(move.from_square, pawn_sq) > 2
    return "squareOfPawn" if far and after < before else "opposition"


def setup(board: chess.Board) -> chess.Move | None:
    """A king move the opponent could just have played to reach `board`, as a legal move from
    the position before it, or None."""
    them = not board.turn
    king = board.king(them)
    for origin in sorted(chess.SquareSet(chess.BB_KING_ATTACKS[king])):
        if board.piece_at(origin):
            continue
        before = board.copy(stack=False)
        before.remove_piece_at(king)
        before.set_piece_at(origin, chess.Piece(chess.KING, them))
        before.turn = them
        if not before.is_valid():
            continue
        move = chess.Move(origin, king)
        if move in before.legal_moves:
            return move
    return None


def kpk_drills(rng: random.Random, per_theme: int) -> list[dict]:
    table = eg.solve_kpk()
    found: dict[str, list[tuple[str, list[str], int]]] = {t: [] for t in ("keySquares", "opposition", "squareOfPawn")}
    squares = list(range(64))
    for wk in squares:
        for bk in squares:
            for p in range(8, 56):
                for black in (False, True):
                    if not eg._valid(wk, bk, p, black):
                        continue
                    board = chess.Board(None)
                    board.set_piece_at(wk, chess.Piece(chess.KING, chess.WHITE))
                    board.set_piece_at(bk, chess.Piece(chess.KING, chess.BLACK))
                    board.set_piece_at(p, chess.Piece(chess.PAWN, chess.WHITE))
                    board.turn = chess.BLACK if black else chess.WHITE
                    first = kpk_only(table, board)
                    if first is None or first.promotion:
                        continue
                    line = kpk_line(table, board)
                    pre = setup(board) if line else None
                    if pre is None:
                        continue
                    before = board.copy(stack=False)
                    before.remove_piece_at(pre.to_square)
                    before.set_piece_at(pre.from_square, chess.Piece(chess.KING, not board.turn))
                    before.turn = not board.turn
                    found[kpk_theme(board, first)].append(
                        (before.fen(), [pre.uci(), *(m.uci() for m in line)], len(line))
                    )
    out = []
    for theme, rows in found.items():
        rng.shuffle(rows)
        print(f"{theme}: {len(rows):,} candidates", file=sys.stderr)
        for fen, moves, n in rows[:per_theme]:
            out.append(
                {"theme": theme, "fen": fen, "moves": moves, "yours": (n + 1) // 2, "extra": "pawnEndgame endgame"}
            )
    return out


# --- queen and rook mates (proved by search) ---------------------------------------------------


def mates(engine, board: chess.Board, depth: int) -> list[tuple[chess.Move, int | None]]:
    """Every legal move with its proved mate distance for the mover (None: no mate found)."""
    infos = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=board.legal_moves.count())
    out = []
    for info in infos:
        score = info["score"].pov(board.turn)
        out.append((info["pv"][0], score.mate() if score.is_mate() and score.mate() > 0 else None))
    return out


def mate_line(engine, board: chess.Board, n: int, depth: int) -> list[chess.Move] | None:
    """The line to mate in `n`, if every move of yours in it is the only one that fast."""
    line = []
    b = board.copy()
    for left in range(n, 0, -1):
        scored = mates(engine, b, depth)
        fastest = [m for m, d in scored if d is not None and d <= left]
        if len(fastest) != 1:
            return None
        line.append(fastest[0])
        b.push(fastest[0])
        if b.is_checkmate():
            return line
        reply = engine.play(b, chess.engine.Limit(depth=depth)).move
        line.append(reply)
        b.push(reply)
    return None


def mate_drills(engine_path: str, rng: random.Random, per_theme: int, depth: int) -> list[dict]:
    out = []
    with chess.engine.SimpleEngine.popen_uci(engine_path) as engine:
        for theme, piece in (("queenMate", chess.QUEEN), ("rookMate", chess.ROOK)):
            kept, tries, seen = [], 0, set()
            while len(kept) < per_theme and tries < per_theme * 200:
                tries += 1
                board = chess.Board(None)
                # The lone king near an edge: that is where these mates happen.
                file, rank = rng.randrange(8), rng.choice((0, 0, 1, 1, 2))
                if rng.random() < 0.5:
                    file, rank = rank, file
                bk = chess.square(file, rank)
                # Your king two or three squares away: the mating net is close, as in a lesson.
                near = [s for s in range(64) if 2 <= chess.square_distance(s, bk) <= 3]
                wk = rng.choice(near)
                x = rng.choice([s for s in range(64) if s not in (bk, wk)])
                board.set_piece_at(bk, chess.Piece(chess.KING, chess.BLACK))
                board.set_piece_at(wk, chess.Piece(chess.KING, chess.WHITE))
                board.set_piece_at(x, chess.Piece(piece, chess.WHITE))
                board.turn = chess.WHITE
                if not board.is_valid() or board.is_game_over() or board.board_fen() in seen:
                    continue
                seen.add(board.board_fen())
                best = mates(engine, board, depth)
                n = min((d for _, d in best if d is not None), default=None)
                if n is None or n > 3:
                    continue
                line = mate_line(engine, board, n, depth)
                pre = setup(board) if line else None
                if pre is None:
                    continue
                before = board.copy(stack=False)
                before.remove_piece_at(pre.to_square)
                before.set_piece_at(pre.from_square, chess.Piece(chess.KING, chess.BLACK))
                before.turn = chess.BLACK
                kept.append(
                    {
                        "theme": theme,
                        "fen": before.fen(),
                        "moves": [pre.uci(), *(m.uci() for m in line)],
                        "yours": n,
                        "extra": f"mateIn{n} endgame",
                    }
                )
            print(f"{theme}: {len(kept)} kept from {tries} tries", file=sys.stderr)
            out.extend(kept)
    return out


# --- output --------------------------------------------------------------------------------------


def mirrored(fen: str, moves: list[str]) -> tuple[str, list[str]]:
    """The same drill with the colours swapped and the board flipped."""
    board = chess.Board(fen).mirror()

    def flip(uci: str) -> str:
        m = chess.Move.from_uci(uci)
        return chess.Move(chess.square_mirror(m.from_square), chess.square_mirror(m.to_square), m.promotion).uci()

    return board.fen(), [flip(m) for m in moves]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--engine", default=None)
    parser.add_argument("--per-theme", type=int, default=300)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--depth", type=int, default=12)
    parser.add_argument("--out", default=str(eg.DATA))
    args = parser.parse_args()
    from knightly.analyze import find_engine

    rng = random.Random(args.seed)
    drills = kpk_drills(rng, args.per_theme) + mate_drills(find_engine(args.engine), rng, args.per_theme, args.depth)
    eg.DATA.parent.mkdir(exist_ok=True)
    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, FIELDS)
        writer.writeheader()
        for i, d in enumerate(drills):
            fen, moves = d["fen"], d["moves"]
            if i % 2:
                fen, moves = mirrored(fen, moves)
            writer.writerow(
                {
                    "PuzzleId": f"kn{d['theme'][:2]}{i:05d}",
                    "FEN": fen,
                    "Moves": " ".join(moves),
                    "Rating": BASE[d["theme"]] + 100 * (d["yours"] - 1),
                    "RatingDeviation": 75,
                    "Popularity": 100,
                    "NbPlays": 1000,
                    "Themes": f"{d['theme']} {d['extra']}",
                    "GameUrl": "",
                }
            )
    print(f"wrote {len(drills)} drills to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
