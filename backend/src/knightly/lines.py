"""Engine lines for game review's "Why" and "Best line" buttons, computed on demand.

For one move we want two short lines: the BEST line from the position before it (what the
mover should have played) and the WHY line from the position after it (how the opponent
punishes it). Stockfish gives the moves and a score but no reasons, so `explain()` writes a
sentence from what the line does: mate, material won or lost, or just the swing in win
chance.
"""

import json

import chess
import chess.engine

from .analyze import MATE_CP, find_engine, win_pct

VERSION = 2  # bump when the output changes, so cached lines are recomputed
MIN_PLIES = 4  # show at least this much of a line...
MAX_PLIES = 8  # ...and at most this, stopping early at the first quiet move after MIN_PLIES
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def material(board: chess.Board, color: chess.Color) -> int:
    """Material balance from `color`'s side, in pawns."""
    return sum(v * (len(board.pieces(p, color)) - len(board.pieces(p, not color))) for p, v in VALUES.items())


def trim(board: chess.Board, pv: list[chess.Move]) -> list[chess.Move]:
    """Cut the engine's principal variation to a readable length without stopping in the
    middle of an exchange: after MIN_PLIES, stop before the first quiet move (no capture,
    no check)."""
    b = board.copy()
    out = []
    for move in pv[:MAX_PLIES]:
        if len(out) >= MIN_PLIES and not b.is_capture(move) and not b.gives_check(move):
            break
        out.append(move)
        b.push(move)
    return out


def _amount(points: int) -> str:
    return {
        1: "a pawn",
        2: "two pawns",
        3: "a piece",
        4: "a piece and a pawn",
        5: "a rook",
        6: "a rook and a pawn",
        9: "the queen",
    }.get(points, f"{points} points of material")


def _mark(board: chess.Board, move: chess.Move) -> str:
    """A move in the explanation, tagged with who plays it ("[[b:Rb3]]") so the web app can
    draw the piece icon in that side's style."""
    return f"[[{'w' if board.turn == chess.WHITE else 'b'}:{board.san(move)}]]"


def _san_line(board: chess.Board, moves: list[chess.Move], limit: int = 3) -> str:
    b = board.copy()
    out = []
    for move in moves[:limit]:
        out.append(_mark(b, move))
        b.push(move)
    return " ".join(out)


def explain(
    kind: str,
    before: chess.Board,
    played: chess.Move,
    start: chess.Board,
    moves: list[chess.Move],
    score: chess.engine.PovScore,
    opponent: str,
) -> str:
    """One sentence for a line. `before` is the position before the reviewed move, `start`
    where the line begins (before it for "best", after it for "why"), `score` the engine's
    score at the end of the line."""
    mover = before.turn
    end = start.copy()
    for move in moves:
        end.push(move)
    gained = material(end, mover) - material(before, mover)
    mate = score.pov(mover).mate()
    played_san = _mark(before, played)

    if kind == "best":
        best_san = _mark(before, moves[0])
        if mate is not None and mate > 0:
            return f"{best_san} mates in {mate}: {_san_line(start, moves, 5)}."
        if gained > 0:
            follow = start.copy()
            follow.push(moves[0])
            tail = _san_line(follow, moves[1:])
            return f"{best_san} wins {_amount(gained)}" + (f", after {tail}…" if tail else ".")
        if gained < 0:
            return f"{best_san} gives up {_amount(-gained)} for a stronger position."
        return f"{best_san} keeps the balance where it was, unlike {played_san}."

    reply = _mark(start, moves[0])
    if mate is not None and mate < 0:
        return f"{played_san} allows mate in {-mate}, starting with {reply}."
    if gained < 0:
        return f"After {played_san}, {opponent} plays {reply} and wins {_amount(-gained)}."
    if gained > 0:
        return f"{played_san} wins {_amount(gained)}, but {reply} leaves you worse off than before."
    return f"No material changes hands, but after {reply} your position is worse."


def line_json(
    kind: str,
    before: chess.Board,
    played: chess.Move,
    start: chess.Board,
    pv: list[chess.Move],
    score: chess.engine.PovScore,
    opponent: str,
) -> dict:
    moves = trim(start, pv)
    b = start.copy()
    san = []
    for move in moves:
        san.append(b.san(move))
        b.push(move)
    mover = before.turn
    cp = score.pov(mover).score(mate_score=MATE_CP)
    return {
        "v": VERSION,
        "kind": kind,
        "start_fen": start.fen(),
        "moves": [m.uci() for m in moves],
        "san": san,
        # The reviewed move's mover's win chance at the end of the line.
        "win_pct": round(win_pct(cp), 1) if cp is not None else None,
        "mate": score.pov(mover).mate(),
        "summary": explain(kind, before, played, start, moves, score, opponent) if moves else None,
    }


def compute(fen_before: str, played_uci: str, opponent: str, analyse) -> dict:
    """Both lines for one move. `analyse(board) -> (PovScore, [Move])` runs the engine."""
    before = chess.Board(fen_before)
    played = chess.Move.from_uci(played_uci)
    after = before.copy()
    after.push(played)
    out = {}
    best_score, best_pv = analyse(before)
    if best_pv:
        out["best"] = line_json("best", before, played, before, best_pv, best_score, opponent)
    if not after.is_game_over():
        why_score, why_pv = analyse(after)
        if why_pv:
            out["why"] = line_json("why", before, played, after, why_pv, why_score, opponent)
    return out


def _stored(board: chess.Board, line: str | None, cp: int | None, mate: int | None):
    """A stored analysis line as `analyse` returns one: (PovScore, [Move]). The line stops
    at its first move that isn't legal, so a bad row can't produce an illegal line."""
    score = chess.engine.PovScore(
        chess.engine.Mate(mate) if mate is not None else chess.engine.Cp(cp or 0), chess.WHITE
    )
    b = board.copy()
    moves = []
    for uci in (line or "").split():
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            break
        if move not in b.legal_moves:
            break
        moves.append(move)
        b.push(move)
    return score, moves


def from_analysis(fen_before: str, played_uci: str, opponent: str, row) -> dict:
    """Both lines for one move from what the game's analysis stored (best_line, reply_line
    and the evals around the move), with no engine: the same output as `compute`."""
    before = chess.Board(fen_before)
    after = before.copy()
    after.push(chess.Move.from_uci(played_uci))
    found = {
        before.fen(): _stored(before, row["best_line"], row["eval_before"], row["mate_before"]),
        after.fen(): _stored(after, row["reply_line"], row["eval_after"], row["mate_after"]),
    }
    return compute(fen_before, played_uci, opponent, lambda board: found[board.fen()])


def preview(board: chess.Board, analyse) -> dict:
    """One short continuation; all numbers describe the current position for White."""
    outcome = board.outcome()
    result = None
    if outcome:
        result = {
            chess.Termination.CHECKMATE: "Checkmate",
            chess.Termination.STALEMATE: "Draw by stalemate",
            chess.Termination.INSUFFICIENT_MATERIAL: "Draw by insufficient material",
            chess.Termination.FIVEFOLD_REPETITION: "Draw by repetition",
            chess.Termination.SEVENTYFIVE_MOVES: "Draw by the seventy-five-move rule",
        }.get(outcome.termination, "Draw")
    elif board.is_repetition(3):
        result = "Draw by repetition"
    elif board.is_fifty_moves():
        result = "Draw by the fifty-move rule"
    if result:
        winner = outcome.winner if outcome else None
        return {
            "start_fen": board.fen(),
            "moves": [],
            "san": [],
            "eval_cp": None if winner is not None else 0,
            "mate": 0 if winner is not None else None,
            "white_win": 100 if winner == chess.WHITE else 0 if winner == chess.BLACK else 50,
            "result": result,
        }
    score, pv = analyse(board)
    white = score.white()
    cp = white.score(mate_score=MATE_CP)
    mate = white.mate()
    candidates = trim(board, pv)
    moves = []
    shown = board.copy()
    san = []
    for move in candidates:
        san.append(shown.san(move))
        shown.push(move)
        moves.append(move)
        if shown.is_game_over() or shown.is_repetition(3) or shown.is_fifty_moves():
            break
    return {
        "start_fen": board.fen(),
        "moves": [m.uci() for m in moves],
        "san": san,
        "eval_cp": white.score(),
        "mate": mate,
        "white_win": (100 if mate > 0 else 0) if mate is not None else round(win_pct(cp), 1) if cp is not None else 50,
        "result": None,
    }


class Engine:
    """A short-lived Stockfish for on-demand lines (one request, two positions)."""

    def __init__(self, depth: int, engine_path: str | None = None):
        self.depth = depth
        self.engine = chess.engine.SimpleEngine.popen_uci(find_engine(engine_path))

    def __call__(self, board: chess.Board):
        info = self.engine.analyse(board, chess.engine.Limit(depth=self.depth))
        return info["score"], info.get("pv", [])

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.engine.quit()


# A move's stored analysis, as from_analysis reads it, with who answers it.
STORED = """m.ply, m.uci, m.is_user, m.best_line, m.reply_line, m.eval_before, m.mate_before,
            m.eval_after, m.mate_after, g.opponent"""


def answerer(move) -> str:
    """Who answers the move in the "why" line: you, after the opponent's moves."""
    return "you" if move["is_user"] is False else (move["opponent"] or "your opponent")


def stored_moves(conn, game_id: int) -> list:
    """A game's moves whose analysis stored lines, in order."""
    return conn.execute(
        f"""SELECT {STORED} FROM moves m JOIN games g ON g.id = m.game_id
            WHERE m.game_id = %s AND (m.best_line IS NOT NULL OR m.reply_line IS NOT NULL)
            ORDER BY m.ply""",
        (game_id,),
    ).fetchall()


def stored_move(conn, game_id: int, ply: int):
    """One analysed move, with or without stored lines; None when there's none."""
    return conn.execute(
        f"""SELECT {STORED} FROM moves m JOIN games g ON g.id = m.game_id
            WHERE m.game_id = %s AND m.ply = %s""",
        (game_id, ply),
    ).fetchone()


def cached(conn, game_id: int, depth: int, ply: int | None = None) -> dict[int, dict]:
    """Lines computed on demand at `depth` by an earlier request, by ply, while still
    current (lines written by an older VERSION are left out, to be recomputed)."""
    rows = conn.execute(
        "SELECT ply, data FROM engine_lines WHERE game_id = %s AND depth = %s"
        + (" AND ply = %s" if ply is not None else ""),
        (game_id, depth, *(() if ply is None else (ply,))),
    ).fetchall()
    out = {}
    for r in rows:
        data = json.loads(r["data"])
        if all(line.get("v") == VERSION for line in data.values()):
            out[r["ply"]] = data
    return out


def save(conn, game_id: int, ply: int, depth: int, data: dict) -> None:
    conn.execute(
        """INSERT INTO engine_lines (game_id, ply, depth, data) VALUES (%s, %s, %s, %s)
           ON CONFLICT (game_id, ply, depth)
           DO UPDATE SET data = excluded.data, created_at = iso_now()""",
        (game_id, ply, depth, json.dumps(data)),
    )
