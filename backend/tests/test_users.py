"""Users: Clerk sign-in, and that nobody can see or change anyone else's data."""

import base64
import time

import psycopg
import pytest
from conftest import (
    HOST,
    PUBLIC_PEM,
    PUBLISHABLE,
    add_kpi_game,
    as_user,
    days_ago,
    seed,
    signed,
    ten_minute_sample,
    token,
)
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from knightly import api, auth, db, users


@pytest.fixture
def two(db_url, clerk):
    a = seed(db_url, "user_alice", 100, "alice_handle", "opp_of_alice")
    b = seed(db_url, "user_bob", 200, "bob_handle", "opp_of_bob")
    return TestClient(api.create_app(db_url)), a, b


def test_requests_need_a_valid_token(two):
    client, _, _ = two
    assert client.get("/api/home").status_code == 401
    assert client.get("/api/home", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    forged = {"Authorization": f"Bearer {token('user_alice', key=other_key)}"}
    assert client.get("/api/home", headers=forged).status_code == 401
    assert client.get("/api/home", headers=as_user("user_alice", exp=int(time.time()) - 60)).status_code == 401
    assert client.get("/api/home", headers=as_user("user_alice", iss="https://evil.example")).status_code == 401
    assert client.get("/api/home", headers=as_user("user_alice")).status_code == 200
    # Public: the sounds list and the Clerk webhook (which checks its own signature).
    assert client.get("/api/sounds").status_code == 200


GETS = [
    "/api/accounts",
    "/api/status",
    "/api/settings",
    "/api/home",
    "/api/deck",
    "/api/overview?range=all",
    "/api/overview?range=30d",
    "/api/patterns?range=all",
    "/api/games",
    "/api/games?unrated=true&q=gambit",
    "/api/games?kpi=thrown",
    "/api/games?to_review=true",
    "/api/games?review_status=to_review",
    "/api/games?review_status=reviewed",
]


def test_nobody_sees_anyone_elses_data(two):
    client, _, _ = two
    for path in GETS:
        for me, them in (("alice", "bob"), ("bob", "alice")):
            r = client.get(path, headers=as_user(f"user_{me}"))
            assert r.status_code == 200, (path, r.text)
            assert f"{them}_handle" not in r.text and f"opp_of_{them}" not in r.text, (me, path)
    alice = as_user("user_alice")
    assert {g["id"] for g in client.get("/api/games", headers=alice).json()["games"]} == {100, 101, 102}
    assert client.get("/api/overview?range=all", headers=alice).json()["games_played"] == 3
    assert client.get("/api/settings", headers=alice).json()["your_data"]["games"] == 3


def test_phase_accuracy_and_pattern_memory_are_your_own(two, db_url):
    client, a, b = two
    for user_id, accuracy, pattern in ((a, 90, "fork"), (b, 20, "pin")):
        conn = db.connect(db_url, migrate=False, user_id=user_id)
        with conn:
            conn.execute("UPDATE moves SET accuracy = %s WHERE is_user", (accuracy,))
            first = conn.execute("SELECT min(game_id) FROM moves").fetchone()[0]
            conn.execute("UPDATE moves SET pattern = %s WHERE game_id = %s AND ply = 3", (pattern, first))
            conn.execute("INSERT INTO cards (game_id, ply) VALUES (%s, 3)", (first,))
        conn.close()
    for me, accuracy, pattern in (("alice", 90, "fork"), ("bob", 20, "pin")):
        headers = as_user(f"user_{me}")
        phases = client.get("/api/overview?range=30d", headers=headers).json()["phase_accuracy"]["current"]
        # Two analysed games each, both your moves (plies 1 and 3) in the opening.
        assert phases["opening"] == {"accuracy": accuracy, "moves": 4, "games": 2}
        memory = client.get("/api/patterns?range=30d", headers=headers).json()["memory"]
        assert memory == [{"pattern": pattern, "total": 1, "mastered": 0, "learning": 0, "new": 1}]


def test_nobody_can_open_or_change_anyone_elses_games(two):
    client, _, _ = two
    alice = as_user("user_alice")
    assert client.get("/api/games/101", headers=alice).status_code == 200
    assert client.get("/api/games/201", headers=alice).status_code == 404
    assert client.get("/api/games/201/lines/1", headers=alice).status_code == 404
    assert client.post("/api/games/201/review", headers=alice).status_code == 404
    assert (
        client.post("/api/deck/answer", headers=alice, json={"game_id": 201, "ply": 3, "uci": "e2e4"}).status_code
        == 404
    )
    assert client.delete("/api/accounts/chesscom/bob_handle", headers=alice).status_code == 204  # a no-op...
    assert client.get("/api/accounts", headers=as_user("user_bob")).json() == [  # ...for Bob
        {"source": "chesscom", "handle": "bob_handle"}
    ]


def test_writes_land_on_the_signed_in_user(two, db_url):
    client, a, b = two
    client.post("/api/accounts", headers=as_user("user_bob"), json={"source": "lichess", "handle": "bobby"})
    client.put("/api/settings/analysis", headers=as_user("user_alice"), json={"nodes": 1_000_000})
    with db.connect(db_url) as owner:
        assert owner.execute("SELECT user_id FROM accounts WHERE handle = 'bobby'").fetchone()[0] == b
        assert owner.execute("SELECT user_id, value FROM settings").fetchall() == [(a, "1000000")]
    assert client.get("/api/settings", headers=as_user("user_bob")).json()["nodes"] == 500_000


def test_two_people_can_both_have_the_game_they_played_each_other(two, db_url):
    _, a, b = two
    game = {"source": "chesscom", "source_id": "shared-game", "pgn": "1. e4"}
    for user_id in (a, b):
        with db.connect(db_url, migrate=False, user_id=user_id) as conn:
            assert db.insert_game(conn, game)
            assert not db.insert_game(conn, game)  # still once per person


def test_a_new_sign_in_creates_the_user(two, db_url):
    client, _, _ = two
    home = client.get("/api/home", headers=as_user("user_new"))
    assert home.status_code == 200 and home.json()["today"]["game"] is None
    with db.connect(db_url) as owner:
        assert users.find(owner, "user_new") is not None


def test_the_database_itself_keeps_users_apart(two, db_url):
    _, a, b = two
    conn = db.connect(db_url, migrate=False, user_id=a)
    assert conn.execute("SELECT count(*) FROM games").fetchone()[0] == 3
    assert conn.execute("SELECT count(*) FROM moves WHERE game_id = 200").fetchone()[0] == 0
    with pytest.raises(psycopg.errors.InsufficientPrivilege):  # row-level security's check
        conn.execute("INSERT INTO accounts (source, handle, user_id) VALUES ('lichess', 'x', %s)", (b,))
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("SELECT * FROM users")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("DELETE FROM lichess_puzzles")
    nobody = db.connect(db_url, migrate=False, user_id=999)
    assert nobody.execute("SELECT count(*) FROM games").fetchone()[0] == 0


def test_deleting_a_clerk_account_deletes_their_data(two, db_url):
    client, a, b = two
    headers, raw = signed({"type": "user.deleted", "data": {"id": "user_bob"}})
    assert client.post("/api/webhooks/clerk", headers=headers, content=raw).status_code == 200
    with db.connect(db_url) as owner:
        assert users.find(owner, "user_bob") is None
        left = dict(owner.execute("SELECT user_id, count(*) FROM games GROUP BY user_id").fetchall())
        assert left == {a: 3}
        assert owner.execute("SELECT count(*) FROM moves WHERE user_id = %s", (b,)).fetchone()[0] == 0
    # Bob signing in again starts over, with nothing.
    assert client.get("/api/games", headers=as_user("user_bob")).json()["total"] == 0


def test_webhooks_must_be_signed_and_fresh(two):
    client, _, _ = two
    headers, raw = signed(
        {"type": "user.deleted", "data": {"id": "user_bob"}},
        secret="whsec_" + base64.b64encode(b"someone else's secret").decode(),
    )
    assert client.post("/api/webhooks/clerk", headers=headers, content=raw).status_code == 400
    headers, raw = signed({"type": "user.deleted", "data": {"id": "user_bob"}}, at=time.time() - 3600)
    assert client.post("/api/webhooks/clerk", headers=headers, content=raw).status_code == 400
    assert client.post("/api/webhooks/clerk", content=b"{}").status_code == 400
    assert client.get("/api/games", headers=as_user("user_bob")).json()["total"] == 3


def test_tokens_for_another_site_are_refused(two, monkeypatch, db_url):
    monkeypatch.setenv("KNIGHTLY_ALLOWED_ORIGINS", "https://knightly.example, http://localhost:5173")
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/home", headers=as_user("user_alice")).status_code == 200
    assert client.get("/api/home", headers=as_user("user_alice", azp="https://evil.example")).status_code == 401


def test_native_tokens_need_opt_in_and_keep_users_apart(two, monkeypatch, db_url):
    monkeypatch.setenv("KNIGHTLY_ALLOWED_ORIGINS", "https://knightly.example")
    native = as_user("user_alice", omit_azp=True)
    client = TestClient(api.create_app(db_url))
    assert client.get("/api/games", headers=native).status_code == 401
    monkeypatch.setenv("KNIGHTLY_ALLOW_NATIVE_AUTH", "1")
    client = TestClient(api.create_app(db_url))
    for name, ids in (("alice", {100, 101, 102}), ("bob", {200, 201, 202})):
        response = client.get("/api/games", headers=as_user(f"user_{name}", omit_azp=True))
        assert response.status_code == 200
        assert {game["id"] for game in response.json()["games"]} == ids
    assert client.get("/api/games/201", headers=native).status_code == 404


@pytest.mark.parametrize(
    "claims",
    [
        {"azp": "https://evil.example"},
        {"azp": ""},
        {"azp": None},
        {"omit_azp": True, "exp": 1},
        {"omit_azp": True, "iss": "https://evil.example"},
        {"omit_azp": True, "nbf": int(time.time()) + 3600},
    ],
)
def test_native_opt_in_does_not_bypass_token_validation(claims):
    checker = auth.Clerk(f"https://{HOST}", PUBLIC_PEM, ["https://knightly.example"], allow_native=True)
    with pytest.raises(auth.Unauthorized):
        checker.user(token("user_alice", **claims))


def test_native_opt_in_still_checks_signature():
    checker = auth.Clerk(f"https://{HOST}", PUBLIC_PEM, ["https://knightly.example"], allow_native=True)
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(auth.Unauthorized):
        checker.user(token("user_alice", key=other_key, omit_azp=True))


def test_linking_hands_the_local_users_data_to_a_clerk_account(db_url):
    with db.connect(db_url) as owner:  # the template's local user (id 1) with a game
        owner.execute("INSERT INTO games (source, source_id, pgn) VALUES ('otb', 'x', '')")
        users.ensure(owner, "user_fresh")  # signed in once before linking: replaced
        users.link(owner, users.LOCAL, "user_fresh")
        assert users.find(owner, users.LOCAL) is None and users.find(owner, "user_fresh") == 1
        users.ensure(owner, users.LOCAL)
        with pytest.raises(SystemExit, match="games of its own"):
            users.link(owner, users.LOCAL, "user_fresh")


def test_auth_settings(monkeypatch):
    assert auth.frontend_api(PUBLISHABLE) == f"https://{HOST}"
    monkeypatch.delenv("KNIGHTLY_AUTH")
    monkeypatch.setenv("KNIGHTLY_MODE", "server")
    with pytest.raises(SystemExit, match="signs people in with Clerk"):
        auth.from_env()  # a server never quietly serves one person's data to everyone
    monkeypatch.setenv("KNIGHTLY_AUTH", "local")
    assert auth.from_env() is None
    monkeypatch.setenv("KNIGHTLY_MODE", "mac")
    monkeypatch.delenv("KNIGHTLY_AUTH")
    assert auth.from_env() is None  # your own Mac: no sign-in until Clerk is set up


def test_linking_takes_effect_on_a_running_server(db_url, clerk):
    with db.connect(db_url) as owner:  # the local user's history: one game
        owner.execute("INSERT INTO games (source, source_id, pgn, rated) VALUES ('otb', 'x', '', true)")
    client = TestClient(api.create_app(db_url))
    me = as_user("user_me")
    assert client.get("/api/games", headers=me).json()["total"] == 0  # signed up: a new, empty user
    with db.connect(db_url) as owner:
        users.link(owner, users.LOCAL, "user_me")  # while the server runs
    assert client.get("/api/games", headers=me).json()["total"] == 1  # the next request sees it


def test_time_diagnostics_are_account_and_period_scoped(two, db_url):

    client, alice_id, bob_id = two
    for owner, gid, age in [(alice_id, 700, 1), (alice_id, 701, 40), (bob_id, 800, 1)]:
        game, moves = ten_minute_sample(gid)
        with db.connect(db_url, migrate=False, user_id=owner) as conn:
            add_kpi_game(conn, gid, played_at=days_ago(age), outcome='loss')
            conn.execute(
                "UPDATE games SET pgn=%s, source='chesscom', time_control='600', variant='standard', termination='opponent won on time' WHERE id=%s",
                (game['pgn'], gid),
            )
            conn.execute("INSERT INTO game_analysis (game_id,engine,nodes) VALUES (%s, 'test',1)", (gid,))
            for m in moves:
                conn.execute(
                    """INSERT INTO moves (game_id,ply,move_number,color,is_user,uci,san,phase,win_pct_before,win_pct_after)
                                VALUES (%s,%s,%s,'white',%s,%s,%s,%s,%s,%s)""",
                    (
                        gid,
                        m['ply'],
                        (m['ply'] + 1) // 2,
                        True,
                        m['uci'],
                        m['san'],
                        m['phase'],
                        m['win_pct_before'],
                        m['win_pct_after'],
                    ),
                )
    recent = client.get('/api/overview?range=30d', headers=as_user('user_alice')).json()['time_management']
    assert recent['analysed_games'] == 1
    assert recent['fast']['decisions'] == 2
    assert {x['game_id'] for x in recent['fast']['examples']} == {700}
    all_time = client.get('/api/overview?range=all', headers=as_user('user_alice')).json()['time_management']
    assert all_time['analysed_games'] == 2
    assert {x['game_id'] for x in all_time['fast']['examples']} == {700, 701}
    bob = client.get('/api/overview?range=all', headers=as_user('user_bob')).json()['time_management']
    assert {x['game_id'] for x in bob['fast']['examples']} == {800}


def test_deck_game_counts_are_account_scoped(two, db_url):
    client, alice_id, bob_id = two
    with db.connect(db_url, migrate=False, user_id=alice_id) as conn:
        add_kpi_game(conn, 150, played_at=days_ago(0), outcome="win")  # imported, not analysed yet
        conn.execute("UPDATE games SET variant = 'standard'")
    with db.connect(db_url, migrate=False, user_id=bob_id) as conn:
        conn.execute("UPDATE games SET variant = 'standard'")
    for user, games in [("user_alice", {"analyzed": 2, "pending": 2}), ("user_bob", {"analyzed": 2, "pending": 1})]:
        assert client.get("/api/deck", headers=as_user(user)).json()["games"] == games
        assert client.get("/api/home", headers=as_user(user)).json()["today"]["games"] == games
