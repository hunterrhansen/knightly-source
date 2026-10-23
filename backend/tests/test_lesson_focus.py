"""The lesson follows your games: the skill costing you most in recent games leads the day's new
positions and, for safety, brings a threat question after every position
(docs/specs/2026-10-17-learning-loop-design.md, part 2)."""

from datetime import timedelta

from conftest import (
    add_review_game,
    add_review_move,
    add_shape_game,
    days_ago,
    shape_ply,
)
from fastapi.testclient import TestClient

from knightly import api, db, deck, game_trend


def trend(**costs):
    """A part 1 trend with each skill's (recent mistakes, cost); unnamed skills cost nothing."""
    return {
        "reason": None,
        "window": 20,
        "skills": [
            {"key": key, "recent": costs.get(key, (0, 0.0))[0], "cost": costs.get(key, (0, 0.0))[1]}
            for key in game_trend.SKILLS
        ],
    }


def test_the_focus_is_the_costliest_skill_with_enough_mistakes():
    assert game_trend.pick_focus(trend(safety=(5, 6.5), tactics=(9, 14.4))) == {
        "key": "tactics",
        "cost": 14.4,
        "window": 20,
    }
    # Costlier, but only two mistakes: too few to lean the lesson on.
    assert game_trend.pick_focus(trend(safety=(5, 6.5), tactics=(2, 14.4)))["key"] == "safety"
    # Under a win% a game: nothing worth leaning toward.
    assert game_trend.pick_focus(trend(safety=(4, 0.9))) is None
    # A tie keeps the fixed order, safety first.
    assert game_trend.pick_focus(trend(safety=(3, 4.0), calculation=(3, 4.0)))["key"] == "safety"
    assert game_trend.pick_focus({**trend(safety=(5, 6.5)), "reason": "few_games"}) is None


def test_the_focus_is_kept_for_the_day_and_remembered_once_a_day(db_url, monkeypatch):
    answers = iter([trend(safety=(5, 6.5)), trend(tactics=(9, 14.4)), trend()])
    monkeypatch.setattr(game_trend, "summarize", lambda conn, today, practice=True: next(answers))
    with db.connect(db_url) as conn:
        today = db.today(conn)
        assert game_trend.focus(conn, today)["key"] == "safety"
        # Later the same day a new game would make tactics costlier: the lesson doesn't shift.
        assert game_trend.focus(conn, today)["key"] == "safety"
        assert game_trend.focus(conn, today + timedelta(days=1))["key"] == "tactics"
        assert game_trend.focus(conn, today + timedelta(days=2)) is None
        history = db.get_setting(conn, game_trend.FOCUS_SETTING)["history"]
    assert history == [
        {"day": (today + timedelta(days=n)).isoformat(), "key": key}
        for n, key in enumerate(["safety", "tactics", None])
    ]


def test_the_focus_skills_new_positions_come_before_other_blunders(db_url, monkeypatch):
    with db.connect(db_url) as conn:
        add_review_game(conn, 1, played_at="2026-10-10T12:00:00Z")
        conn.execute("UPDATE games SET rated = true")
        add_review_move(conn, 1, 2, cls="blunder")  # a blunder missing your own tactic
        add_review_move(conn, 1, 4, cls="mistake")  # a mistake that allowed their reply
        conn.execute("UPDATE moves SET layer = 'ownTactic' WHERE ply = 2")
        conn.execute("UPDATE moves SET layer = 'theirReply' WHERE ply = 4")
        deck.sync(conn)
        today = db.today(conn)
        order = lambda: [(r["game_id"], r["ply"]) for r in deck.queue(conn, today)]  # noqa: E731
        trend = lambda focus: lambda conn, today=None: {"focus": focus, "costs": {}}  # noqa: E731
        monkeypatch.setattr(game_trend, "day_trend", trend(None))
        assert order() == [(1, 2), (1, 4)]  # without a focus, blunders first
        monkeypatch.setattr(game_trend, "day_trend", trend({"key": "safety", "cost": 6.5, "window": 20}))
        assert order() == [(1, 4), (1, 2)]


def test_today_reports_the_focus_chosen_from_your_games(db_url):
    with db.connect(db_url) as conn:
        for gid in range(1, 21):  # two windows of ten; a missed threat costing 30 win% in each recent game
            plies = [shape_ply(1, "e4", "e2e4")]
            if gid <= 10:
                plies += [shape_ply(0, "a5", "a7a5"), shape_ply(1, "Kb1", "e1d1", "blunder", "theirThreat", win=20.0)]
            add_shape_game(conn, gid, played_at=days_ago(gid), plies=plies)
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/home").json()["today"]["focus"] == {"key": "safety", "cost": 30.0, "window": 10}
