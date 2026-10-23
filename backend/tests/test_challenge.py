"""Testing out of a post (challenge.py, issue #325): one Steps page at its own difficulty."""

import pytest
from conftest import write_csv
from fastapi.testclient import TestClient

from knightly import api, challenge, db, puzzles, wards


def row(pid, rating=900):
    fen = "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1"
    return f"{pid},{fen},e8d8 b5c7,{rating},75,95,1000,mateIn1 short,https://lichess.org/x,\n"


@pytest.fixture
def at_the_drawbridge(db_url, tmp_path):
    """A learner past the Gatehouse, at the mate-in-one post, with its puzzles stored."""
    with db.connect(db_url) as conn:
        puzzles.import_file(conn, write_csv(tmp_path / "p.csv", [row(f"m{i:02d}") for i in range(20)]), log=print)
        db.set_setting(
            conn, wards.REACHED_SETTING, {"board-vision": {"entered": "2026-10-01", "cleared": "2026-10-02"}}
        )
        assert wards.current(conn).ward.key == "mate-in-one"
    return TestClient(api.create_app(db_url))


def answer_page(client, right: int):
    deck = client.post("/api/posts/challenge").json()
    for i in range(wards.PAGE):
        puzzle = deck["puzzle"]
        assert puzzle is not None and deck["mode"] == "challenge", i
        moves = ["b5c7"] if i < right else ["e1e2"]
        client.post("/api/puzzles/answer", json={"id": puzzle["id"], "line_key": puzzle["line_key"], "moves": moves})
        deck = client.get("/api/deck?mode=challenge").json() if i < wards.PAGE - 1 else deck
    return client.get("/api/deck?mode=challenge")


def test_a_page_at_the_bar_clears_the_post_and_moves_the_learner_on(db_url, at_the_drawbridge):
    done = answer_page(at_the_drawbridge, right=wards.PAGE_RIGHT)
    assert done.status_code == 200
    assert done.json()["challenge"] == {
        "done": wards.PAGE,
        "right": wards.PAGE_RIGHT,
        "total": wards.PAGE,
        "passed": True,
        "ward": "mate-in-one",
        "games_not_yet": False,
    }
    with db.connect(db_url) as conn:
        assert wards.current(conn).ward.key != "mate-in-one"
    journey = at_the_drawbridge.get("/api/journey").json()
    tested = next(w for w in journey["wards"] if w["key"] == "mate-in-one")
    assert tested["state"] == "cleared" and tested["tested_out"] is True


def test_three_misses_leave_the_post_as_it_was(db_url, at_the_drawbridge):
    done = answer_page(at_the_drawbridge, right=wards.PAGE - 3).json()["challenge"]
    assert done["passed"] is False
    with db.connect(db_url) as conn:
        assert wards.current(conn).ward.key == "mate-in-one"


def test_there_is_no_test_to_continue_before_one_is_started(at_the_drawbridge):
    assert at_the_drawbridge.get("/api/deck?mode=challenge").status_code == 409


def test_a_test_is_offered_when_the_puzzle_rating_is_well_above_the_post(db_url, at_the_drawbridge, monkeypatch):
    with db.connect(db_url) as conn:
        ward = wards.current(conn)
        band = wards.bands(conn)["mate-in-one"]
        monkeypatch.setattr(puzzles, "ability", lambda conn: int(band) + challenge.SUGGEST_ABOVE)
        assert challenge.suggested(conn, ward)
        monkeypatch.setattr(puzzles, "ability", lambda conn: int(band))
        assert not challenge.suggested(conn, ward)


def test_a_test_cannot_override_games_that_keep_missing_the_idea(db_url, at_the_drawbridge):
    # Steps' real gate is the games: a perfect page does not clear a post the board says no to.
    from datetime import UTC, datetime, timedelta

    from conftest import insert_game

    with db.connect(db_url) as conn:
        played = (datetime.now(UTC) - timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
        insert_game(conn, 700, rated=True, played_at=played)
        for ply in range(1, wards.GAMES_AGAINST_ENOUGH + 1):
            conn.execute(
                """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                                      best_uci, classification, chance_motif, chance_found)
                   VALUES (700, %s, %s, 'white', true, 'middlegame', 'Nf3', 'g1f3', 'g1f3', 'best', 'mate', %s)""",
                (ply, ply, ply <= 5),
            )
    done = answer_page(at_the_drawbridge, right=wards.PAGE).json()["challenge"]
    assert done["passed"] is False and done["games_not_yet"] is True
    with db.connect(db_url) as conn:
        assert wards.current(conn).ward.key == "mate-in-one"
