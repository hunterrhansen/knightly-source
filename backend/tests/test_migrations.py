import uuid

from conftest import _admin, _url

from knightly import db, users


def test_removing_bot_play_deletes_bot_games_and_their_rows_but_keeps_imported_ones(db_url):
    conn = db.connect(db_url)
    with conn:
        for source, source_id in (("bot", "played-here"), ("chesscom", "imported")):
            db.insert_game(conn, {"source": source, "source_id": source_id, "pgn": "1. e4"})
            conn.execute(
                """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci)
                   SELECT id, 1, 1, 'white', true, 'opening', 'e4', 'e2e4' FROM games WHERE source_id = %s""",
                (source_id,),
            )
    sql = dict(db.migrations())["0017"]
    with conn:
        conn.execute(sql)
    assert [r[0] for r in conn.execute("SELECT source FROM games")] == ["chesscom"]
    assert conn.execute("SELECT count(*) FROM moves").fetchone()[0] == 1


def _seed_integer_flags(conn) -> None:
    """Rows as the app wrote them before 0024: flags as 0, 1 or NULL."""
    for gid, rated in ((1, 1), (2, 0), (3, None)):
        conn.execute(
            "INSERT INTO games (id, source, source_id, pgn, rated) VALUES (%s, 'chesscom', %s, '', %s)",
            (gid, str(gid), rated),
        )
    for ply, is_user in ((1, 1), (2, 0), (3, None)):
        conn.execute(
            """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci)
               VALUES (1, %s, 1, 'white', %s, 'opening', 'e4', 'e2e4')""",
            (ply, is_user),
        )
    for pid, success in (("a", 1), ("b", 0), ("c", None)):
        conn.execute(
            "INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success) VALUES ('knightly', %s, '', %s)",
            (pid, success),
        )
    conn.execute("INSERT INTO cards (game_id, ply) VALUES (1, 1)")
    conn.execute(
        """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, solved)
           VALUES (1, 1, 'a', 'e2e4', 1, 0), (1, 1, 'b', 'e2e4', 0, 1)"""
    )
    conn.execute(
        """INSERT INTO daily_activity (day, game, positions, puzzles, rescue, goal)
           VALUES ('2026-10-01', 1, 0, 1, 0, 1), ('2026-10-02', 0, 1, 0, 1, 0)"""
    )


def test_flags_become_booleans_and_unknown_stays_null():
    """0024 on a database written before it: 0/1 read as false/true, NULL stays NULL."""
    name = f"knightly_test_{uuid.uuid4().hex[:12]}"
    _admin(f"CREATE DATABASE {name}")
    try:
        conn = db.connect(_url(name), migrate=False)
        conn.execute("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY)")
        for version, sql in db.migrations():
            if version < "0024":
                with conn:
                    conn.execute(sql)
                    conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))
        user_id = users.ensure(conn, users.LOCAL)
        with conn:
            conn.execute("SELECT set_config('app.user_id', %s, true)", (str(user_id),))
            _seed_integer_flags(conn)

        assert db.apply_migrations(conn)[0] == "0024"

        def rows(sql):
            return [tuple(r) for r in conn.execute(sql)]

        assert rows("SELECT rated FROM games ORDER BY id") == [(True,), (False,), (None,)]
        assert rows("SELECT is_user FROM moves ORDER BY ply") == [(True,), (False,), (None,)]
        assert rows("SELECT success FROM puzzle_attempts ORDER BY puzzle_id") == [(True,), (False,), (None,)]
        assert rows("SELECT correct, solved FROM card_reviews ORDER BY reviewed_at") == [(True, False), (False, True)]
        assert rows("SELECT game, positions, puzzles, rescue, goal FROM daily_activity ORDER BY day") == [
            (True, False, True, False, True),
            (False, True, False, True, False),
        ]
        # A new day with nothing done defaults to false, as it defaulted to 0.
        with conn:
            conn.execute("SELECT set_config('app.user_id', %s, true)", (str(user_id),))
            conn.execute("INSERT INTO daily_activity (day) VALUES ('2026-10-03')")
        assert rows("SELECT game, positions, puzzles, rescue, goal FROM daily_activity WHERE day = '2026-10-03'") == [
            (False, False, False, False, False)
        ]
        conn.close()
    finally:
        _admin(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")
