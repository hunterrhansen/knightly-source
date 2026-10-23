"""The review day follows the user's own time zone, not the server's."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

import pytest
from conftest import add_review_game, add_review_move
from fastapi.testclient import TestClient

from knightly import api, db, deck

# 25 hours apart: whatever the instant, their calendar days differ.
EAST, WEST = "Pacific/Kiritimati", "Pacific/Pago_Pago"


@pytest.fixture
def user(db_url):
    """A connection acting for the test user, as the API's are."""
    c = db.connect(db_url, user_id=1)
    yield c
    c.close()


def in_zone(conn, name):
    db.set_setting(conn, db.TIMEZONE_SETTING, name)
    conn.forget_zone()


def test_day_range_is_the_users_midnight_to_midnight(user):
    in_zone(user, "America/Denver")
    assert db.day_range(user, date(2026, 10, 13)) == ("2026-10-13T06:00:00Z", "2026-10-14T06:00:00Z")
    # Clocks fall back on 1 November: that day is 25 hours long.
    assert db.day_range(user, date(2026, 11, 1)) == ("2026-11-01T06:00:00Z", "2026-11-02T07:00:00Z")
    in_zone(user, "Asia/Tokyo")
    assert db.day_range(user, date(2026, 10, 13)) == ("2026-10-12T15:00:00Z", "2026-10-13T15:00:00Z")


def test_today_and_due_dates_follow_the_users_zone(user):
    in_zone(user, EAST)
    east = db.today(user)
    in_zone(user, WEST)
    assert db.today(user) < east
    in_zone(user, "Asia/Tokyo")
    assert db.local_date(user, datetime(2026, 10, 13, 20, tzinfo=UTC)) == date(2026, 10, 14)


def test_an_evening_answer_counts_on_the_users_day(user):
    add_review_game(user, 1)
    add_review_move(user, 1, 2)
    deck.sync(user)
    in_zone(user, "America/Denver")
    # 21:00 on 13 October in Denver is already 14 October in UTC.
    evening = datetime(2026, 10, 14, 3, tzinfo=UTC)
    deck.answer(user, 1, 2, "e7e5", today=date(2026, 10, 13), now=evening)
    assert [r["ply"] for r in deck.today_results(user, date(2026, 10, 13))] == [2]
    assert deck.today_results(user, date(2026, 10, 14)) == []


def test_unknown_or_missing_zone_keeps_the_servers_day(user):
    assert user.zone is None
    db.set_setting(user, db.TIMEZONE_SETTING, "Mars/Olympus_Mons")
    user.forget_zone()
    assert user.zone is None and db.today(user) == date.today()


def test_api_saves_the_zone_and_checks_answers_against_that_day(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(db_url))
    assert client.put("/api/settings/timezone", json={"timezone": "../etc/passwd"}).status_code == 422
    assert client.put("/api/settings/timezone", json={"timezone": "Not/AZone"}).status_code == 422
    assert client.get("/api/settings").json()["timezone"] is None

    saved = client.put("/api/settings/timezone", json={"timezone": EAST}).json()
    east_day = datetime.now(ZoneInfo(EAST)).date().isoformat()
    assert saved == {"timezone": EAST, "day": east_day}
    assert client.get("/api/settings").json()["timezone"] == EAST
    assert client.get("/api/deck").json()["server_day"] == east_day

    west_day = datetime.now(ZoneInfo(WEST)).date().isoformat()
    body = {"game_id": 1, "ply": 2, "uci": "e7e5", "expected_day": west_day}
    assert client.post("/api/deck/answer", json=body).status_code == 409
    with db.connect(db_url) as c:
        assert c.execute("SELECT count(*) FROM card_reviews").fetchone()[0] == 0
    body["expected_day"] = east_day
    assert client.post("/api/deck/answer", json=body).status_code == 200
