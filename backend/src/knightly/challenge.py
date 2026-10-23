"""Testing out of a post (issue #325): one Steps page at the post's own difficulty.

Everyone starts at the Gatehouse and a post clears at the Steps bar, so a stronger player
would spend weeks on ideas they have. A challenge is the post's exam, as Steps has one per
step: PAGE positions drawn from its lessons in turn, at the post's typical difficulty
(wards.bands) and within its Steps depth. PAGE_RIGHT or more right clears the post for good
(the forward-only record), unless a lesson's games say "not yet" -- Steps' real gate is the
games, and a test does not override them. Fewer right changes nothing: the post goes on as
before, and the answers count as practice like any others.

Only the current post can be challenged, so the walk is still taken in order; passing moves
the learner to the next post, which they may challenge in turn. `suggested` says when the
puzzle rating makes a test worth offering.
"""

import json
from datetime import UTC, date, datetime

from . import db, endgames, puzzles, wards

SETTING = "post_challenge"  # {ward, day, started_at}: the open challenge
# Offer a test when the puzzle ability clears the post's typical difficulty by this much.
SUGGEST_ABOVE = 150


class NotOpen(Exception):
    """No challenge is open for the current post."""


def start(conn, today: date) -> dict:
    """Open a challenge for the current post (or resume the open one)."""
    ward = wards.current(conn)
    saved = current(conn, ward)
    if saved:
        return saved
    if not ward.servable:
        raise NotOpen("This post has nothing to test yet.")
    saved = {"ward": ward.ward.key, "day": today.isoformat(), "started_at": db.stamp(datetime.now(UTC))}
    db.set_setting(conn, SETTING, saved)
    return saved


def current(conn, ward: wards.WardState | None = None) -> dict | None:
    """The open challenge, while its post is still the current one."""
    saved = db.get_setting(conn, SETTING)
    if not isinstance(saved, dict):
        return None
    ward = ward or wards.current(conn)
    return saved if saved.get("ward") == ward.ward.key else None


def _themes(ward: wards.WardState) -> list[str]:
    return [t for lesson in ward.lessons for t in (*lesson.lesson.themes, *lesson.lesson.practice)]


def _answers(conn, saved: dict, ward: wards.WardState) -> list[bool]:
    """First tries since the challenge opened on the post's themes, oldest first."""
    themes = set(_themes(ward))
    rows = conn.execute(
        """SELECT themes, success FROM puzzle_attempts
           WHERE source = %s AND attempted_at >= %s ORDER BY attempted_at, id""",
        (puzzles.SOURCE, saved["started_at"]),
    ).fetchall()
    out = []
    for r in rows:
        ts = r["themes"] if isinstance(r["themes"], list) else json.loads(r["themes"] or "[]")
        if themes & set(ts):
            out.append(bool(r["success"]))
    return out[: wards.PAGE]


def progress(conn, saved: dict, today: date) -> dict:
    """{done, right, total, passed}: passed is None until the page is answered. A passed
    challenge clears the post in the forward-only record and closes."""
    ward = wards.current(conn)
    results = _answers(conn, saved, ward)
    done, right = len(results), sum(results)
    out = {"done": done, "right": right, "total": wards.PAGE, "passed": None, "ward": ward.ward.key}
    if done < wards.PAGE:
        return out
    blocked = any(lesson.games == "not_yet" for lesson in ward.lessons)
    out["passed"] = right >= wards.PAGE_RIGHT and not blocked
    out["games_not_yet"] = blocked
    if out["passed"]:
        reached = db.get_setting(conn, wards.REACHED_SETTING) or {}
        entry = {**(reached.get(ward.ward.key) or {}), "cleared": today.isoformat(), "tested_out": True}
        entry.setdefault("entered", today.isoformat())
        db.set_setting(conn, wards.REACHED_SETTING, {**reached, ward.ward.key: entry})
    db.set_setting(conn, SETTING, None)
    return out


def next_puzzle(conn, saved: dict, today: date) -> dict | None:
    """The challenge's next position: the post's lessons in turn, at its typical difficulty and
    within its Steps depth. None once the page is answered."""
    ward = wards.current(conn)
    done = len(_answers(conn, saved, ward))
    if done >= wards.PAGE:
        return None
    lessons = [lesson for lesson in ward.lessons if lesson.lesson.themes or lesson.lesson.practice]
    target = int(wards.bands(conn).get(ward.ward.key) or puzzles.target_rating(conn))
    for i in range(len(lessons)):
        lesson = lessons[(done + i) % len(lessons)].lesson
        for theme in (*lesson.themes, *lesson.practice):
            puzzle = puzzles._pick(
                conn, theme, f"challenge:{saved['started_at']}:{done}", target, max_moves=wards.depth(lesson, theme)
            )
            shape = lesson.shape if theme in lesson.themes else None
            if puzzle and (shape is None or endgames.matches(puzzle["fen_prev"], shape)):
                return puzzle
    return None


def suggested(conn, ward: wards.WardState) -> bool:
    """Whether to offer a test: the puzzle rating is well above the post's typical difficulty."""
    band = wards.bands(conn).get(ward.ward.key) or 0
    return bool(band) and ward.servable and puzzles.ability(conn) >= band + SUGGEST_ABOVE
