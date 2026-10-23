"""A request's repeated reads are served from its first answer (db.Connection.remember_reads):
every round trip to the hosted database costs ~44 ms, and a home load asked the same small
questions dozens of times. The rule under test: a remembered read never outlives a write."""

import psycopg
from conftest import add_kpi_game, days_ago
from fastapi.testclient import TestClient

from knightly import api, db


def test_a_repeated_read_is_answered_from_memory_until_this_connection_writes(db_url):
    conn = db.connect(db_url).remember_reads()
    db.set_setting(conn, "probe", 1)
    assert db.get_setting(conn, "probe") == 1
    # Another connection changes it: a remembered read does not see that (one request is
    # one consistent view)...
    other = db.connect(db_url)
    db.set_setting(other, "probe", 2)
    assert db.get_setting(conn, "probe") == 1
    # ...but any write on this connection forgets everything, so its own writes always show.
    conn.execute("UPDATE settings SET value = value WHERE key = 'nothing'")
    assert db.get_setting(conn, "probe") == 2
    other.close()
    conn.close()


def test_a_rolled_back_transaction_leaves_no_remembered_reads(db_url):
    conn = db.connect(db_url).remember_reads()
    db.set_setting(conn, "probe", 1)
    try:
        with conn:
            db.set_setting(conn, "probe", 99)
            assert db.get_setting(conn, "probe") == 99
            raise RuntimeError("roll back")
    except RuntimeError:
        pass
    assert db.get_setting(conn, "probe") == 1
    conn.close()


def test_without_remember_reads_every_read_runs(db_url):
    conn = db.connect(db_url)
    db.set_setting(conn, "probe", 1)
    assert db.get_setting(conn, "probe") == 1
    other = db.connect(db_url)
    db.set_setting(other, "probe", 2)
    assert db.get_setting(conn, "probe") == 2
    other.close()
    conn.close()


def test_home_answers_the_same_with_far_fewer_round_trips(db_url, monkeypatch):
    with db.connect(db_url) as conn:
        add_kpi_game(conn, 1, played_at=days_ago(1), outcome="loss", moves=[(1, 85, "best"), (1, 10, "blunder")])
    client = TestClient(api.create_app(db_url))
    real = psycopg.Cursor.execute
    sent = []

    def counted(self, query, *args, **kwargs):
        sent.append(query)
        return real(self, query, *args, **kwargs)

    monkeypatch.setattr(psycopg.Cursor, "execute", counted)
    first = client.get("/api/home").json()
    trips = len(sent)
    # Measured on this fixture: 110 round trips over three connections before, 70 on one
    # connection with its repeated reads remembered. Each is ~44 ms on the hosted database.
    assert trips <= 75, f"{trips} round trips"
    assert client.get("/api/home").json() == first
