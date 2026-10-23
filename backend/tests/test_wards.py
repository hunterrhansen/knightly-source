"""Where a learner is in the curriculum, and what moves them along.

The rule under test throughout: a ward clears on retention, never on exposure. Solving
drills is not evidence; still having the idea is.
"""

import json

import pytest
from conftest import add_threat_game, insert_game, write_csv

from knightly import curriculum, db, deck, puzzles, wards

LONG_AGO = {"entered": "2000-01-01", "entered_at": "2000-01-01T00:00:00Z", "cleared": None}


def reach_all(conn):
    db.set_setting(conn, wards.REACHED_SETTING, {w.key: dict(LONG_AGO) for w in curriculum.WARDS})


@pytest.fixture(autouse=True)
def reached_long_ago(db_url):
    """Every post reached long before the evidence these tests add, so they test what holds
    a lesson. The walk itself (only evidence since a post was reached) is tested on its own:
    those tests set the record they start from."""
    with db.connect(db_url) as conn:
        reach_all(conn)


def puzzle_row(pid, rating, themes):
    fen = "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1"
    return f"{pid},{fen},e8d8 b5c7,{rating},75,95,1000,{themes},https://lichess.org/x,\n"


def solved(conn, pid, themes, success=True, at="2026-10-01T12:00:00Z"):
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, themes, puzzle_rating)
           VALUES (%s, %s, %s, %s, %s, 900)""",
        (puzzles.SOURCE, pid, at, success, json.dumps(themes)),
    )


def held_card(conn, gid, ply, pattern, stability=999.0):
    """A card of the learner's own that is held: past the bar and its family met elsewhere."""
    insert_game(conn, gid, rated=True, played_at="2026-10-01T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              best_uci, classification, pattern)
           VALUES (%s, %s, 1, 'white', true, 'middlegame', 'Nf3', 'g1f3', 'g1f3', 'blunder', %s)""",
        (gid, ply, pattern),
    )
    conn.execute(
        "INSERT INTO cards (game_id, ply, fsrs) VALUES (%s, %s, %s)",
        (gid, ply, json.dumps({"stability": stability})),
    )
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, family_game_id, family_ply)
           VALUES (%s, %s, '2026-10-01T12:00:00Z', true, %s, %s)""",
        (puzzles.SOURCE, f"fam{gid}", gid, ply),
    )


def clear_ward_one(conn):
    """Hold ward 1's vision lessons, so a test can start where the themed wards begin."""
    from knightly import drill

    add_threat_game(conn, 900, "3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1", "Qxd8+", "2026-10-01T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              best_uci, classification)
           VALUES (900, 1, 1, 'white', true, 'middlegame', 'Qa1', 'd1a1', 'd1d8', 'miss')"""
    )
    drill._prepare_vision(conn, 10)
    for _ in range(wards.BASIC_VOLUME):
        conn.execute(
            """INSERT INTO threat_reviews (game_id, ply, reviewed_at, answer, correct, rating)
               VALUES (900, 1, iso_now(), 'd1d8', true, 'good')"""
        )


def test_everyone_starts_at_the_first_ward(db_url):
    conn = db.connect(db_url)
    assert wards.entry(conn) == wards.FIRST_WARD == 1
    # Rating must not place anyone: it is a Chess.com scale and the wards are measured on a
    # Lichess one, and placing by p10 sent a 1400 straight past the whole curriculum.
    assert wards.entry(conn, at=1800) == 1
    assert wards.entry(conn, at=500) == 1


def test_a_ward_with_no_drills_at_all_would_block_rather_than_clear_or_trap():
    # Ward 1 has drills now (the vision kind), so this exercises the rule directly: a ward
    # nothing can serve must not read as cleared (claiming an untaught idea) and must not be
    # current (nothing to serve, so the learner never moves).
    empty = curriculum.Ward("empty", "Nothing to serve", (curriculum.Lesson("x", "X", "tactic", "1"),))
    state = wards.WardState(empty, 1, "blocked", (wards.LessonState(empty.lessons[0], False, 0),))
    assert not state.servable and not state.cleared


def test_three_solves_of_a_theme_hold_its_lesson(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    start = wards.current(conn)
    assert start.ward.key == "mate-in-one"
    for i in range(wards.BASIC_VOLUME):
        solved(conn, f"m{i}", ["mateIn1"])
    assert wards.current(conn).ward.key != "mate-in-one", "the ward should have cleared"


def test_fewer_than_three_solves_is_not_enough(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    for i in range(wards.BASIC_VOLUME - 1):
        solved(conn, f"m{i}", ["mateIn1"])
    assert wards.current(conn).ward.key == "mate-in-one"


def test_failures_do_not_count_toward_holding(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    for i in range(5):
        solved(conn, f"m{i}", ["mateIn1"], success=False)
    assert wards.current(conn).ward.key == "mate-in-one"


def test_a_held_card_of_your_own_holds_the_lesson_without_any_puzzles(db_url):
    # The other route: you kept the idea from your own game. deck.holds is the same test a
    # star uses -- stability past the bar and a family member solved somewhere else.
    conn = db.connect(db_url)
    held_card(conn, 1, 1, "mate")
    lessons = {lesson.lesson.key: lesson for lesson in wards.state(conn)[1].lessons}
    assert lessons["mate-in-one"].solves == 0
    held = [lesson.lesson.key for lesson in wards.state(conn)[1].lessons if lesson.held]
    assert held == [], "the 'mate' pattern is not the mateIn1 theme; only its own theme holds it"


def test_a_card_short_of_the_bar_does_not_hold_a_lesson(db_url):
    conn = db.connect(db_url)
    held_card(conn, 1, 1, "fork", stability=deck.MASTERED_DAYS - 1)
    ward = next(w for w in wards.state(conn) if w.ward.key == "double-attack")
    assert not any(lesson.held for lesson in ward.lessons)


def test_clearing_a_ward_moves_the_drills_on(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    mates = {"mateIn1", "queenMate"}  # the mate-in-one post's two lessons
    before = wards.drill_themes(conn)
    assert before and all(theme in mates for theme, _ in before)
    for i in range(wards.BASIC_VOLUME):
        solved(conn, f"m{i}", ["mateIn1"])
    after = wards.drill_themes(conn)
    assert after and all(theme not in mates for theme, _ in after)


def test_unheld_lessons_are_drilled_before_held_ones(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    for key, theme in (("m", "mateIn1"), ("h", "hangingPiece"), ("a", "activity"), ("f", "fork")):
        for i in range(wards.BASIC_VOLUME):
            solved(conn, f"{key}{i}", [theme])  # clear wards 2, 3 and 4
    ward = wards.current(conn)
    assert ward.ward.key == "mate-in-two"  # mate in two (with the back rank) and the rook mate
    for i in range(wards.BASIC_VOLUME):
        solved(conn, f"b{i}", ["backRankMate"])
    # Mate in two is held now (by its back-rank puzzles), so it must not be drilled first --
    # but it stays in the list,
    # since a nearly finished ward still has to have something to serve.
    themes = [theme for theme, _ in wards.drill_themes(conn)]
    assert themes[0] != "backRankMate" and "backRankMate" in themes


def test_a_lesson_with_no_drills_does_not_park_the_learner_forever(db_url, monkeypatch):
    # Every lesson has drills today, but a new one may land before its drills do; gating on it
    # would stop the curriculum dead. The mini plan stands in for it here.
    import dataclasses

    def bare(ward):
        if ward.key != "mini-plan":
            return ward
        return dataclasses.replace(ward, lessons=(dataclasses.replace(ward.lessons[0], themes=()), *ward.lessons[1:]))

    monkeypatch.setattr(curriculum, "WARDS", tuple(bare(w) for w in curriculum.WARDS))
    conn = db.connect(db_url)
    for i in range(wards.BASIC_VOLUME):
        solved(conn, f"i{i}", ["rookPawn"])
    plan = next(w for w in wards.state(conn) if w.ward.key == "mini-plan")
    assert not all(lesson.held for lesson in plan.lessons), "the mini plan has no drills, so it is unheld"
    assert plan.cleared, "but the ward still clears on the lesson that can be taught"


def test_a_ward_puzzle_respects_the_lessons_shape(db_url, tmp_path):
    conn = db.connect(db_url)
    # A pawn ending that is not bare: eight pawns a side, so the key-squares shape rejects it.
    crowded = "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1"
    row = f"xxxxx,{crowded},e1e2 e8e7,900,75,95,1000,pawnEndgame,https://lichess.org/x,\n"
    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", [row]), log=lambda *a: None)
    from knightly import endgames

    assert endgames.matches(crowded, "simple")
    assert not endgames.matches(crowded, "bare"), "the key-squares lesson must not accept it"


def test_ward_progress_belongs_to_its_user(db_url):
    from knightly import users

    admin = db.connect(db_url)
    one = db.connect(db_url, migrate=False, user_id=users.ensure(admin, "ward_one"))
    two = db.connect(db_url, migrate=False, user_id=users.ensure(admin, "ward_two"))
    reach_all(one)
    reach_all(two)
    clear_ward_one(one)
    for i in range(wards.BASIC_VOLUME):
        solved(one, f"m{i}", ["mateIn1"])
    assert wards.current(one).ward.key not in ("board-vision", "mate-in-one")
    assert wards.current(two).ward.key == "board-vision", "their answers must not move your ward"
    one.close()
    two.close()
    admin.close()


def test_a_puzzle_solved_on_lichess_counts_as_evidence(db_url):
    # puzzles.ability has always counted every source; this filtered to ours, so the two
    # disagreed. Production: 295 Lichess attempts against 26 of ours, 269 solves invisible,
    # and a learner with a 1544 puzzle ability was served mate in one.
    conn = db.connect(db_url)
    for i in range(wards.BASIC_VOLUME):
        conn.execute(
            """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, themes, puzzle_rating)
               VALUES ('lichess', %s, iso_now(), true, %s, 900)""",
            (f"L{i}", json.dumps(["mateIn1"])),
        )
    assert wards.current(conn).ward.key != "mate-in-one"


def test_solves_older_than_the_window_do_not_hold_a_lesson(db_url):
    # Holding an idea is a claim about now: a year-old solve must not skip the ward.
    from datetime import date, timedelta

    from knightly import patterns

    conn = db.connect(db_url)
    clear_ward_one(conn)
    stale = (date.today() - timedelta(days=patterns.RECENT_DAYS + 10)).isoformat() + "T12:00:00Z"
    for i in range(wards.BASIC_VOLUME + 2):
        conn.execute(
            """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, themes, puzzle_rating)
               VALUES ('lichess', %s, %s, true, %s, 900)""",
            (f"old{i}", stale, json.dumps(["mateIn1"])),
        )
    assert wards.current(conn).ward.key == "mate-in-one"


def test_ward_one_is_served_by_its_own_drill_rather_than_the_corpus(db_url):
    # Board vision, attacking and defending and the profitable exchange have no Lichess
    # theme between them; the vision drill is what makes the ward servable at all.
    conn = db.connect(db_url)
    first = wards.state(conn)[0]
    assert first.ward.key == "board-vision"
    assert all(lesson.lesson.drill == "vision" for lesson in first.lessons)
    assert first.servable, "a drill of our own counts as servable"
    assert first.state == "current", "no longer blocked: it has drills now"


def test_correct_vision_answers_hold_ward_one(db_url):
    from knightly import drill

    conn = db.connect(db_url)
    add_threat_game(conn, 1, "3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1", "Qxd8+", "2026-10-01T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              best_uci, classification)
           VALUES (1, 1, 1, 'white', true, 'middlegame', 'Qa1', 'd1a1', 'd1d8', 'miss')"""
    )
    drill._prepare_vision(conn, 10)
    assert wards.current(conn).ward.key == "board-vision"
    for _ in range(wards.BASIC_VOLUME):
        conn.execute(
            """INSERT INTO threat_reviews (game_id, ply, reviewed_at, answer, correct, rating)
               VALUES (1, 1, iso_now(), 'd1d8', true, 'good')"""
        )
    assert wards.current(conn).ward.key != "board-vision", "three right answers hold the ward"


def vision_chances(conn, taken: int, missed: int):
    """Verified free-capture items from past games, with what was actually played."""
    from knightly import drill

    fen = "3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1"
    for i in range(taken + missed):
        gid = 500 + i
        add_threat_game(conn, gid, fen, "Qxd8+", "2026-10-01T12:00:00Z")
        played = "d1d8" if i < taken else "d1a1"  # took it, or played something else
        conn.execute(
            """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                                  best_uci, classification)
               VALUES (%s, 1, 1, 'white', true, 'middlegame', 'Q', %s, 'd1d8', 'miss')""",
            (gid, played),
        )
        drill._prepare_vision(conn, 1)


def test_your_games_can_hold_a_lesson_the_drill_teaches(db_url):
    # 91% of free captures taken at the board is better evidence than the drill's whole
    # volume: what the games show needs one page here (Steps' real gate is the games).
    conn = db.connect(db_url)
    vision_chances(conn, taken=11, missed=1)
    assert wards.current(conn).ward.key == "board-vision", "it still has to be shown here"
    item = conn.execute("SELECT game_id, ply FROM threat_cards WHERE kind = 'vision' LIMIT 1").fetchone()

    def answer():
        conn.execute(
            """INSERT INTO threat_reviews (game_id, ply, reviewed_at, answer, correct, rating)
               VALUES (%s, %s, iso_now(), 'd1d8', true, 'good')""",
            (item["game_id"], item["ply"]),
        )

    for _ in range(wards.PAGE - 1):
        answer()
    assert wards.current(conn).ward.key == "board-vision", "less than a page"
    answer()
    assert wards.current(conn).ward.key != "board-vision"


def test_a_poor_in_game_rate_does_not_hold_it(db_url):
    conn = db.connect(db_url)
    vision_chances(conn, taken=5, missed=7)
    assert wards.current(conn).ward.key == "board-vision"


def test_too_few_chances_cannot_hold_it_however_good_the_rate(db_url):
    # A share means nothing over three chances, however flattering it looks.
    conn = db.connect(db_url)
    vision_chances(conn, taken=3, missed=0)
    assert wards.current(conn).ward.key == "board-vision"


def cleared(*keys: str, day: str = "2026-10-05") -> dict:
    return {key: {"entered": day, "cleared": day} for key in keys}


def test_a_ward_that_slips_stays_cleared_and_keeps_its_day(db_url):
    from datetime import date

    conn = db.connect(db_url)
    db.set_setting(conn, wards.REACHED_SETTING, {"board-vision": dict(LONG_AGO)})
    clear_ward_one(conn)
    first = {w["key"]: w for w in wards.path(conn, date(2026, 10, 10))}
    assert first["board-vision"]["state"] == "cleared"
    assert first["board-vision"]["cleared_on"] == "2026-10-10"
    assert first["mate-in-one"]["entered_on"] == "2026-10-10"
    assert first["mate-in-one"]["cleared_on"] is None
    # The vision lesson stops being held (its answers are gone). The walk moves forward
    # only: the post stays cleared, with the day it first cleared, and the learner stays on.
    conn.execute("DELETE FROM threat_reviews")
    later = {w["key"]: w for w in wards.path(conn, date(2026, 10, 12))}
    assert later["board-vision"]["state"] == "cleared"
    assert later["board-vision"]["cleared_on"] == "2026-10-10"
    assert later["mate-in-one"]["state"] == "current"


def test_a_rank_castle_stands_after_every_third_ward_and_is_never_lost(db_url):
    conn = db.connect(db_url)
    db.set_setting(conn, wards.REACHED_SETTING, cleared("board-vision", "mate-in-one"))
    assert wards.post_ranks(conn) == {}
    db.set_setting(
        conn,
        wards.REACHED_SETTING,
        {**cleared("board-vision", "mate-in-one"), **cleared("loose-pieces", day="2026-10-07")},
    )
    # Reached on the last of the three wards' first clears.
    assert wards.post_ranks(conn) == {"squire-1": "2026-10-07"}
    from knightly import watch

    ranks = {r["key"]: r["reached_on"] for r in watch.journey(conn, db.today(conn))["ranks"]}
    assert ranks["squire-1"] == "2026-10-07"
    # Even if the record were lost, a rank once reached stays (watch.RANKS_SETTING).
    db.set_setting(conn, wards.REACHED_SETTING, {})
    ranks = {r["key"]: r["reached_on"] for r in watch.journey(conn, db.today(conn))["ranks"]}
    assert ranks["squire-1"] == "2026-10-07"


def test_a_ward_nothing_can_serve_never_counts_for_or_against_a_rank(db_url, monkeypatch):
    conn = db.connect(db_url)
    blocked = curriculum.Ward("mate-in-one", "Nothing to serve", (curriculum.Lesson("x", "X", "tactic", "1"),))
    monkeypatch.setattr(curriculum, "WARDS", (curriculum.WARDS[0], blocked, *curriculum.WARDS[2:]))
    db.set_setting(conn, wards.REACHED_SETTING, cleared("board-vision", "loose-pieces"))
    assert wards.post_ranks(conn) == {"squire-1": "2026-10-05"}


def test_wards_reached_belong_to_their_learner(db_url):
    from knightly import users

    conn = db.connect(db_url)
    db.set_setting(conn, wards.REACHED_SETTING, cleared("board-vision", "mate-in-one", "loose-pieces"))
    owner = db.connect(db_url)
    other = db.connect(db_url, migrate=False, user_id=users.ensure(owner, "user_other"))
    assert db.get_setting(other, wards.REACHED_SETTING) is None
    assert wards.post_ranks(other) == {}
    other.close()
    owner.close()


# --- the estimate, not the count ------------------------------------------------------------


def solved_at(conn, pid, themes, rating, success=True):
    conn.execute(
        """INSERT INTO puzzle_attempts (source, puzzle_id, attempted_at, success, themes, puzzle_rating)
           VALUES ('lichess', %s, iso_now(), %s, %s, %s)""",
        (pid, success, json.dumps(themes), rating),
    )


def lesson_state(conn, key):
    return next(lesson for w in wards.state(conn) for lesson in w.lessons if lesson.lesson.key == key)


def test_a_lesson_is_held_only_after_its_basic_volume(db_url):
    # The Steps bar: a lesson's basic workbook (about three pages) answered, not three solves.
    conn = db.connect(db_url)
    clear_ward_one(conn)
    for i in range(wards.BASIC_VOLUME - 1):
        solved_at(conn, f"w{i}", ["mateIn1"], 900)
    state = lesson_state(conn, "mate-in-one")
    assert (state.answered, state.page_right, state.held) == (wards.BASIC_VOLUME - 1, wards.PAGE, False)
    solved_at(conn, "last", ["mateIn1"], 900)
    assert lesson_state(conn, "mate-in-one").held


def test_three_misses_on_the_last_page_keep_a_lesson_unheld(db_url):
    # 80% of a page is at the level; three misses on a page means another pass.
    conn = db.connect(db_url)
    clear_ward_one(conn)
    for i in range(wards.BASIC_VOLUME - 3):
        solved_at(conn, f"r{i}", ["mateIn1"], 900)
    for i in range(3):
        solved_at(conn, f"x{i}", ["mateIn1"], 900, success=False)
    state = lesson_state(conn, "mate-in-one")
    assert state.answered == wards.BASIC_VOLUME and state.page_right == wards.PAGE - 3 and not state.held
    # The misses stay on the page until enough right answers push the first one off it.
    for i in range(wards.PAGE - 3):
        solved_at(conn, f"a{i}", ["mateIn1"], 900)
    assert not lesson_state(conn, "mate-in-one").held
    solved_at(conn, "a-last", ["mateIn1"], 900)
    assert lesson_state(conn, "mate-in-one").held


def test_uncertainty_narrows_as_evidence_arrives(db_url):
    conn = db.connect(db_url)
    blank = lesson_state(conn, "mate-in-one")
    assert blank.sigma == wards.SIGMA_0 and blank.probe == 1.0, "no evidence: a pure guess"
    for i in range(10):
        solved_at(conn, f"w{i}", ["mateIn1"], 1000)
    seen = lesson_state(conn, "mate-in-one")
    assert seen.sigma < blank.sigma and seen.probe < 1.0
    assert seen.sigma >= wards.SIGMA_FLOOR, "a long history is strong evidence, not certainty"


def test_an_unmet_idea_inherits_your_overall_ability_as_its_prior(db_url):
    # Absent evidence about deflection specifically, the best guess is that you are as good
    # at it as at everything else -- the prior patterns.weakness shrinks thin motifs toward.
    conn = db.connect(db_url)
    for i in range(10):
        solved_at(conn, f"x{i}", ["fork"], 1500)
    overall = puzzles.ability(conn)
    assert lesson_state(conn, "deflection").theta == float(overall)


def test_failures_lower_the_estimate(db_url):
    conn = db.connect(db_url)
    before = lesson_state(conn, "mate-in-one").theta
    for i in range(6):
        solved_at(conn, f"f{i}", ["mateIn1"], 900, success=False)
    assert lesson_state(conn, "mate-in-one").theta < before


def test_the_biggest_gap_is_drilled_first_and_an_unknown_idea_still_gets_a_turn(db_url):
    # Without the probe term an idea nobody has evidence about never gets picked: its
    # estimate sits at the learner's overall ability and so never looks like a deficit.
    from knightly import curriculum

    easy = wards.LessonState(
        curriculum.Lesson("a", "A", "tactic", "2", ("fork",)), False, solves=9, theta=1500.0, sigma=60.0, bar=1000.0
    )
    behind = wards.LessonState(
        curriculum.Lesson("b", "B", "tactic", "2", ("pin",)), False, solves=9, theta=900.0, sigma=60.0, bar=1400.0
    )
    unknown = wards.LessonState(
        curriculum.Lesson("c", "C", "tactic", "2", ("skewer",)), False, solves=0, theta=1200.0, sigma=350.0, bar=1200.0
    )
    assert wards.priority(behind) > wards.priority(unknown) > wards.priority(easy)
    ward = wards.WardState(curriculum.Ward("w", "W", ()), 1, "current", (easy, unknown, behind))
    assert [t for t, _ in wards._themes_of(ward)] == ["pin", "skewer", "fork"]


def test_held_lessons_are_still_served_last_rather_than_dropped(db_url):
    from knightly import curriculum

    done = wards.LessonState(
        curriculum.Lesson("a", "A", "tactic", "2", ("fork",)), True, solves=9, theta=1800.0, sigma=60.0, bar=1000.0
    )
    todo = wards.LessonState(
        curriculum.Lesson("b", "B", "tactic", "2", ("pin",)), False, solves=1, theta=900.0, sigma=200.0, bar=1400.0
    )
    ward = wards.WardState(curriculum.Ward("w", "W", ()), 1, "current", (done, todo))
    assert [t for t, _ in wards._themes_of(ward)] == ["pin", "fork"]


def test_solves_from_before_a_post_was_reached_never_clear_it(db_url):
    # 325 puzzles solved before the wards existed once cleared six posts on launch day: the
    # walk starts at the first post and history skips none of them.
    conn = db.connect(db_url)
    db.set_setting(conn, wards.REACHED_SETTING, {})
    for i in range(10):
        solved(conn, f"m{i}", ["mateIn1"])
    assert wards.current(conn).ward.key == "board-vision"
    reached = db.get_setting(conn, wards.REACHED_SETTING)
    assert list(reached) == ["board-vision"], "only the post the learner is at is reached"


def test_solves_after_a_post_is_reached_clear_it_and_reach_the_next(db_url):
    conn = db.connect(db_url)
    # At the Drawbridge, reached before tonight's solves.
    db.set_setting(
        conn,
        wards.REACHED_SETTING,
        {
            "board-vision": {"entered": "2026-09-01", "entered_at": "2026-09-01T00:00:00Z", "cleared": "2026-09-02"},
            "mate-in-one": {"entered": "2026-09-02", "entered_at": "2026-09-02T00:00:00Z", "cleared": None},
        },
    )
    assert wards.current(conn).ward.key == "mate-in-one"
    for i in range(wards.BASIC_VOLUME):
        solved(conn, f"m{i}", ["mateIn1"])
    assert wards.current(conn).ward.key == "loose-pieces"
    # The Armoury is reached now, so the forks and hanging pieces solved before it wait.
    assert "entered_at" in db.get_setting(conn, wards.REACHED_SETTING)["loose-pieces"]


def test_a_post_once_cleared_stays_cleared(db_url):
    # The record moves forward only: evidence ageing out of the window never walks a learner
    # back to the Gatehouse.
    conn = db.connect(db_url)
    db.set_setting(
        conn,
        wards.REACHED_SETTING,
        {
            "board-vision": {"entered": "2026-09-01", "entered_at": "2026-09-01T00:00:00Z", "cleared": "2026-09-02"},
            "mate-in-one": {"entered": "2026-09-02", "entered_at": "2026-09-02T00:00:00Z", "cleared": None},
        },
    )
    states = {w.ward.key: w.state for w in wards.state(conn)}
    assert states["board-vision"] == "cleared" and states["mate-in-one"] == "current"


def test_a_lesson_your_games_hold_still_needs_one_page_here(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    held_card(conn, 1, 2, "mateIn1")
    assert wards.current(conn).ward.key == "mate-in-one", "a held card alone does not skip the post"
    for i in range(wards.PAGE - 1):
        solved_at(conn, f"m{i}", ["mateIn1"], 900)
    assert wards.current(conn).ward.key == "mate-in-one", "less than a page"
    solved_at(conn, "m-last", ["mateIn1"], 900)
    assert wards.current(conn).ward.key != "mate-in-one"


def test_a_passed_lessons_reviews_space_out_when_right_and_start_over_when_wrong(db_url, monkeypatch):
    import dataclasses
    from datetime import date

    conn = db.connect(db_url)
    states = wards.state(conn)
    at = next(w.index for w in states if w.ward.key == "mate-in-one") + 1
    moved = [
        dataclasses.replace(w, state="cleared" if w.index < at else "current" if w.index == at else "ahead")
        for w in states
    ]
    monkeypatch.setattr(wards, "state", lambda conn, at=None, today=None: moved)
    db.set_setting(conn, wards.REACHED_SETTING, {"mate-in-one": {"entered": "2026-09-20", "cleared": "2026-10-01"}})
    today = date(2026, 10, 20)

    def due(key):
        return next(d for d, lesson in wards.review_schedule(conn, today) if lesson.lesson.key == key)

    assert due("mate-in-one") == date(2026, 10, 3), "first review two days after the post cleared"
    solved(conn, "r1", ["mateIn1"], at="2026-10-03T12:00:00Z")
    solved(conn, "r2", ["mateIn1"], at="2026-10-07T12:00:00Z")
    assert due("mate-in-one") == date(2026, 10, 15), "two right in a row: eight days on"
    solved(conn, "r3", ["mateIn1"], success=False, at="2026-10-15T12:00:00Z")
    assert due("mate-in-one") == date(2026, 10, 17), "a miss starts it over"


def chances_in_games(conn, motif, *, found, missed, gid=700):
    """Clear chances for `motif` in a recent rated game: `found` taken, `missed` not."""
    from conftest import insert_game

    insert_game(conn, gid, rated=True, played_at=days_ago_iso(5))
    for ply in range(1, found + missed + 1):
        conn.execute(
            """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                                  best_uci, classification, chance_motif, chance_found)
               VALUES (%s, %s, %s, 'white', true, 'middlegame', 'Nf3', 'g1f3', 'g1f3', 'best', %s, %s)""",
            (gid, ply, ply, motif, ply <= found),
        )


def days_ago_iso(n):
    from datetime import UTC, datetime, timedelta

    return (datetime.now(UTC) - timedelta(days=n)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_games_that_keep_missing_an_idea_keep_its_lesson_open_whatever_the_puzzles_say(db_url):
    # Steps' real gate: still missing the mate at the board means not ready to move on.
    conn = db.connect(db_url)
    clear_ward_one(conn)
    for i in range(wards.BASIC_VOLUME):
        solved_at(conn, f"m{i}", ["mateIn1"], 900)
    assert lesson_state(conn, "mate-in-one").held, "the puzzles alone would hold it"
    chances_in_games(conn, "mate", found=5, missed=wards.GAMES_AGAINST_ENOUGH - 5)
    state = lesson_state(conn, "mate-in-one")
    assert (state.games, state.game_found, state.game_chances) == ("not_yet", 5, wards.GAMES_AGAINST_ENOUGH)
    assert not state.held


def test_games_that_show_an_idea_hold_its_lesson_with_one_page(db_url):
    conn = db.connect(db_url)
    clear_ward_one(conn)
    chances_in_games(conn, "mate", found=9, missed=1)
    for i in range(wards.PAGE - 1):
        solved_at(conn, f"m{i}", ["mateIn1"], 900)
    assert not lesson_state(conn, "mate-in-one").held, "less than a page"
    solved_at(conn, "m-last", ["mateIn1"], 900)
    state = lesson_state(conn, "mate-in-one")
    assert state.games == "yes" and state.held
