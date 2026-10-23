"""Opponents' public profiles: which handles are worth asking about, what is stored, and
the avatar the games list serves."""

import io
import urllib.error

import pytest
from conftest import insert_game
from fastapi.testclient import TestClient

from knightly import api, db, players


def http_error(url, code):
    return urllib.error.HTTPError(url, code, "", {}, io.BytesIO(b""))


def fake_profiles(monkeypatch, pages: dict, missing=()):
    """Chess.com's /pub/player/{handle}, with `missing` handles answering 404."""
    calls = []

    def get_json(url, headers=None):
        handle = url.rsplit("/", 1)[-1]
        calls.append(handle)
        if handle in missing:
            raise http_error(url, 404)
        return pages[handle]

    monkeypatch.setattr(players, "get_json", get_json)
    return calls


def test_stale_asks_for_own_accounts_first_then_opponents(db_url):
    with db.connect(db_url) as conn, conn:
        db.add_account(conn, "chesscom", "gghansen")
        insert_game(conn, 1, opponent="Zara")
        insert_game(conn, 2, opponent="Zara")  # the same opponent is asked about once
        insert_game(conn, 3, opponent="abbot")
        insert_game(conn, 4, opponent="lichessonly", source="lichess")
        insert_game(conn, 5, opponent=None)
        assert players.stale(conn) == ["gghansen", "abbot", "zara"]


def test_refresh_stores_avatars_and_remembers_a_missing_profile(db_url, monkeypatch):
    with db.connect(db_url) as conn:
        with conn:
            insert_game(conn, 1, opponent="Zara")
            insert_game(conn, 2, opponent="ghost")
        calls = fake_profiles(
            monkeypatch,
            {
                "zara": {
                    "avatar": "https://images.chesscomfiles.com/zara.png",
                    "name": "Zara",
                    "title": "WIM",
                    "country": "https://api.chess.com/pub/country/IS",
                }
            },
            missing=("ghost",),
        )

        assert players.refresh(conn) == 2
        assert sorted(calls) == ["ghost", "zara"]
        assert players.known(conn) == {"zara": "https://images.chesscomfiles.com/zara.png"}
        row = conn.execute("SELECT * FROM players WHERE handle = 'zara'").fetchone()
        assert (row["title"], row["country"], row["missing"]) == ("WIM", "IS", False)
        assert conn.execute("SELECT missing FROM players WHERE handle = 'ghost'").fetchone()["missing"] is True

        # Both are known now, so a second run asks about neither.
        calls.clear()
        assert players.refresh(conn) == 0
        assert calls == []


def test_refresh_stops_the_batch_when_the_api_fails(db_url, monkeypatch):
    with db.connect(db_url) as conn:
        with conn:
            insert_game(conn, 1, opponent="abbot")
            insert_game(conn, 2, opponent="zara")

        def down(url, headers=None):
            raise urllib.error.URLError("no route to host")

        monkeypatch.setattr(players, "get_json", down)
        assert players.refresh(conn, log=lambda *_: None) == 0
        # Nothing was stored, so the next run asks about them again.
        assert players.stale(conn) == ["abbot", "zara"]


def test_a_stale_profile_is_read_again(db_url, monkeypatch):
    with db.connect(db_url) as conn:
        with conn:
            insert_game(conn, 1, opponent="zara")
            players.save(conn, "zara", {"avatar": "old.png"})
            conn.execute("UPDATE players SET fetched_at = '2020-01-01T00:00:00Z' WHERE handle = 'zara'")
        assert players.stale(conn) == ["zara"]
        fake_profiles(monkeypatch, {"zara": {"avatar": "new.png"}})
        assert players.refresh(conn) == 1
        assert players.known(conn) == {"zara": "new.png"}


@pytest.fixture
def client(db_url):
    return TestClient(api.create_app(db_url))


def test_the_games_list_serves_the_opponents_avatar(db_url, client):
    with db.connect(db_url) as conn, conn:
        insert_game(conn, 1, opponent="Zara", played_at="2026-10-01T12:00:00Z", user_color="white", rated=True)
        insert_game(conn, 2, opponent="abbot", played_at="2026-10-02T12:00:00Z", user_color="white", rated=True)
        players.save(conn, "zara", {"avatar": "https://images.chesscomfiles.com/zara.png"})
        players.save(conn, "abbot", None)  # no profile: the app falls back to initials
    games = {g["id"]: g for g in client.get("/api/games").json()["games"]}
    assert games[1]["opponent_avatar"] == "https://images.chesscomfiles.com/zara.png"
    assert games[2]["opponent_avatar"] is None


def test_a_games_review_serves_both_players_avatars(db_url, client):
    with db.connect(db_url) as conn, conn:
        insert_game(
            conn,
            1,
            opponent="Zara",
            account="gghansen",
            played_at="2026-10-01T12:00:00Z",
            user_color="white",
            rated=True,
        )
        players.save(conn, "gghansen", {"avatar": "https://images.chesscomfiles.com/me.png"})
        players.save(conn, "zara", {"avatar": "https://images.chesscomfiles.com/zara.png"})
    game = client.get("/api/games/1").json()
    assert game["user_avatar"] == "https://images.chesscomfiles.com/me.png"
    assert game["opponent_avatar"] == "https://images.chesscomfiles.com/zara.png"


def test_a_review_card_carries_the_opponents_avatar(db_url):
    from knightly import deck

    with db.connect(db_url) as conn, conn:
        insert_game(conn, 1, opponent="Zara", user_color="white", rated=True)
        conn.execute(
            "INSERT INTO moves (game_id, ply, color, phase, san, uci, move_number, is_user) "
            "VALUES (1, 1, 'white', 'opening', 'e4', 'e2e4', 1, true)"
        )
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (1, 1)")
        players.save(conn, "zara", {"avatar": "https://images.chesscomfiles.com/zara.png"})
        row = deck.card_row(conn, 1, 1)
    assert row["opponent_avatar"] == "https://images.chesscomfiles.com/zara.png"
