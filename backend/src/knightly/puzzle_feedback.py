"""Coaching explanations for Lichess practice puzzles, prepared by the worker.

Puzzles are graded only against Lichess's line (or a mate), so they have no grade map; this
keeps just what the coach says: for each other first move, the engine's punishing reply and
its reason (explain.py), and the line's why. Searches run in the `practice` job for the
day's served puzzle, never in a deck GET; a partial set is useful and a move without an
explanation shows the plain verdict.
"""

import hashlib
import json
import time

import chess
import chess.engine

from . import explain

VERSION = 1


def fingerprint(fen: str, line: list[str], engine: str) -> str:
    from . import deck, practice_grades

    value = [
        VERSION,
        fen,
        line,
        engine,
        deck.JUDGE_DEPTH,
        practice_grades.MOVE_TIME,
        practice_grades.CARD_TIME,
        explain.REFUTE_PLIES,
    ]
    return hashlib.sha256(json.dumps(value, separators=(",", ":")).encode()).hexdigest()


def compute(fen: str, line: list[str], engine, revision: str | None = None) -> dict:
    from . import deck, practice_grades

    board = chess.Board(fen)
    solution = explain.why(fen, line)
    explanations = {}
    legal = list(board.legal_moves)
    began = time.monotonic()
    for move in practice_grades.likely_first(board, legal):
        uci = move.uci()
        if uci == line[0] or time.monotonic() - began >= practice_grades.CARD_TIME:
            continue
        after = board.copy()
        after.push(move)
        if after.is_game_over():
            continue  # a mate solves it; a draw has no reply to show
        info = engine.analyse(after, chess.engine.Limit(depth=deck.JUDGE_DEPTH, time=practice_grades.MOVE_TIME))
        if info.get("depth", 0) < deck.JUDGE_DEPTH:
            continue  # a capped search is no evidence
        reason = explain.explain_wrong(board, uci, info, solution)
        if reason:
            explanations[uci] = reason
    return {
        "version": VERSION,
        "key": fingerprint(fen, line, revision or engine.id["name"]),
        "fen": fen,
        "explanations": explanations,
        "why": solution,
    }


def cached(conn, exercise: dict) -> dict | None:
    """The prepared feedback for a served puzzle (`puzzles._exercise`), or None."""
    from .practice_grades import engine_revision

    row = conn.execute("SELECT value FROM puzzle_feedback WHERE puzzle_id = %s", (exercise["id"],)).fetchone()
    value = row["value"] if row else None
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    revision = engine_revision()
    if not isinstance(value, dict) or not revision or value.get("version") != VERSION:
        return None
    fen = exercise["fen_before"]
    if value.get("fen") != fen or value.get("key") != fingerprint(fen, exercise["line"], revision):
        return None
    legal = {m.uci() for m in chess.Board(fen).legal_moves}
    if not isinstance(value.get("explanations"), dict) or not set(value["explanations"]).issubset(legal):
        return None
    return value


def pending(conn) -> dict | None:
    """Today's served puzzle when its feedback isn't prepared yet."""
    from . import puzzles

    exercise = puzzles.idea_puzzle(conn)
    return exercise if exercise and cached(conn, exercise) is None else None


def prepare(conn, exercise: dict, engine, revision: str) -> None:
    value = compute(exercise["fen_before"], exercise["line"], engine, revision)
    conn.execute(
        """INSERT INTO puzzle_feedback (puzzle_id, value) VALUES (%s, %s::jsonb)
                    ON CONFLICT (user_id, puzzle_id) DO UPDATE SET value = excluded.value""",
        (exercise["id"], json.dumps(value)),
    )
