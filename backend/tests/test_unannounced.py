"""Unannounced positions, "Your move": critical and calm positions from your games, judged like
a card's first move, logged and never scheduled (docs/specs/2026-10-17-learning-loop-design.md,
part 4)."""

from datetime import timedelta

import pytest
from conftest import add_review_game, add_review_move, as_user, days_ago
from fastapi.testclient import TestClient

from knightly import analyze, api, db, deck, unannounced, users

# You are Black. Critical: your best move beats the next by far (Black's view: -300 vs 0).
CRITICAL = dict(cls="best", best=-300, second=0)
# Calm: the top two moves are a few points apart, so any safe move is fine.
CALM = dict(cls="good", best=-50, second=-40)


def position(conn, gid, ply, *, kind, phase="middlegame"):
    add_review_move(conn, gid, ply, **(CRITICAL if kind == "critical" else CALM))
    conn.execute("UPDATE moves SET phase = %s WHERE game_id = %s AND ply = %s", (phase, gid, ply))


def game(conn, gid, days=1):
    add_review_game(conn, gid, played_at=days_ago(days))
    conn.execute("UPDATE games SET rated = true WHERE id = %s", (gid,))


@pytest.fixture
def judged(monkeypatch):
    """Judge without Stockfish: the engine's move is best, "d7d5" is within 5 points, anything
    else is wrong."""
    monkeypatch.setattr(
        deck, "judge", lambda fen, uci, best, ev: "best" if uci == best else "good" if uci == "d7d5" else "wrong"
    )


def test_positions_are_critical_or_calm_and_come_two_critical_to_one_calm(db_url, judged, monkeypatch):
    with db.connect(db_url) as c:
        game(c, 1)
        position(c, 1, 2, kind="critical")
        position(c, 1, 4, kind="critical")
        position(c, 1, 6, kind="calm")
        position(c, 1, 8, kind="calm", phase="opening")  # calm, but too early to mean anything
        position(c, 1, 10, kind="critical")
        add_review_move(c, 1, 10 + 2, cls="blunder")  # a mistake: neither kind
        today = db.today(c)
        assert unannounced._candidates(c, "critical", today) == [(1, 2), (1, 4), (1, 10)]
        assert unannounced._candidates(c, "calm", today) == [(1, 6)]
        monkeypatch.setattr(unannounced, "PER_DAY", 3)
        kinds = []
        for _ in range(3):
            nxt = unannounced.plan(c, today)["next"]
            kinds.append(nxt["kind"])
            unannounced.answer(c, nxt["game_id"], nxt["ply"], ["e7e5"], today=today)
        assert kinds == ["critical", "critical", "calm"]
        assert unannounced.plan(c, today) == {"done": 3, "total": 3, "next": None}
        # Not asked again for REST_DAYS, then back in the pool.
        later = today + timedelta(days=unannounced.REST_DAYS + 1)
        assert (1, 2) in unannounced._candidates(c, "critical", later)
        assert (1, 2) not in unannounced._candidates(c, "critical", today + timedelta(days=3))


def test_answers_are_judged_like_cards_logged_once_a_day_and_never_scheduled(db_url, judged):
    with db.connect(db_url) as c:
        game(c, 1)
        position(c, 1, 2, kind="calm")
        position(c, 1, 4, kind="critical")
        deck.sync(c)  # neither is a card: nothing to schedule
        today = db.today(c)
        calm = unannounced.answer(c, 1, 2, ["d7d5"], today=today)  # within 5 points: fine
        assert (calm["correct"], calm["quality"], calm["unannounced"], calm["rating"]) == (True, "good", "calm", None)
        missed = unannounced.answer(c, 1, 4, ["a7a6"], today=today)
        assert (missed["correct"], missed["status"], missed["best_uci"]) == (False, "failed", "e7e5")
        unannounced.answer(c, 1, 4, ["e7e5"], today=today)  # the retry isn't logged
        rows = c.execute("SELECT game_id, ply, kind, correct FROM unannounced_answers ORDER BY ply").fetchall()
        assert [tuple(r) for r in rows] == [(1, 2, "calm", True), (1, 4, "critical", False)]
        assert c.execute("SELECT count(*) FROM card_reviews").fetchone()[0] == 0
        with pytest.raises(KeyError):
            unannounced.answer(c, 1, 3, ["e7e5"], today=today)  # their move, not yours


def test_the_noticing_rate_counts_critical_first_answers_from_twenty_on(db_url, judged):
    with db.connect(db_url) as c:
        for gid in range(1, 21):
            game(c, gid)
            position(c, gid, 2, kind="critical")
        game(c, 99)
        position(c, 99, 2, kind="calm")
        today = db.today(c)
        for gid in range(1, 20):
            unannounced.answer(c, gid, 2, ["e7e5" if gid <= 14 else "a7a6"], today=today)
        unannounced.answer(c, 99, 2, ["d7d5"], today=today)  # calm answers don't count
        assert deck.health(c, today)["noticing"] is None  # 19 critical answers
        unannounced.answer(c, 20, 2, ["a7a6"], today=today)
        assert deck.health(c, today)["noticing"] == {"rate": 0.7, "answers": 20}


def test_practice_serves_your_move_and_counts_it_in_the_lesson(db_url, judged):
    with db.connect(db_url) as c:
        game(c, 1)
        position(c, 1, 2, kind="critical")
        position(c, 1, 4, kind="calm")
    client = TestClient(api.create_app(db_url))
    first = client.get("/api/deck?mode=lesson").json()
    # No review positions today, so "Your move" comes at once; it is not a card.
    item = first["unannounced_item"]
    assert first["card"] is None and item["unannounced"] == "critical"
    assert (item["game_id"], item["ply"], item["line"]) == (1, 2, ["e7e5"])
    assert first["today"] == {"done": 0, "total": 1}
    day = first["server_day"]
    found = client.post(
        "/api/unannounced/answer", json={"game_id": 1, "ply": 2, "moves": ["e7e5"], "expected_day": day}
    ).json()
    assert (found["correct"], found["unannounced"], found["line"]["uci"]) == (True, "critical", ["e7e5"])
    second = client.get("/api/deck?mode=lesson").json()
    assert second["unannounced_item"]["unannounced"] == "calm"
    assert second["today"] == {"done": 1, "total": 2}
    assert (
        client.post(
            "/api/unannounced/answer", json={"game_id": 1, "ply": 2, "moves": ["e7e5"], "expected_day": "2000-01-01"}
        ).status_code
        == 409
    )
    assert (
        client.post("/api/unannounced/answer", json={"game_id": 1, "ply": 2, "moves": ["e7e5", "e2e4"]}).status_code
        == 422
    )


def test_only_your_own_positions_can_be_answered(db_url, clerk, judged):  # noqa: F811
    with db.connect(db_url) as owner:
        alice = users.ensure(owner, "user_alice")
        users.ensure(owner, "user_bob")
    conn = db.connect(db_url, migrate=False, user_id=alice)
    with conn:
        game(conn, 1)
        position(conn, 1, 2, kind="critical")
    conn.close()
    client = TestClient(api.create_app(db_url))
    body = {"game_id": 1, "ply": 2, "moves": ["e7e5"]}
    assert client.post("/api/unannounced/answer", json=body, headers=as_user("user_bob")).status_code == 404
    assert client.post("/api/unannounced/answer", json=body, headers=as_user("user_alice")).status_code == 200


def row(**over):
    base = {
        "color": "white",
        "classification": "best",
        "phase": "middlegame",
        "best_uci": "e2e4",
        "eval_before": 60,
        "eval_second": 40,
        "card": False,
    }
    return base | over


def test_a_mate_you_found_is_critical_not_a_quiet_position():
    # Regression: the clamp made a forced mate beside a winning move read as no gap, so
    # kind_of called it calm and the verdict said any safe move was fine. 102 of the
    # production account's positions were mislabelled this way.
    assert unannounced.kind_of(row(eval_before=analyze.MATE_CP - 2, eval_second=700)) == "critical"


def test_a_winning_position_is_never_calm_even_when_the_top_moves_are_close():
    # Both moves mate: not critical (either wins), but not a quiet position either.
    assert unannounced.kind_of(row(eval_before=analyze.MATE_CP - 2, eval_second=analyze.MATE_CP - 9)) is None


def test_a_genuinely_quiet_position_is_still_calm():
    assert unannounced.kind_of(row()) == "calm"
    assert unannounced.kind_of(row(phase="opening")) is None
