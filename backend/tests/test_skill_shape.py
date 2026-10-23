"""Skill shape: the Progress radar's five scores, their samples and when they are unavailable."""

from conftest import add_shape_game, as_user, days_ago, shape_ply
from fastapi.testclient import TestClient

from knightly import api, db, users

# Nc7+ forks Black's king and queen: a tactic on the board.
FORK_ON = "q3k3/8/8/1N6/8/8/8/6K1 w - - 0 1"


# Two forcing starts that held (Nxe5, Qh5+) around a recapture (dxe5) that never counts.
FILLER = [
    shape_ply(1, "Nxe5", "f3e5"),
    shape_ply(0, "Nxe5", "c6e5"),
    shape_ply(1, "dxe5", "d4e5"),
    shape_ply(0, "a6", "a7a6"),
    shape_ply(1, "Qh5+", "d1h5"),
]


def axes(client, range_="30d", headers=None):
    shape = client.get(f"/api/overview?range={range_}", headers=headers).json()["skill_shape"]
    assert shape["version"] == 1
    assert [a["key"] for a in shape["axes"]] == ["safety", "tactics", "calculation", "converting", "defending"]
    return {a["key"]: a for a in shape["axes"]}


def test_each_axis_counts_its_own_sample(db_url):
    with db.connect(db_url) as conn:
        for gid in range(1, 11):  # ten settled games, all reached 80% win chance
            plies = [{**FILLER[0], "win": 85.0}, *FILLER[1:]]
            if gid in (1, 2):  # ignored their threat: a safety lapse, not a forcing start
                plies.append(shape_ply(0, "a5", "a6a5"))
                plies.append(shape_ply(1, "Kb1", "a1b1", "blunder", "theirThreat"))
            if gid == 3:  # allowed their reply with a capture: Safety's, so not Calculation's
                plies += [shape_ply(0, "a5", "a6a5"), shape_ply(1, "Bxh7", "d3h7", "mistake", "theirReply")]
            if gid == 4:  # a forcing line that failed later
                plies += [shape_ply(0, "a5", "a6a5"), shape_ply(1, "Qxb7", "h5b7", "mistake", "calculation")]
            if gid == 5:  # a costly capture no layer explains: in no sample
                plies += [shape_ply(0, "a5", "a6a5"), shape_ply(1, "Rxa5", "a1a5", "mistake", "other")]
            if gid == 6:  # missed your own tactic, eighteen times over
                for _ in range(18):
                    plies += [shape_ply(0, "a5", "a6a5"), shape_ply(1, "Kb1", "a1b1", "miss", "ownTactic")]
            if gid == 7:
                plies += [shape_ply(0, "a5", "a6a5"), shape_ply(1, "Kb1", "a1b1", "miss", "ownTactic")]
            add_shape_game(
                conn,
                gid,
                played_at=days_ago(gid),
                outcome="draw" if gid == 9 else "loss" if gid == 10 else "win",
                plies=plies,
            )
        # Unsettled (a mistake still waiting for its layer) and capped: out of the first three axes.
        add_shape_game(
            conn,
            11,
            played_at=days_ago(11),
            outcome="draw",
            plies=[shape_ply(1, "Kb1", "a1b1", "mistake", None, win=10.0)],
        )
        add_shape_game(conn, 12, played_at=days_ago(12), plies=[shape_ply(1, "Kb1", "a1b1", "blunder", "unknown")])
        # You played the fork, and the next-best move was far worse: a tactic found.
        add_shape_game(
            conn,
            13,
            played_at=days_ago(13),
            start_fen=FORK_ON,
            plies=[shape_ply(1, "Nc7+", "b5c7", "best", best="b5c7", before=900, second=0)],
        )
        # The same fork when anything else won too: no chance, though still a forcing start.
        add_shape_game(
            conn,
            14,
            played_at=days_ago(14),
            start_fen=FORK_ON,
            plies=[shape_ply(1, "Nc7+", "b5c7", "best", best="b5c7", before=900, second=850)],
        )
        # Practice: two first tries at fork positions, one solved.
        conn.execute("UPDATE moves SET pattern = 'fork' WHERE game_id = 7 AND ply = 7")
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (7, 7)")
        for correct, day in ((1, 1), (0, 2)):
            conn.execute(
                "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)"
                " VALUES (7, 7, %s, 'b5c7', %s, 'good')",
                (days_ago(day), bool(correct)),
            )

    by = axes(TestClient(api.create_app(db_url)))
    # Games 1-10, 13 and 14 are settled; 11 and 12 are counted as excluded, never as clean.
    assert by["safety"] | {"previous": None} == {
        "key": "safety",
        "score": 75,
        "reason": None,
        "successes": 9,
        "attempts": 12,
        "games": 12,
        "excluded": 2,
        "parts": None,
        "previous": None,
    }
    # 1 found + 19 ownTactic misses in games, plus 1 of 2 practice first tries.
    tactics = by["tactics"]
    assert tactics["parts"] == {"games": {"found": 1, "chances": 20}, "practice": {"solved": 1, "tries": 2}}
    assert (tactics["successes"], tactics["attempts"], tactics["score"]) == (2, 22, 9)
    # 2 per game in 1-10, plus both Nc7+; recaptures, Bxh7 (Safety's) and Rxa5 (other) left out.
    calc = by["calculation"]
    assert (calc["successes"], calc["attempts"], calc["score"]) == (22, 23, 96)
    # Ten games reached 80: eight won (a draw is not a conversion).
    assert (by["converting"]["successes"], by["converting"]["attempts"], by["converting"]["score"]) == (8, 10, 80)
    # One game fell to 20 and was saved: a rate, but too few games for a score.
    defending = by["defending"]
    assert (defending["score"], defending["reason"], defending["successes"], defending["attempts"]) == (
        None,
        "few_games",
        1,
        1,
    )
    # Nothing in the previous 30 days: no previous score, but its counts are there.
    assert by["safety"]["previous"] == {
        "score": None,
        "reason": "few_games",
        "successes": 0,
        "attempts": 0,
        "games": 0,
        "excluded": 0,
    }


def test_tactics_needs_twenty_chances_in_games_whatever_the_practice(db_url):
    with db.connect(db_url) as conn:
        for gid in range(1, 11):
            add_shape_game(
                conn,
                gid,
                played_at=days_ago(gid),
                plies=[shape_ply(1, "Kb1", "a1b1", "miss", "ownTactic")] if gid == 1 else FILLER,
            )
        conn.execute("UPDATE moves SET pattern = 'fork' WHERE game_id = 1")
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (1, 1)")
        for day in range(1, 30):
            conn.execute(
                "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)"
                " VALUES (1, 1, %s, 'b5c7', true, 'good')",
                (days_ago(day),),
            )
    tactics = axes(TestClient(api.create_app(db_url)))["tactics"]
    assert (tactics["score"], tactics["reason"], tactics["parts"]["games"]["chances"]) == (None, "few_chances", 1)
    assert (tactics["successes"], tactics["attempts"]) == (29, 30)


def test_a_previous_score_needs_both_periods_to_qualify(db_url):
    with db.connect(db_url) as conn:
        for gid in range(1, 11):  # this month: ten clean games
            add_shape_game(conn, gid, played_at=days_ago(gid), plies=[shape_ply(1, "e4", "e2e4")])
        for gid in range(21, 31):  # the month before: half of them with a safety lapse
            lapse = gid % 2 == 0
            add_shape_game(
                conn,
                gid,
                played_at=days_ago(gid + 10),
                plies=[shape_ply(1, "Kb1", "a1b1", "blunder" if lapse else "good", "theirReply" if lapse else None)],
            )
    client = TestClient(api.create_app(db_url))
    safety = axes(client)["safety"]
    assert safety["score"] == 100
    assert safety["previous"] == {
        "score": 50,
        "reason": None,
        "successes": 5,
        "attempts": 10,
        "games": 10,
        "excluded": 0,
    }
    assert axes(client, "all")["safety"]["previous"] is None  # all time has no earlier period
    assert axes(client, "all")["safety"]["score"] == 75

    with db.connect(db_url) as conn:
        conn.execute("UPDATE games SET rated = false WHERE id = 1")
    safety = axes(client)["safety"]
    # This month no longer qualifies, so neither score shows; the earlier counts still do.
    assert (safety["score"], safety["reason"], safety["games"]) == (None, "few_games", 9)
    assert (safety["previous"]["score"], safety["previous"]["successes"]) == (None, 5)

    with db.connect(db_url) as conn:
        conn.execute("UPDATE games SET rated = true WHERE id = 1")
        conn.execute("UPDATE games SET rated = false WHERE id = 30")
    safety = axes(client)["safety"]
    assert safety["score"] == 100
    assert (safety["previous"]["score"], safety["previous"]["reason"], safety["previous"]["games"]) == (
        None,
        "few_games",
        9,
    )


def test_scores_count_only_your_own_games(db_url, clerk):  # noqa: F811
    for clerk_id, first, lapse in (("user_alice", 100, False), ("user_bob", 200, True)):
        with db.connect(db_url) as owner:
            user_id = users.ensure(owner, clerk_id)
        conn = db.connect(db_url, migrate=False, user_id=user_id)
        with conn:
            for gid in range(first, first + 10):
                add_shape_game(
                    conn,
                    gid,
                    played_at=days_ago(gid - first + 1),
                    plies=[
                        shape_ply(1, "Kb1", "a1b1", "blunder", "theirThreat") if lapse else shape_ply(1, "e4", "e2e4")
                    ],
                )
        conn.close()
    client = TestClient(api.create_app(db_url))
    for me, score in (("alice", 100), ("bob", 0)):
        safety = axes(client, headers=as_user(f"user_{me}"))["safety"]
        assert (safety["score"], safety["games"], safety["attempts"]) == (score, 10, 10)
