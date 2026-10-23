"""The watch story's data (watch.py): card states, slips per game and this week, tonight's
preview, stars that never go away, ranks that are never lost, and nights kept."""

import json
from datetime import UTC, date, datetime, timedelta

import pytest
from conftest import add_review_game, add_review_move, days_ago
from fastapi.testclient import TestClient
from fsrs import Card, State

from knightly import api, curriculum, daily, db, deck, wards, watch

TODAY = date(2026, 10, 14)


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def fsrs_state(stability: float) -> str:
    """A reviewed card's FSRS state with this stability (days)."""
    card = Card()
    card.state, card.stability, card.difficulty = State.Review, stability, 5.0
    card.last_review = datetime(2026, 10, 1, tzinfo=UTC)
    card.due = card.last_review + timedelta(days=max(1, int(stability)))
    return json.dumps(card.to_dict())


def analysed_game(conn, gid, plies=(2, 4, 6), played_at="2026-10-01T12:00:00Z"):
    """An analysed game whose given plies (yours, as Black) are review cards, never answered."""
    add_review_game(conn, gid, played_at=played_at)
    conn.execute(
        """INSERT INTO game_analysis (game_id, engine, depth, user_accuracy, user_blunders,
           user_mistakes, user_inaccuracies) VALUES (%s, 'test', 1, 80, %s, 0, 0)""",
        (gid, len(plies)),
    )
    for ply in plies:
        add_review_move(conn, gid, ply)
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (%s, %s)", (gid, ply))


def answered(conn, gid, ply, *results, stability=5.0, at="2026-10-0{}T20:00:00Z"):
    """Graded answers (True right, False wrong), oldest first, then the card's FSRS state."""
    for i, right in enumerate(results, start=1):
        conn.execute(
            """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating,
               stability_before, stability_after) VALUES (%s, %s, %s, 'e7e5', %s, %s, 1, %s)""",
            (gid, ply, at.format(i), right, "good" if right else "again", stability),
        )
    conn.execute(
        """UPDATE cards SET reviews = %s, lapses = %s, fsrs = %s, due = '2026-10-20',
           last_reviewed_at = %s WHERE game_id = %s AND ply = %s""",
        (len(results), results.count(False), fsrs_state(stability), at.format(len(results)), gid, ply),
    )


def test_card_state_mapping():
    """New and failed-last are on watch; solved and not mastered is held; mastered has
    stopped slipping, whatever its last answer."""
    assert watch.state_of(0, None, mastered=False) == "on_watch"
    assert watch.state_of(3, False, mastered=False) == "on_watch"
    assert watch.state_of(3, True, mastered=False) == "held"
    assert watch.state_of(3, False, mastered=True) == "stopped"


def test_games_list_has_slips_per_game_and_this_week(db_url):
    with db.connect(db_url) as conn:
        analysed_game(conn, 1, plies=(2, 4, 6, 8), played_at=days_ago(2))
        answered(conn, 1, 4, False, True)  # held: right since the miss
        answered(conn, 1, 6, True, False)  # on watch: the last answer failed
        answered(conn, 1, 8, True, True, stability=90)  # no tactic, so its schedule is enough
        analysed_game(conn, 2, plies=(), played_at=days_ago(3))  # analysed, nothing slipped
        add_review_game(conn, 3, played_at=days_ago(1))  # not analysed yet
        analysed_game(conn, 4, plies=(2,), played_at=days_ago(20))  # outside the week
    body = TestClient(api.create_app(db_url)).get("/api/games?unrated=true").json()
    slips = {g["id"]: g["slips"] for g in body["games"]}
    assert slips == {
        1: {"on_watch": 2, "held": 1, "stopped": 1},
        2: {"on_watch": 0, "held": 0, "stopped": 0},
        3: None,
        4: {"on_watch": 1, "held": 0, "stopped": 0},
    }
    assert body["week"] == {"games": 3, "analysed": 2, "slipped": 4, "on_watch": 2, "held": 1, "stopped": 1}


def test_games_scope_picks_slipped_or_clean_games_and_leaves_out_unanalysed(db_url):
    with db.connect(db_url) as conn:
        analysed_game(conn, 1, plies=(2, 4), played_at=days_ago(2))
        answered(conn, 1, 2, True, True, stability=90)  # stopped slipping, still a slip
        analysed_game(conn, 2, plies=(), played_at=days_ago(3))  # Clean
        add_review_game(conn, 3, played_at=days_ago(1))  # not analysed yet: neither
        analysed_game(conn, 4, plies=(6,), played_at=days_ago(4))
    client = TestClient(api.create_app(db_url))
    slipped = client.get("/api/games?unrated=true&slips=slipped").json()
    assert [g["id"] for g in slipped["games"]] == [1, 4]
    assert slipped["total"] == 2
    assert slipped["games"][0]["slips"] == {"on_watch": 1, "held": 0, "stopped": 1}
    clean = client.get("/api/games?unrated=true&slips=clean").json()
    assert [g["id"] for g in clean["games"]] == [2]
    assert clean["total"] == 1
    everything = client.get("/api/games?unrated=true").json()
    assert [g["id"] for g in everything["games"]] == [3, 1, 2, 4]
    assert client.get("/api/games?slips=some").status_code == 422


def test_suspended_cards_are_not_slips(db_url):
    with db.connect(db_url) as conn:
        analysed_game(conn, 1, plies=(2, 4))
        conn.execute(
            "UPDATE cards SET suspended_at = '2026-10-02T00:00:00Z', suspend_reason = 'not_useful' WHERE ply = 4"
        )
        game = conn.execute("SELECT * FROM (SELECT 1 AS id, true AS analysed) g").fetchall()
        assert watch.slips(conn, game) == {1: {"on_watch": 1, "held": 0, "stopped": 0}}


def test_game_detail_deck_cards_say_state_due_label_and_held(db_url):
    with db.connect(db_url) as conn:
        analysed_game(conn, 1, plies=(2, 4))
        conn.execute("UPDATE moves SET pattern = 'fork' WHERE ply = 4")
        answered(conn, 1, 4, False, True, True)
    body = TestClient(api.create_app(db_url)).get("/api/games/1").json()
    assert body["deck_cards"] == [
        {"ply": 2, "state": "on_watch", "due": None, "label": "Your move 1", "reason": None, "held": 0},
        {"ply": 4, "state": "held", "due": "2026-10-20", "label": "Fork", "reason": None, "held": 2},
    ]
    assert body["deck_plies"] == [2, 4]


def test_tonight_names_up_to_three_moves_in_lesson_order(db_url):
    with db.connect(db_url) as conn:
        # Five days ago: recent, but past deck.LEAD_GAME_DAYS, so no game leads the lesson.
        analysed_game(conn, 1, plies=(2, 4, 6, 8, 10), played_at=days_ago(5))
        # Due and nearly forgotten, answered wrong once: first in the lesson, a second look.
        answered(conn, 1, 10, False, True, stability=1.0)
        conn.execute("UPDATE cards SET due = '2026-01-01' WHERE ply = 10")
        conn.execute("UPDATE moves SET pattern = 'pin' WHERE ply = 10")
    body = TestClient(api.create_app(db_url)).get("/api/home").json()
    tonight = body["today"]["tonight"]
    assert [c["ply"] for c in tonight["cards"]][:1] == [10]
    assert len(tonight["cards"]) == 3
    first = tonight["cards"][0]
    assert (first["label"], first["chip"], first["opponent"], first["color"]) == ("Pin", "again", "opp", "black")
    assert first["fen"] and first["san"] == "g5"
    assert [c["chip"] for c in tonight["cards"][1:]] == ["new", "new"]
    # The four new positions (the pace allows five) are from this week's game.
    assert tonight["slipped_recent"] == 4
    assert tonight["game"] is None
    lesson = body["today"]["lesson"]
    assert tonight["remaining"] == lesson["total"] - lesson["done"] - 3


def test_a_new_games_slips_lead_tonights_lesson_and_its_card(db_url):
    with db.connect(db_url) as conn:
        # An older game's move, due and nearly forgotten: the lesson's first without a new game.
        analysed_game(conn, 2, plies=(2,), played_at=days_ago(20))
        answered(conn, 2, 2, False, True, stability=1.0)
        conn.execute("UPDATE cards SET due = '2026-01-01' WHERE game_id = 2")
        # Last night's game, newly analysed: two moves slipped past you.
        analysed_game(conn, 1, plies=(4, 6), played_at=days_ago(1))
    body = TestClient(api.create_app(db_url)).get("/api/home").json()
    tonight = body["today"]["tonight"]
    assert tonight["game"] == {"id": 1, "opponent": "opp", "played_at": days_ago(1), "slipped": 2}
    # The card's rows are the game's slips, then the moves you're keeping hold of.
    assert [(c["game_id"], c["ply"], c["chip"]) for c in tonight["cards"]] == [(1, 4, "new"), (1, 6, "new")]
    lesson = body["today"]["lesson"]
    assert tonight["remaining"] == lesson["total"] - lesson["done"] - 2 == 1
    # The lesson itself serves them first, before the most forgotten due move.
    with db.connect(db_url) as conn:
        today = db.today(conn)
        assert [(r["game_id"], r["ply"]) for r in deck.lesson_queue(conn, today)] == [(1, 4), (1, 6), (2, 2)]


def test_a_star_is_dated_from_history_set_once_and_backfilled(conn):
    analysed_game(conn, 1, plies=(2, 4, 6))
    # Reached 11 days on its second answer (before stamp_stars existed): the backfill.
    conn.execute(
        """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating,
           stability_before, stability_after) VALUES
           (1, 2, '2026-09-01T20:00:00Z', 'e7e5', true, 'good', 0, 3),
           (1, 2, '2026-09-21T20:00:00Z', 'e7e5', true, 'good', 3, 12),
           (1, 2, '2026-10-30T20:00:00Z', 'e7e5', true, 'good', 12, 40)"""
    )
    conn.execute("UPDATE cards SET reviews = 3, fsrs = %s WHERE ply = 2", (fsrs_state(40),))
    # A fork needs a family puzzle too: its star is the day that was solved.
    answered(conn, 1, 4, True, True, stability=20)
    conn.execute("UPDATE moves SET pattern = 'fork' WHERE ply = 4")
    # Held but not stopped slipping yet: no star.
    answered(conn, 1, 6, True, stability=5)
    assert watch.stamp_stars(conn) == 1
    stars = dict((r[0], r[1]) for r in conn.execute("SELECT ply, mastered_at FROM cards WHERE mastered_at IS NOT NULL"))
    assert stars == {2: "2026-09-21T20:00:00Z"}
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, family_game_id, family_ply)
           VALUES ('knightly', 'p1', '2026-10-12T09:00:00Z', true, 1, 4)"""
    )
    assert watch.stamp_stars(conn) == 1
    assert conn.execute("SELECT mastered_at FROM cards WHERE ply = 4").fetchone()[0] == "2026-10-12T09:00:00Z"
    # Set once: nothing restamps, even when a later answer would date it differently.
    assert watch.stamp_stars(conn) == 0
    assert conn.execute("SELECT mastered_at FROM cards WHERE ply = 2").fetchone()[0] == "2026-09-21T20:00:00Z"


def test_a_move_stops_slipping_at_eleven_days_well_before_long_term_memory(conn):
    """About 11 days' stability (Good on two separate days) is a star; 10.9 days is still
    held. Long-term memory, the deck's count, stays at 60 days."""
    analysed_game(conn, 1, plies=(2, 4, 6))
    answered(conn, 1, 2, True, True, stability=10.9)
    answered(conn, 1, 4, True, True, stability=11)
    answered(conn, 1, 6, True, True, stability=60)
    assert {c["ply"]: c["state"] for c in watch.cards(conn)} == {2: "held", 4: "stopped", 6: "stopped"}
    assert watch.stamp_stars(conn) == 2
    starred_plies = [r[0] for r in conn.execute("SELECT ply FROM cards WHERE mastered_at IS NOT NULL ORDER BY ply")]
    assert starred_plies == [4, 6]
    # Only the 60-day card counts as long-term memory.
    assert deck.stats(conn, TODAY)["mastered"] == 1


def test_a_move_with_a_tactic_family_stops_slipping_only_once_a_family_puzzle_is_solved(conn):
    analysed_game(conn, 1, plies=(2,))
    conn.execute("UPDATE moves SET pattern = 'fork' WHERE ply = 2")
    answered(conn, 1, 2, True, True, stability=20)
    assert [c["state"] for c in watch.cards(conn)] == ["held"]
    assert watch.stamp_stars(conn) == 0
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, family_game_id, family_ply)
           VALUES ('knightly', 'p1', '2026-10-12T09:00:00Z', true, 1, 2)"""
    )
    assert [c["state"] for c in watch.cards(conn)] == ["stopped"]
    assert watch.stamp_stars(conn) == 1


def test_a_lapse_below_eleven_days_dims_the_star(conn):
    analysed_game(conn, 1, plies=(2,))
    answered(conn, 1, 2, True, True, stability=12)
    assert [s["dimmed"] for s in watch.journey(conn, TODAY)["star_list"]] == [False]
    conn.execute("DELETE FROM card_reviews")
    answered(conn, 1, 2, True, True, False, stability=3)
    journey = watch.journey(conn, TODAY)
    assert (journey["stars"], journey["dimmed"]) == (1, 1)
    assert [c["state"] for c in watch.cards(conn)] == ["on_watch"]


def starred(conn, gid, n, first_day=date(2026, 9, 1)):
    """A game with n cards, each stopped slipping, starred one a day from first_day."""
    plies = tuple(range(2, 2 * n + 1, 2))
    add_review_game(conn, gid)
    for i, ply in enumerate(plies):
        add_review_move(conn, gid, ply)
        conn.execute(
            "INSERT INTO cards (game_id, ply, reviews, fsrs, mastered_at) VALUES (%s, %s, 3, %s, %s)",
            (gid, ply, fsrs_state(90), f"{first_day + timedelta(days=i)}T20:00:00Z"),
        )
    return plies


def nights(conn, *days):
    for d in days:
        conn.execute("INSERT INTO daily_activity (day, planned, goal) VALUES (%s, 1, true)", (d.isoformat(),))


def test_stars_count_what_you_learned_but_never_reach_a_rank(conn):
    starred(conn, 1, 12)
    nights(conn, date(2026, 8, 30))
    journey = watch.journey(conn, TODAY)
    reached = {r["key"]: r["reached_on"] for r in journey["ranks"]}
    assert reached["page"] == "2026-08-30"  # the first night kept
    assert reached["squire-1"] is None  # twelve stars, but no castle's posts cleared
    posts = [r["post"] for r in journey["ranks"]]
    assert posts[:7] == [None, 3, 6, 9, 12, 15, 18] and posts[-1] == len(curriculum.WARDS)
    assert (journey["stars"], journey["rank"], journey["rank_reached_on"]) == (12, "Page", "2026-08-30")
    assert (journey["next_rank"], journey["next_post"]) == ("Squire I", 3)


def test_each_castle_stands_after_its_posts(conn):
    """The rank ladder and the walk's castles are one ladder: Squire I onward at every
    POSTS_PER_RANK posts, in wards.POST_RANKS order, and Castellan when the last post clears."""
    by_post = {key: post for key, _, post in watch.RANKS if post is not None}
    assert list(by_post) == [*wards.POST_RANKS, wards.FINAL_RANK]
    steps = [i * wards.POSTS_PER_RANK for i in range(1, len(wards.POST_RANKS) + 1)]
    assert list(by_post.values()) == [*steps, len(curriculum.WARDS)]
    assert steps[-1] < len(curriculum.WARDS), "every ladder rank has posts to clear"


def test_a_lapse_dims_a_star_without_lowering_the_count_or_a_reached_rank(conn):
    plies = starred(conn, 1, 10)
    # A rank reached under the old star thresholds stays reached.
    db.set_setting(conn, watch.RANKS_SETTING, {"squire-1": "2026-09-10"})
    assert watch.journey_summary(conn, TODAY)["rank"] == "Squire I"
    conn.execute("UPDATE cards SET fsrs = %s, lapses = 1 WHERE ply = %s", (fsrs_state(2), plies[0]))
    journey = watch.journey(conn, TODAY)
    assert (journey["stars"], journey["dimmed"], journey["rank"]) == (10, 1, "Squire I")
    assert [s["dimmed"] for s in journey["star_list"]] == [True] + [False] * 9


def test_before_the_first_night_and_star_the_rank_is_page(conn):
    summary = watch.journey_summary(conn, TODAY)
    assert summary == {"stars": 0, "rank": "Page", "rank_reached_on": None, "next_rank": "Squire I", "next_post": 3}


def test_nights_total_counts_every_kept_night_but_not_frozen_or_missed_days(conn):
    kept = [TODAY - timedelta(days=n) for n in range(20, 12, -1)]  # eight nights, a freeze earned
    nights(conn, *kept, TODAY - timedelta(days=11), TODAY - timedelta(days=5), TODAY)
    streak = daily.streak(conn, TODAY)
    # Day 12 was frozen; days 10..6 and 4..1 were missed and broke the streak.
    assert streak["nights_total"] == 11
    assert streak["count"] == 1
    milestones = watch.journey(conn, TODAY)["nights"]
    assert milestones["total"] == 11
    assert milestones["milestones"][0] == {"nights": 7, "reached_on": (TODAY - timedelta(days=14)).isoformat()}
    assert milestones["milestones"][1] == {"nights": 30, "reached_on": None}


def test_home_and_journey_serve_the_journey(db_url):
    with db.connect(db_url) as conn:
        starred(conn, 1, 3)
    client = TestClient(api.create_app(db_url))
    home = client.get("/api/home").json()
    assert home["journey"]["stars"] == 3
    assert home["today"]["streak"]["nights_total"] == 0
    body = client.get("/api/journey").json()
    assert [s["label"] for s in body["star_list"]] == ["Your move 1", "Your move 2", "Your move 3"]
    assert [m["nights"] for m in body["nights"]["milestones"]] == list(watch.NIGHT_MILESTONES)


def test_progress_counts_every_move_by_where_it_is_on_the_watch(db_url):
    with db.connect(db_url) as conn:
        analysed_game(conn, 1, plies=(2, 4, 6, 8))
        answered(conn, 1, 4, True)  # held
        answered(conn, 1, 6, True, False)  # its last answer slipped: on watch again
        answered(conn, 1, 8, True, True, stability=20.0)  # stopped slipping
    body = TestClient(api.create_app(db_url)).get("/api/journey").json()
    assert body["moves"] == {"on_watch": 2, "held": 1, "stopped": 1}


def test_the_games_badge_counts_new_games_with_moves_that_slipped(db_url):
    with db.connect(db_url) as conn:
        analysed_game(conn, 1, plies=(2, 4), played_at=days_ago(1))
        analysed_game(conn, 2, plies=(), played_at=days_ago(1.5))  # clean
    client = TestClient(api.create_app(db_url))
    today = client.get("/api/home").json()["today"]
    assert (today["new_games"], today["new_games_slipped"]) == (2, 1)
    assert client.post("/api/games/1/review").status_code == 200
    assert client.get("/api/home").json()["today"]["new_games_slipped"] == 0


def test_a_move_is_named_by_its_blunder_cause_then_its_tactic_then_its_number():
    assert watch.label("missedThreat", "fork", 14) == "Missed threat"
    assert watch.label(None, "fork", 14) == "Fork"
    assert watch.label("unknownCause", "unknownTactic", 14) == "Your move 14"
