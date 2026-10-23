import json
import subprocess
from datetime import UTC, datetime, timedelta

import pytest
from conftest import add_kpi_game, days_ago
from fastapi.testclient import TestClient

from knightly import api, db, deck, game_facts, limits, lines, schedule
from knightly.routes import account as account_routes
from knightly.routes import games as games_routes


@pytest.fixture
def client(db_url, tmp_path):
    path = db_url
    with db.connect(path) as conn:
        # 1: reached a winning position, then lost: a thrown win.
        add_kpi_game(
            conn, 1, played_at=days_ago(1), outcome="loss", moves=[(1, 85, "best"), (0, 15, "good"), (1, 10, "blunder")]
        )
        # 2: opponent blundered and was punished; won.
        add_kpi_game(
            conn, 2, played_at=days_ago(2), outcome="win", moves=[(1, 50, "good"), (0, 10, "blunder"), (1, 90, "best")]
        )
        # 3: opponent blundered, user missed it; was lost, then came back to draw.
        add_kpi_game(
            conn,
            3,
            played_at=days_ago(3),
            outcome="draw",
            termination="Game drawn by repetition",
            moves=[(1, 15, "mistake"), (0, 40, "blunder"), (1, 18, "mistake")],
        )
        # 4: not analysed.
        add_kpi_game(conn, 4, played_at=days_ago(4), outcome="win", opening="London System")
        # 5: unrated, excluded by default.
        add_kpi_game(conn, 5, played_at=days_ago(5), outcome="win", rated=False)
        # 6: older than 30 days, for the previous-period comparison.
        add_kpi_game(conn, 6, played_at=days_ago(40), outcome="loss", rating=850, moves=[(1, 50, "good")])
    return TestClient(api.create_app(path))


def test_ended_by():
    assert game_facts.ended_by("gghansen won by checkmate") == "Checkmate"
    assert game_facts.ended_by("Kylawot won on time") == "Time"
    assert game_facts.ended_by("Game drawn by timeout vs insufficient material") == "Time vs material"
    assert game_facts.ended_by("Game drawn by insufficient material") == "Material"
    assert game_facts.ended_by(None) is None


def test_overview_kpis(client):
    o = client.get("/api/overview?range=30d").json()
    k = o["kpis"]
    assert o["games_played"] == 4  # unrated game 5 left out
    assert o["games_analysed"] == 3
    assert o["rating"] == {"current": 900, "change": 50, "best": 900}
    assert k["winning_games"] == 2 and k["thrown"] == 1 and k["conversion"] == 0.5
    assert k["opp_blunders"] == 2 and k["punish_rate"] == 0.5
    assert k["lost_games"] == 2 and k["comeback_rate"] == 0.5  # game 3 drew, game 1 lost
    # Game 1's blunder, plus both of game 3's 20+ point drops even though they're labelled
    # "mistake": blunders are counted by size, not label.
    assert k["blunders_per_game"] == 1
    # Opening edge is the eval after move 10, and these games are shorter: no value, not a
    # clamped one (Postgres's least() skips NULLs, unlike SQLite's min()).
    assert k["opening_edge"] is None


def test_previous_period_needs_enough_games(client):
    prev = client.get("/api/overview?range=30d").json()["previous_kpis"]
    assert prev["analysed"] == 1
    assert prev["blunders_per_game"] is None  # one game is below MIN_SAMPLE
    assert client.get("/api/overview?range=all").json()["previous_kpis"] is None


def test_kpi_links_return_the_games_behind_them(client):
    def ids(query):
        return [g["id"] for g in client.get(f"/api/games?{query}").json()["games"]]

    assert ids("kpi=thrown") == [1]
    assert ids("kpi=unpunished") == [3]
    assert ids("kpi=comebacks") == [3]
    assert ids("kpi=blunders") == [1, 3]
    assert client.get("/api/games?kpi=bogus").status_code == 400


def test_games_filters(client):
    def total(query=""):
        return client.get(f"/api/games?{query}").json()["total"]

    assert total() == 5
    assert total("unrated=true") == 6
    assert total("q=london") == 1
    assert total("result=win") == 2
    assert total("range=30d") == 4
    assert total("analysed=true") == 4
    g = client.get("/api/games?q=london").json()["games"][0]
    assert g["ended_by"] == "Resigned" and g["analysed"] is False


def test_game_detail(client):
    g = client.get("/api/games/2").json()
    assert g["id"] == 2 and g["outcome"] == "win"
    assert [m["classification"] for m in g["plies"]] == ["good", "blunder", "best"]
    assert g["plies"][1]["win_pct_before"] == 50 and g["plies"][1]["win_pct_after"] == 10
    unanalysed = client.get("/api/games/4").json()
    assert unanalysed["plies"] == [] and unanalysed["analysed"] is False
    assert client.get("/api/games/999").status_code == 404


def test_accounts(db_url, client, tmp_path):
    assert client.get("/api/accounts").json() == []
    with db.connect(db_url) as conn:
        db.add_account(conn, "chesscom", "gghansen")
    assert client.get("/api/accounts").json() == [{"source": "chesscom", "handle": "gghansen"}]


@pytest.fixture
def system(monkeypatch):
    """Stand-ins for launchd, the Keychain and Stockfish, so tests never touch the real Mac."""
    calls = {"install": None, "uninstall": 0, "run_now": 0, "spawned": None}
    state = {"schedule": None}

    def install(db_path, hour=6, minute=0, log=print, user="local"):
        calls["install"] = (hour, minute)
        state["schedule"] = {"hour": hour, "minute": minute, "loaded": True, "user": user}

    def uninstall(log=print):
        calls["uninstall"] += 1
        state["schedule"] = None

    monkeypatch.setattr(schedule, "install", install)
    monkeypatch.setattr(schedule, "uninstall", uninstall)
    monkeypatch.setattr(schedule, "current", lambda: state["schedule"])
    monkeypatch.setattr(schedule, "run_now", lambda log=print: calls.__setitem__("run_now", calls["run_now"] + 1))
    monkeypatch.setattr(subprocess, "Popen", lambda args, **kw: calls.__setitem__("spawned", args))
    monkeypatch.setattr(account_routes, "lichess_token_saved", lambda: True)
    monkeypatch.setattr(account_routes, "engine_name", lambda: "Stockfish 19")
    return calls


def test_settings_snapshot(client, system):
    s = client.get("/api/settings").json()
    assert s["nodes"] == 500_000 and s["engine"] == "Stockfish 19" and s["lichess_token"] is True
    assert "schedule" not in s and s["running"] is False and s["last_run"] is None
    assert s["database"]["games"] == 6 and s["database"]["analysed"] == 4


def test_add_and_remove_account(client, system):
    assert client.post("/api/accounts", json={"source": "chesscom", "handle": "gghansen"}).status_code == 201
    assert (
        client.post("/api/accounts", json={"source": "chesscom", "handle": "gghansen"}).status_code == 201
    )  # idempotent
    assert client.get("/api/accounts").json() == [{"source": "chesscom", "handle": "gghansen"}]
    assert client.post("/api/accounts", json={"source": "fics", "handle": "x1"}).status_code == 400
    assert client.post("/api/accounts", json={"source": "lichess", "handle": "no spaces"}).status_code == 400
    assert client.delete("/api/accounts/chesscom/gghansen").status_code == 204
    assert client.get("/api/accounts").json() == []


def test_analysis_budget(db_url, client, system, tmp_path):
    assert client.put("/api/settings/analysis", json={"nodes": 1_000_000}).json() == {"nodes": 1_000_000}
    assert client.get("/api/settings").json()["nodes"] == 1_000_000
    with db.connect(db_url) as conn:
        assert db.analysis_nodes(conn) == 1_000_000  # what `analyze`, `update` and the worker use
    assert client.put("/api/settings/analysis", json={"nodes": 10}).status_code == 422


def test_practice_pace(db_url, client):
    assert client.get("/api/settings").json()["pace"] == "standard"
    assert client.put("/api/settings/practice", json={"pace": "light"}).json() == {"pace": "light"}
    assert client.get("/api/settings").json()["pace"] == "light"
    with db.connect(db_url) as conn:
        assert deck.pace(conn) == "light"  # what today's queue uses
    assert client.put("/api/settings/practice", json={"pace": "huge"}).status_code == 422


def test_run_now(client, system):
    # Run now queues an update for a worker; asking again while it waits changes nothing.
    assert client.post("/api/update/run").json() == {"started": True, "queued": True}
    assert client.post("/api/update/run").json() == {"started": True, "queued": False}
    assert client.get("/api/status").json()["queued"] == ["update"]
    assert client.get("/api/settings").json()["running"] is True
    assert system["spawned"] is None and system["run_now"] == 0


def test_settings_shows_the_live_run(db_url, client, system, tmp_path):
    with db.connect(db_url) as conn:
        conn.execute("""INSERT INTO runs (status, trigger, errors, progress, finished_at)
                        VALUES ('partial', 'schedule', '["backup: disk full"]',
                                '{"plan": ["backup"], "current": null, "detail": null,
                                  "done": [{"key": "backup", "summary": null, "error": "disk full"}]}',
                                iso_now())""")
        conn.execute("""INSERT INTO runs (status, trigger, progress) VALUES ('running', 'manual',
                        '{"plan": ["analyze", "backup"], "current": "analyze",
                          "detail": "1 of 3 games", "done": []}')""")
    s = client.get("/api/settings").json()
    assert s["running"] is True
    assert s["current_run"]["progress"]["detail"] == "1 of 3 games"
    assert s["last_run"]["errors"] == ["backup: disk full"]
    assert s["last_run"]["progress"]["done"][0]["error"] == "disk full"


def test_engine_lines_are_computed_once_then_cached(db_url, client, tmp_path, monkeypatch):
    import chess
    import chess.engine

    calls = []

    class FakeEngine:
        def __init__(self, depth, engine_path=None):
            calls.append(depth)

        def __enter__(self):
            return lambda board: (
                chess.engine.PovScore(chess.engine.Cp(30), chess.WHITE),
                [next(iter(board.legal_moves))],
            )

        def __exit__(self, *exc):
            pass

    monkeypatch.setattr(lines, "Engine", FakeEngine)
    with db.connect(db_url) as conn:
        # The position before ply 1 is rebuilt from the game's moves (positions.py).
        conn.execute("UPDATE games SET moves_san = 'e4 e5' WHERE id = 2")
        conn.execute("UPDATE moves SET uci = 'e2e4' WHERE game_id = 2 AND ply = 1")
    first = client.get("/api/games/2/lines/1").json()
    assert set(first) == {"best", "why"} and first["why"]["start_fen"].split()[1] == "b"
    assert client.get("/api/games/2/lines/1").json() == first
    assert calls == [18]  # second request came from the cache
    with db.connect(db_url) as conn:  # a line cached by an older lines.py...
        conn.execute("""UPDATE engine_lines SET data = jsonb_set(data::jsonb, '{best,v}', '1')::text""")
    client.get("/api/games/2/lines/1")
    assert calls == [18, 18]  # ...is recomputed
    assert client.get("/api/games/2/lines/99").status_code == 404


def test_stored_lines_open_without_the_engine_or_its_quota(db_url, client, monkeypatch):
    class NoEngine:
        def __init__(self, *args, **kwargs):
            raise AssertionError("stored lines must not start Stockfish")

    monkeypatch.setattr(lines, "Engine", NoEngine)
    monkeypatch.setattr(limits, "ENGINE_PER_MINUTE", 1)
    client = TestClient(api.create_app(db_url))
    with db.connect(db_url) as conn:
        conn.execute("UPDATE games SET moves_san = 'e4 e5' WHERE id = 2")
        conn.execute("""UPDATE moves SET uci = 'e2e4', best_line = 'd2d4 d7d5',
                        reply_line = 'e7e5 g1f3' WHERE game_id = 2 AND ply = 1""")
        # A bad stored line stops at its first illegal move.
        conn.execute("""UPDATE moves SET uci = 'e7e5', best_line = 'e7e5 e7e5',
                        reply_line = NULL WHERE game_id = 2 AND ply = 2""")
    one = [client.get("/api/games/2/lines/1") for _ in range(3)]  # past the quota of 1
    assert [r.status_code for r in one] == [200, 200, 200]
    first = one[0].json()
    assert first["best"]["moves"] == ["d2d4", "d7d5"] and first["best"]["summary"]
    assert first["why"]["moves"] == ["e7e5", "g1f3"] and first["why"]["start_fen"].split()[1] == "b"
    every = client.get("/api/games/2/lines").json()
    assert every["1"] == first
    assert every["2"]["best"]["moves"] == ["e7e5"] and "why" not in every["2"]


def test_position_preview_validates_history_and_leaves_game_unchanged(client, monkeypatch):
    import chess
    import chess.engine

    calls = []

    class FakeEngine:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            pass

        def configure(self, options):
            assert options == {"Threads": 1, "Hash": 32}

        def analyse(self, board, limit):
            calls.append(board.fen())
            assert limit.time == 1.5 and limit.nodes == 250_000 and limit.depth == 18
            return {
                "score": chess.engine.PovScore(chess.engine.Cp(-25), chess.WHITE),
                "pv": [next(iter(board.legal_moves))],
            }

    monkeypatch.setattr(games_routes, "find_engine", lambda _: "fake")
    monkeypatch.setattr(chess.engine.SimpleEngine, "popen_uci", lambda _: FakeEngine())
    original = client.get("/api/games/2").json()
    r = client.post("/api/review/position", json={"fen": chess.STARTING_FEN, "moves": ["e2e4", "c7c5"]})
    assert r.status_code == 200 and r.json()["eval_cp"] == -25
    assert r.json()["start_fen"] == calls[0]
    assert client.get("/api/games/2").json() == original
    for fen, moves in [
        ("bad", []),
        ("8/8/8/8/8/8/8/8 w - - 0 1", []),
        (chess.STARTING_FEN, ["e2e5"]),
        (chess.STARTING_FEN, ["0000"]),
        (chess.STARTING_FEN, ["e2e4", "e2e4"]),
    ]:
        assert client.post("/api/review/position", json={"fen": fen, "moves": moves}).status_code == 400
    assert len(calls) == 1


def test_terminal_preview_and_engine_unavailable(client, monkeypatch):
    import chess

    def missing(_):
        raise SystemExit("not installed")

    monkeypatch.setattr(games_routes, "find_engine", missing)
    moves = ["g1f3", "g8f6", "f3g1", "f6g8"] * 2
    r = client.post("/api/review/position", json={"fen": chess.STARTING_FEN, "moves": moves})
    assert r.status_code == 200 and r.json()["result"] == "Draw by repetition"
    assert (
        client.post("/api/review/position", json={"fen": chess.STARTING_FEN, "moves": moves + ["e2e4"]}).status_code
        == 400
    )
    assert client.post("/api/review/position", json={"fen": chess.STARTING_FEN}).status_code == 503
    assert (
        client.post("/api/review/position", json={"fen": chess.STARTING_FEN, "moves": ["e2e4"] * 257}).status_code
        == 422
    )


def test_finish_review(client):
    assert client.get("/api/games/1").json()["reviewed_at"] is None
    r = client.post("/api/games/1/review")
    assert r.status_code == 200
    reviewed = r.json()["reviewed_at"]
    g = client.get("/api/games/1").json()
    assert g["reviewed_at"] == reviewed
    assert [x["reviewed_at"] for x in client.get("/api/games").json()["games"] if x["id"] == 1] == [reviewed]
    assert g["review_marks"] == []
    marks = [{"ply": 2, "mark": "found"}, {"ply": 6, "mark": "praise"}]
    assert client.post("/api/games/1/review", json={"marks": marks}).status_code == 200
    assert client.get("/api/games/1").json()["review_marks"] == marks
    assert client.post("/api/games/1/review", json={"marks": [{"ply": 2, "mark": "nope"}]}).status_code == 422
    assert client.post("/api/games/1/review").status_code == 200  # finishing again is fine
    assert client.post("/api/games/999/review").status_code == 404


def test_home(client):
    h = client.get("/api/home").json()
    assert "units" not in h
    # Today's game: the newest unreviewed, analysed game from the last 3 days.
    assert h["today"]["game"]["id"] == 1
    assert h["today"]["reviewed_today"] == 0
    # Reviewing game 1, the newest, leaves nothing newer to review.
    client.post("/api/games/1/review")
    after = client.get("/api/home").json()["today"]
    assert after["reviewed_today"] == 1
    assert after["game"] is None and after["new_games"] == 0


def test_games_quick_filters(client):
    page = client.get("/api/games").json()
    # Older unreviewed games stay discoverable; the count is not limited to seven days.
    assert page["counts"] == {"all": 5, "to_review": 4, "wins": 2, "losses": 2, "blunders": 2, "thrown": 1}
    client.post("/api/games/2/review")
    to_review = client.get("/api/games?to_review=true").json()
    assert [g["id"] for g in to_review["games"]] == [1, 3, 6]
    assert to_review["counts"]["to_review"] == 3 and to_review["total"] == 3
    # Counts follow search and the popover filters, not the quick filter itself.
    assert client.get("/api/games?result=win").json()["counts"]["all"] == 5
    assert client.get("/api/games?color=white").json()["counts"]["all"] == 5


def test_library_counts_and_recommendation_follow_filters_before_pagination(client, monkeypatch):
    monkeypatch.setattr(games_routes, "PAGE_SIZE", 2)
    second = client.get("/api/games?page=2").json()
    assert [g["id"] for g in second["games"]] == [3, 4]
    assert second["review_counts"] == {"all": 5, "to_review": 4, "reviewed": 0}
    assert second["next_review"]["id"] == 1  # not derived from this page
    assert second["games"][0]["opponent_rating"] == 880
    assert second["games"][0]["accuracy"] == 80
    assert second["games"][0]["color"] == "white"

    assert client.post("/api/games/1/review").status_code == 200
    reviewed = client.get("/api/games?review_status=reviewed").json()
    assert [g["id"] for g in reviewed["games"]] == [1]
    assert reviewed["review_counts"] == {"all": 5, "to_review": 3, "reviewed": 1}
    assert reviewed["next_review"]["id"] == 2
    assert reviewed["games"][0]["reviewed_at"] is not None

    losses = client.get("/api/games?result=loss&review_status=to_review").json()
    assert [g["id"] for g in losses["games"]] == [6]
    assert losses["review_counts"] == {"all": 2, "to_review": 1, "reviewed": 1}
    assert losses["next_review"]["id"] == 6
    assert client.get("/api/games?q=London&review_status=to_review").json()["next_review"] is None
    assert client.get("/api/games?review_status=bogus").status_code == 422


def test_library_does_not_recommend_analyzed_games_without_a_known_player_side(client, db_url):
    with db.connect(db_url) as conn:
        conn.execute("UPDATE games SET user_color = NULL WHERE id = 1")
    library = client.get("/api/games?review_status=to_review").json()
    assert library["next_review"]["id"] == 2
    assert library["review_counts"]["to_review"] == 3
    assert 1 not in [game["id"] for game in library["games"]]


def test_patterns_endpoint(db_url, client, tmp_path):
    # Game 1's blunder (ply 3) is tagged on the first request; with no stored position
    # details to go on in this fixture it waits for the engine pass.
    p = client.get("/api/patterns?range=30d").json()
    assert p["range"] == "30d"
    assert p["pending"] + sum(x["total"] for x in p["patterns"]) >= 1
    with db.connect(db_url) as conn:
        conn.execute("UPDATE moves SET pattern = 'fork' WHERE game_id = 1 AND ply = 3")
    forks = next(x for x in client.get("/api/patterns?range=30d").json()["patterns"] if x["pattern"] == "fork")
    assert forks["blunder"] == 1 and forks["total"] >= 1


def test_pattern_strength_counts_first_tries_in_the_period_and_the_one_before(db_url, client):
    def ago(days):
        return (datetime.now(UTC) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")

    with db.connect(db_url) as conn:
        conn.execute("UPDATE moves SET pattern = 'fork' WHERE game_id = 1 AND ply = 3")
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (1, 3)")
        for days, correct in ((5, 1), (10, 0), (40, 1), (70, 0)):
            conn.execute(
                "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct) VALUES (1, 3, %s, 'e2e4', %s)",
                (ago(days), bool(correct)),
            )
        for pid, days, themes, success in (
            ("f1", 2, ["fork", "middlegame"], 0),
            ("b1", 3, ["backRankMate", "mate", "short"], 1),
            ("m1", 4, ["mate", "mateIn2"], 0),
            ("x1", 1, ["fork"], 1),
        ):
            conn.execute(
                "INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, themes) VALUES (%s, %s, %s, %s, %s)",
                ("lichess" if pid == "x1" else "knightly", pid, ago(days), bool(success), json.dumps(themes)),
            )
    by = {s["pattern"]: s for s in client.get("/api/patterns?range=30d").json()["strength"]}
    # Two review days and one puzzle in the last 30 days; the Lichess-site puzzle is not ours.
    assert (by["fork"]["attempts"], by["fork"]["first_try"]) == (3, 1)
    assert by["fork"]["previous"] == {"attempts": 1, "first_try": 1}
    assert (by["backRankMate"]["attempts"], by["backRankMate"]["first_try"]) == (1, 1)
    assert (by["mate"]["attempts"], by["mate"]["first_try"]) == (1, 0)
    assert by["pin"] == {"pattern": "pin", "attempts": 0, "first_try": 0, "previous": {"attempts": 0, "first_try": 0}}
    everything = {s["pattern"]: s for s in client.get("/api/patterns?range=all").json()["strength"]}
    assert (everything["fork"]["attempts"], everything["fork"]["first_try"]) == (5, 2)
    assert everything["fork"]["previous"] is None


def test_overview_phase_accuracy_averages_your_rated_moves_by_phase(db_url, client):
    with db.connect(db_url) as conn:
        for gid, ply, phase, accuracy in (
            (1, 1, "opening", 90),
            (1, 2, "opening", 10),  # ply 2 is the opponent's
            (1, 3, "endgame", 40),
            (2, 1, "opening", 70),
            (2, 3, "middlegame", 60),
            (3, 1, "middlegame", 80),
            (3, 3, "middlegame", None),  # no accuracy: left out
            (6, 1, "endgame", 30),
        ):
            conn.execute(
                "UPDATE moves SET phase = %s, accuracy = %s WHERE game_id = %s AND ply = %s",
                (phase, accuracy, gid, ply),
            )
        add_kpi_game(conn, 7, played_at=days_ago(5), outcome="win", rated=False, moves=[(1, 50, "good")])
        # Ten games 31-40 days ago: enough for an opening comparison, not an endgame one.
        for gid in range(20, 30):
            add_kpi_game(conn, gid, played_at=days_ago(gid + 11), outcome="win", moves=[(1, 50, "good")])
        conn.execute("UPDATE moves SET accuracy = 0 WHERE game_id = 7")
        conn.execute("UPDATE moves SET accuracy = 50 WHERE game_id BETWEEN 20 AND 29")

    month = client.get("/api/overview?range=30d").json()["phase_accuracy"]
    assert month["current"] == {
        "opening": {"accuracy": 80, "moves": 2, "games": 2},
        "middlegame": {"accuracy": 70, "moves": 2, "games": 2},
        "endgame": {"accuracy": 40, "moves": 1, "games": 1},
    }
    assert month["previous"] == {
        "opening": {"accuracy": 50, "moves": 10, "games": 10},
        "middlegame": {"accuracy": None, "moves": 0, "games": 0},
        "endgame": {"accuracy": None, "moves": 1, "games": 1},
    }
    everything = client.get("/api/overview?range=all").json()["phase_accuracy"]
    assert everything["previous"] is None
    assert everything["current"]["endgame"] == {"accuracy": 35, "moves": 2, "games": 2}
    assert everything["current"]["opening"] == {"accuracy": 55, "moves": 12, "games": 12}  # (90 + 70 + 10 × 50) / 12


def test_pattern_memory_splits_the_deck_by_tactic(db_url, client):
    with db.connect(db_url) as conn:
        for gid, ply, pattern, reviews, stability in (
            (1, 3, "fork", 0, None),
            (3, 1, "fork", 3, 75),
            (3, 3, "fork", 2, 10),
            (2, 3, "pin", 1, 60),  # exactly MASTERED_DAYS counts as mastered
            (2, 1, None, 0, None),
            (6, 1, "other", 1, 59.9),
        ):
            conn.execute("UPDATE moves SET pattern = %s WHERE game_id = %s AND ply = %s", (pattern, gid, ply))
            conn.execute(
                "INSERT INTO cards (game_id, ply, reviews, fsrs) VALUES (%s, %s, %s, %s)",
                (gid, ply, reviews, json.dumps({"stability": stability}) if stability else None),
            )
        # The pin card's family has been practised; the fork card's has not. Both are out past
        # MASTERED_DAYS, so only the family separates them.
        conn.execute(
            """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success,
                                            family_game_id, family_ply)
               VALUES ('knightly', 'fam1', '2026-10-01T00:00:00Z', true, 2, 3)"""
        )
    memory = client.get("/api/patterns?range=30d").json()["memory"]
    assert memory == [
        # The schedule says the fork at (3, 1) is long-term, but nothing says the idea is:
        # no family puzzle of it has been solved, so it stays learning.
        {"pattern": "fork", "total": 3, "mastered": 0, "learning": 2, "new": 1},
        {"pattern": "pin", "total": 1, "mastered": 1, "learning": 0, "new": 0},
        # "other" has no nameable tactic and so no family: its schedule alone decides, and
        # 59.9 days is short of it either way.
        {"pattern": "other", "total": 1, "mastered": 0, "learning": 1, "new": 0},
        {"pattern": "pending", "total": 1, "mastered": 0, "learning": 0, "new": 1},
    ]
    # The same split as the deck's own totals, and the same whatever the range.
    totals = client.get("/api/deck").json()
    assert (totals["total"], totals["mastered"], totals["learning"], totals["new"]) == (6, 1, 3, 2)
    assert client.get("/api/patterns?range=all").json()["memory"] == memory


def test_a_card_with_no_tactic_is_mastered_on_its_schedule_alone(db_url, client):
    # A third of mistakes carry no nameable tactic. They can have no family, so requiring a
    # solved family member would leave them never mastered.
    with db.connect(db_url) as conn:
        conn.execute("UPDATE moves SET pattern = 'other' WHERE game_id = 1 AND ply = 3")
        conn.execute(
            "INSERT INTO cards (game_id, ply, reviews, fsrs) VALUES (1, 3, 4, %s)", (json.dumps({"stability": 90}),)
        )
    assert client.get("/api/deck").json()["mastered"] == 1


def test_local_sounds_are_served_only_when_present(db_url, tmp_path):
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/sounds/move-self.mp3").status_code == 404
    assert client.get("/api/sounds").json() == []
    (tmp_path / "sounds").mkdir()
    (tmp_path / "sounds" / "move-self.mp3").write_bytes(b"ID3")
    assert client.get("/api/sounds").json() == ["move-self.mp3"]
    r = client.get("/api/sounds/move-self.mp3")
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
    assert client.get("/api/sounds/..%2Fchess.db").status_code == 404
    assert client.get("/api/sounds/other.mp3").status_code == 404


def test_status_has_each_accounts_headline_rating_and_the_last_run(db_url, tmp_path):
    path = db_url
    with db.connect(path) as conn:
        conn.execute(
            "INSERT INTO accounts (source, handle) VALUES ('chesscom', 'gghansen'), ('lichess', 'hunterrhansen')"
        )
        conn.execute(
            "INSERT INTO snapshots (source, account, kind, data) VALUES ('chesscom', 'gghansen', 'stats', %s)",
            (
                json.dumps(
                    {
                        "chess_rapid": {"last": {"rating": 922}, "record": {"win": 306, "loss": 249, "draw": 25}},
                        "chess_blitz": {"last": {"rating": 700}, "record": {"win": 3, "loss": 4, "draw": 0}},
                    }
                ),
            ),
        )
        conn.execute(
            "INSERT INTO snapshots (source, account, kind, data) VALUES ('lichess', 'hunterrhansen', 'profile', %s)",
            (json.dumps({"perfs": {"rapid": {"games": 0, "rating": 1500}, "puzzle": {"games": 278, "rating": 1547}}}),),
        )
        conn.execute(
            "INSERT INTO runs (started_at, finished_at, status, trigger, new_games, games_analysed) "
            "VALUES ('2026-10-07T12:00:05Z', '2026-10-07T12:15:04Z', 'ok', 'schedule', 8, 8)"
        )
    s = TestClient(api.create_app(path)).get("/api/status").json()
    assert [(a["source"], a["rating"], a["rating_kind"]) for a in s["accounts"]] == [
        ("chesscom", 922, "Rapid"),
        ("lichess", 1547, "Puzzles"),
    ]
    assert s["current_run"] is None
    assert s["last_run"]["status"] == "ok" and s["last_run"]["new_games"] == 8 and s["last_run"]["errors"] == []


def test_home_offers_a_game_where_you_never_moved(db_url):
    # Resigned after White's first move: the game is analysed, but you have no move with a
    # win%, so whether you were ever winning or lost is unknown.
    with db.connect(db_url) as conn:
        add_kpi_game(conn, 1, played_at=days_ago(1), outcome="loss", moves=[(0, 50, "good")])
    home = TestClient(api.create_app(db_url)).get("/api/home")
    assert home.status_code == 200
    game = home.json()["today"]["game"]
    assert game["id"] == 1


def test_a_game_whose_moves_have_no_known_owner_opens(db_url):
    # A PGN import where neither player matched --me: analysis can't tell whose moves are
    # whose, so is_user is NULL.
    with db.connect(db_url) as conn:
        add_kpi_game(conn, 1, played_at=days_ago(1), outcome="loss", moves=[(1, 50, "good"), (0, 50, "good")])
        conn.execute("UPDATE moves SET is_user = NULL")
    game = TestClient(api.create_app(db_url)).get("/api/games/1")
    assert game.status_code == 200
    assert [p["is_user"] for p in game.json()["plies"]] == [None, None]
