"""The home path's data (path.py): the schedule ahead from the cards' FSRS due dates, each
move's last check at the 11-day bar, every kept night placed on its real date with what it
held, a kept night's moves now, and progress toward the first star."""

import json
from datetime import UTC, date, datetime, timedelta

import pytest
from conftest import add_review_game, add_review_move
from fastapi.testclient import TestClient
from fsrs import Card, State

from knightly import api, db, extra, path

TODAY = date(2026, 10, 14)


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def card(conn, gid, ply, *, due: date | None, stability: float, held=1, pattern=None, opponent="kd_88"):
    """A reviewed card due on `due` (its FSRS due time that evening), last reviewed
    `stability` days before it and answered right `held` times in a row."""
    if not conn.execute("SELECT 1 FROM games WHERE id = %s", (gid,)).fetchone():
        add_review_game(conn, gid)
        conn.execute("UPDATE games SET opponent = %s WHERE id = %s", (opponent, gid))
    add_review_move(conn, gid, ply)
    conn.execute("UPDATE moves SET pattern = %s WHERE game_id = %s AND ply = %s", (pattern, gid, ply))
    at = datetime.combine(due or TODAY, datetime.min.time(), UTC) + timedelta(hours=18)
    last = at - timedelta(days=max(1, round(stability)))
    state = Card(state=State.Review, stability=stability, difficulty=5.0, due=at, last_review=last)
    conn.execute(
        "INSERT INTO cards (game_id, ply, fsrs, due, reviews, last_reviewed_at) VALUES (%s, %s, %s, %s, %s, %s)",
        (gid, ply, json.dumps(state.to_dict()), due.isoformat() if due else None, held, db.stamp(last)),
    )
    for i in range(held):
        conn.execute(
            """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating, stability_after)
               VALUES (%s, %s, %s, 'e7e5', true, 'good', %s)""",
            (gid, ply, db.stamp(last - timedelta(days=held - 1 - i)), stability),
        )


def test_the_schedule_ahead_is_the_cards_due_dates_for_the_next_seven_days(conn):
    tomorrow, saturday = TODAY + timedelta(days=1), TODAY + timedelta(days=3)
    card(conn, 1, 2, due=tomorrow, stability=1.5, held=1)
    card(conn, 1, 4, due=tomorrow, stability=2, held=3)
    card(conn, 1, 6, due=saturday, stability=2, held=2)
    card(conn, 1, 8, due=TODAY - timedelta(days=2), stability=2)  # overdue: tonight's
    card(conn, 1, 10, due=TODAY + timedelta(days=8), stability=9)  # beyond the week
    card(conn, 2, 2, due=tomorrow, stability=3)
    conn.execute("UPDATE cards SET suspended_at = '2026-10-01T00:00:00Z' WHERE game_id = 2")  # hidden
    days = path.ahead(conn, TODAY)
    assert [d["date"] for d in days] == [(TODAY + timedelta(days=i)).isoformat() for i in range(1, 8)]
    assert [d["due"] for d in days] == [2, 0, 1, 0, 0, 0, 0]
    # Longest held first; each move named for its row.
    assert [(m["game_id"], m["ply"], m["held"]) for m in days[0]["moves"]] == [(1, 4, 3), (1, 2, 1)]
    assert days[0]["moves"][0] | {"fen": None} == {
        "game_id": 1,
        "ply": 4,
        "san": "g5",
        "label": "Your move 2",
        "opponent": "kd_88",
        "color": "black",
        "fen": None,
        "held": 3,
        "last_check": False,
    }
    assert days[0]["moves"][0]["fen"]
    assert [(m["game_id"], m["ply"]) for m in days[2]["moves"]] == [(1, 6)]


def test_at_most_three_moves_are_named_a_day_and_the_count_is_every_move_due(conn):
    tomorrow = TODAY + timedelta(days=1)
    for ply in (2, 4, 6, 8, 10):
        card(conn, 1, ply, due=tomorrow, stability=2, held=ply // 2)
    day = path.ahead(conn, TODAY)[0]
    assert day["due"] == 5
    assert [m["ply"] for m in day["moves"]] == [10, 8, 6]


def test_a_last_check_is_a_move_whose_good_answer_would_reach_eleven_days(conn):
    # Due on Saturday. On time, FSRS's Good takes a 3-day memory to about 11.1 days, past
    # the bar, and a 2-day one to about 7.8, short of it.
    saturday = TODAY + timedelta(days=3)
    card(conn, 1, 2, due=saturday, stability=3)
    card(conn, 1, 4, due=saturday, stability=2, held=4)
    # A tactic needs its family too: past the bar on its schedule, no puzzle solved yet.
    card(conn, 1, 6, due=saturday, stability=3, pattern="fork")
    day = path.ahead(conn, TODAY)[2]
    flags = {m["ply"]: m["last_check"] for m in day["moves"]}
    assert flags == {2: True, 4: False, 6: False}
    assert day["last_checks"] == 1
    # The last check leads the day, ahead of the longer-held move.
    assert day["moves"][0]["ply"] == 2
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, family_game_id, family_ply)
           VALUES ('knightly', 'p1', '2026-10-12T09:00:00Z', true, 1, 6)"""
    )
    flags = {m["ply"]: m["last_check"] for m in path.ahead(conn, TODAY)[2]["moves"]}
    assert flags == {2: True, 4: False, 6: True}


def kept(conn, *days):
    for d in days:
        conn.execute("INSERT INTO daily_activity (day, planned, goal) VALUES (%s, 1, true)", (d.isoformat(),))


def answer(conn, gid, ply, day: date, right: bool, hour=18):
    conn.execute(
        """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)
           VALUES (%s, %s, %s, 'e7e5', %s, %s)""",
        (gid, ply, f"{day.isoformat()}T{hour}:00:00Z", right, "good" if right else "again"),
    )


def test_history_places_every_kept_night_on_its_date_with_what_it_held(conn):
    first, second, third = date(2026, 10, 2), date(2026, 10, 6), date(2026, 10, 7)  # gaps between
    for ply in (2, 4, 6, 8):
        card(conn, 1, ply, due=TODAY + timedelta(days=5), stability=3)
    conn.execute("DELETE FROM card_reviews")
    kept(conn, first, second, third)
    answer(conn, 1, 2, first, True)
    answer(conn, 1, 4, first, False)
    answer(conn, 1, 2, second, True)
    answer(conn, 1, 6, date(2026, 10, 4), True)  # a day that was not kept: no node
    answer(conn, 1, 4, third, True)
    answer(conn, 1, 8, third, True, hour=19)  # held in that night's extra watch
    conn.execute("UPDATE cards SET mastered_at = '2026-10-06T18:30:00Z' WHERE ply = 2")
    db.set_setting(
        conn,
        extra.LOG_SETTING,
        [{"day": "2026-10-07", "n": 1, "held": 1, "slipped": 0, "stopped": 0, "cards": [[1, 8]]}],
    )
    got = path.history(conn, TODAY)
    assert got["nights"] == [
        {"date": "2026-10-02", "held": 1, "slipped": 1, "stopped": 0},
        {"date": "2026-10-06", "held": 1, "slipped": 0, "stopped": 1},
        {"date": "2026-10-07", "held": 1, "slipped": 0, "stopped": 0},
    ]
    assert got["extra"] == [{"date": "2026-10-07", "held": 1, "slipped": 0, "stopped": 0}]


def test_a_kept_nights_card_says_what_it_held_and_where_each_move_stands_now(db_url):
    night = date(2026, 10, 6)
    with db.connect(db_url) as conn:
        card(conn, 1, 2, due=TODAY + timedelta(days=3), stability=4)  # held, back on a weekday
        card(conn, 1, 4, due=TODAY + timedelta(days=40), stability=40)  # stopped slipping since
        card(conn, 1, 6, due=TODAY + timedelta(days=1), stability=1)
        conn.execute("DELETE FROM card_reviews")
        kept(conn, date(2026, 10, 5), night)
        answer(conn, 1, 2, night, True)
        answer(conn, 1, 4, night, True, hour=19)
        answer(conn, 1, 6, night, False, hour=20)
        answer(conn, 1, 6, TODAY - timedelta(days=1), False)  # since: back on watch
    client = TestClient(api.create_app(db_url))
    body = client.get("/api/journey/night?date=2026-10-06").json()
    assert {k: body[k] for k in ("date", "night", "held", "slipped", "stopped")} == {
        "date": "2026-10-06",
        "night": 2,
        "held": 2,
        "slipped": 1,
        "stopped": 0,
    }
    assert [(m["ply"], m["held_then"], m["state"], m["due"]) for m in body["moves"]] == [
        (2, True, "held", (TODAY + timedelta(days=3)).isoformat()),
        (4, True, "stopped", (TODAY + timedelta(days=40)).isoformat()),
        (6, False, "on_watch", (TODAY + timedelta(days=1)).isoformat()),
    ]
    assert client.get("/api/journey/night?date=2026-10-04").status_code == 404


def test_first_star_progress_is_the_held_move_closest_to_eleven_days(conn):
    card(conn, 1, 2, due=TODAY + timedelta(days=2), stability=4)
    card(conn, 1, 4, due=TODAY + timedelta(days=4), stability=7.04, pattern="fork")
    card(conn, 1, 6, due=TODAY + timedelta(days=1), stability=9)
    conn.execute("UPDATE card_reviews SET correct = false WHERE ply = 6")  # on watch, not held
    assert path.first_star(conn, 0) == {
        "game_id": 1,
        "ply": 4,
        "san": "g5",
        "label": "Fork",
        "days": 7.0,
        "target": 11,
        "needs_family": True,
    }
    # Once there is a star there is no first star to show.
    assert path.first_star(conn, 1) is None


def test_with_nothing_held_there_is_no_first_star_progress(conn):
    assert path.first_star(conn, 0) is None


def test_journey_serves_the_path_and_keeps_its_older_fields(db_url):
    with db.connect(db_url) as conn:
        card(conn, 1, 2, due=TODAY + timedelta(days=1), stability=3)
    body = TestClient(api.create_app(db_url)).get("/api/journey").json()
    assert {"stars", "rank", "ranks", "star_list", "nights", "dimmed"} <= body.keys()
    assert len(body["ahead"]) == path.AHEAD_DAYS
    assert body["history"] == {"nights": [], "extra": []}
    assert body["first_star"]["ply"] == 2
