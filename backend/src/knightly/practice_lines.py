"""Forcing lines for practice positions, and the step-by-step grading of an answer.

A card whose best move starts a forcing line is solved like a Chess.com puzzle: you move,
the opponent's reply plays in, you continue. The worker builds the line (never a deck GET):
from the card's best move, the opponent answers with the engine's first choice, and your
next move extends the line only when it is clearly the one move (the deck's CLEAR_GAP) or
mates where the second choice doesn't. Any shallow search or engine failure keeps the card
to its one move, exactly as before lines existed.

`step` grades one submitted move list against a line, for own-game cards and Lichess
puzzles alike. The client sends every move played so far; the server keeps no state
between moves and judges only the last one.
"""

import hashlib
import json

import chess
import chess.engine

from .analyze import MATE_CP, win_pct

VERSION = 1
LINE_DEPTH = 16
MOVE_TIME = 3.0  # cap per search; a capped, shallow search is no line
MAX_LEARNER_MOVES = 3  # so at most five plies
SKIP = "0000"  # Show Solution


class LineChanged(RuntimeError):
    """The answer names a line this exercise no longer has: reopen the position."""


class PrefixMismatch(ValueError):
    """The submitted moves leave the line before the last one, or run past its end."""


def key(fen: str, moves: list[str]) -> str:
    """Names a line's content, so an answer can say which line it was attempting."""
    return hashlib.sha256(json.dumps([fen, moves], separators=(",", ":")).encode()).hexdigest()[:16]


def fingerprint(fen, best_uci, eval_best, engine):
    from . import deck

    value = [VERSION, fen, best_uci, eval_best, engine, LINE_DEPTH, MOVE_TIME, MAX_LEARNER_MOVES, deck.CLEAR_GAP]
    return hashlib.sha256(json.dumps(value, separators=(",", ":")).encode()).hexdigest()


def _search(engine, board, multipv):
    """The engine's top `multipv` lines, or None when any of them fell short of LINE_DEPTH."""
    infos = engine.analyse(board, chess.engine.Limit(depth=LINE_DEPTH, time=MOVE_TIME), multipv=multipv)
    infos = infos if isinstance(infos, list) else [infos]
    if not infos or any(i.get("depth", 0) < LINE_DEPTH or not i.get("pv") or "score" not in i for i in infos):
        return None
    return infos


def _unique(infos, learner: chess.Color) -> bool:
    """Whether the best move is clearly the one move: the only legal move, a mate where the
    second choice doesn't mate, or CLEAR_GAP points of win chance better."""
    from . import deck

    if len(infos) == 1:
        return True
    best, second = (i["score"].pov(learner) for i in infos[:2])
    if best.mate() is not None and best.mate() > 0:
        return not (second.mate() is not None and second.mate() > 0)
    return win_pct(best.score(mate_score=MATE_CP)) - win_pct(second.score(mate_score=MATE_CP)) >= deck.CLEAR_GAP


def build(fen: str, best_uci: str, engine) -> list[str]:
    """The line from `fen` starting with `best_uci`: learner moves at even indexes. One move
    when the line can't be trusted."""
    board = chess.Board(fen)
    first = chess.Move.from_uci(best_uci)
    if first not in board.legal_moves:
        return [best_uci]
    learner = board.turn
    line = [first]
    board.push(first)
    try:
        while (len(line) + 1) // 2 < MAX_LEARNER_MOVES and not board.is_game_over():
            replies = _search(engine, board, 1)
            if replies is None:
                return [best_uci]
            reply = replies[0]["pv"][0]
            board.push(reply)
            if board.is_game_over():
                break  # a line never ends on the opponent's move
            infos = _search(engine, board, 2)
            if infos is None:
                return [best_uci]
            if not _unique(infos, learner):
                break
            move = infos[0]["pv"][0]
            line += [reply, move]
            board.push(move)
    except (chess.engine.EngineError, OSError, TimeoutError):
        return [best_uci]
    return [m.uci() for m in line]


def compute(fen, best_uci, eval_best, engine, revision=None):
    moves = build(fen, best_uci, engine)
    return {
        "version": VERSION,
        "key": fingerprint(fen, best_uci, eval_best, revision or engine.id["name"]),
        "fen": fen,
        "moves": moves,
    }


def _legal(fen: str, moves: list[str]) -> bool:
    board = chess.Board(fen)
    try:
        for uci in moves:
            move = chess.Move.from_uci(uci)
            if move not in board.legal_moves:
                return False
            board.push(move)
    except ValueError:
        return False
    return True


def cached(row, fen):
    """The stored line for a card, when it was built from this exact position, reference
    move, eval, engine and policy; else None."""
    from .practice_grades import engine_revision

    value = row["practice_line"]
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    if not isinstance(value, dict):
        return None
    revision = engine_revision()
    if not revision or value.get("version") != VERSION or value.get("fen") != fen:
        return None
    if value.get("key") != fingerprint(fen, row["best_uci"], row["eval_before"], revision):
        return None
    moves = value.get("moves")
    if (
        not isinstance(moves, list)
        or not moves
        or len(moves) % 2 == 0
        or moves[0] != row["best_uci"]
        or not all(isinstance(m, str) for m in moves)
        or not _legal(fen, moves)
    ):
        return None
    return value


def line_for(row, fen) -> list[str]:
    """The line a card is served and graded with: the stored one, else its one best move."""
    value = cached(row, fen)
    return value["moves"] if value else [row["best_uci"]]


def san_line(fen: str, moves: list[str]) -> list[str]:
    """The moves in SAN; from the first one that isn't legal (or SKIP), as given."""
    board = chess.Board(fen)
    out = []
    for i, uci in enumerate(moves):
        try:
            move = chess.Move.from_uci(uci)
            if not move or move not in board.legal_moves:
                raise ValueError(uci)
        except ValueError:
            return out + moves[i:]
        out.append(board.san(move))
        board.push(move)
    return out


def step(fen: str, line: list[str], moves: list[str], judge_first=None) -> dict:
    """Grade the last learner move of `moves` (the whole list played from `fen`) against
    `line`. `judge_first(uci)` grades a first move that isn't the line's (own-game cards
    accept close alternatives); without it, only the line's move or a mate counts.

    Returns {"status": "continue", "reply": uci} or a terminal {"status": "solved" | "failed" |
    "shown", "quality", "exact"}, with "step" (the learner-move index) and "expected" (the
    line's move at that step). Raises PrefixMismatch for a list the line can't have produced."""
    if not moves or len(moves) % 2 == 0 or len(moves) > len(line):
        raise PrefixMismatch("These moves don't follow this position's solution.")
    if moves[:-1] != line[: len(moves) - 1]:
        raise PrefixMismatch("These moves don't follow this position's solution.")
    index = len(moves) - 1
    out = {"step": index // 2, "expected": line[index]}
    uci = moves[-1]
    if uci == SKIP:
        return {**out, "status": "shown", "quality": "shown", "exact": False}
    if uci == line[index]:
        if index + 1 < len(line):
            return {**out, "status": "continue", "reply": line[index + 1]}
        return {**out, "status": "solved", "quality": "best", "exact": True}
    board = chess.Board(fen)
    for prior in moves[:-1]:
        board.push(chess.Move.from_uci(prior))
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return {**out, "status": "failed", "quality": "wrong", "exact": False}
    if move not in board.legal_moves:
        return {**out, "status": "failed", "quality": "wrong", "exact": False}
    board.push(move)
    if board.is_checkmate():
        return {**out, "status": "solved", "quality": "best", "exact": False}
    if index == 0 and judge_first is not None:
        quality = judge_first(uci)
        if quality in ("best", "excellent", "good"):
            return {**out, "status": "solved", "quality": quality, "exact": False}
        return {**out, "status": "failed", "quality": quality, "exact": False}
    return {**out, "status": "failed", "quality": "wrong", "exact": False}


def hint_move(line: list[str], moves: list[str]) -> str:
    """The line's move for the learner's next step after `moves` (an even-length prefix)."""
    if len(moves) % 2 or len(moves) >= len(line) or moves != line[: len(moves)]:
        raise PrefixMismatch("These moves don't follow this position's solution.")
    return line[len(moves)]
