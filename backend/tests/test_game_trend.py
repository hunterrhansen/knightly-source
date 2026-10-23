"""In your games: each skill's mistakes in your recent games against the games before, with the
practice in between (docs/specs/2026-10-17-learning-loop-design.md, part 1)."""

from conftest import add_shape_game, as_user, days_ago, shape_ply
from fastapi.testclient import TestClient

from knightly import api, db, users

CLEAN = [shape_ply(1, "e4", "e2e4")]


def trend(client, headers=None):
    return client.get("/api/overview?range=30d", headers=headers).json()["game_trend"]


def by_key(t):
    assert [s["key"] for s in t["skills"]] == ["safety", "tactics", "calculation"]
    return {s["key"]: s for s in t["skills"]}


def test_recent_games_against_the_games_before_with_practice_between(db_url):
    with db.connect(db_url) as conn:
        for gid in range(1, 41):  # 1-20 the newest, 21-40 the twenty before
            plies = list(CLEAN)
            if gid >= 21:  # a missed threat every earlier game, each costing 30 win%
                plies += [shape_ply(0, "a5", "a7a5"), shape_ply(1, "Kb1", "e1d1", "blunder", "theirThreat", win=20.0)]
            if gid <= 3:  # three allowed replies lately, 10 win% each
                plies += [shape_ply(0, "a5", "a7a5"), shape_ply(1, "Kb1", "e1d1", "mistake", "theirReply", win=40.0)]
            if gid in (1, 2, 3, 4, 21, 22, 23, 24, 25):  # tactics missed about as often
                plies += [shape_ply(0, "h5", "h7h5"), shape_ply(1, "Kb1", "e1d1", "miss", "ownTactic")]
            if gid in (5, 26, 27):  # too few failed lines to call anything
                plies += [shape_ply(0, "h5", "h7h5"), shape_ply(1, "Qxb7", "d1b7", "mistake", "calculation")]
            add_shape_game(conn, gid, played_at=days_ago(gid), plies=plies)
        # Not settled yet (a mistake without a layer): in neither window, so game 20 stays recent.
        add_shape_game(conn, 41, played_at=days_ago(10.5), plies=[shape_ply(1, "Kb1", "e1d1", "blunder", None)])
        # Unrated: never a sample game.
        add_shape_game(conn, 42, played_at=days_ago(2), plies=[shape_ply(1, "Kb1", "e1d1", "blunder", "theirThreat")])
        conn.execute("UPDATE games SET rated = false WHERE id = 42")

        # Practice. A threat question on game 21's missed threat: graded twice, once ungraded.
        conn.execute("INSERT INTO threat_cards (game_id, ply, kind) VALUES (21, 3, 'threat')")
        for at, rating in ((days_ago(5), "good"), (days_ago(4), None), (days_ago(25), "again")):
            conn.execute(
                "INSERT INTO threat_reviews (game_id, ply, reviewed_at, answer, correct, rating)"
                " VALUES (21, 3, %s, 'none', false, %s)",
                (at, rating),
            )
        # The same missed threat as a review card, answered lately.
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (21, 3)")
        conn.execute(
            "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)"
            " VALUES (21, 3, %s, 'e1d1', true, 'good')",
            (days_ago(2),),
        )
        # Knightly puzzles train tactics; another source's attempts do not count.
        for source, at in (("knightly", days_ago(3)), ("knightly", days_ago(30)), ("lichess", days_ago(3))):
            conn.execute(
                "INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success) VALUES (%s, %s, %s, true)",
                (source, f"{source}-{at}", at),
            )

    t = trend(TestClient(api.create_app(db_url)))
    assert (t["version"], t["window"], t["games"], t["reason"]) == (1, 20, 40, None)
    assert t["since"] == days_ago(20)
    skills = by_key(t)
    assert skills["safety"] == {
        "key": "safety",
        "recent": 3,
        "earlier": 20,
        "cost": 1.5,
        "change": "fewer",
        "practice": {"recent": 2, "earlier": 1},
    }
    assert skills["tactics"] | {"cost": None} == {
        "key": "tactics",
        "recent": 4,
        "earlier": 5,
        "cost": None,
        "change": "same",
        "practice": {"recent": 1, "earlier": 1},
    }
    assert (skills["calculation"]["recent"], skills["calculation"]["earlier"], skills["calculation"]["change"]) == (
        1,
        2,
        None,
    )


def test_windows_split_what_there_is_and_need_ten_games_each(db_url):
    with db.connect(db_url) as conn:
        for gid in range(1, 26):  # 25 games: two windows of 12, the oldest left out
            plies = list(CLEAN)
            if gid <= 12:  # a missed threat in every recent game
                plies += [shape_ply(0, "a5", "a7a5"), shape_ply(1, "Kb1", "e1d1", "blunder", "theirThreat")]
            if gid == 25:  # outside both windows
                plies += [shape_ply(0, "a5", "a7a5"), shape_ply(1, "Qxb7", "d1b7", "mistake", "calculation")]
            add_shape_game(conn, gid, played_at=days_ago(gid), plies=plies)
    client = TestClient(api.create_app(db_url))
    t = trend(client)
    assert (t["window"], t["games"], t["since"]) == (12, 25, days_ago(12))
    skills = by_key(t)
    assert (skills["safety"]["recent"], skills["safety"]["earlier"], skills["safety"]["change"]) == (12, 0, "more")
    assert skills["calculation"]["earlier"] == 0

    with db.connect(db_url) as conn:  # 19 games: windows of nine are too small to compare
        conn.execute("UPDATE games SET rated = false WHERE id > 19")
    t = trend(client)
    assert (t["window"], t["games"], t["reason"], t["since"]) == (0, 19, "few_games", None)
    assert all(
        s
        == {
            "key": s["key"],
            "recent": 0,
            "earlier": 0,
            "cost": None,
            "change": None,
            "practice": {"recent": 0, "earlier": 0},
        }
        for s in t["skills"]
    )


def test_only_your_own_games_count(db_url, clerk):  # noqa: F811
    for clerk_id, first, lapse in (("user_alice", 100, False), ("user_bob", 200, True)):
        with db.connect(db_url) as owner:
            user_id = users.ensure(owner, clerk_id)
        conn = db.connect(db_url, migrate=False, user_id=user_id)
        with conn:
            for gid in range(first, first + 20):
                add_shape_game(
                    conn,
                    gid,
                    played_at=days_ago(gid - first + 1),
                    plies=[shape_ply(1, "Kb1", "e1d1", "blunder", "theirThreat")] if lapse else CLEAN,
                )
        conn.close()
    client = TestClient(api.create_app(db_url))
    for me, recent in (("alice", 0), ("bob", 10)):
        t = trend(client, headers=as_user(f"user_{me}"))
        assert (t["window"], t["games"], by_key(t)["safety"]["recent"]) == (10, 20, recent)
