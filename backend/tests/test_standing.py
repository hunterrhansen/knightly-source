"""Where you stand: your current rating from your real games."""

from datetime import date

import pytest

from knightly import db, standing


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


TODAY = date(2026, 10, 19)
RECENT = "2026-10-10T12:00:00Z"
FEN = "4k3/8/8/8/8/8/8/4K3 w - - 0 1"


def add_game(conn, gid, *, user_rating=900, played_at=RECENT, rated=True):
    conn.execute(
        """INSERT INTO games (id, source, source_id, played_at, speed, user_color,
           user_outcome, opponent, pgn, moves_san, start_fen, rated, time_control, user_rating)
           VALUES (%s, 'chesscom', %s, %s, 'rapid', 'white', 'win', 'opp', '', 'e4', %s,
                   %s, '600', %s)""",
        (gid, str(gid), played_at, FEN, rated, user_rating),
    )


def test_rating_follows_the_recent_games_not_the_whole_history(conn):
    """Averaging all history said 688 where the recent games said 916 -- the difference
    between a curriculum aimed at back-rank mates and one aimed at forks."""
    for i in range(standing.RECENT_GAMES):
        add_game(conn, i + 1, user_rating=900, played_at="2026-10-15T12:00:00Z")
    for i in range(20):  # older and much weaker
        add_game(conn, 500 + i, user_rating=400, played_at="2024-01-01T12:00:00Z")
    assert standing.rating(conn) == 900


def test_rating_is_unknown_without_rated_games(conn):
    assert standing.rating(conn) is None
    add_game(conn, 1, user_rating=900, rated=False)
    assert standing.rating(conn) is None
