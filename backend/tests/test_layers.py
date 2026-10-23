import json
from datetime import date

import chess
import chess.engine
import pytest
from conftest import insert_game

from knightly import db, deck, game_trend, layers, threats

M = chess.Move.from_uci

# White's knight on e4 is attacked by Black's d5 pawn before White moves.
THREATENED = "7k/8/8/3p4/4N3/8/8/K7 w - - 0 1"
# Black's d6 pawn covers c5; nothing of White's is attacked yet.
LOOSE_SQUARE = "k7/8/3p4/8/8/1N6/8/K7 w - - 0 1"
# Ne7+ looks forcing, but the rook comes round to e2 and takes the knight four plies later.
LATE_LOSS = "6k1/8/8/3N4/8/8/r7/6K1 w - - 0 1"
LATE_LINE = ["g8h8", "g1f1", "a2e2", "f1g1", "e2e7"]
# Nc7+ forks Black's king and queen.
FORK_ON = "q3k3/8/8/1N6/8/8/8/6K1 w - - 0 1"


def info(pv=(), cp=0, mate=None, turn=chess.BLACK, depth=12):
    score = chess.engine.Mate(mate) if mate is not None else chess.engine.Cp(cp)
    return {"score": chess.engine.PovScore(score, turn), "pv": [M(m) for m in pv], "depth": depth}


class FakeEngine:
    """Answers analyse() from a table keyed by FEN (lists for MultiPV searches)."""

    def __init__(self, table):
        self.table = table

    def analyse(self, board, limit, multipv=None):
        return self.table[board.fen()]


def after(fen, uci):
    b = chess.Board(fen)
    b.push(M(uci))
    return b.fen()


def passed_fen(fen):
    return threats.passed(chess.Board(fen)).fen()


# Threat search


def test_a_piece_already_attacked_is_a_threat_and_a_pawn_grab_is_not():
    engine = FakeEngine({passed_fen(THREATENED): [info(["d5e4"], cp=300), info(["h8g8"])]})
    found = threats.search(engine, chess.Board(THREATENED), depth=12)
    assert [(t["uci"], t["san"], t["net"]) for t in found] == [("d5e4", "dxe4", 3)]

    # A knight for a pawn, even with the recapture, is a threat.
    defended = "7k/8/8/8/3p4/2N5/1P6/K7 w - - 0 1"
    engine = FakeEngine({passed_fen(defended): [info(["d4c3", "b2c3"], cp=200)]})
    assert [t["net"] for t in threats.search(engine, chess.Board(defended), depth=12)] == [2]

    pawn = "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1"  # dxe4 only wins a pawn
    engine = FakeEngine({passed_fen(pawn): [info(["d5e4"], cp=100)]})
    assert threats.search(engine, chess.Board(pawn), depth=12) == []


def test_a_mate_threat_counts_without_material():
    back_rank = "6k1/5ppp/8/8/8/8/8/r5K1 w - - 0 1"  # White in check: nothing to ask
    assert threats.search(FakeEngine({}), chess.Board(back_rank), depth=12) is None
    quiet = "6k1/5ppp/8/8/8/8/5PPP/r6K w - - 0 1"
    board = chess.Board(quiet)
    board.remove_piece_at(chess.A1)
    board.set_piece_at(chess.A8, chess.Piece(chess.ROOK, chess.BLACK))
    board.remove_piece_at(chess.G8)
    board.set_piece_at(chess.H8, chess.Piece(chess.KING, chess.BLACK))
    engine = FakeEngine({threats.passed(board).fen(): [info(["a8a1"], mate=1)]})
    assert threats.search(engine, board, depth=12)[0]["mate"] == 1


def test_a_capped_search_is_unknown_not_no_threat():
    engine = FakeEngine({passed_fen(THREATENED): [info(["d5e4"], cp=300, depth=8)]})
    assert threats.search(engine, chess.Board(THREATENED), depth=12) is None


# Layers


def test_ignoring_a_threat_that_then_wins_material_is_their_threat():
    threat_set = [{"uci": "d5e4"}]
    refutation = {"pv": [M("d5e4")], "score": info(cp=-300, turn=chess.WHITE)["score"]}
    assert layers.classify(chess.Board(THREATENED), "a1b1", "blunder", None, threat_set, refutation) == "theirThreat"
    # Punished by a different move: the move made a new problem, not their threat.
    other = {"pv": [M("h8g8")], "score": info(cp=-300, turn=chess.WHITE)["score"]}
    assert layers.classify(chess.Board(THREATENED), "a1b1", "blunder", None, threat_set, other) != "theirThreat"


def test_moving_onto_a_covered_square_is_their_reply():
    refutation = {"pv": [M("d6c5"), M("a1b2")], "score": info(cp=-300, turn=chess.WHITE)["score"]}
    assert layers.classify(chess.Board(LOOSE_SQUARE), "b3c5", "blunder", None, [], refutation) == "theirReply"
    # Allowing mate in two is a reply too, whatever the material.
    mate = {"pv": [M("d6d5")], "score": info(mate=-2, turn=chess.WHITE)["score"]}
    assert layers.classify(chess.Board(LOOSE_SQUARE), "a1b1", "blunder", None, [], mate) == "theirReply"


def test_a_check_that_loses_the_piece_only_later_is_calculation():
    refutation = {"pv": [M(m) for m in LATE_LINE], "score": info(cp=-300, turn=chess.WHITE)["score"]}
    assert layers.classify(chess.Board(LATE_LOSS), "d5e7", "mistake", None, [], refutation) == "calculation"
    # Leaving the knight there with a quiet move loses it within three plies: their reply.
    board = chess.Board(LATE_LOSS)
    board.push(M("d5e7"))
    board.push(M("g8h8"))
    quick = {"pv": [M("a2e2"), M("h1g1"), M("e2e7")], "score": info(cp=-300, turn=chess.WHITE)["score"]}
    assert layers.classify(board, "g1h1", "mistake", None, [], quick) == "theirReply"


def test_a_missed_fork_is_your_tactic_and_a_quiet_miss_is_untagged():
    assert layers.classify(chess.Board(FORK_ON), "g1f1", "miss", "b5c7", None, None) == "ownTactic"
    assert layers.classify(chess.Board(FORK_ON), "g1f1", "miss", "g1h2", None, None) is None


def test_settle_one_marks_a_capped_search_unknown():
    engine = FakeEngine(
        {passed_fen(THREATENED): [info(["d5e4"], cp=300)], after(THREATENED, "a1b1"): info(["d5e4"], cp=300, depth=6)}
    )
    assert layers.settle_one(engine, THREATENED, "a1b1", "blunder", None, depth=12) == ("unknown", None)


def test_settle_one_keeps_the_threats_and_refutation():
    engine = FakeEngine(
        {passed_fen(THREATENED): [info(["d5e4"], cp=300)], after(THREATENED, "a1b1"): info(["d5e4"], cp=300)}
    )
    layer, facts = layers.settle_one(engine, THREATENED, "a1b1", "blunder", None, depth=12)
    assert layer == "theirThreat"
    assert facts["threats"][0]["uci"] == "d5e4"
    assert facts["refutation"]["line"] == ["d5e4"]


@pytest.mark.parametrize(
    "control,ply,previous,setup,expected",
    [
        ("600", 21, 59.0, False, True),  # under a tenth of 10 minutes
        ("600", 21, 60.0, False, False),
        ("60+0", 21, 29.5, False, True),  # a minute game: 30 seconds is the bar
        ("60+0", 21, 31.0, False, False),
        ("600+5", 2, None, False, False),  # first move: the full base
        ("600", 2, None, True, None),  # a setup position has no known start
        ("600", 21, None, False, None),  # no clock recorded
        ("1/259200", 21, 10.0, False, None),  # daily games have no supported clock
    ],
)
def test_time_trouble_from_the_starting_clock(control, ply, previous, setup, expected):
    assert layers.time_trouble(control, ply, previous, setup) is expected


# Settling stored games, counts and practice order


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def add_game(conn, gid, start_fen, sans, played_at="2026-10-10T12:00:00Z", rated=True):
    insert_game(
        conn,
        gid,
        played_at=played_at,
        user_color="white",
        user_outcome="loss",
        moves_san=" ".join(sans),
        start_fen=start_fen,
        rated=rated,
        time_control="600",
    )


def add_move(conn, gid, ply, uci, cls, best_uci, clock=None):
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
           best_uci, eval_before, eval_second, classification, clock_left, win_pct_before)
           VALUES (%s, %s, %s, 'white', true, 'middlegame', 'x', %s, %s, 0, 300, %s, %s, 50)""",
        (gid, ply, (ply + 1) // 2, uci, best_uci, cls, clock),
    )


def test_settle_tags_recent_rated_mistakes_once_and_counts_them(conn, monkeypatch):
    add_game(conn, 1, THREATENED, ["Kb1"])
    add_move(conn, 1, 1, "a1b1", "blunder", "e4c5")
    add_game(conn, 2, FORK_ON, ["Kb1"])
    add_move(conn, 2, 1, "g1f1", "miss", "b5c7")
    add_game(conn, 3, THREATENED, ["Kb1"], played_at="2025-01-01T12:00:00Z")  # too old
    add_move(conn, 3, 1, "a1b1", "blunder", "e4c5")

    table = {passed_fen(THREATENED): [info(["d5e4"], cp=300)], after(THREATENED, "a1b1"): info(["d5e4"], cp=300)}
    monkeypatch.setattr(chess.engine.SimpleEngine, "popen_uci", classmethod(lambda cls, path: _Pooled(table)))
    today = date(2026, 10, 15)
    assert layers.settle(conn, "stockfish", workers=1, log=lambda *_: None, today=today) == 2
    assert layers.settle(conn, "stockfish", workers=1, log=lambda *_: None, today=today) == 0

    rows = {r["game_id"]: r for r in conn.execute("SELECT game_id, layer, time_trouble, cause_facts FROM moves")}
    assert rows[1]["layer"] == "theirThreat"
    assert rows[1]["time_trouble"] is None  # a setup position: no known starting clock
    facts = rows[1]["cause_facts"]
    facts = json.loads(facts) if isinstance(facts, str) else facts
    assert facts["threats"][0]["san"] == "dxe4"
    assert rows[2]["layer"] == "ownTactic"
    assert rows[3]["layer"] is None

    counts = layers.counts(conn, "2026-09-01T00:00:00Z")
    assert counts["theirThreat"] == 1 and counts["ownTactic"] == 1
    assert counts["pending"] == 0  # the old game is outside the period
    assert layers.counts(conn, None)["pending"] == 1


def test_new_cards_lean_toward_the_habit_costing_most(conn, monkeypatch):
    # Two mistakes missing your own tactic against one that ignored their threat. A mistake
    # count ranks your tactic first; the cost says safety is what loses you games, and the
    # cost wins. Layers of the same skill (theirThreat, theirReply) share its cost.
    for gid in (1, 2, 3):
        add_game(conn, gid, THREATENED, ["Kb1"], played_at=f"2026-10-0{gid}T12:00:00Z")
        add_move(conn, gid, 1, "a1b1", "blunder", "e4c5")
    conn.execute("UPDATE moves SET layer = 'theirThreat' WHERE game_id = 1")  # oldest game
    conn.execute("UPDATE moves SET layer = 'ownTactic' WHERE game_id IN (2, 3)")
    for gid in (1, 2, 3):
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (%s, 1)", (gid,))
    monkeypatch.setattr(deck, "pace", lambda c: "intense")
    monkeypatch.setattr(
        game_trend,
        "day_trend",
        lambda conn, today=None: {"focus": None, "costs": {"safety": 9.0, "tactics": 1.0, "calculation": 0.0}},
    )
    monkeypatch.setattr(db, "today", lambda conn: date(2026, 10, 15))
    order = [r["game_id"] for r in deck.queue(conn, date(2026, 10, 15))]
    assert order == [1, 3, 2]  # the costly habit first, then the rest newest-game first


class _Pooled:
    def __init__(self, table):
        self.engine = FakeEngine(table)

    def configure(self, options):
        pass

    def analyse(self, board, limit, multipv=None):
        return self.engine.analyse(board, limit, multipv)

    def quit(self):
        pass


def test_the_api_shows_layers_on_moves_and_in_the_overview(db_url):
    from fastapi.testclient import TestClient

    from knightly import api

    with db.connect(db_url) as c:
        add_game(c, 1, THREATENED, ["Kb1"], played_at="2026-10-14T12:00:00Z")
        add_move(c, 1, 1, "a1b1", "blunder", "e4c5")
        c.execute(
            "UPDATE moves SET layer = 'theirThreat', time_trouble = true, cause_facts = %s::jsonb",
            (
                json.dumps(
                    {
                        "threats": [{"uci": "d5e4", "san": "dxe4", "line": ["d5e4"], "net": 3, "mate": None}],
                        "refutation": {"line": ["d5e4"], "cp": -300, "mate": None},
                    }
                ),
            ),
        )
        add_game(c, 2, FORK_ON, ["Kf1"], played_at="2026-10-14T13:00:00Z")
        add_move(c, 2, 1, "g1f1", "miss", "g1h2")
        c.execute("UPDATE moves SET layer = 'other' WHERE game_id = 2")
    client = TestClient(api.create_app(db_url))
    ply = client.get("/api/games/1").json()["plies"][0]
    assert (ply["layer"], ply["time_trouble"]) == ("theirThreat", True)
    # Why you missed it, from the stored facts; the habit to work on.
    assert ply["cause"]["cause_kind"] == "missedThreat" and ply["cause"]["reply_san"] == "dxe4"
    assert ply["principle"] == "blunderCheck" and "cause_facts" not in ply
    other = client.get("/api/games/2").json()["plies"][0]
    assert other["layer"] is None and other["cause"] is None and other["principle"] is None
    counts = client.get("/api/overview?range=all").json()["layers"]
    assert counts["theirThreat"] == 1 and counts["other"] == 1 and counts["pending"] == 0


def test_settle_stores_time_trouble_from_the_previous_clock(conn, monkeypatch):
    # A normal game (no setup position): White's third move began with 50 seconds left.
    conn.execute(
        """INSERT INTO games (id, source, source_id, played_at, speed, user_color, user_outcome,
           opponent, pgn, moves_san, rated, time_control)
           VALUES (1, 'chesscom', '1', '2026-10-10T12:00:00Z', 'rapid', 'white', 'loss', 'opp', '',
                   'e4 e5 Nf3 Nc6 Bc4 Nd4', true, '600')"""
    )
    add_move(conn, 1, 1, "e2e4", "mistake", "d2d4", clock=590.0)
    add_move(conn, 1, 3, "g1f3", "mistake", "d2d4", clock=50.0)
    add_move(conn, 1, 5, "f1c4", "miss", "d2d4", clock=40.0)
    monkeypatch.setattr(chess.engine.SimpleEngine, "popen_uci", classmethod(lambda cls, path: _Pooled(_AnyLine())))
    layers.settle(conn, "stockfish", workers=1, log=lambda *_: None, today=date(2026, 10, 15))
    trouble = {r["ply"]: r["time_trouble"] for r in conn.execute("SELECT ply, time_trouble FROM moves")}
    assert trouble == {1: False, 3: False, 5: True}


class _AnyLine(dict):
    """A quiet engine: no threats, an even line, whatever the position."""

    def __getitem__(self, fen):
        board = chess.Board(fen)
        move = next(iter(board.legal_moves))
        return info([move.uci()], cp=0, turn=board.turn)


def test_settle_reaches_back_two_progress_periods(conn):
    # A miss needs no engine. 120 days back is in the previous 90-day period; 200 is beyond it.
    add_game(conn, 1, FORK_ON, ["Kf1"], played_at="2026-06-17T12:00:00Z")
    add_move(conn, 1, 1, "g1f1", "miss", "b5c7")
    add_game(conn, 2, FORK_ON, ["Kf1"], played_at="2026-03-29T12:00:00Z")
    add_move(conn, 2, 1, "g1f1", "miss", "b5c7")
    assert layers.settle(conn, None, workers=1, log=lambda *_: None, today=date(2026, 10, 15)) == 1
    rows = {r["game_id"]: r["layer"] for r in conn.execute("SELECT game_id, layer FROM moves")}
    assert rows == {1: "ownTactic", 2: None}
