"""The daily review's streak: the daily lesson (or a reviewed game) keeps it, freezes cover
missed days."""

import json
from datetime import UTC, date, datetime, timedelta, timezone

import pytest
from conftest import add_review_game, add_review_move, line_row, write_csv
from fastapi.testclient import TestClient

from knightly import api, daily, db, deck, watch

TODAY = date(2026, 10, 14)  # a Wednesday


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def days(conn, *entries):
    """Rows by days before TODAY: an int is a day with the game step done; ("rest", n) a
    day Today showed nothing to do."""
    for entry in entries:
        rest = isinstance(entry, tuple)
        ago = entry[1] if rest else entry
        conn.execute(
            "INSERT INTO daily_activity (day, planned, game) VALUES (%s, %s, %s)",
            ((TODAY - timedelta(days=ago)).isoformat(), 0 if rest else 1, not rest),
        )


def test_one_finished_step_keeps_the_streak_and_today_counts_once_done(conn):
    days(conn, 3, 2, 1)
    before = daily.streak(conn, TODAY)
    assert (before["count"], before["safe_today"]) == (3, False)
    days(conn, 0)
    after = daily.streak(conn, TODAY)
    assert (after["count"], after["best"], after["safe_today"]) == (4, 4, True)


def test_a_missed_day_without_a_freeze_starts_over(conn):
    days(conn, 5, 4, 2, 1)
    result = daily.streak(conn, TODAY)
    assert (result["count"], result["best"], result["freezes"]) == (2, 2, 0)
    assert [d["state"] for d in result["week"]] == [
        "done",
        "done",
        "today",
        "upcoming",
        "upcoming",
        "upcoming",
        "upcoming",
    ]


def test_seven_days_earn_a_freeze_that_covers_one_missed_day(conn):
    days(conn, *range(9, 2, -1), 1)  # 7 days to Sunday, Monday missed, Tuesday done
    covered = daily.streak(conn, TODAY)
    assert (covered["count"], covered["freezes"]) == (8, 0)
    assert covered["week"][0] == {"date": "2026-10-12", "state": "frozen", "night": None}
    # With the freeze spent, missing Wednesday and Thursday ends it.
    assert daily.streak(conn, TODAY + timedelta(days=2))["count"] == 0


def test_freezes_are_capped_and_spent_one_per_missed_day(conn):
    days(conn, *range(30, 9, -1))  # 21 days: three earned, two kept
    result = daily.streak(conn, TODAY - timedelta(days=9))
    assert result["freezes"] == daily.MAX_FREEZES
    # Days 9..1 missed: two freezes cover two days, the third miss ends it.
    assert daily.streak(conn, TODAY)["count"] == 0


def test_a_day_with_nothing_to_do_neither_breaks_nor_extends(conn):
    days(conn, 3, ("rest", 2), 1)
    result = daily.streak(conn, TODAY)
    assert result["count"] == 2
    monday = [d for d in result["week"] if d["date"] == (TODAY - timedelta(days=2)).isoformat()]
    assert monday == [{"date": "2026-10-12", "state": "rest", "night": None}]
    days(conn, ("rest", 0))  # nothing to do today either: today still reads as today
    assert daily.streak(conn, TODAY)["week"][2] == {"date": "2026-10-14", "state": "today", "night": None}


def test_history_replays_freezes_rest_and_days_before_the_first_activity(conn):
    days(conn, ("rest", 20), *range(19, 12, -1), ("rest", 11))
    states = [d["state"] for d in daily.history(conn, TODAY, TODAY - timedelta(days=21), TODAY)]
    assert states == (
        ["none", "rest"]
        + ["done"] * 7  # 21 ago: nothing yet; 20: rest
        + ["frozen", "rest"]  # the earned freeze covers 12 ago; 11 was rest
        + ["missed"] * 10  # no freeze left: 10..1 ago are missed
        + ["today"]
    )
    monday = TODAY - timedelta(days=TODAY.weekday())
    week = daily.history(conn, TODAY, monday, monday + timedelta(days=6))
    assert week == daily.streak(conn, TODAY)["week"]
    assert [d["state"] for d in week][3:] == ["upcoming"] * 4


def test_the_calendar_and_todays_week_agree_on_a_frozen_day(conn):
    days(conn, *range(9, 2, -1), 1)  # Monday is frozen, as in Today's week
    monday = TODAY - timedelta(days=TODAY.weekday())
    assert (
        daily.history(conn, TODAY, monday, monday)[0]
        == daily.streak(conn, TODAY)["week"][0]
        == {"date": "2026-10-12", "state": "frozen", "night": None}
    )


def test_done_days_carry_their_night_across_a_freeze_and_restart_after_a_miss(conn):
    # 12..10 ago done, 9 missed (no freeze yet), 8..2 done (earns one), 1 frozen, today done.
    days(conn, 12, 11, 10, *range(8, 1, -1), 0)
    history = daily.history(conn, TODAY, TODAY - timedelta(days=12), TODAY)
    nights = [(d["state"], d["night"]) for d in history]
    assert nights == (
        [("done", 1), ("done", 2), ("done", 3), ("missed", None)]
        + [("done", n) for n in range(1, 8)]  # the new streak's first seven nights
        + [("frozen", None), ("done", 8)]  # the freeze adds no night; today is night 8
    )
    assert daily.streak(conn, TODAY)["count"] == 8


def test_streak_days_endpoint_ends_at_today_and_limits_the_range(db_url):
    client = TestClient(api.create_app(db_url))
    with db.connect(db_url) as c:
        today = db.today(c)
        c.execute(
            "INSERT INTO daily_activity (day, planned, game) VALUES (%s, 1, true)",
            ((today - timedelta(days=1)).isoformat(),),
        )

    def get(start, end):
        return client.get("/api/streak/days", params={"from": str(start), "to": str(end)})

    month = get(today - timedelta(days=41), today)  # 42 days: the most at a time
    assert month.status_code == 200
    states = month.json()["days"]
    assert len(states) == 42 and states[0]["date"] == (today - timedelta(days=41)).isoformat()
    assert [d["state"] for d in states[-3:]] == ["none", "done", "today"]
    assert get(today, today).json() == {"days": [{"date": today.isoformat(), "state": "today", "night": None}]}
    for start, end in [
        (today - timedelta(days=42), today),  # 43 days
        (today, today + timedelta(days=1)),  # past today
        (today, today - timedelta(days=1)),  # reversed
        ("2026-02-30", today),
        ("yesterday", today),
    ]:
        assert get(start, end).status_code == 422, (start, end)
    assert client.get("/api/streak/days", params={"from": str(today)}).status_code == 422


def test_streak_days_show_only_the_signed_in_users_activity(db_url):
    from knightly import users

    with db.connect(db_url) as owner:
        other_id = users.ensure(owner, "user_other")
        today = db.today(owner)
    with db.connect(db_url, migrate=False, user_id=other_id) as other:
        other.execute(
            "INSERT INTO daily_activity (day, planned, game) VALUES (%s, 1, true)",
            ((today - timedelta(days=1)).isoformat(),),
        )
        assert [d["state"] for d in daily.history(other, today, today - timedelta(days=1), today)] == ["done", "today"]
    client = TestClient(api.create_app(db_url))  # signed in as the local user
    days_ = client.get("/api/streak/days", params={"from": str(today - timedelta(days=1)), "to": str(today)}).json()[
        "days"
    ]
    assert [d["state"] for d in days_] == ["none", "today"]


def test_a_finished_step_stays_finished_when_more_work_arrives(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    deck.sync(conn)
    deck.answer(conn, 1, 2, "e7e5", today=TODAY, now=datetime(2026, 10, 14, 18, tzinfo=UTC))
    daily.record(conn, TODAY)
    add_review_move(conn, 1, 4)  # a new position joins today's deck
    deck.sync(conn)
    daily.record(conn, TODAY)
    row = conn.execute("SELECT positions FROM daily_activity WHERE day = %s", (TODAY.isoformat(),)).fetchone()
    assert row["positions"] is True


def test_answering_todays_positions_finishes_the_step_and_saves_the_streak(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(db_url))
    before = client.get("/api/home").json()["today"]
    positions = next(s for s in before["plan"] if s["kind"] == "positions")
    assert positions == {"kind": "positions", "done": False, "count": 0, "total": 1}
    assert before["streak"]["safe_today"] is False and before["streak"]["count"] == 0
    assert before["day"] == before["streak"]["week"][date.fromisoformat(before["day"]).weekday()]["date"]

    day = client.get("/api/deck").json()["server_day"]
    assert (
        client.post("/api/deck/answer", json={"game_id": 1, "ply": 2, "uci": "e7e5", "expected_day": day}).status_code
        == 200
    )
    after = client.get("/api/home").json()["today"]
    assert next(s for s in after["plan"] if s["kind"] == "positions")["done"] is True
    assert after["streak"]["count"] == 1 and after["streak"]["safe_today"] is True
    assert after["memory"]["total"] == 1


def due_card(conn, ply, *, stability, reviewed_days_ago, due):
    """A reviewed card: high stability is still remembered; low stability long ago is fading."""
    from fsrs import Card, State

    last = datetime(2026, 10, 14, 12, tzinfo=UTC) - timedelta(days=reviewed_days_ago)
    state = Card(state=State.Review, stability=stability, difficulty=5.0, due=last, last_review=last)
    conn.execute(
        "UPDATE cards SET fsrs = %s, due = %s, reviews = 1 WHERE game_id = 1 AND ply = %s",
        (json.dumps(state.to_dict()), due, ply),
    )


def test_the_lesson_serves_the_most_forgotten_positions_first(conn):
    add_review_game(conn, 1)
    for ply in (2, 4, 6):
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    due_card(conn, 2, stability=100, reviewed_days_ago=20, due="2026-10-01")  # long overdue, well known
    due_card(conn, 4, stability=1, reviewed_days_ago=5, due="2026-10-12")  # recent, nearly forgotten
    now = datetime(2026, 10, 14, 12, tzinfo=UTC)
    assert [r["ply"] for r in deck.queue(conn, TODAY)] == [2, 4, 6]
    assert [r["ply"] for r in deck.lesson_queue(conn, TODAY, now=now)] == [4, 2, 6]


def answer_lesson_item(client):
    card = client.get("/api/deck?mode=lesson").json()["card"]
    assert (
        client.post(
            "/api/deck/answer", json={"game_id": card["game_id"], "ply": card["ply"], "uci": "e7e5"}
        ).status_code
        == 200
    )


def test_ten_answers_finish_the_lesson_and_keep_the_streak_with_positions_left(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        for ply in range(2, 26, 2):
            add_review_move(c, 1, ply)
        deck.sync(c)
        c.execute("UPDATE cards SET due = '2000-01-01', reviews = 1")  # twelve reviews due
    client = TestClient(api.create_app(db_url))
    for _ in range(daily.GOAL - 1):
        answer_lesson_item(client)
    almost = client.get("/api/home").json()["today"]
    assert almost["lesson"] == {"done": 9, "total": 10} and almost["streak"]["safe_today"] is False
    answer_lesson_item(client)
    done = client.get("/api/deck?mode=lesson").json()
    assert done["card"] is None and done["puzzle"] is None
    assert done["lesson"] == {"done": 10, "total": 10}
    # Keep going: an extra watch serves the reviews the watch had no room for.
    assert client.post("/api/lesson/extra").json()["card"] is not None
    today = client.get("/api/home").json()["today"]
    assert next(s for s in today["plan"] if s["kind"] == "positions") == {
        "kind": "positions",
        "done": False,
        "count": 10,
        "total": 12,
    }
    assert today["streak"]["safe_today"] is True and today["streak"]["count"] == 1


def test_a_day_with_fewer_items_than_the_goal_needs_them_all(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        for ply in (2, 4, 6):
            add_review_move(c, 1, ply)
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/home").json()["today"]["lesson"] == {"done": 0, "total": 3}
    for _ in range(3):
        answer_lesson_item(client)
    today = client.get("/api/home").json()["today"]
    assert today["lesson"] == {"done": 3, "total": 3} and today["streak"]["safe_today"] is True


def test_puzzles_fill_the_lesson_when_positions_run_out(db_url, tmp_path):

    from knightly import puzzles

    with db.connect(db_url) as c:
        puzzles.import_file(
            c, write_csv(tmp_path / "p.csv", [line_row("aaaaa"), line_row("bbbbb")]), log=lambda *a: None
        )
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(db_url))
    answer_lesson_item(client)
    lesson = client.get("/api/deck?mode=lesson").json()
    # With puzzles stored the watch is always the full GOAL: they fill what positions cannot.
    assert lesson["lesson"] == {"done": 1, "total": daily.GOAL} and lesson["card"] is None
    puzzle = lesson["puzzle"]
    assert (
        client.post(
            "/api/puzzles/answer",
            json={"id": puzzle["id"], "line_key": puzzle["line_key"], "moves": ["e7e5", "g1f3", "b8c6"]},
        ).status_code
        == 200
    )
    assert client.get("/api/home").json()["today"]["lesson"]["done"] == 2


def test_a_finished_puzzle_session_alone_does_not_keep_the_streak(conn):
    conn.execute("INSERT INTO daily_activity (day, planned, puzzles) VALUES (%s, 2, true)", (TODAY.isoformat(),))
    assert daily.streak(conn, TODAY)["safe_today"] is False


def test_only_answers_that_cross_into_long_term_memory_count_as_mastered_today(conn):
    add_review_game(conn, 1)
    for ply in (2, 4, 6):
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    due_card(conn, 2, stability=50, reviewed_days_ago=50, due="2026-10-14")  # about to cross
    due_card(conn, 4, stability=200, reviewed_days_ago=200, due="2026-10-14")  # already long-term
    due_card(conn, 6, stability=50, reviewed_days_ago=50, due="2026-10-14")  # missed today
    noon = datetime(2026, 10, 14, 12, tzinfo=UTC)
    for ply in (2, 4):
        deck.answer(conn, 1, ply, "e7e5", today=TODAY, now=noon)
    deck.answer(conn, 1, 6, "g7g5", today=TODAY, now=noon)
    stabilities = {
        r["ply"]: (r["stability_before"], r["stability_after"])
        for r in conn.execute("SELECT ply, stability_before, stability_after FROM card_reviews")
    }
    assert stabilities[2][0] == 50 and stabilities[2][1] >= deck.MASTERED_DAYS
    assert stabilities[6][1] < deck.MASTERED_DAYS
    assert deck.mastered_today(conn, TODAY) == 1
    assert deck.mastered_today(conn, TODAY + timedelta(days=1)) == 0


def test_answers_that_cross_eleven_days_stop_slipping_today_and_relight_a_star(conn):
    """The Watch page's "stopped slipping · A star relit" uses the watch story's 11-day bar,
    not long-term memory: a card crossing 60 days had stopped slipping long before."""
    add_review_game(conn, 1)
    for ply in (2, 4, 6):
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    due_card(conn, 2, stability=5, reviewed_days_ago=5, due="2026-10-14")  # about to stop slipping
    due_card(conn, 4, stability=50, reviewed_days_ago=50, due="2026-10-14")  # about to be long-term
    due_card(conn, 6, stability=5, reviewed_days_ago=5, due="2026-10-14")  # missed today
    noon = datetime(2026, 10, 14, 12, tzinfo=UTC)
    for ply in (2, 4):
        deck.answer(conn, 1, ply, "e7e5", today=TODAY, now=noon)
    deck.answer(conn, 1, 6, "g7g5", today=TODAY, now=noon)
    after = dict(conn.execute("SELECT ply, stability_after FROM card_reviews").fetchall())
    assert after[2] >= watch.STOPPED_DAYS > after[6]
    assert watch.stopped_today_keys(conn, TODAY) == {(1, 2)}
    assert deck.mastered_today_keys(conn, TODAY) == {(1, 4)}
    # The kept results name the move that stopped and say when a miss is back.
    results = {r["ply"]: r for r in deck.today_results(conn, TODAY)}
    assert [ply for ply, r in results.items() if r["stopped"]] == [2]
    due = conn.execute("SELECT due FROM cards WHERE game_id = 1 AND ply = 6").fetchone()[0]
    assert results[6]["due"] == due and due > TODAY.isoformat()
    # The Watch page's relit star counts it; the memory count keeps its own 60-day bar.
    memory = daily.summary(conn, TODAY, game_available=False)["memory"]
    assert (memory["stopped_today"], memory["mastered_today"]) == (1, 1)
    # The star it earned is the one the journey shows.
    assert [s["ply"] for s in watch.journey(conn, TODAY)["star_list"]] == [2, 4]


def test_last_kept_is_the_latest_day_that_counted(conn):
    assert daily.streak(conn, TODAY)["last_kept"] is None
    days(conn, 9, 8, ("rest", 2))
    # A rest day keeps nothing: silence still counts from the last watch kept.
    assert daily.streak(conn, TODAY)["last_kept"] == "2026-10-06"
    days(conn, 0)
    assert daily.streak(conn, TODAY)["last_kept"] == TODAY.isoformat()


def test_the_watch_is_saved_on_the_users_day_and_served_with_settings_and_home(db_url):
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/settings").json()["watch"] is None
    assert client.get("/api/home").json()["today"]["watch"] is None
    client.put("/api/settings/timezone", json={"timezone": "Pacific/Kiritimati"})
    saved = client.put("/api/settings/watch", json={"time": "20:30", "anchor": "  finish dinner "}).json()
    kiritimati = datetime.now(timezone(timedelta(hours=14))).date().isoformat()
    assert saved == {"time": "20:30", "anchor": "finish dinner", "set_on": kiritimati}
    assert client.get("/api/settings").json()["watch"] == saved
    assert client.get("/api/home").json()["today"]["watch"] == saved


@pytest.mark.parametrize(
    "body",
    [
        {"time": "20:10", "anchor": "finish dinner"},  # off the 15-minute grid
        {"time": "24:00", "anchor": "finish dinner"},
        {"time": "8:00", "anchor": "finish dinner"},
        {"time": "20:00", "anchor": " a "},  # under 2 characters once trimmed
        {"time": "20:00", "anchor": "x" * 61},
        {"time": "20:00", "anchor": "finish dinner\nthen sleep"},
    ],
)
def test_an_invalid_watch_is_refused_and_nothing_is_saved(db_url, body):
    client = TestClient(api.create_app(db_url))
    assert client.put("/api/settings/watch", json=body).status_code == 422
    assert client.get("/api/settings").json()["watch"] is None


def test_a_game_review_keeps_the_night_only_on_a_day_with_no_lesson(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)  # the game's slip makes tonight's lesson
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/home").json()["today"]["lesson"]["total"] == 1
    assert client.post("/api/games/1/review").status_code == 200
    today = client.get("/api/home").json()["today"]
    # The review is done, but the watch (the lesson) is what keeps the night.
    assert next(s for s in today["plan"] if s["kind"] == "game")["done"] is True
    assert today["streak"]["safe_today"] is False and today["streak"]["nights_total"] == 0
    # Finishing the lesson keeps it.
    answer_lesson_item(client)
    assert client.get("/api/home").json()["today"]["streak"]["safe_today"] is True


def test_with_no_lesson_a_game_review_keeps_the_night(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)  # nothing in it for the deck
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/home").json()["today"]["lesson"]["total"] == 0
    assert client.post("/api/games/1/review").status_code == 200
    streak = client.get("/api/home").json()["today"]["streak"]
    assert (streak["safe_today"], streak["count"], streak["nights_total"]) == (True, 1, 1)
