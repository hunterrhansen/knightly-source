import json
from datetime import UTC, date, datetime

import chess
import chess.engine
import pytest
from conftest import DXE4, THREATENED, add_threat_game, add_threat_move, threat_item
from fastapi.testclient import TestClient

from knightly import api, db, drill

M = chess.Move.from_uci
TODAY = date(2026, 10, 15)

# Nothing is attacked: a quiet position.
QUIET = "7k/6pp/8/8/8/8/6PP/K7 w - - 0 1"


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


class Engine:
    """The opponent's line from each passed position, keyed by the position's FEN."""

    def __init__(self, lines):
        self.lines = lines

    def analyse(self, board, limit, multipv=None):
        moves = self.lines[board.board_fen()]
        score = chess.engine.PovScore(chess.engine.Cp(300 if moves == ["d5e4"] else 0), board.turn)
        return [{"score": score, "pv": [M(m) for m in moves], "depth": 30}]


def kinds(conn):
    return {r["game_id"]: r["kind"] for r in conn.execute("SELECT game_id, kind FROM threat_cards")}


def test_prepare_adds_missed_threats_then_one_calm_position_per_three(conn):
    # Several moves saved the knight, so the position is no review card: still a drill item.
    threat_item(conn, 1, card=False)
    # Sound moves of yours: a newer one where a threat exists after all, an older quiet one.
    add_threat_game(conn, 2, QUIET, "Kb1", "2026-10-11T12:00:00Z")
    add_threat_move(conn, 2, "a1b1", "good")
    add_threat_game(conn, 3, THREATENED, "Kb1", "2026-10-12T12:00:00Z")
    add_threat_move(conn, 3, "a1b1", "best")
    engine = Engine({chess.Board(QUIET).board_fen(): ["h8g8"], chess.Board(THREATENED).board_fen(): ["d5e4"]})
    assert drill.prepare(conn, log=lambda *_: None, today=TODAY, engine=engine) == 2
    assert kinds(conn) == {1: "threat", 2: "calm", 3: "skip"}
    stored = conn.execute("SELECT threats FROM threat_cards WHERE game_id = 1").fetchone()["threats"]
    assert drill._threats(stored)[0]["san"] == "dxe4"
    # Nothing more to add: one calm item already balances one threat item.
    assert drill.prepare(conn, log=lambda *_: None, today=TODAY, engine=engine) == 0


def test_a_position_in_check_is_never_a_calm_item(conn):
    threat_item(conn, 1)
    checked = "7k/8/8/8/8/8/1q6/K7 w - - 0 1"  # the queen gives check: nothing to ask
    add_threat_game(conn, 2, checked, "Kxb2", "2026-10-11T12:00:00Z")
    add_threat_move(conn, 2, "a1b2", "good")
    drill.prepare(
        conn, log=lambda *_: None, today=TODAY, engine=Engine({chess.Board(THREATENED).board_fen(): ["d5e4"]})
    )
    assert kinds(conn)[2] == "skip"


def test_own_questions_mix_in_calm_items_skip_cards_and_stop_at_the_daily_limit(conn):
    for gid in range(1, 8):
        threat_item(conn, gid, f"2026-10-0{gid}T12:00:00Z", card=False)
        conn.execute(
            "INSERT INTO threat_cards (game_id, ply, kind, threats) VALUES (%s, 1, %s, %s::jsonb)",
            (gid, "calm" if gid in (1, 2) else "threat", "[]" if gid in (1, 2) else json.dumps([DXE4])),
        )
    order = [(r["game_id"], r["kind"]) for r in drill.queue(conn, TODAY)]
    # Newest first, a calm item after every three threat items, five new a day.
    assert order == [(7, "threat"), (6, "threat"), (5, "threat"), (2, "calm"), (4, "threat")]
    # A threat item that is a review card asks its question with the card instead.
    conn.execute("INSERT INTO cards (game_id, ply) VALUES (7, 1)")
    assert (7, "threat") not in [(r["game_id"], r["kind"]) for r in drill.queue(conn, TODAY)]
    assert drill.card_threat(conn, 7, 1) == {"threats": [DXE4]}
    assert drill.card_threat(conn, 1, 1) is None  # calm: no question on a card


def test_answers_are_graded_from_the_stored_set_and_only_the_first_schedules(conn):
    threat_item(conn, 1)
    conn.execute(
        "INSERT INTO threat_cards (game_id, ply, kind, threats) VALUES (1, 1, 'threat', %s::jsonb)",
        (json.dumps([DXE4]),),
    )
    now = datetime(2026, 10, 15, 18, tzinfo=UTC)
    wrong = drill.answer(conn, 1, 1, drill.NONE, seconds=4, today=TODAY, now=now)
    assert (wrong["correct"], wrong["rating"]) == (False, "again")
    assert wrong["threats"][0]["uci"] == "d5e4"
    retry = drill.answer(conn, 1, 1, "d5e4", seconds=3, today=TODAY, now=now)
    assert (retry["correct"], retry["rating"]) == (True, None)  # a retry doesn't reschedule
    row = conn.execute("SELECT reviews, lapses FROM threat_cards").fetchone()
    assert (row["reviews"], row["lapses"]) == (1, 1)
    assert drill.queue(conn, TODAY) == []  # answered today
    with pytest.raises(ValueError):
        drill.answer(conn, 1, 1, "e4c5", today=TODAY)  # White's move, not theirs


def test_no_threat_is_right_on_a_calm_item_and_fast_answers_are_easy(conn):
    add_threat_game(conn, 2, QUIET, "Kb1", "2026-10-11T12:00:00Z")
    add_threat_move(conn, 2, "a1b1", "good")
    conn.execute("INSERT INTO threat_cards (game_id, ply, kind) VALUES (2, 1, 'calm')")
    result = drill.answer(conn, 2, 1, drill.NONE, seconds=5, today=TODAY)
    assert (result["correct"], result["rating"]) == (True, "easy")
    assert drill.answer(conn, 2, 1, "h7h6", today=TODAY)["correct"] is False


def test_the_watch_looks_first_and_counts_the_question(db_url, monkeypatch):
    from knightly import practice_grades

    monkeypatch.setattr(practice_grades, "engine_revision", lambda: None)  # no grade maps here
    with db.connect(db_url) as c:
        # Three review cards on other games, and one threat question of its own.
        for gid in (11, 12, 13):
            add_threat_game(c, gid, THREATENED, "Kb1", f"2026-10-0{gid - 10}T12:00:00Z")
            c.execute(
                """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci, best_san,
                   best_uci, eval_before, eval_second, classification, win_pct_before)
                   VALUES (%s, 1, 1, 'white', true, 'middlegame', 'Kb1', 'a1b1', 'Nc5', 'e4c5', 300, 0, 'blunder', 50)""",
                (gid,),
            )
        threat_item(c, 1, card=False)
        c.execute(
            "INSERT INTO threat_cards (game_id, ply, kind, threats) VALUES (1, 1, 'threat', %s::jsonb)",
            (json.dumps([DXE4]),),
        )
    client = TestClient(api.create_app(db_url))
    asked = client.get("/api/deck").json()
    assert asked["today"] == {"done": 0, "total": 4}  # three positions and the question
    # The watch's first slot looks before moving (mix.py): the question, not a card.
    assert asked["card"] is None and asked["mode"] == "defend"
    assert asked["threat_item"]["kind"] == "threat" and asked["threat_item"]["threats"][0]["san"] == "dxe4"
    day = asked["server_day"]
    assert (
        client.post(
            "/api/threats/answer", json={"game_id": 1, "ply": 1, "answer": "a1a2", "expected_day": day}
        ).status_code
        == 422
    )
    assert client.post("/api/threats/answer", json={"game_id": 9, "ply": 1, "answer": "none"}).status_code == 404
    assert (
        client.post(
            "/api/threats/answer", json={"game_id": 1, "ply": 1, "answer": "none", "expected_day": "2000-01-01"}
        ).status_code
        == 409
    )
    ok = client.post(
        "/api/threats/answer", json={"game_id": 1, "ply": 1, "answer": "d5e4", "expected_day": day, "seconds": 20}
    ).json()
    assert ok["correct"] is True and ok["rating"] == "good"
    after = client.get("/api/deck").json()
    assert after["today"] == {"done": 1, "total": 4}
    assert after["card"] is not None and after["threat_item"] is None


# --- "what does your move allow?": the other half of the habit -----------------------------

# White to move, the knight on f3 undefended (no g2 pawn) and the black queen eyeing it.
# 1. a3?? ignores that and 1... Qxf3 takes it: a theirReply blunder, exactly the shape
# layers.py tags.
LOOSE_KNIGHT = "rnb1kbnr/pppp1ppp/8/4p3/6q1/5N2/PPPPPP1P/RNBQKB1R w KQkq - 0 1"


def allows_item(conn, gid=1, refutation=("g4f3",), played_at="2026-10-01T12:00:00Z"):
    """A game whose first move is the learner's theirReply blunder, with the line stored."""
    add_threat_game(conn, gid, LOOSE_KNIGHT, "a3", played_at)
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              classification, layer, cause_facts)
           VALUES (%s, 1, 1, 'white', true, 'middlegame', 'a3', 'a2a3', 'blunder',
                   'theirReply', %s::jsonb)""",
        (gid, json.dumps({"threats": [], "refutation": {"line": list(refutation)}})),
    )


def test_an_allows_item_is_made_from_a_theirReply_move(db_url):
    conn = db.connect(db_url)
    allows_item(conn)
    assert drill._prepare_allows(conn, 10) == 1
    row = conn.execute("SELECT kind, threats FROM threat_cards WHERE game_id = 1 AND ply = 1").fetchone()
    assert row["kind"] == "allows"
    assert [t["uci"] for t in drill._threats(row["threats"])] == ["g4f3"]


def test_a_theirReply_move_with_no_stored_line_is_skipped_rather_than_guessed(db_url):
    conn = db.connect(db_url)
    allows_item(conn, refutation=())
    assert drill._prepare_allows(conn, 10) == 0
    assert conn.execute("SELECT count(*) FROM threat_cards").fetchone()[0] == 0


def test_an_allows_item_is_answered_from_after_your_own_move(db_url):
    conn = db.connect(db_url)
    allows_item(conn)
    drill._prepare_allows(conn, 10)
    item = drill.item(conn, 1, 1)
    # Your own move animates in as the setup and the board you answer from is the one after
    # it, so their reply is a legal move rather than the opponent moving out of turn.
    assert item["kind"] == "allows"
    assert item["prev_uci"] == "a2a3"
    assert item["fen_prev"] == LOOSE_KNIGHT
    assert item["fen_before"].startswith("rnb1kbnr/pppp1ppp/8/4p3/6q1/P4N2/1PPPPP1P/RNBQKB1R b")


def test_grading_an_allows_answer_takes_the_refutation_and_nothing_else(db_url):
    conn = db.connect(db_url)
    allows_item(conn)
    drill._prepare_allows(conn, 10)
    assert drill.answer(conn, 1, 1, "g4f3")["correct"] is True
    assert drill.answer(conn, 1, 1, "g8f6")["correct"] is False, "a legal but wrong reply is wrong"
    with pytest.raises(ValueError):
        drill.answer(conn, 1, 1, "h1h8")  # White's rook: not theirs to move


def test_a_wrong_allows_answer_schedules_it_again(db_url):
    conn = db.connect(db_url)
    allows_item(conn)
    drill._prepare_allows(conn, 10)
    result = drill.answer(conn, 1, 1, drill.NONE)
    assert result["correct"] is False and result["rating"] == "again"
    assert result["due"] is not None


def test_allows_items_are_served_in_the_queue(db_url):
    conn = db.connect(db_url)
    allows_item(conn)
    drill._prepare_allows(conn, 10)
    assert [(r["game_id"], r["ply"]) for r in drill.queue(conn)] == [(1, 1)]


def test_prepare_counts_allows_items_toward_the_calm_share(db_url):
    # "Something is always there" must not become a safe guess as the new kind arrives, so
    # calm items are owed against both kinds that do have something there.
    conn = db.connect(db_url)
    for gid in range(1, 4):
        allows_item(conn, gid=gid)
    after_a3 = chess.Board(LOOSE_KNIGHT)
    after_a3.push(M("a2a3"))
    drill.prepare(conn, engine=Lines({after_a3.board_fen(): [["g4f3"]]}), log=lambda *a: None)
    kinds = {r["kind"]: r["n"] for r in conn.execute("SELECT kind, count(*) AS n FROM threat_cards GROUP BY kind")}
    assert kinds.get("allows") == 3


# --- ward 1: "they left a piece loose" ------------------------------------------------------

# Black's rook on d8 is undefended and White's queen on d1 can simply take it.
FREE_ROOK = "3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1"
# The same rook, now guarded by the king on c8: taking it is a trade, not the lesson.
GUARDED_ROOK = "2kr4/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1"


def test_free_capture_wants_an_undefended_piece_worth_taking():
    assert drill.free_capture(chess.Board(FREE_ROOK), "d1a1") is False, "d1a1 is not a capture"
    assert drill.free_capture(chess.Board(FREE_ROOK), "d1d8") is True
    assert drill.free_capture(chess.Board(GUARDED_ROOK), "d1d8") is False, "defended: a trade"


def test_free_capture_ignores_a_pawn_and_an_illegal_move():
    pawn = "7k/p7/8/8/8/8/5PPP/3Q3K w - - 0 1"
    assert drill.free_capture(chess.Board(pawn), "d1a4") is False  # not a capture
    assert drill.free_capture(chess.Board(FREE_ROOK), "nonsense") is False
    assert drill.free_capture(chess.Board(FREE_ROOK), None) is False


def vision_game(conn, gid=1):
    add_threat_game(conn, gid, FREE_ROOK, "Qxd8+", "2026-10-01T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              best_uci, classification)
           VALUES (%s, 1, 1, 'white', true, 'middlegame', 'Qa1', 'd1a1', 'd1d8', 'miss')""",
        (gid,),
    )


def test_a_vision_item_is_made_from_a_loose_piece_in_your_own_game(db_url):
    conn = db.connect(db_url)
    vision_game(conn)
    assert drill._prepare_vision(conn, 10) == 1
    row = conn.execute("SELECT kind, threats FROM threat_cards WHERE game_id = 1").fetchone()
    assert row["kind"] == "vision"
    assert [t["uci"] for t in drill._threats(row["threats"])] == ["d1d8"]


def test_a_vision_answer_is_your_own_move_not_the_opponents(db_url):
    conn = db.connect(db_url)
    vision_game(conn)
    drill._prepare_vision(conn, 10)
    item = drill.item(conn, 1, 1)
    assert item["kind"] == "vision" and item["fen_before"] == FREE_ROOK
    assert drill.answer(conn, 1, 1, "d1d8")["correct"] is True
    assert drill.answer(conn, 1, 1, "d1a1")["correct"] is False
    with pytest.raises(ValueError):
        drill.answer(conn, 1, 1, "a8a1")  # Black's rook: not yours to move


def test_allows_and_vision_items_are_served_with_their_answers_in_full(db_url):
    # Both are stored as a bare move; the app names each answer ("Qxd8# wins a rook"), so
    # the item and the graded answer carry its SAN and what it wins.
    conn = db.connect(db_url)
    vision_game(conn)
    drill._prepare_vision(conn, 10)
    allows_item(conn, gid=2)
    drill._prepare_allows(conn, 10)
    vision = drill.item(conn, 1, 1)["threats"]
    assert [(t["san"], t["net"]) for t in vision] == [("Qxd8#", 5)]
    assert drill.answer(conn, 1, 1, "d1d8")["threats"] == vision
    allows = drill.item(conn, 2, 1)["threats"]
    assert [(t["san"], t["net"]) for t in allows] == [("Qxf3", 3)]


def test_vision_items_are_not_selected_by_the_hangingPiece_tag(db_url):
    # The obvious filter is chance_motif, and it is the least reliable signal we have
    # (0.17 precision). A position with the tag but no loose piece must not become an item.
    conn = db.connect(db_url)
    add_threat_game(conn, 1, GUARDED_ROOK, "Qxd8+", "2026-10-01T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              best_uci, classification, chance_motif)
           VALUES (1, 1, 1, 'white', true, 'middlegame', 'Qa1', 'd1a1', 'd1d8', 'miss', 'hangingPiece')"""
    )
    assert drill._prepare_vision(conn, 10) == 0


# --- widened answers: any move that wins material is the threat --------------------------

# White to move. Black's queen on f6 eyes two loose white pieces: the knight on c3 and the
# bishop on h4. Either capture wins a piece, so either is the threat.
TWO_LOOSE = "6k1/5ppp/5q2/8/7B/2N5/P4PPP/6K1 w - - 0 1"
QXC3 = {"uci": "f6c3", "san": "Qxc3", "line": ["f6c3"], "net": 3, "mate": None}


class Lines:
    """Several of the opponent's lines from each position, best first, keyed by board FEN."""

    def __init__(self, lines):
        self.lines = lines

    def analyse(self, board, limit, multipv=None):
        score = chess.engine.PovScore(chess.engine.Cp(300), board.turn)
        return [{"score": score, "pv": [M(m) for m in pv], "depth": 30} for pv in self.lines[board.board_fen()]]


def two_loose_threat(conn, stored):
    add_threat_game(conn, 1, TWO_LOOSE, "a3", "2026-10-10T12:00:00Z")
    add_threat_move(conn, 1, "a2a3", "blunder", "theirThreat", {"threats": stored, "refutation": None})
    conn.execute(
        "INSERT INTO threat_cards (game_id, ply, kind, threats) VALUES (1, 1, 'threat', %s::jsonb)",
        (json.dumps(stored),),
    )


def passed_fen(fen):
    board = chess.Board(fen)
    board.push(chess.Move.null())
    return board.board_fen()


def test_a_threat_item_made_from_fewer_lines_accepts_every_winning_capture_once_widened(conn):
    # Made when only the top lines counted: Qxc3 was stored, Qxh4 wins a piece just the same.
    two_loose_threat(conn, [QXC3])
    assert drill.answer(conn, 1, 1, "f6h4", today=TODAY)["correct"] is False
    engine = Lines({passed_fen(TWO_LOOSE): [["f6h4"], ["f6c3"], ["g8f8"]]})
    assert drill.widen(conn, lambda: engine, log=lambda *_: None) == 1
    assert drill.answer(conn, 1, 1, "f6h4", today=TODAY)["correct"] is True
    assert drill.answer(conn, 1, 1, "f6c3", today=TODAY)["correct"] is True
    assert drill.answer(conn, 1, 1, "g8f8", today=TODAY)["correct"] is False, "a king move wins nothing"
    # Done once: a widened item is not searched again.
    assert drill.widen(conn, lambda: engine, log=lambda *_: None) == 0


def test_widening_never_takes_back_an_answer_that_was_accepted(conn):
    two_loose_threat(conn, [QXC3])
    drill.widen(conn, lambda: Lines({passed_fen(TWO_LOOSE): [["f6h4"]]}), log=lambda *_: None)
    assert drill.answer(conn, 1, 1, "f6c3", today=TODAY)["correct"] is True


def test_a_capped_search_leaves_the_item_for_the_next_run(conn):
    two_loose_threat(conn, [QXC3])

    class Capped:
        def analyse(self, board, limit, multipv=None):
            return [{"score": chess.engine.PovScore(chess.engine.Cp(0), board.turn), "pv": [], "depth": 5}]

    assert drill.widen(conn, lambda: Capped(), log=lambda *_: None) == 0
    assert conn.execute("SELECT answer_set FROM threat_cards").fetchone()["answer_set"] < drill.ANSWER_SET


def test_an_allows_item_accepts_any_reply_that_wins_material_once_widened(db_url):
    conn = db.connect(db_url)
    add_threat_game(conn, 1, TWO_LOOSE, "a3", "2026-10-01T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              classification, layer, cause_facts)
           VALUES (1, 1, 1, 'white', true, 'middlegame', 'a3', 'a2a3', 'blunder',
                   'theirReply', %s::jsonb)""",
        (json.dumps({"threats": [], "refutation": {"line": ["f6c3"], "cp": -300, "mate": None}}),),
    )
    drill._prepare_allows(conn, 10)
    # Before: only the engine's own refutation counted.
    assert drill.answer(conn, 1, 1, "f6h4")["correct"] is False
    after_a3 = chess.Board(TWO_LOOSE)
    after_a3.push(M("a2a3"))
    engine = Lines({after_a3.board_fen(): [["f6h4"], ["g8f8"]]})
    assert drill.widen(conn, lambda: engine, log=lambda *_: None) == 1
    accepted = [t["uci"] for t in drill.item(conn, 1, 1)["threats"]]
    # The other loose piece, and the stored refutation even though this search left it out.
    assert accepted == ["f6h4", "f6c3"]
    assert drill.answer(conn, 1, 1, "f6h4")["correct"] is True
    assert drill.answer(conn, 1, 1, "g8f8")["correct"] is False


def test_a_calm_item_that_stays_calm_is_widened_and_still_calm(conn):
    # Staging found this: writing the empty set back must not break the threats column.
    add_threat_game(conn, 1, QUIET, "Kb1", "2026-10-10T12:00:00Z")
    add_threat_move(conn, 1, "a1b1", "good")
    conn.execute("INSERT INTO threat_cards (game_id, ply, kind) VALUES (1, 1, 'calm')")
    assert drill.widen(conn, lambda: Lines({passed_fen(QUIET): [["h8g8"]]}), log=lambda *_: None) == 1
    row = conn.execute("SELECT kind, answer_set FROM threat_cards").fetchone()
    assert (row["kind"], row["answer_set"]) == ("calm", drill.ANSWER_SET)
    assert drill.answer(conn, 1, 1, drill.NONE, today=TODAY)["correct"] is True


def test_a_calm_item_where_a_threat_turns_up_becomes_a_threat_item(conn):
    add_threat_game(conn, 1, TWO_LOOSE, "a3", "2026-10-10T12:00:00Z")
    add_threat_move(conn, 1, "a2a3", "good")
    conn.execute("INSERT INTO threat_cards (game_id, ply, kind) VALUES (1, 1, 'calm')")
    drill.widen(conn, lambda: Lines({passed_fen(TWO_LOOSE): [["f6h4"]]}), log=lambda *_: None)
    assert kinds(conn) == {1: "threat"}
    assert drill.answer(conn, 1, 1, drill.NONE, today=TODAY)["correct"] is False
