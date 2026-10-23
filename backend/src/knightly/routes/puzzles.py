"""Lichess puzzles: checking answers move by move, and hints."""

from fastapi import APIRouter, HTTPException

from .. import daily, db, practice_lines, puzzles
from ..schemas import HintOut, PuzzleAnswerIn, PuzzleAnswerOut, PuzzleHintIn
from ..web import Context


def router(ctx: Context) -> APIRouter:
    api = APIRouter()

    @api.post("/api/puzzles/answer", response_model=PuzzleAnswerOut, response_model_exclude_unset=True)
    def puzzle_answer(body: PuzzleAnswerIn):
        """Check a practice puzzle answer move by move; the first finished try is recorded."""
        with ctx.connect() as conn, conn:
            today = db.today(conn)
            if body.expected_day is not None and body.expected_day != today:
                raise HTTPException(409, "A new practice day has started. Reopen this puzzle before answering.")
            try:
                result = puzzles.answer(
                    conn, body.id, body.moves, line_key=body.line_key, redo=body.redo, hinted=body.hinted, today=today
                )
            except KeyError:
                raise HTTPException(404, "No such puzzle.") from None
            except practice_lines.LineChanged as error:
                raise HTTPException(409, str(error)) from None
            except practice_lines.PrefixMismatch as error:
                raise HTTPException(422, str(error)) from None
            if result["status"] != "continue":
                daily.record(conn, today)
            return result

    @api.post("/api/puzzles/hint", response_model=HintOut, response_model_exclude_unset=True)
    def puzzle_hint(body: PuzzleHintIn):
        """The move for the puzzle's current step, for the two-step Hint."""
        with ctx.connect() as conn:
            try:
                return puzzles.hint(conn, body.id, body.moves, body.line_key)
            except KeyError:
                raise HTTPException(404, "No such puzzle.") from None
            except practice_lines.LineChanged as error:
                raise HTTPException(409, str(error)) from None
            except practice_lines.PrefixMismatch as error:
                raise HTTPException(422, str(error)) from None

    return api
