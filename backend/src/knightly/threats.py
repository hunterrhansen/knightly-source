"""The opponent's threats: what they would win if the side to move passed.

Shared by mistake layers (layers.py), practice grades and the "What do they threaten?" drill
(docs/specs/2026-10-16-safety-habit-training-design.md). A threat is a fact of the
engine's own line: it mates, or its first REFUTE_PLIES win the opponent at least LOSS points
net (a piece for a pawn, or the exchange), with recaptures followed to their end (explain._walk). Pawn grabs and positional threats
are not claimed either way.
"""

import chess
import chess.engine

from .explain import REFUTE_PLIES, _walk

LINES = 5  # the opponent's top lines looked at: enough that a smaller win is not crowded out
LOSS = 2  # points net that make a line a threat: a piece for a pawn, or the exchange
MOVE_TIME = 2.0  # seconds per search, as practice grading


def passed(board: chess.Board) -> chess.Board | None:
    """`board` with the side to move passing (en passant cleared), or None when asking
    makes no sense: in check (passing is illegal) or the game is over."""
    if board.is_check() or board.is_game_over():
        return None
    out = board.copy()
    out.push(chess.Move.null())
    return out


def describe(board: chess.Board, pv: list[chess.Move], score: chess.engine.PovScore) -> dict | None:
    """Line `pv` (from `board`, opponent to move) as a threat entry, threat or not: what it nets
    them and the mate it gives. None when the line has no legal first move."""
    if not pv or pv[0] not in board.legal_moves:
        return None
    them = board.turn
    mate = score.pov(them).mate()
    _, gained, _ = _walk(board, pv, REFUTE_PLIES)
    net = gained[them] - gained[not them]
    return {
        "uci": pv[0].uci(),
        "san": board.san(pv[0]),
        "line": [m.uci() for m in pv[:REFUTE_PLIES]],
        "net": net,
        "mate": mate if mate is not None and mate > 0 else None,
    }


def from_line(board: chess.Board, pv: list[chess.Move], score: chess.engine.PovScore) -> dict | None:
    """The threat that line `pv` (from `board`, opponent to move, as `passed` returns) carries
    out, or None when it mates nothing and wins less than LOSS points net."""
    found = describe(board, pv, score)
    if found is None or (found["mate"] is None and found["net"] < LOSS):
        return None
    return found


def search(
    engine: chess.engine.SimpleEngine, board: chess.Board, depth: int, time: float = MOVE_TIME
) -> list[dict] | None:
    """The opponent's threats in `board` (learner to move): a list, best line first, empty when
    nothing in their top LINES lines mates or wins LOSS points. None when there is nothing to
    ask (in check, game over) or the search was capped below `depth`: unknown is never "no
    threat"."""
    board_passed = passed(board)
    if board_passed is None:
        return None
    return replies(engine, board_passed, depth, time)


def replies(
    engine: chess.engine.SimpleEngine, board: chess.Board, depth: int, time: float = MOVE_TIME
) -> list[dict] | None:
    """The opponent's winning moves in `board` (the opponent to move): every one of their top
    LINES lines that mates or wins LOSS points, best first. None when the game is over or the
    search was capped below `depth`."""
    if board.is_game_over():
        return None
    count = min(LINES, board.legal_moves.count())
    # A fresh board from the FEN: engines are sent positions, not a history with a null move.
    infos = engine.analyse(chess.Board(board.fen()), chess.engine.Limit(depth=depth, time=time), multipv=count)
    if isinstance(infos, dict):
        infos = [infos]
    if not infos or any(i.get("depth", 0) < depth or "score" not in i for i in infos):
        return None
    found, seen = [], set()
    for info in infos:
        threat = from_line(board, info.get("pv") or [], info["score"])
        if threat and threat["uci"] not in seen:
            seen.add(threat["uci"])
            found.append(threat)
    return found
