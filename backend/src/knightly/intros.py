"""Lesson intros: the Steps Method's "explain, demonstrate, then the first exercise".

docs/specs/2026-10-20-curriculum-wards-design.md (issue #326). Before a post's practice, each of
its lessons is introduced once, in order: the knight's line (the app's copy), a position played
out from the wall (the demonstration), and a guided first position (the learner's turn). The
guided move is judged in the app and never recorded, so it never counts toward holding the
lesson; the intro is only marked seen (SETTING).

Positions are the easiest ones the curriculum has for the lesson: its own themes, its practice
themes (the Gatehouse's loose pieces), or INTRO_THEMES for a lesson with no drills of its own.
The few lessons nothing can supply (the opening rules, activity, stalemate) have positions
chosen by hand in DATA, each checked by the tests.
"""

import json
from datetime import date
from pathlib import Path

import chess

from . import curriculum, db, practice_lines, puzzles

SETTING = "lesson_intros"  # {lesson key: "YYYY-MM-DD"}: introduced on that day
DATA = Path(__file__).with_name("data") / "lesson_intros.json"
# Lessons with no drills of their own, shown with the corpus theme closest to their Steps aim.
INTRO_THEMES = {
    "thinking-ahead": ("mateIn2",),
    "threats": ("defensiveMove",),
    "mobility": ("trappedPiece",),
}
SCAN = 40  # easiest candidates looked at per theme


def introduced(conn) -> dict[str, str]:
    saved = db.get_setting(conn, SETTING)
    return saved if isinstance(saved, dict) else {}


def mark(conn, key: str, today: date) -> None:
    """Record a lesson's intro as seen (first day only)."""
    seen = introduced(conn)
    if key not in seen:
        db.set_setting(conn, SETTING, {**seen, key: today.isoformat()})


def pending(conn, lessons) -> curriculum.Lesson | None:
    """The current post's first lesson, in Steps order, whose intro has not been seen."""
    seen = introduced(conn)
    return next((lesson.lesson for lesson in lessons if lesson.lesson.key not in seen), None)


def _exercise(fen: str, moves: list[str]) -> dict:
    """A position as the app plays it: the opponent's move in, then the line. As
    puzzles._exercise, so the app's board shows it the same way."""
    board = chess.Board(fen)
    board.push(chess.Move.from_uci(moves[0]))
    return {
        "fen_prev": fen,
        "prev_uci": moves[0],
        "fen_before": board.fen(),
        "color": "white" if board.turn == chess.WHITE else "black",
        "line": moves[1:],
        "line_key": practice_lines.key(board.fen(), moves[1:]),
    }


def _hand() -> dict:
    with open(DATA) as f:
        return json.load(f)


def _easiest(conn, themes: tuple[str, ...], max_moves: int | None) -> list[dict]:
    """The easiest playable positions carrying any of `themes`, easiest first."""
    out, seen = [], set()
    for theme in themes:
        rows = conn.execute(
            """SELECT * FROM lichess_puzzles WHERE (' ' || themes || ' ') ILIKE %s
               ORDER BY rating, puzzle_id LIMIT %s""",
            (f"% {theme} %", SCAN),
        ).fetchall()
        for row in rows:
            moves = row["moves"].split()
            if row["puzzle_id"] in seen or not puzzles._playable(row):
                continue
            if max_moves and len(moves) > 2 * max_moves:
                continue
            seen.add(row["puzzle_id"])
            out.append({"id": row["puzzle_id"], **_exercise(row["fen"], moves)})
    return out


def payload(conn, lesson: curriculum.Lesson) -> dict:
    """A lesson's intro: its key and name, the demonstration and the guided position (either
    None when nothing can supply it). The app supplies the words."""
    from . import wards  # it reads this module's record of intros

    hand = _hand().get(lesson.key)
    if hand:
        example = _exercise(hand["example"]["fen"], hand["example"]["moves"])
        guided = _exercise(hand["guided"]["fen"], hand["guided"]["moves"]) if hand.get("guided") else None
    else:
        themes = lesson.themes or lesson.practice or INTRO_THEMES.get(lesson.key, ())
        found = _easiest(conn, themes, wards.DEPTH.get(lesson.step))
        example = found[0] if found else None
        guided = found[1] if len(found) > 1 else None
    return {"lesson": lesson.key, "name": lesson.name, "example": example, "guided": guided}
