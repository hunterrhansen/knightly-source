import json
from datetime import UTC, date, datetime, timedelta

import pytest
from conftest import add_review_game, add_review_move, as_user
from fastapi.testclient import TestClient

from knightly import analyze, api, db, deck, users

# Answers are judged without Stockfish (conftest.no_engine).
pytestmark = pytest.mark.usefixtures("no_engine")


@pytest.fixture
def conn(db_url, tmp_path):
    c = db.connect(db_url)
    yield c
    c.close()


def test_clear_best_is_from_the_movers_side():
    # Black to move: -50 vs +300 means the second choice is much worse for Black.
    assert deck.clear_best("black", -50, 300)
    assert not deck.clear_best("black", -50, -20)
    assert deck.clear_best("white", 50, -300)
    assert not deck.clear_best("white", 50, None)


def test_clear_best_counts_a_mate_beside_another_winning_move():
    # Regression: evals clamp to CLAMP_CP before win_pct, so a forced mate and a merely
    # winning alternative both land near 98% and the gap reads zero. Those positions never
    # became cards. 16 of the production account's mistakes were missing for this reason.
    mate, winning = analyze.MATE_CP - 2, 700
    assert analyze.win_pct(mate) - analyze.win_pct(winning) < deck.CARD_GAP
    assert deck.clear_best("white", mate, winning)
    assert deck.clear_best("black", -mate, -winning)


def test_clear_best_does_not_count_one_mate_against_another():
    assert not deck.clear_best("white", analyze.MATE_CP - 2, analyze.MATE_CP - 9)


def test_sync_adds_only_clear_mistakes_of_yours_once(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)  # blunder, one clear best move
    add_review_move(conn, 1, 4, cls="mistake", second=-20)  # several moves about as good
    add_review_move(conn, 1, 6, cls="inaccuracy")  # not a mistake
    add_review_move(conn, 1, 7, is_user=False, color="white", best=50, second=-300)  # opponent's
    add_review_move(conn, 1, 8, cls="miss")
    assert deck.sync(conn) == 2
    assert deck.sync(conn) == 0
    assert {tuple(r) for r in conn.execute("SELECT game_id, ply FROM cards")} == {(1, 2), (1, 8)}


def test_refresh_adds_newly_analysed_mistakes_and_skips_rescans_otherwise(conn):
    from knightly import analyze

    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    assert deck.refresh(conn)  # nothing recorded yet: the first refresh scans
    assert not deck.refresh(conn)
    add_review_game(conn, 2)
    row = dict.fromkeys(analyze.MOVE_COLUMNS) | dict(
        game_id=2,
        ply=2,
        move_number=1,
        color="black",
        is_user=True,
        phase="opening",
        san="g5",
        uci="g7g5",
        best_san="e5",
        best_uci="e7e5",
        eval_before=-50,
        eval_second=300,
        classification="blunder",
        win_pct_before=50,
    )
    analyze.save(conn, 2, [row], {"game_id": 2, "engine": "test"})
    assert deck.refresh(conn)
    assert not deck.refresh(conn)
    assert {tuple(r) for r in conn.execute("SELECT game_id, ply FROM cards")} == {(1, 2), (2, 2)}
    # Tactic tags come with the refresh, so new cards are named as before.
    assert conn.execute("SELECT pattern FROM moves WHERE game_id = 2").fetchone()[0] is not None


def test_a_mistake_with_a_five_to_ten_point_gap_becomes_a_card(conn):
    # Black to move: the second choice (+30) costs about 7 win% against the best (-50);
    # -20 costs under 3.
    assert 5 < deck.best_gap("black", -50, 30) < 10
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2, second=30)
    add_review_move(conn, 1, 4, second=-20)
    assert deck.sync(conn) == 1
    assert deck.game_plies(conn, 1) == [2]


def test_a_card_rules_change_refreshes_an_already_synced_deck(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2, second=30)
    # Synced under the old rules, which recorded only the analysis version.
    db.set_setting(conn, deck.SYNCED_SETTING, db.analysis_version(conn))
    assert deck.refresh(conn)
    assert not deck.refresh(conn)
    assert {tuple(r) for r in conn.execute("SELECT game_id, ply FROM cards")} == {(1, 2)}


def test_near_bar_lists_only_mistakes_within_the_gap_range_with_their_position(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2, second=30)  # about 7
    add_review_move(conn, 1, 4)  # far above 10
    add_review_move(conn, 1, 6, second=-20)  # under 5
    add_review_move(conn, 1, 8, cls="inaccuracy", second=30)
    [row] = deck.near_bar(conn)
    assert (row["game_id"], row["ply"]) == (1, 2)
    assert row["fen"].startswith("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b")


NOON = datetime(2026, 10, 6, 18, tzinfo=UTC)  # Oct 6 in any US time zone
DAY = date(2026, 10, 6)


def first_review(conn, gid, ply):
    return conn.execute(
        "SELECT rating, quality, solved FROM card_reviews WHERE game_id = %s AND ply = %s", (gid, ply)
    ).fetchone()


def test_first_try_grades_the_card_like_anki(conn):
    add_review_game(conn, 1)
    for ply in (2, 4, 6, 8):
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    best = deck.answer(conn, 1, 2, "e7e5", today=DAY, now=NOON)
    assert best["correct"] and best["rating"] == "good" and best["quality"] == "best"
    assert best["due"] == "2026-10-08"  # FSRS: a new card answered Good comes back in 2 days
    good = deck.answer(conn, 1, 4, "d7d5", today=DAY, now=NOON)
    assert good["correct"] and good["rating"] == "hard" and good["due"] == "2026-10-07"
    wrong = deck.answer(conn, 1, 6, "g7g5", today=DAY, now=NOON)
    assert not wrong["correct"] and wrong["rating"] == "again" and wrong["due"] == "2026-10-07"
    hinted = deck.answer(conn, 1, 8, "e7e5", hinted=True, today=DAY, now=NOON)
    assert hinted["correct"] and hinted["rating"] == "again"
    assert tuple(conn.execute("SELECT reviews, lapses FROM cards WHERE ply = 6").fetchone()) == (1, 1)


def test_a_retry_is_for_learning_and_keeps_the_grade(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    add_review_move(conn, 1, 4)
    deck.sync(conn)
    assert deck.answer(conn, 1, 2, "g7g5", today=DAY, now=NOON)["rating"] == "again"
    retry = deck.answer(conn, 1, 2, "e7e5", today=DAY, now=NOON)
    assert retry["correct"] and retry["rating"] is None and retry["due"] == "2026-10-07"
    assert tuple(first_review(conn, 1, 2)) == ("again", "wrong", 1)
    assert conn.execute("SELECT count(*) FROM card_reviews").fetchone()[0] == 1
    # Show me, then the end-of-session redo: judged, but it stays a miss.
    deck.answer(conn, 1, 4, deck.SKIP, today=DAY, now=NOON)
    assert deck.answer(conn, 1, 4, "e7e5", redo=True, today=DAY, now=NOON)["correct"]
    assert tuple(first_review(conn, 1, 4)) == ("again", "shown", 0)
    assert [r["mark"] for r in deck.today_results(conn, DAY)] == ["helped", "missed"]


def test_marks_for_the_done_screens():
    assert [deck.mark(r, s) for r, s in [("good", True), ("hard", True), ("again", True), ("again", False)]] == [
        "found",
        "good",
        "helped",
        "missed",
    ]


def test_answers_from_before_fsrs_are_replayed(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    deck.sync(conn)
    # Answered right once under the old ladder: no FSRS state yet.
    conn.execute("UPDATE cards SET reviews = 1, step = 1, due = '2026-10-09' WHERE ply = 2")
    conn.execute(
        "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct) "
        "VALUES (1, 2, '2026-10-06T18:00:00Z', 'e7e5', true)"
    )
    deck.sync(conn)
    fsrs_state, due = conn.execute("SELECT fsrs, due FROM cards WHERE ply = 2").fetchone()
    assert fsrs_state and due == "2026-10-08"
    assert first_review(conn, 1, 2)["rating"] == "good"


def make_due(conn, gid, plies, day):
    """Cards answered once before (a week before `day`), due on `day`."""
    for ply in plies:
        conn.execute(
            "UPDATE cards SET due = %s, reviews = 1 WHERE game_id = %s AND ply = %s", (day.isoformat(), gid, ply)
        )
        conn.execute(
            "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating) "
            "VALUES (%s, %s, %s, 'e7e5', true, 'good')",
            (gid, ply, f"{day - timedelta(days=7)}T12:00:00Z"),
        )


def test_new_positions_are_capped_by_the_pace_counting_todays_answers(conn):
    add_review_game(conn, 1, played_at="2026-09-01T12:00:00Z")
    add_review_game(conn, 2, played_at="2026-10-01T12:00:00Z")
    for ply in range(2, 2 + 2 * 8, 2):
        add_review_move(conn, 1, ply)
        add_review_move(conn, 2, ply)
    deck.sync(conn)
    today = date.today()
    q = deck.queue(conn, today)
    assert len(q) == 5  # Standard
    assert {r["game_id"] for r in q} == {2}  # newest game first
    deck.answer(conn, q[0]["game_id"], q[0]["ply"], "e7e5", today=today)
    assert len(deck.queue(conn, today)) == 4
    assert deck.stats(conn, today)["today"] == {"done": 1, "total": 5}
    db.set_setting(conn, deck.PACE_SETTING, "light")
    assert deck.stats(conn, today)["today"] == {"done": 1, "total": 3}
    db.set_setting(conn, deck.PACE_SETTING, "intense")
    assert deck.stats(conn, today)["today"] == {"done": 1, "total": 10}
    db.set_setting(conn, deck.PACE_SETTING, "bogus")  # an unknown value falls back
    assert deck.pace(conn) == "standard"


def test_due_reviews_do_not_crowd_out_new_positions(conn):
    # Under the old shared limit of ten, twelve due cards left no room for new mistakes.
    add_review_game(conn, 1)
    add_review_game(conn, 2, played_at="2026-10-05T12:00:00Z")
    for ply in range(2, 26, 2):
        add_review_move(conn, 1, ply)
    add_review_move(conn, 2, 2)
    add_review_move(conn, 2, 4)
    deck.sync(conn)
    today = date.today()
    make_due(conn, 1, range(2, 26, 2), today - timedelta(days=1))
    q = deck.queue(conn, today)
    assert [r["game_id"] for r in q] == [1] * 12 + [2, 2]
    # Answering reviews doesn't use up today's new positions either.
    for r in q[:6]:
        deck.answer(conn, r["game_id"], r["ply"], "e7e5", today=today)
    assert [r["game_id"] for r in deck.queue(conn, today)] == [1] * 6 + [2, 2]


def test_reviews_stop_at_a_fixed_daily_ceiling_most_overdue_first_whatever_the_pace(conn):
    # The old cap (ten times the new limit) was 30 at Light: right at the deck's own
    # steady-state estimate, so due reviews piled up. Now 200, as in Anki, at every pace.
    add_review_game(conn, 1)
    plies = range(2, 2 + 2 * 210, 2)
    for ply in plies:
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    today = date.today()
    make_due(conn, 1, [2, 4], today - timedelta(days=9))
    make_due(conn, 1, plies[2:], today - timedelta(days=1))
    db.set_setting(conn, deck.PACE_SETTING, "light")
    q = deck.queue(conn, today)
    assert len(q) == 200
    assert [r["ply"] for r in q[:2]] == [2, 4]
    # Reviews answered today count against it.
    conn.execute(
        "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating) "
        "VALUES (1, 2, %s, 'e7e5', true, 'good')",
        (f"{today}T12:00:00Z",),
    )
    q = deck.queue(conn, today)
    assert len(q) == 199 and q[0]["ply"] == 4


def five_new(conn, gid):
    add_review_game(conn, gid, played_at=f"2026-10-0{gid}T12:00:00Z")
    for ply in range(2, 12, 2):
        add_review_move(conn, gid, ply)


def test_learn_more_adds_one_paces_worth_of_new_positions_for_today_only(conn):
    five_new(conn, 1)
    five_new(conn, 2)
    deck.sync(conn)
    db.set_setting(conn, deck.PACE_SETTING, "light")
    today = db.today(conn)
    # Nothing to add while today's queue still has positions.
    assert deck.more_available(conn, today, deck.queue(conn, today)) == 0
    assert deck.learn_more(conn, today) == 0
    for r in deck.queue(conn, today):
        deck.answer(conn, r["game_id"], r["ply"], "e7e5", today=today)
    assert deck.queue(conn, today) == []
    assert deck.more_available(conn, today, []) == 3
    assert deck.learn_more(conn, today) == 3
    more = deck.queue(conn, today)
    assert len(more) == 3 and all(r["due"] is None for r in more)
    # The extra positions are graded and scheduled by FSRS like any other.
    result = deck.answer(conn, more[0]["game_id"], more[0]["ply"], "e7e5", today=today)
    assert result["rating"] in ("good", "easy") and result["due"] > today.isoformat()
    for r in more[1:]:
        deck.answer(conn, r["game_id"], r["ply"], "e7e5", today=today)
    # Only four positions are left unanswered, so Learn more offers three, then one.
    assert deck.learn_more(conn, today) == 3
    for r in deck.queue(conn, today):
        deck.answer(conn, r["game_id"], r["ply"], "e7e5", today=today)
    assert deck.learn_more(conn, today) == 1
    assert deck.pace(conn) == "light"
    # Tomorrow is back to the pace's own limit.
    assert deck.new_limit(conn, today) == 3 + 3 + 3 + 1
    assert deck.new_limit(conn, today + timedelta(days=1)) == 3


def test_learn_more_endpoint_raises_todays_limit_once_the_queue_is_done(db_url, conn):
    client = TestClient(api.create_app(db_url))
    five_new(conn, 1)
    deck.sync(conn)
    db.set_setting(conn, deck.PACE_SETTING, "light")
    today = db.today(conn)
    assert client.get("/api/home").json()["today"]["learn_more"] == 0
    assert client.post("/api/deck/more").json() == {"added": 0, "day": today.isoformat()}
    for r in deck.queue(conn, today):
        deck.answer(conn, r["game_id"], r["ply"], "e7e5", today=today)
    assert client.get("/api/home").json()["today"]["learn_more"] == 2
    assert client.post("/api/deck/more").json()["added"] == 2
    home = client.get("/api/home").json()["today"]
    positions = next(step for step in home["plan"] if step["kind"] == "positions")
    assert positions == {"kind": "positions", "done": False, "count": 3, "total": 5}
    assert home["learn_more"] == 0
    assert client.get("/api/settings").json()["pace"] == "light"


def add_chances(conn, gid_start, motif, *, found, missed, ply_start=100):
    """Taken and untaken chances at `motif`, the evidence patterns.weakness reads.

    `chance_found` carries whether you took it. A tactical chance is taken by playing the
    engine's move, but a positional one by playing any move with the idea in it, so the
    answer is stored rather than read back off `uci = best_uci`."""
    ply = ply_start
    for i in range(found + missed):
        taken = i < found
        # second == best, so these never qualify as cards themselves; they are only the
        # chance evidence weakness() reads.
        add_review_move(
            conn, gid_start, ply, cls="best" if taken else "miss", uci="e7e5" if taken else "g7g5", best=-50, second=-50
        )
        conn.execute(
            "UPDATE moves SET chance_motif = %s, chance_found = %s WHERE game_id = %s AND ply = %s",
            (motif, taken, gid_start, ply),
        )
        ply += 2


def test_new_positions_come_weakest_first(conn):
    # The weaker tactic sits on the OLDER game, so ordering by weakness has to beat the
    # newest-first fallback for this to pass.
    add_review_game(conn, 1, played_at="2026-10-01T12:00:00Z")
    add_review_game(conn, 2, played_at="2026-10-10T12:00:00Z")
    conn.execute("UPDATE games SET rated = true")
    add_review_move(conn, 2, 2, cls="mistake")  # newest game, a tactic you usually find
    add_review_move(conn, 1, 2, cls="mistake")  # older game, the tactic you fail
    add_review_move(conn, 1, 4, cls="blunder")  # a blunder: always first, whatever the tactic
    add_review_move(conn, 1, 6, cls="miss")  # untagged: sorts at the average, so above a
    # tactic you are measurably good at
    for gid, ply, pattern in [(2, 2, "pin"), (1, 2, "fork"), (1, 4, "pin")]:
        conn.execute("UPDATE moves SET pattern = %s WHERE game_id = %s AND ply = %s", (pattern, gid, ply))
    add_chances(conn, 1, "fork", found=2, missed=38)  # 5%: the weakness
    add_chances(conn, 2, "pin", found=38, missed=2)  # 95%: fine
    deck.sync(conn)
    q = deck.queue(conn, date(2026, 10, 14))
    assert [(r["game_id"], r["ply"]) for r in q] == [(1, 4), (1, 2), (1, 6), (2, 2)]


def test_new_positions_ignore_how_often_a_tactic_merely_comes_up(conn):
    # The base-rate case a raw mistake count gets backwards: pin has far more mistakes than
    # fork, but a much better find rate, so fork is the weakness and must come first.
    add_review_game(conn, 1, played_at="2026-10-10T12:00:00Z")
    conn.execute("UPDATE games SET rated = true")
    add_review_move(conn, 1, 2, cls="mistake")
    add_review_move(conn, 1, 4, cls="mistake")
    conn.execute("UPDATE moves SET pattern = 'pin' WHERE game_id = 1 AND ply = 2")
    conn.execute("UPDATE moves SET pattern = 'fork' WHERE game_id = 1 AND ply = 4")
    add_chances(conn, 1, "pin", found=150, missed=50, ply_start=100)  # 75%, 50 mistakes
    add_chances(conn, 1, "fork", found=10, missed=30, ply_start=600)  # 25%, 30 mistakes
    deck.sync(conn)
    order = [(r["game_id"], r["ply"]) for r in deck.queue(conn, date(2026, 10, 14))][:2]
    assert order == [(1, 4), (1, 2)]


def test_queue_serves_due_cards_before_new_ones(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    add_review_move(conn, 1, 4)
    deck.sync(conn)
    yesterday = date.today() - timedelta(days=1)
    conn.execute("UPDATE cards SET due = %s, reviews = 1 WHERE ply = 4", (yesterday.isoformat(),))
    assert [r["ply"] for r in deck.queue(conn)] == [4, 2]


def test_judge_preserves_required_underpromotion(monkeypatch):
    monkeypatch.undo()  # Exercise the real judge, without needing an engine.
    fen = "8/6P1/5KBk/8/8/8/8/8 w - - 0 1"
    assert deck.judge(fen, "g7g8n", "g7g8n", None) == "best"
    assert deck.judge(fen, "g7g8q", "g7g8n", None) == "wrong"


def test_api_serves_a_card_and_grades_it(db_url, tmp_path):
    path = db_url
    with db.connect(path) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 1, cls="best", is_user=False, color="white", uci="e2e4", best_uci="e2e4")
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(path))

    today = client.get("/api/deck").json()
    assert today["total"] == 1 and today["today"] == {"done": 0, "total": 1}
    card = today["card"]
    assert (card["game_id"], card["ply"], card["san"], card["prev_uci"]) == (1, 2, "g5", "e2e4")
    assert card["fen_prev"] == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    assert "best_uci" not in card  # the answer stays on the server until you've tried

    graded = client.post("/api/deck/answer", json={"game_id": 1, "ply": 2, "uci": "e7e5"}).json()
    assert graded["correct"] and graded["best_san"] == "e5"
    after = client.get("/api/deck").json()
    assert after["card"] is None and after["today"] == {"done": 1, "total": 1}
    [result] = after["results"]
    assert result == {
        "game_id": 1,
        "ply": 2,
        "pattern": "pending",
        "correct": True,
        "mark": "found",
        "san": "g5",
        "opponent": "opp",
        "due": graded["due"],
        "stopped": False,
        "label": None,
    }

    assert client.post("/api/deck/answer", json={"game_id": 9, "ply": 2, "uci": "e7e5"}).status_code == 404
    assert client.post("/api/deck/answer", json={"game_id": 1, "ply": 2, "uci": "nonsense"}).status_code == 422
    assert client.post("/api/deck/hint", json={"game_id": 1, "ply": 2}).json() == {"best_uci": "e7e5", "from": "e7"}
    assert client.post("/api/deck/hint", json={"game_id": 9, "ply": 2}).status_code == 404


def test_skip_counts_as_a_miss(db_url, tmp_path):
    path = db_url
    with db.connect(path) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 1, cls="best", is_user=False, color="white", uci="e2e4", best_uci="e2e4")
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(path))
    client.get("/api/deck")
    skipped = client.post("/api/deck/answer", json={"game_id": 1, "ply": 2, "uci": "0000"}).json()
    assert not skipped["correct"] and skipped["rating"] == "again" and skipped["quality"] == "shown"
    assert [r["correct"] for r in client.get("/api/deck").json()["results"]] == [False]


def test_game_plies_lists_positions_before_they_are_cards(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)  # will be a card
    add_review_move(conn, 1, 4, cls="mistake", second=-20)  # no single better move
    assert deck.game_plies(conn, 1) == [2]
    deck.sync(conn)
    assert deck.game_plies(conn, 1) == [2]


def test_answer_from_game_review_adds_the_card_first(conn):
    # Game review asks before Finish review has synced the deck; the answer still counts.
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    res = deck.answer(conn, 1, 2, "e7e5", today=DAY, now=NOON)
    assert res["correct"] and res["rating"] == "good" and res["due"] == "2026-10-08"
    assert conn.execute("SELECT reviews FROM cards WHERE game_id = 1 AND ply = 2").fetchone()[0] == 1
    with pytest.raises(KeyError):
        deck.answer(conn, 1, 4, "e7e5", today=DAY, now=NOON)


@pytest.mark.skipif(not __import__("shutil").which("stockfish"), reason="stockfish not installed")
def test_judge_accepts_moves_close_to_the_best(monkeypatch):
    monkeypatch.undo()  # the real judge, with Stockfish
    after_e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    assert deck.judge(after_e4, "e7e5", "e7e5", 30) == "best"
    assert deck.judge(after_e4, "c7c5", "e7e5", 30) in ("excellent", "good")  # the Sicilian is fine
    assert deck.judge(after_e4, "g7g5", "e7e5", 30) == "wrong"
    assert deck.judge(after_e4, deck.SKIP, "e7e5", 30) == "shown"
    fools = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    assert deck.judge(fools, "d8h4", "e5e4", 0) == "best"  # any mate counts


def test_a_quick_clean_find_is_easy(conn):
    add_review_game(conn, 1)
    for ply in (2, 4, 6):
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    quick = deck.answer(conn, 1, 2, "e7e5", seconds=6, today=DAY, now=NOON)
    assert quick["rating"] == "easy"
    # FSRS: Easy on a new card is about 8 days, fuzzed as in Anki (6 to 11 over 3,000 draws)
    assert 6 <= (date.fromisoformat(quick["due"]) - DAY).days <= 11
    slow = deck.answer(conn, 1, 4, "e7e5", seconds=40, today=DAY, now=NOON)
    assert slow["rating"] == "good"
    hinted = deck.answer(conn, 1, 6, "e7e5", seconds=3, hinted=True, today=DAY, now=NOON)
    assert hinted["rating"] == "again"
    assert deck.mark("easy", True) == "found"


def test_the_preview_of_each_rating_is_the_date_the_answer_saves(conn):
    add_review_game(conn, 1)
    for ply in (2, 4, 6, 8):
        add_review_move(conn, 1, ply)
    deck.sync(conn)
    answers = {"again": ("g7g5", None), "hard": ("d7d5", None), "good": ("e7e5", 40), "easy": ("e7e5", 6)}
    for ply, (rating, (uci, seconds)) in zip((2, 4, 6, 8), answers.items(), strict=True):
        shown = deck.preview(conn, 1, ply, now=NOON)
        saved = deck.answer(conn, 1, ply, uci, seconds=seconds, today=DAY, now=NOON)
        assert saved["rating"] == rating
        assert shown["next"][rating] == {"due": saved["due"], "mastered": saved["mastered"]}
        assert shown["mastered"] is False
    # A review weeks out is fuzzed, as in Anki, but seeded by the card and its review count:
    # the date shown before the answer is the one it gets.
    later = datetime.fromisoformat(f"{deck.answer(conn, 1, 6, 'e7e5', today=DAY, now=NOON)['due']}T18:00:00+00:00")
    for _ in range(3):
        shown = deck.preview(conn, 1, 6, now=later)
        assert deck.preview(conn, 1, 6, now=later) == shown
        saved = deck.answer(conn, 1, 6, "e7e5", seconds=40, today=later.date(), now=later)
        assert shown["next"]["good"]["due"] == saved["due"]
        later = datetime.fromisoformat(f"{saved['due']}T18:00:00+00:00")
    assert (later.date() - DAY).days > 20


def test_the_deck_uses_tuned_parameters_once_there_are_enough_reviews(conn):
    add_review_game(conn, 1)
    add_review_move(conn, 1, 2)
    deck.sync(conn)
    deck.answer(conn, 1, 2, "e7e5", today=DAY, now=NOON)
    assert deck.tune(conn) == {**deck.tuning(conn), "tuned": False}
    assert deck.tuning(conn)["reviews"] == 1 and not deck.tuning(conn)["personal"]
    assert deck.scheduler(conn) is deck.SCHEDULER
    tuned = [round(p * 1.01, 4) for p in deck.SCHEDULER.parameters]
    conn.execute("INSERT INTO settings (key, value) VALUES ('fsrs_parameters', %s)", (json.dumps(tuned),))
    assert deck.tuning(conn)["personal"]
    assert list(deck.scheduler(conn).parameters) == tuned


def add_reviews(conn, n, start=datetime(2026, 1, 1, tzinfo=UTC)):
    """n graded answers of one card, a day apart from `start`."""
    if not conn.execute("SELECT 1 FROM cards").fetchone():
        add_review_game(conn, 1)
        add_review_move(conn, 1, 2)
        deck.sync(conn)
    conn.executemany(
        """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)
           VALUES (1, 2, %s, 'e7e5', true, 'good')""",
        [((start + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%SZ"),) for i in range(n)],
    )


TUNED = [round(p * 1.01, 4) for p in deck.SCHEDULER.parameters]


@pytest.fixture
def optimizer(monkeypatch):
    """FSRS's optimizer without PyTorch: records the reviews it was given, returns TUNED."""
    import fsrs

    calls = []

    class Optimizer:
        def __init__(self, logs):
            calls.append(len(logs))

        def compute_optimal_parameters(self):
            return TUNED

    monkeypatch.setattr(fsrs, "Optimizer", Optimizer, raising=False)
    return calls


def test_the_worker_tunes_at_the_threshold_then_monthly(conn, optimizer):
    now = datetime(2027, 6, 1, tzinfo=UTC)
    add_reviews(conn, deck.MIN_TUNE_REVIEWS - 1)
    assert not deck.maybe_tune(conn, now, log=lambda _: None)
    assert optimizer == [] and deck.scheduler(conn) is deck.SCHEDULER
    add_reviews(conn, 1, start=datetime(2027, 5, 1, tzinfo=UTC))
    assert deck.maybe_tune(conn, now, log=lambda _: None)
    assert optimizer == [512] and list(deck.scheduler(conn).parameters) == TUNED
    assert deck.tuning(conn)["tuned_reviews"] == 512
    # Not again within RETUNE_DAYS, nor after it without new answers.
    assert not deck.maybe_tune(conn, now + timedelta(days=29), log=lambda _: None)
    assert not deck.maybe_tune(conn, now + timedelta(days=31), log=lambda _: None)
    add_reviews(conn, 1, start=datetime(2027, 6, 2, tzinfo=UTC))
    assert deck.maybe_tune(conn, now + timedelta(days=31), log=lambda _: None)
    assert optimizer == [512, 513]


def test_without_the_optimizer_the_deck_keeps_the_defaults(conn, monkeypatch):
    import fsrs

    monkeypatch.delattr(fsrs, "Optimizer", raising=False)
    monkeypatch.setattr(fsrs, "__getattr__", lambda name: (_ for _ in ()).throw(ImportError("no torch")))
    now = datetime(2027, 6, 1, tzinfo=UTC)
    add_reviews(conn, deck.MIN_TUNE_REVIEWS)
    logged = []
    assert not deck.maybe_tune(conn, now, log=logged.append)
    assert "no torch" in logged[0]
    assert deck.scheduler(conn) is deck.SCHEDULER and not deck.tuning(conn)["personal"]
    # Tried again a week later, not on every daily update.
    assert not deck.tune_due(conn, now + timedelta(days=6))
    assert deck.tune_due(conn, now + timedelta(days=7))


def test_a_failed_tuning_keeps_the_parameters_in_use(conn, optimizer, monkeypatch):
    import fsrs

    now = datetime(2027, 6, 1, tzinfo=UTC)
    add_reviews(conn, deck.MIN_TUNE_REVIEWS)
    assert deck.maybe_tune(conn, now, log=lambda _: None)
    add_reviews(conn, 5, start=datetime(2027, 6, 2, tzinfo=UTC))
    later = now + timedelta(days=31)
    for broken in ([1.0, 2.0], RuntimeError("diverged")):  # unusable parameters, a crash

        class Broken:
            def __init__(self, logs):
                pass

            def compute_optimal_parameters(self, broken=broken):
                if isinstance(broken, Exception):
                    raise broken
                return broken

        monkeypatch.setattr(fsrs, "Optimizer", Broken)
        conn.execute("DELETE FROM settings WHERE key = 'fsrs_tune_failed_at'")
        assert not deck.maybe_tune(conn, later, log=lambda _: None)
        assert list(deck.scheduler(conn).parameters) == TUNED
        assert deck.tuning(conn)["tuned_reviews"] == 512


def test_api_server_day_guards_answer_before_mutation(db_url):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
    client = TestClient(api.create_app(db_url))
    info = client.get('/api/deck').json()
    assert info['server_day'] == date.today().isoformat()
    body = {'game_id': 1, 'ply': 2, 'uci': 'e7e5', 'expected_day': (date.today() - timedelta(days=1)).isoformat()}
    assert client.post('/api/deck/answer', json=body).status_code == 409
    with db.connect(db_url) as c:
        assert c.execute('SELECT count(*) FROM card_reviews').fetchone()[0] == 0
    body['expected_day'] = info['server_day']
    result = client.post('/api/deck/answer', json=body)
    assert result.status_code == 200 and result.json()['rating'] is not None
    body.pop('expected_day')
    assert client.post('/api/deck/answer', json=body).json()['rating'] is None


LINE = ["e2e4", "e7e5", "g1f3"]


@pytest.fixture
def line_card(conn, monkeypatch):
    """A card from the starting position whose solution is the line 1.e4 e5 2.Nf3."""
    import chess

    from knightly import practice_grades, practice_lines

    monkeypatch.setattr(practice_grades, "engine_revision", lambda: "Testfish 1")
    conn.execute(
        """INSERT INTO games (id, source, source_id, played_at, speed, user_color, user_outcome,
           opponent, pgn, moves_san) VALUES (7, 'chesscom', '7', '2026-10-01T12:00:00Z', 'rapid',
           'white', 'loss', 'opp', '', 'd4 d5')"""
    )
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci, best_san,
           best_uci, eval_before, eval_second, classification, win_pct_before)
           VALUES (7, 1, 1, 'white', true, 'opening', 'd4', 'd2d4', 'e4', 'e2e4', 30, -300, 'blunder', 50)"""
    )
    value = {
        "version": practice_lines.VERSION,
        "fen": chess.STARTING_FEN,
        "moves": LINE,
        "key": practice_lines.fingerprint(chess.STARTING_FEN, "e2e4", 30, "Testfish 1"),
    }
    conn.execute("UPDATE moves SET practice_line = %s::jsonb WHERE game_id = 7", (json.dumps(value),))
    deck.sync(conn)
    return practice_lines.key(chess.STARTING_FEN, LINE)


def reviews(conn):
    return conn.execute("SELECT rating, quality, solved, moves FROM card_reviews WHERE game_id = 7").fetchall()


def test_a_correct_move_mid_line_returns_the_reply_and_saves_nothing(conn, line_card):
    step = deck.answer(conn, 7, 1, moves=["e2e4"], line_key=line_card, today=DAY, now=NOON)
    assert step == {"status": "continue", "step": 0, "reply_uci": "e7e5", "reply_san": "e5"}
    assert reviews(conn) == [] and deck.queue(conn, DAY)
    done = deck.answer(conn, 7, 1, moves=LINE, line_key=line_card, seconds=30, today=DAY, now=NOON)
    assert done["status"] == "solved" and done["rating"] == "good" and done["step"] == 1
    assert done["line"] == {"uci": LINE, "san": ["e4", "e5", "Nf3"]}
    assert [tuple(r) for r in reviews(conn)] == [("good", "best", 1, "e2e4 e7e5 g1f3")]


def test_a_wrong_later_move_fails_the_position_and_a_retry_finds_it_with_help(conn, line_card):
    failed = deck.answer(conn, 7, 1, moves=["e2e4", "e7e5", "b1c3"], line_key=line_card, today=DAY, now=NOON)
    assert failed["status"] == "failed" and failed["rating"] == "again"
    assert (failed["best_uci"], failed["best_san"]) == ("g1f3", "Nf3")
    retry = deck.answer(conn, 7, 1, moves=LINE, line_key=line_card, today=DAY, now=NOON)
    assert retry["status"] == "solved" and retry["rating"] is None
    assert [tuple(r)[:3] for r in reviews(conn)] == [("again", "wrong", 1)]
    assert [r["mark"] for r in deck.today_results(conn, DAY)] == ["helped"]


def test_hints_and_time_set_the_grade_of_a_finished_line(conn, line_card):
    assert deck.answer(conn, 7, 1, moves=LINE, line_key=line_card, seconds=15, today=DAY, now=NOON)["rating"] == "easy"
    conn.execute("DELETE FROM card_reviews")
    assert (
        deck.answer(conn, 7, 1, moves=LINE, line_key=line_card, hinted=True, seconds=3, today=DAY, now=NOON)["rating"]
        == "again"
    )


def test_show_solution_mid_line_is_again_and_a_redo_grades_nothing(conn, line_card):
    shown = deck.answer(conn, 7, 1, moves=["e2e4", "e7e5", deck.SKIP], line_key=line_card, today=DAY, now=NOON)
    assert shown["status"] == "shown" and shown["rating"] == "again" and shown["best_uci"] == "g1f3"
    redo = deck.answer(conn, 7, 1, moves=LINE, line_key=line_card, redo=True, today=DAY, now=NOON)
    assert redo["status"] == "solved" and redo["rating"] is None
    assert [tuple(r)[:3] for r in reviews(conn)] == [("again", "shown", 0)]


def test_a_one_move_answer_from_older_clients_is_graded_on_the_first_move(conn, line_card):
    legacy = deck.answer(conn, 7, 1, "e2e4", today=DAY, now=NOON)
    assert legacy["status"] == "solved" and legacy["rating"] == "good" and legacy["line"]["uci"] == ["e2e4"]


def test_api_guards_the_line_before_writing(db_url, line_card):
    import chess

    from knightly import practice_lines

    client = TestClient(api.create_app(db_url))
    card = client.get("/api/deck").json()["card"]
    assert card["line_key"] == practice_lines.key(chess.STARTING_FEN, LINE)
    assert card["line"] == LINE  # served with the position for instant answers
    body = {"game_id": 7, "ply": 1, "line_key": card["line_key"]}
    assert client.post("/api/deck/answer", json={**body, "moves": ["e2e4", "d7d5", "g1f3"]}).status_code == 422
    assert client.post("/api/deck/answer", json={**body, "line_key": "0" * 16, "moves": ["e2e4"]}).status_code == 409
    assert client.post("/api/deck/answer", json={**body, "moves": ["e2e4"], "uci": "e2e4"}).status_code == 422
    with db.connect(db_url) as c:
        assert c.execute("SELECT count(*) FROM card_reviews").fetchone()[0] == 0
    assert client.post("/api/deck/hint", json={**body, "moves": ["e2e4", "e7e5"]}).json() == {
        "best_uci": "g1f3",
        "from": "g1",
    }
    assert client.post("/api/deck/hint", json={**body, "moves": ["e2e4"]}).status_code == 422
    step = client.post("/api/deck/answer", json={**body, "moves": ["e2e4"]}).json()
    assert step["status"] == "continue" and step["reply_uci"] == "e7e5"


def test_a_position_missed_four_times_is_served_as_a_leech(db_url, no_engine):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
        deck.sync(c)
        for day in range(1, 4):  # missed on three days: each one's first answer is a lapse
            when = datetime(2026, 10, day, 18, tzinfo=UTC)
            deck.answer(c, 1, 2, "a7a6", today=date(2026, 10, day), now=when)
    client = TestClient(api.create_app(db_url))
    card = client.get("/api/deck").json()["card"]
    assert (card["lapses"], card["leech"]) == (3, False)
    with db.connect(db_url) as c:
        deck.answer(c, 1, 2, "a7a6", today=date(2026, 10, 4), now=datetime(2026, 10, 4, 18, tzinfo=UTC))
        deck.answer(c, 1, 2, "e7e5", today=date(2026, 10, 4), now=datetime(2026, 10, 4, 19, tzinfo=UTC))
    card = client.get("/api/deck").json()["card"]
    # The same day's retry found it, but that doesn't undo the lapse.
    assert (card["lapses"], card["leech"]) == (4, True)


def test_a_hidden_position_leaves_every_count_and_comes_back_where_it_was(db_url, no_engine):
    with db.connect(db_url) as c:
        add_review_game(c, 1)
        add_review_move(c, 1, 2)
        add_review_move(c, 1, 4)
        deck.sync(c)
        deck.answer(c, 1, 2, "a7a6", today=DAY, now=NOON)  # missed once: due again soon
        before = c.execute("SELECT fsrs, due, reviews, lapses FROM cards WHERE ply = 2").fetchone()
    client = TestClient(api.create_app(db_url))
    assert client.post("/api/deck/suspend", json={"game_id": 1, "ply": 2, "reason": "engine_wrong"}).json() == {
        "suspended": True
    }
    # Again with another reason: still hidden since the first time, for the first reason.
    client.post("/api/deck/suspend", json={"game_id": 1, "ply": 2, "reason": "not_useful"})
    hidden = client.get("/api/deck/suspended").json()
    assert [(h["game_id"], h["ply"], h["reason"], h["san"]) for h in hidden] == [(1, 2, "engine_wrong", "g5")]
    today = client.get("/api/deck").json()
    assert (today["total"], today["suspended"], today["new"]) == (1, 1, 1)
    assert today["card"]["ply"] == 4  # the hidden one isn't served
    with db.connect(db_url) as c:
        assert [r["ply"] for r in deck.queue(c)] == [4]
        assert deck.game_plies(c, 1) == [4]  # game review doesn't ask it either
        assert sum(p["total"] for p in deck.by_pattern(c)) == 1
        # Hiding isn't an answer: no review is recorded.
        assert c.execute("SELECT count(*) FROM card_reviews WHERE ply = 2").fetchone()[0] == 1
    assert client.post("/api/deck/unsuspend", json={"game_id": 1, "ply": 2}).json() == {"suspended": False}
    with db.connect(db_url) as c:
        after = c.execute("SELECT fsrs, due, reviews, lapses FROM cards WHERE ply = 2").fetchone()
        assert tuple(after) == tuple(before)  # the schedule resumes where it was
        assert sorted(r["ply"] for r in deck.queue(c)) == [2, 4]
    assert client.get("/api/deck/suspended").json() == []


def test_hiding_needs_a_known_reason_and_one_of_your_positions(db_url, clerk):  # noqa: F811

    with db.connect(db_url) as owner:
        alice = users.ensure(owner, "user_alice")
        users.ensure(owner, "user_bob")
    conn = db.connect(db_url, migrate=False, user_id=alice)
    with conn:
        add_review_game(conn, 1)
        add_review_move(conn, 1, 2)
        deck.sync(conn)
    conn.close()
    client = TestClient(api.create_app(db_url))
    body = {"game_id": 1, "ply": 2, "reason": "engine_wrong"}
    assert (
        client.post("/api/deck/suspend", json={**body, "reason": "boring"}, headers=as_user("user_alice")).status_code
        == 422
    )
    # Bob can't hide Alice's position: to him it doesn't exist.
    assert client.post("/api/deck/suspend", json=body, headers=as_user("user_bob")).status_code == 404
    assert (
        client.post("/api/deck/unsuspend", json={"game_id": 1, "ply": 2}, headers=as_user("user_bob")).status_code
        == 404
    )
    assert client.get("/api/deck/suspended", headers=as_user("user_alice")).json() == []
    assert client.post("/api/deck/suspend", json=body, headers=as_user("user_alice")).status_code == 200


def test_schedule_health_forecasts_the_week_and_measures_reviews_found(db_url):
    with db.connect(db_url) as c:
        today = db.today(c)
        add_review_game(c, 1)
        for ply, due, fsrs, hidden in [
            (2, -2, True, False),  # overdue: counts today
            (4, 3, True, False),
            (6, None, False, False),  # new: not a review
            (8, 1, True, True),  # hidden
            (10, 8, True, False),
        ]:  # beyond the week
            add_review_move(c, 1, ply)
            c.execute(
                "INSERT INTO cards (game_id, ply, due, fsrs, suspended_at) VALUES (1, %s, %s, %s, %s)",
                (
                    ply,
                    None if due is None else (today + timedelta(days=due)).isoformat(),
                    "{}" if fsrs else None,
                    "2026-10-01T00:00:00Z" if hidden else None,
                ),
            )
        now = datetime.now(UTC)

        def review(ply, days_ago, rating):
            c.execute(
                "INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating) "
                "VALUES (1, %s, %s, 'e7e5', true, %s)",
                (ply, (now - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%SZ"), rating),
            )

        review(2, 25, "again")  # each card's first-ever answer is learning, not remembering
        review(4, 25, "again")
        for n in range(19):
            review(2 if n % 2 else 4, 20 - n, "again" if n < 2 else "good")
        review(10, 45, "good")
        review(10, 40, "again")  # a later answer, but too long ago to count
        health = deck.health(c, today)
        assert [d["due"] for d in health["forecast"]] == [1, 0, 0, 1, 0, 0, 0]
        assert health["forecast"][0]["date"] == today.isoformat()
        assert health["retention"] is None  # 19 answers: too few to say
        review(2, 0, "good")
        assert deck.health(c, today)["retention"] == {"rate": 0.9, "answers": 20, "target": 0.9}
        assert deck.health(c, today)["tuned"] is False
