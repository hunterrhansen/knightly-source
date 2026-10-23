"""Lesson intros (intros.py): explain, demonstrate, then a guided first position."""

import json

import chess
import pytest
from conftest import write_csv
from fastapi.testclient import TestClient

from knightly import api, curriculum, db, intros, wards


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def row(pid, themes, rating, moves="e8d8 b5c7"):
    fen = "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1"
    return f"{pid},{fen},{moves},{rating},75,95,1000,{themes},https://lichess.org/x,\n"


def test_a_posts_lessons_are_introduced_once_each_in_steps_order(db_url, tmp_path):
    from knightly import puzzles

    with db.connect(db_url) as c:  # the Gatehouse's practice: something to serve
        puzzles.import_file(c, write_csv(tmp_path / "p.csv", [row("h1", "hangingPiece short", 600)]), log=print)
    client = TestClient(api.create_app(db_url))
    gatehouse = [lesson.key for lesson in curriculum.WARDS[0].lessons]
    seen = []
    for _ in gatehouse:
        deck = client.get("/api/deck").json()
        seen.append(deck["intro"]["lesson"])
        assert client.post(f"/api/lessons/{seen[-1]}/introduced").json() == {"introduced": True}
    assert seen == gatehouse
    assert "intro" not in client.get("/api/deck").json(), "every lesson of the post introduced"


def test_an_intro_shows_the_easiest_positions_within_the_steps_depth(conn, tmp_path):
    rows = [
        row("hard", "mateIn1 short", 1500),
        row("easy", "mateIn1 short", 600),
        row("mid", "mateIn1 short", 800),
        # The easiest of all, but two moves of yours: Step 1 asks for one.
        row("long", "mateIn1 long", 400, "e8d8 b5c7 d8c8 c7a8"),
    ]
    from knightly import puzzles

    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", rows), log=lambda *a: None)
    intro = intros.payload(conn, curriculum.LESSONS["mate-in-one"])
    assert intro["name"] == "Mate in one"
    assert intro["example"]["line"] == ["b5c7"] and intro["example"]["fen_prev"].startswith("r3k3")
    # The two easiest one-movers: the long line is easier still, but deeper than Step 1.
    assert (intro["example"]["id"], intro["guided"]["id"]) == ("easy", "mid")


def test_a_lesson_nothing_can_supply_still_has_its_hand_picked_positions(conn):
    for key in ("golden-rules", "opening-principles", "stalemate", "activity"):
        intro = intros.payload(conn, curriculum.LESSONS[key])
        assert intro["example"] is not None, key


@pytest.mark.parametrize("key", sorted(json.load(open(intros.DATA))))
def test_hand_picked_positions_are_legal_and_the_guided_answer_is_the_only_mate(key):
    hand = json.load(open(intros.DATA))[key]
    assert key in curriculum.LESSONS
    for part in ("example", "guided"):
        if part not in hand:
            continue
        board = chess.Board(hand[part]["fen"])
        for uci in hand[part]["moves"]:
            move = chess.Move.from_uci(uci)
            assert move in board.legal_moves, (key, part, uci)
            board.push(move)
    if "guided" in hand:
        board = chess.Board(hand["guided"]["fen"])
        board.push(chess.Move.from_uci(hand["guided"]["moves"][0]))
        mates = [m for m in board.legal_moves if board.copy().is_checkmate() or _mates(board, m)]
        assert [m.uci() for m in mates] == [hand["guided"]["moves"][1]], key


def _mates(board: chess.Board, move: chess.Move) -> bool:
    after = board.copy()
    after.push(move)
    return after.is_checkmate()


def test_an_unknown_lesson_has_no_intro(db_url):
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/lessons/nonsense/intro").status_code == 404
    assert client.post("/api/lessons/nonsense/introduced").status_code == 404
    assert client.get("/api/lessons/mate-in-one/intro").json()["lesson"] == "mate-in-one"


def test_marking_an_intro_seen_keeps_its_first_day(conn):
    from datetime import date

    intros.mark(conn, "pin", date(2026, 10, 1))
    intros.mark(conn, "pin", date(2026, 10, 5))
    assert intros.introduced(conn) == {"pin": "2026-10-01"}
    assert wards.DEPTH  # depth keys exist for the step the intro reads
