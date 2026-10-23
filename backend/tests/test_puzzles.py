from datetime import date, timedelta

from conftest import OPENING, insert_game, line_row, write_csv
from fastapi.testclient import TestClient

from knightly import api, db, patterns, practice_lines, puzzles

FORK = "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1"


def row(pid, rating=1200, popularity=95, plays=1000, themes="fork short"):
    return f"{pid},{FORK},e8d8 b5c7,{rating},75,{popularity},{plays},{themes},https://lichess.org/x,\n"


def test_import_keeps_only_good_puzzles_in_our_themes(db_url, tmp_path):
    conn = db.connect(db_url)
    f = write_csv(
        tmp_path / "p.csv",
        [
            row("aaaaa"),
            row("bbbbb", popularity=10),  # disliked
            row("ccccc", plays=20),  # hardly played
            row("ddddd", rating=2900),  # out of range
            row("eeeee", themes="endgame quiet"),  # not a theme we tag
        ],
    )
    kept = puzzles.import_file(conn, f, log=lambda *a: None)
    assert kept["fork"] == 1
    assert [r[0] for r in conn.execute("SELECT puzzle_id FROM lichess_puzzles")] == ["aaaaa"]


def test_practice_serves_puzzles_after_cards_and_grades_them_on_the_server(db_url, tmp_path):
    with db.connect(db_url) as conn:
        puzzles.import_file(
            conn, write_csv(tmp_path / "p.csv", [line_row("aaaaa"), line_row("bbbbb")]), log=lambda *a: None
        )
    client = TestClient(api.create_app(db_url))
    deck = client.get("/api/deck").json()
    assert deck["card"] is None and deck["puzzles"] == {"done": 0, "session": puzzles.SESSION, "available": True}
    puzzle = deck["puzzle"]
    assert client.get("/api/deck").json()["puzzle"] == puzzle  # the same puzzle until answered
    assert (puzzle["prev_uci"], puzzle["fen_prev"], puzzle["color"]) == ("e2e4", OPENING, "black")
    # The solution comes with the puzzle (the app judges instantly); its key names it.
    assert puzzle["line"] == ["e7e5", "g1f3", "b8c6"]
    assert puzzle["line_key"] == practice_lines.key(puzzle["fen_before"], puzzle["line"])
    body = {"id": puzzle["id"], "line_key": puzzle["line_key"]}

    step = client.post("/api/puzzles/answer", json={**body, "moves": ["e7e5"]}).json()
    assert step == {"status": "continue", "step": 0, "reply_uci": "g1f3", "reply_san": "Nf3"}
    assert client.post("/api/puzzles/hint", json={**body, "moves": ["e7e5", "g1f3"]}).json()["best_uci"] == "b8c6"
    failed = client.post("/api/puzzles/answer", json={**body, "moves": ["e7e5", "g1f3", "d7d6"]}).json()
    assert failed["status"] == "failed" and failed["recorded"] and failed["done_today"] == 1
    assert failed["line"] == {"uci": ["e7e5", "g1f3", "b8c6"], "san": ["e5", "Nf3", "Nc6"]}
    retry = client.post("/api/puzzles/answer", json={**body, "moves": ["e7e5", "g1f3", "b8c6"]}).json()
    assert retry["status"] == "solved" and not retry["recorded"]

    after = client.get("/api/deck").json()
    assert after["puzzle"]["id"] != puzzle["id"]
    assert after["puzzle_results"] == [
        {"id": puzzle["id"], "correct": False, "rating": 1200, "themes": ["fork", "short"]}
    ]
    other = after["puzzle"]
    hinted = client.post(
        "/api/puzzles/answer",
        json={"id": other["id"], "line_key": other["line_key"], "moves": ["e7e5", "g1f3", "b8c6"], "hinted": True},
    ).json()
    assert hinted["status"] == "solved" and hinted["recorded"]
    with db.connect(db_url) as conn:
        assert [r[0] for r in conn.execute("SELECT success FROM puzzle_attempts ORDER BY id")] == [False, False]
        assert puzzles.done_today(conn, date.today()) == 2

    assert client.post("/api/puzzles/answer", json={**body, "moves": ["e7e5", "d2d4", "b8c6"]}).status_code == 422
    assert client.post("/api/puzzles/answer", json={**body, "line_key": "0" * 16, "moves": ["e7e5"]}).status_code == 409
    assert client.post("/api/puzzles/answer", json={"id": "zzzzz", "moves": ["e7e5"]}).status_code == 404
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    assert (
        client.post("/api/puzzles/answer", json={**body, "moves": ["e7e5"], "expected_day": yesterday}).status_code
        == 409
    )


def test_puzzle_attempts_belong_to_their_user(db_url, tmp_path):
    from knightly import users

    with db.connect(db_url) as conn:
        puzzles.import_file(conn, write_csv(tmp_path / "p.csv", [line_row("aaaaa")]), log=lambda *a: None)
        puzzles.answer(conn, "aaaaa", ["e7e5", "g1f3", "b8c6"])
    owner = db.connect(db_url)
    other = db.connect(db_url, migrate=False, user_id=users.ensure(owner, "user_other"))
    assert puzzles.done_today(other) == 0
    assert puzzles.idea_puzzle(other)["id"] == "aaaaa"  # still new to them
    other.close()
    owner.close()


# --- families: the same idea somewhere else, next to the card it matches --------------------


def card_row(pid, themes, rating=1200):
    return f"{pid},{FORK},e8d8 b5c7,{rating},75,95,1000,{themes},https://lichess.org/x,\n"


def a_card(conn, gid=1, ply=1, pattern="fork", phase="middlegame"):
    """A game, a mistake of yours carrying `pattern`, and a card on it."""
    insert_game(
        conn,
        gid,
        played_at="2026-10-10T12:00:00Z",
        user_color="white",
        user_outcome="loss",
        moves_san="x",
        rated=True,
        time_control="600",
    )
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
           best_uci, eval_before, eval_second, classification, pattern, win_pct_before)
           VALUES (%s, %s, 1, 'white', true, %s, 'x', 'g7g5', 'e7e5', -50, 300, 'blunder', %s, 50)""",
        (gid, ply, phase, pattern),
    )
    conn.execute("INSERT INTO cards (game_id, ply) VALUES (%s, %s)", (gid, ply))


def answered_today(conn, gid=1, ply=1, when="2026-10-14T09:00:00Z"):
    conn.execute(
        """INSERT INTO card_reviews (game_id, ply, reviewed_at, answer_uci, correct, rating)
           VALUES (%s, %s, %s, 'e7e5', true, 'good')""",
        (gid, ply, when),
    )


def test_a_family_puzzle_carries_the_cards_tactic(db_url, tmp_path):
    with db.connect(db_url) as conn:
        puzzles.import_file(
            conn,
            write_csv(tmp_path / "p.csv", [card_row("forky", "fork middlegame"), card_row("pinny", "pin middlegame")]),
            log=lambda *a: None,
        )
        a_card(conn, pattern="fork")
        got = puzzles.family_puzzle(conn, 1, 1, date(2026, 10, 14))
    assert got["id"] == "forky"


def test_a_card_with_no_nameable_tactic_has_no_family(db_url, tmp_path):
    with db.connect(db_url) as conn:
        puzzles.import_file(
            conn, write_csv(tmp_path / "p.csv", [card_row("forky", "fork middlegame")]), log=lambda *a: None
        )
        a_card(conn, pattern="other")
        assert puzzles.family_puzzle(conn, 1, 1, date(2026, 10, 14)) is None


def test_a_family_prefers_the_cards_phase_but_does_not_require_it(db_url, tmp_path):
    with db.connect(db_url) as conn:
        puzzles.import_file(
            conn,
            write_csv(tmp_path / "p.csv", [card_row("middl", "fork middlegame"), card_row("endga", "fork endgame")]),
            log=lambda *a: None,
        )
        a_card(conn, gid=1, ply=1, phase="endgame")
        assert puzzles.family_puzzle(conn, 1, 1, date(2026, 10, 14))["id"] == "endga"
        # With nothing in that phase the motif alone still carries the idea.
        conn.execute("DELETE FROM lichess_puzzles WHERE puzzle_id = 'endga'")
        assert puzzles.family_puzzle(conn, 1, 1, date(2026, 10, 14))["id"] == "middl"


def test_a_family_is_owed_only_for_a_position_first_answered_today(db_url):
    today = date(2026, 10, 14)
    with db.connect(db_url) as conn:
        a_card(conn, gid=1, ply=1)
        assert puzzles.family_due(conn, today) is None  # not answered yet
        answered_today(conn, 1, 1)
        assert puzzles.family_due(conn, today) == (1, 1)
        # A position answered on an earlier day is a review, not a first meeting.
        a_card(conn, gid=2, ply=1)
        answered_today(conn, 2, 1, when="2026-10-01T09:00:00Z")
        answered_today(conn, 2, 1, when="2026-10-14T09:30:00Z")
        assert puzzles.family_due(conn, today) == (1, 1)


def test_a_family_is_owed_once(db_url, tmp_path):
    today = date(2026, 10, 14)
    with db.connect(db_url) as conn:
        puzzles.import_file(
            conn, write_csv(tmp_path / "p.csv", [card_row("forky", "fork middlegame")]), log=lambda *a: None
        )
        a_card(conn)
        answered_today(conn)
        assert puzzles.family_due(conn, today) == (1, 1)
        puzzles.record(conn, "forky", True, family=(1, 1))
        assert puzzles.family_due(conn, today) is None


def test_solving_a_family_member_is_what_mastery_needs(db_url, tmp_path):
    with db.connect(db_url) as conn:
        puzzles.import_file(
            conn, write_csv(tmp_path / "p.csv", [card_row("forky", "fork middlegame")]), log=lambda *a: None
        )
        a_card(conn)
        assert puzzles.family_solved(conn, 1, 1) is False
        puzzles.record(conn, "forky", False, family=(1, 1))
        assert puzzles.family_solved(conn, 1, 1) is False  # attempted, not solved
        conn.execute("UPDATE puzzle_attempts SET success = true WHERE puzzle_id = 'forky'")
        assert puzzles.family_solved(conn, 1, 1) is True
        assert puzzles.families_solved(conn) == {(1, 1)}


def attempt(conn, pid, success, rating, at):
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, puzzle_rating)
           VALUES (%s, %s, %s, %s, %s)""",
        (puzzles.SOURCE, pid, at, success, rating),
    )


def rated_game(conn, gid, rating, played_at="2026-10-01T12:00:00Z"):
    insert_game(conn, gid, rated=True, user_rating=rating, played_at=played_at)


def test_ability_starts_at_your_game_rating_not_a_flat_default(db_url):
    conn = db.connect(db_url)
    assert puzzles.ability(conn) == puzzles.DEFAULT_TARGET  # no games to read
    for gid in range(1, 6):
        rated_game(conn, gid, 640)
    assert puzzles.ability(conn) == 640


def test_target_is_easier_than_your_ability_by_the_accuracy_gap(db_url):
    conn = db.connect(db_url)
    for gid in range(1, 6):
        rated_game(conn, gid, 1400)
    # A 1400 is served 1159, not 1400: an Elo alone converges on a coin-flip, and practice
    # belongs near TARGET_ACCURACY. The gap is derived, so it cannot drift from the target.
    assert puzzles.target_rating(conn) == 1400 - puzzles.EASIER_BY == 1159
    predicted = 1 / (1 + 10 ** ((puzzles.target_rating(conn) - puzzles.ability(conn)) / 400))
    assert round(predicted, 2) == puzzles.TARGET_ACCURACY


def test_target_never_falls_below_the_corpus(db_url):
    conn = db.connect(db_url)
    for gid in range(1, 6):
        rated_game(conn, gid, 520)  # 520 - 241 is below anything stored
    assert puzzles.target_rating(conn) == puzzles.RATING_RANGE[0]


def test_failures_pull_the_rating_down_where_the_old_median_ignored_them(db_url):
    conn = db.connect(db_url)
    for gid in range(1, 6):
        rated_game(conn, gid, 1200)
    for i in range(10):
        attempt(conn, f"f{i:04d}", False, 1200, f"2026-10-01T12:{i:02d}:00Z")
    assert puzzles.ability(conn) < 1200, "ten straight failures must lower the rating"


def test_successes_raise_it_and_the_two_cancel(db_url):
    conn = db.connect(db_url)
    for gid in range(1, 6):
        rated_game(conn, gid, 1200)
    for i in range(10):
        attempt(conn, f"w{i:04d}", True, 1200, f"2026-10-01T12:{i:02d}:00Z")
    up = puzzles.ability(conn)
    assert up > 1200
    for i in range(10):
        attempt(conn, f"l{i:04d}", False, 1200, f"2026-10-01T13:{i:02d}:00Z")
    down = puzzles.ability(conn)
    # Not back to 1200: Elo is path-dependent, and losing to a 1200 once you are rated 1500
    # costs more than beating one gained. Ten wins then ten losses is evidence of a ceiling,
    # and the rating says so. What must hold is the direction.
    assert down < up and down < 1200


def test_the_first_answers_move_the_rating_fastest(db_url):
    conn = db.connect(db_url)
    for gid in range(1, 6):
        rated_game(conn, gid, 1200)
    attempt(conn, "first", True, 1200, "2026-10-01T12:00:00Z")
    early = puzzles.ability(conn) - 1200
    for i in range(puzzles.PROVISIONAL):
        attempt(conn, f"p{i:04d}", False, 1200, f"2026-10-02T12:{i:02d}:00Z")
    before = puzzles.ability(conn)
    attempt(conn, "late", True, 1200, "2026-10-03T12:00:00Z")
    assert early > puzzles.ability(conn) - before, "a settled rating must move less than a provisional one"


def test_ability_is_replayed_not_stored_so_order_decides(db_url):
    conn = db.connect(db_url)
    for gid in range(1, 6):
        rated_game(conn, gid, 1200)
    attempt(conn, "easy", True, 600, "2026-10-01T12:00:00Z")
    attempt(conn, "hard", False, 1800, "2026-10-01T12:05:00Z")
    once = puzzles.ability(conn)
    assert puzzles.ability(conn) == once, "reading twice must give the same answer"
    # Beating a puzzle 600 below you is worth as little as losing to one 600 above costs, so
    # these two cancel exactly. The rating moves on surprises, not on volume.
    assert once == 1200
    attempt(conn, "upset", False, 600, "2026-10-01T12:10:00Z")
    assert puzzles.ability(conn) < 1150, "losing to a much easier puzzle must cost a lot"


def test_accuracy_reports_the_control_signal_and_stays_quiet_when_thin(db_url):
    conn = db.connect(db_url)
    assert puzzles.accuracy(conn) is None
    for i in range(4):
        attempt(conn, f"a{i:04d}", i < 3, 1000, f"2026-10-01T12:{i:02d}:00Z")
    assert puzzles.accuracy(conn) is None  # under a tenth of the window
    for i in range(6):
        attempt(conn, f"b{i:04d}", True, 1000, f"2026-10-01T13:{i:02d}:00Z")
    assert puzzles.accuracy(conn) == 0.9


def test_puzzle_ratings_belong_to_their_user(db_url):
    from knightly import users

    # Both connections must be user-scoped: an unscoped one connects as the owner and sees
    # every row, which would average the two accounts' ratings rather than isolate them.
    admin = db.connect(db_url)
    one = db.connect(db_url, migrate=False, user_id=users.ensure(admin, "user_one"))
    two = db.connect(db_url, migrate=False, user_id=users.ensure(admin, "user_two"))
    for gid in range(1, 6):
        rated_game(one, gid, 1500)
    for gid in range(100, 105):
        rated_game(two, gid, 700)
    assert puzzles.ability(one) == 1500
    assert puzzles.ability(two) == 700
    attempt(two, "theirs", False, 700, "2026-10-01T12:00:00Z")
    assert puzzles.ability(one) == 1500, "their answer must not move your rating"
    assert puzzles.ability(two) < 700
    one.close()
    two.close()
    admin.close()


def test_the_quota_is_spread_over_rating_bands_not_taken_in_file_order(db_url, tmp_path, monkeypatch):
    # Lichess ships the file in puzzle-id order, so an unstratified quota samples a theme
    # across its whole range: measured on the real file, 4,211 pin puzzles under 900 passed
    # the filters and the corpus stored 119, because pin's median is 1584. Here the easy
    # puzzles come last in the file, so file order alone would keep none of them.
    monkeypatch.setattr(puzzles, "PER_THEME", 4)
    monkeypatch.setattr(puzzles, "BAND_WIDTH", 900)  # two bands: 500-1399 and 1400-2200
    hard = [row(f"h{i:04d}", rating=1600) for i in range(20)]
    easy = [row(f"e{i:04d}", rating=700) for i in range(20)]
    conn = db.connect(db_url)
    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", hard + easy), log=lambda *a: None)
    kept = [r[0] for r in conn.execute("SELECT rating FROM lichess_puzzles ORDER BY rating")]
    assert kept.count(700) == 2 and kept.count(1600) == 2, kept


def test_a_theme_with_no_easy_puzzles_leaves_its_low_band_short(db_url, tmp_path, monkeypatch):
    # En passant starts at 778 and mate in five at 939 on the real file. A thin band must not
    # borrow quota from the bands above it, or the stratification is undone where it matters.
    monkeypatch.setattr(puzzles, "PER_THEME", 4)
    monkeypatch.setattr(puzzles, "BAND_WIDTH", 900)
    conn = db.connect(db_url)
    kept = puzzles.import_file(
        conn, write_csv(tmp_path / "p.csv", [row(f"h{i:04d}", rating=1600) for i in range(20)]), log=lambda *a: None
    )
    assert kept["fork"] == 2, "only the upper band could fill, and it fills to its own quota"


def test_bands_cover_the_whole_rating_range(db_url):
    lo, hi = puzzles.RATING_RANGE
    edges = puzzles.bands()
    assert edges[0] == lo and edges[-1] <= hi
    assert puzzles._band(lo) == lo and puzzles._band(hi) == edges[-1]
    assert puzzles._band(edges[1] - 1) == lo, "a rating one below an edge stays in the band below"


def themed_row(pid, themes, rating=900):
    fen = "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1"
    return f"{pid},{fen},e8d8 b5c7,{rating},75,95,1000,{themes},https://lichess.org/x,\n"


def test_the_ward_decides_which_puzzle_is_served(db_url, tmp_path):
    from knightly import wards

    conn = db.connect(db_url)
    # Ward 1 is the vision drill (own games, no corpus), so the first themed ward is mate in
    # one. Stock a mateIn1 puzzle and an unrelated one it must not prefer.
    puzzles.import_file(
        conn,
        write_csv(tmp_path / "p.csv", [themed_row("mate1", "mateIn1 short"), themed_row("fork1", "fork short")]),
        log=lambda *a: None,
    )
    assert wards.current(conn).ward.key == "board-vision"
    served = puzzles.idea_puzzle(conn)
    # Ward 1 has no corpus themes, so it falls through rather than serving nothing.
    assert served is not None


def test_a_ward_with_corpus_themes_is_preferred_over_the_weakness_order(db_url, tmp_path, monkeypatch):
    from knightly import curriculum, wards

    conn = db.connect(db_url)
    puzzles.import_file(
        conn,
        write_csv(tmp_path / "p.csv", [themed_row("mate1", "mateIn1 short"), themed_row("fork1", "fork short")]),
        log=lambda *a: None,
    )
    # Pretend the learner is on the mate-in-one ward.
    ward = next(w for w in wards.state(conn) if w.ward.key == "mate-in-one")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    assert puzzles.idea_puzzle(conn)["id"] == "mate1"
    assert curriculum.BY_WARD["mate-in-one"].themes == ("mateIn1", "queenMate")


def test_the_served_puzzle_carries_no_extra_keys(db_url, tmp_path, monkeypatch):
    # `ward` and `theme` are reported separately on the deck payload; leaking them onto the
    # puzzle would drift the contract. Tested on the path that adds them.
    from knightly import wards

    conn = db.connect(db_url)
    puzzles.import_file(
        conn, write_csv(tmp_path / "p.csv", [themed_row("mate1", "mateIn1 short")]), log=lambda *a: None
    )
    ward = next(w for w in wards.state(conn) if w.ward.key == "mate-in-one")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    assert wards.ward_puzzle(conn)["ward"] == "mate-in-one", "the ward path does add them"
    served = puzzles.idea_puzzle(conn)
    assert served["id"] == "mate1" and "ward" not in served and "theme" not in served
    assert served["taught"] is True  # marks the post's own idea; the route pops it


def test_the_weakness_fallback_only_knows_the_seven_tagger_themes(db_url, tmp_path):
    # Worth pinning: the corpus is stocked by 49 themes but `patterns.THEMES` is 7, so a
    # puzzle outside them is unreachable once the ward has nothing to serve. The ward path
    # is what makes the other 42 reachable at all.
    conn = db.connect(db_url)
    puzzles.import_file(
        conn, write_csv(tmp_path / "p.csv", [themed_row("mate1", "mateIn1 short")]), log=lambda *a: None
    )
    assert "mateIn1" not in patterns.THEMES
    assert puzzles.idea_puzzle(conn) is None


def test_a_ward_the_corpus_cannot_serve_falls_back_rather_than_serving_nothing(db_url, tmp_path, monkeypatch):
    from knightly import wards

    conn = db.connect(db_url)
    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", [themed_row("fork1", "fork short")]), log=lambda *a: None)
    # A ward whose themes are stocked by nothing: the weakness order must still find the fork.
    ward = next(w for w in wards.state(conn) if w.ward.key == "mate-in-one")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    assert puzzles.idea_puzzle(conn)["id"] == "fork1"


# --- what kind of practice a serving is: the five modes ------------------------------------


def test_the_deck_says_what_kind_of_practice_it_is_serving(db_url, tmp_path):
    # `mode` names the Steps workbook variant a serving corresponds to, so the app can say
    # "same idea, somewhere else" or "no hint this time" rather than inferring it from shape.
    conn = db.connect(db_url)
    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", [themed_row("p1", "fork short")]), log=lambda *a: None)
    with TestClient(api.create_app(db_url)) as client:
        body = client.get("/api/deck").json()
    assert "mode" in body, "always present, even when null"
    # Nothing of the learner's own, so a corpus puzzle fills the slot. The Gatehouse has no
    # corpus themes, so it is the weakness order's fork: more practice, not the post's idea.
    assert body["puzzle"] is not None and body["mode"] == "volume"


def test_mode_is_null_when_there_is_nothing_to_serve(db_url):
    # A review card is the learner's own position rather than a way of serving a ward's
    # idea, and an empty session is not a mode either.
    with TestClient(api.create_app(db_url)) as client:
        body = client.get("/api/deck").json()
    assert body["puzzle"] is None and body["mode"] is None


def test_a_busy_night_still_gives_four_of_ten_items_to_the_posts_idea(db_url, tmp_path, monkeypatch):
    # Twelve reviews due, more than the whole watch: the post's puzzles still take their four
    # slots (mix.SLOTS), so every watch teaches the post, and the reviews fill the rest.
    from conftest import add_review_game, add_review_move

    from knightly import daily, deck, wards

    with db.connect(db_url) as c:
        puzzles.import_file(
            c,
            write_csv(tmp_path / "p.csv", [themed_row(f"m{i}", "mateIn1 short") for i in range(6)]),
            log=lambda *a: None,
        )
        add_review_game(c, 1, played_at="2026-10-01T12:00:00Z")
        for ply in range(2, 26, 2):
            add_review_move(c, 1, ply)
        deck.sync(c)
        c.execute("UPDATE cards SET due = '2000-01-01', reviews = 1")
        ward = next(w for w in wards.state(c) if w.ward.key == "mate-in-one")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    client = TestClient(api.create_app(db_url))
    served = []
    for _ in range(daily.GOAL):
        body = client.get("/api/deck?mode=lesson").json()
        if body["card"]:
            served.append("card")
            card = body["card"]
            client.post("/api/deck/answer", json={"game_id": card["game_id"], "ply": card["ply"], "uci": "e7e5"})
        else:
            served.append(body["mode"])
            client.post("/api/puzzles/answer", json={"id": body["puzzle"]["id"], "moves": ["b5c7"]})
    # Slots 2, 4, 7 and 10 are tonight's idea; the look and review slots have nothing of
    # their own here, so the due reviews fill them.
    assert served == ["card", "taught", "card", "taught", "card", "card", "taught", "card", "card", "taught"]
    done = client.get("/api/deck?mode=lesson").json()
    assert done["lesson"] == {"done": daily.GOAL, "total": daily.GOAL}
    assert done["card"] is None and done["puzzle"] is None


def test_an_early_posts_puzzles_ask_for_one_move_and_fall_back_to_longer(db_url, tmp_path, monkeypatch):
    # The Steps Method deepens calculation step by step: Step 1's lessons are one move.
    from knightly import wards

    long_line = (
        "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1,e8d8 b5c7 d8c8 c7a8,900,75,95,1000,mateIn1 long,https://lichess.org/x,\n"
    )
    conn = db.connect(db_url)
    puzzles.import_file(
        conn,
        write_csv(tmp_path / "p.csv", ["aaaaa," + long_line, themed_row("short", "mateIn1 short")]),
        log=lambda *a: None,
    )
    ward = next(w for w in wards.state(conn) if w.ward.key == "mate-in-one")
    monkeypatch.setattr(wards, "current", lambda conn, at=None: ward)
    assert wards.ward_puzzle(conn)["id"] == "short"
    puzzles.answer(conn, "short", ["b5c7"])
    # With no one-mover left, the longer line still serves rather than nothing.
    assert wards.ward_puzzle(conn)["id"] == "aaaaa"
