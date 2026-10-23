"""Extra watches: another watch once tonight's is kept, as many as the learner wants, in the
same mix as tonight's; reviews it had no room for, then new slips and family puzzles for held
moves; never a card answered tonight, never the streak."""

import json
from datetime import UTC, datetime, timedelta

import pytest
from conftest import OPENING, add_review_game, add_review_move, insert_game, write_csv
from fastapi.testclient import TestClient
from fsrs import Card, State

from knightly import api, daily, db, deck, drill, extra, mix, puzzles, unannounced


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def puzzle_row(pid, themes):
    return f"{pid},{OPENING},e2e4 e7e5 g1f3 b8c6,1200,75,95,1000,{themes},https://lichess.org/x,\n"


PUZZLE_ANSWER = ["e7e5", "g1f3", "b8c6"]


def answer_card(client, card, mode):
    assert card is not None, f"no card in {mode}"
    response = client.post("/api/deck/answer", json={"game_id": card["game_id"], "ply": card["ply"], "uci": "e7e5"})
    assert response.status_code == 200


def a_night_with_slips_left(db_url):
    """Twelve reviews due tonight in an old game, and three never-answered positions in two
    newer games; the lesson is answered, which keeps the night."""
    with db.connect(db_url) as c:
        add_review_game(c, 1, played_at="2026-10-01T12:00:00Z")
        for ply in range(2, 26, 2):
            add_review_move(c, 1, ply)
        deck.sync(c)
        c.execute("UPDATE cards SET due = '2000-01-01', reviews = 1")
        add_review_game(c, 2, played_at="2026-10-05T12:00:00Z")
        add_review_game(c, 3, played_at="2026-10-03T12:00:00Z")
        for gid, ply in ((2, 2), (2, 4), (3, 2)):
            add_review_move(c, gid, ply)
        deck.sync(c)
    client = TestClient(api.create_app(db_url))
    for _ in range(daily.GOAL):
        answer_card(client, client.get("/api/deck?mode=lesson").json()["card"], "lesson")
    return client


def test_an_extra_watch_waits_until_tonights_watch_is_kept(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(db_url))
    assert client.post("/api/lesson/extra").status_code == 409
    assert client.get("/api/deck?mode=extra").status_code == 409
    today = client.get("/api/home").json()["today"]
    assert today["streak"]["safe_today"] is False and today["extra_kept"] == 0


def test_an_extra_watch_takes_the_reviews_tonights_watch_had_no_room_for_then_new_slips(db_url):
    client = a_night_with_slips_left(db_url)
    kept = client.get("/api/home").json()["today"]
    assert kept["streak"] == {**kept["streak"], "count": 1, "safe_today": True}
    assert kept["extra_kept"] == 0

    deck_ = client.post("/api/lesson/extra").json()
    assert deck_["extra"] == {"done": 0, "total": daily.GOAL, "kept": 0}
    served = []
    while deck_["card"]:
        served.append((deck_["card"]["game_id"], deck_["card"]["ply"]))
        answer_card(client, deck_["card"], "extra")
        deck_ = client.get("/api/deck?mode=extra").json()
    # The two reviews still due tonight first (none was answered tonight, so it is no early
    # second review), then the new slips, newest game first. Nothing answered tonight returns.
    assert served == [(1, 22), (1, 24), (2, 2), (2, 4), (3, 2)]
    # With no puzzles stored the watch runs dry and ends where it is, kept.
    assert deck_["puzzle"] is None and deck_["extra"] == {"done": 5, "total": 5, "kept": 1}
    assert [(r["game_id"], r["ply"]) for r in deck_["results"]] == served

    after = client.get("/api/home").json()["today"]
    assert after["streak"]["count"] == 1 and after["extra_kept"] == 1
    # The next extra watch starts fresh; resuming an open one does not count it twice.
    assert client.post("/api/lesson/extra").json()["extra"] == {"done": 0, "total": 0, "kept": 1}


def test_a_finished_extra_watch_is_kept_on_the_path_with_what_it_held(db_url):
    client = a_night_with_slips_left(db_url)
    deck_ = client.post("/api/lesson/extra").json()
    while deck_["card"]:
        answer_card(client, deck_["card"], "extra")
        deck_ = client.get("/api/deck?mode=extra").json()
    history = client.get("/api/journey").json()["history"]
    with db.connect(db_url) as c:
        tonight = db.today(c).isoformat()
    # Its five answers are its own; the night's watch keeps the lesson's ten answers.
    assert history["extra"] == [{"date": tonight, "held": 5, "slipped": 0, "stopped": 0}]
    assert history["nights"] == [{"date": tonight, "held": daily.GOAL, "slipped": 0, "stopped": 0}]
    # Read again (and after the next watch starts), it is logged once.
    client.post("/api/lesson/extra")
    assert len(client.get("/api/journey").json()["history"]["extra"]) == 1


def test_an_unfinished_extra_watch_resumes(db_url):
    client = a_night_with_slips_left(db_url)
    first = client.post("/api/lesson/extra").json()
    answer_card(client, first["card"], "extra")
    again = client.post("/api/lesson/extra").json()
    assert again["extra"] == {"done": 1, "total": daily.GOAL, "kept": 0}
    assert (again["card"]["game_id"], again["card"]["ply"]) == (1, 24)


def held_card(conn, gid, ply, pattern, stability):
    """A reviewed card due next week whose last answer was right, carrying `pattern`."""
    insert_game(conn, gid, played_at="2026-09-01T12:00:00Z", user_color="black", moves_san="x")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
           best_uci, eval_before, eval_second, classification, pattern, win_pct_before)
           VALUES (%s, %s, 1, 'black', true, 'middlegame', 'g5', 'g7g5', 'e7e5', -50, 300, 'blunder', %s, 50)""",
        (gid, ply, pattern),
    )
    last = datetime.now(UTC) - timedelta(days=3)
    state = Card(state=State.Review, stability=stability, difficulty=5.0, due=last, last_review=last)
    conn.execute(
        "INSERT INTO cards (game_id, ply, fsrs, due, reviews) VALUES (%s, %s, %s, '2999-01-01', 1)",
        (gid, ply, json.dumps(state.to_dict())),
    )
    conn.execute(
        """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)
           VALUES (%s, %s, %s, 'e7e5', true, 'good')""",
        (gid, ply, db.stamp(last)),
    )


def serve(conn, n):
    """Item `n` of an extra watch, as the route asks for it."""
    today = db.today(conn)
    asked, moves = drill.plan(conn, today), unannounced.plan(conn, today)
    return mix.serve(conn, today, n, asked, moves, deck.queue(conn, today), extra_watch=True)


def test_an_extra_watchs_games_slot_runs_new_slips_then_held_families_then_never_runs_dry(conn, tmp_path):
    today = db.today(conn)
    puzzles.import_file(
        conn,
        write_csv(
            tmp_path / "p.csv",
            [puzzle_row("forky", "fork middlegame"), puzzle_row("skewy", "skewer"), puzzle_row("pinny", "pin")],
        ),
        log=lambda *a: None,
    )
    held_card(conn, 10, 2, "fork", stability=4)
    held_card(conn, 11, 2, "skewer", stability=8)  # closer to the 11-day bar: first
    add_review_game(conn, 1, played_at="2026-10-10T12:00:00Z")
    add_review_move(conn, 1, 2)  # a new slip with no nameable tactic
    deck.sync(conn)
    # An open extra watch: a family puzzle solved in it counts for its held move.
    watch = {"day": today.isoformat(), **extra.answered(conn, today), "total": 10, "kept": 0}
    db.set_setting(conn, extra.SETTING, watch)
    games_slot = mix.SLOTS.index(mix.GAMES)

    assert serve(conn, games_slot)["card"] == (1, 2)
    conn.execute("UPDATE cards SET due = '2999-01-01', reviews = 1 WHERE game_id = 1")

    item = serve(conn, games_slot)
    assert item["card"] is None and item["puzzle"]["id"] == "skewy" and item["mode"] == "volume"
    # Solving it counts as the held move's family: what lets it stop slipping.
    puzzles.answer(conn, "skewy", PUZZLE_ANSWER, today=today)
    assert puzzles.family_solved(conn, 11, 2) is True

    assert serve(conn, games_slot)["puzzle"]["id"] == "forky"
    puzzles.answer(conn, "forky", ["d7d5"], today=today)  # missed: it waits for another night
    assert puzzles.family_solved(conn, 10, 2) is False

    # Nothing of the learner's own is left: the slot falls back to puzzles, so it never runs dry.
    assert serve(conn, games_slot)["puzzle"]["id"] == "pinny"
    puzzles.answer(conn, "pinny", PUZZLE_ANSWER, today=today)
    assert not any(serve(conn, games_slot)[k] for k in ("card", "threat", "move", "puzzle"))


def test_the_current_posts_lessons_come_before_the_weakest_themes(conn, tmp_path, monkeypatch):
    # More watches tonight mean more of what the post teaches, announced as the post's idea.
    from knightly import wards

    today = db.today(conn)
    puzzles.import_file(
        conn,
        write_csv(tmp_path / "p.csv", [puzzle_row("pinny", "pin"), puzzle_row("matey", "mateIn1 short")]),
        log=lambda *a: None,
    )
    ward = next(w for w in wards.state(conn) if w.ward.key == "mate-in-one")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    monkeypatch.setattr(puzzles.patterns, "weakness", lambda conn, today: {"pin": 0.1})
    idea_slot = mix.SLOTS.index(mix.IDEA)
    served = serve(conn, idea_slot)
    assert served["puzzle"]["id"] == "matey" and served["mode"] == "taught"
    assert not {"ward", "theme", "taught"} & served["puzzle"].keys()

    # A post the corpus cannot serve falls back to the weakest theme, not announced.
    puzzles.answer(conn, "matey", PUZZLE_ANSWER, today=today)
    served = serve(conn, idea_slot)
    assert served["puzzle"]["id"] == "pinny" and served["mode"] == "volume"
