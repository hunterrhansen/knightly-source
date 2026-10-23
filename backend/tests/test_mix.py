"""The watch's mix (mix.py): what each of its items is for."""

import dataclasses

import pytest
from conftest import add_threat_game, write_csv

from knightly import db, deck, drill, mix, puzzles, unannounced, wards


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


def themed_row(pid, themes):
    fen = "r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1"
    return f"{pid},{fen},e8d8 b5c7,900,75,95,1000,{themes},https://lichess.org/x,\n"


def serve(conn, n):
    today = db.today(conn)
    asked, moves = drill.plan(conn, today), unannounced.plan(conn, today)
    return mix.serve(conn, today, n, asked, moves, deck.queue(conn, today), extra_watch=False)


def test_a_watch_of_ten_looks_first_twice_drills_the_idea_four_times_and_reviews_and_revisits_twice_each():
    counts = {kind: mix.SLOTS.count(kind) for kind in (mix.LOOK, mix.IDEA, mix.REVIEW, mix.GAMES)}
    assert counts == {mix.LOOK: 2, mix.IDEA: 4, mix.REVIEW: 2, mix.GAMES: 2}
    assert len(mix.SLOTS) == 10
    # No job twice running, so the watch interleaves rather than blocks.
    assert all(a != b for a, b in zip(mix.SLOTS, mix.SLOTS[1:], strict=False))


def test_mixed_review_serves_an_earlier_posts_idea_unannounced(conn, tmp_path, monkeypatch):
    puzzles.import_file(
        conn,
        write_csv(tmp_path / "p.csv", [themed_row("m1", "mateIn1 short"), themed_row("f1", "fork short")]),
        log=lambda *a: None,
    )
    # Walked on past mate in one: the post after it is current, everything before it cleared.
    states = wards.state(conn)
    at = next(w.index for w in states if w.ward.key == "mate-in-one") + 1
    moved = [
        dataclasses.replace(w, state="cleared" if w.index < at else "current" if w.index == at else "ahead")
        for w in states
    ]
    monkeypatch.setattr(wards, "state", lambda conn, at=None, today=None: moved)
    review_slot = mix.SLOTS.index(mix.REVIEW)
    item = serve(conn, review_slot)
    assert item["puzzle"]["id"] == "m1" and item["mode"] == "review"


def test_mixed_review_before_any_earlier_post_falls_back_rather_than_serving_nothing(conn, tmp_path):
    # At the Gatehouse nothing is behind the learner, and there is no "Your move" yet: the
    # slot still serves, from the next kind with something to give.
    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", [themed_row("f1", "fork short")]), log=lambda *a: None)
    item = serve(conn, mix.SLOTS.index(mix.REVIEW))
    assert item["puzzle"]["id"] == "f1" and item["mode"] == "volume"


# --- the Gatehouse: its idea is taught from your own games ----------------------------------

FREE_ROOK = "3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1"  # Black left the rook loose: Qxd8+


def vision_item(conn, gid):
    """A position from your own game where taking a loose piece was the move (drill.py vision)."""
    add_threat_game(conn, gid, FREE_ROOK, "Qxd8+", f"2026-10-0{gid}T12:00:00Z")
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                              best_uci, classification)
           VALUES (%s, 1, 1, 'white', true, 'middlegame', 'Qa1', 'd1a1', 'd1d8', 'miss')""",
        (gid,),
    )
    drill._prepare_vision(conn, 10)


def test_the_gatehouse_idea_slot_serves_your_own_loose_pieces_before_any_puzzle(conn, tmp_path):
    puzzles.import_file(
        conn, write_csv(tmp_path / "p.csv", [themed_row("h1", "hangingPiece short")]), log=lambda *a: None
    )
    vision_item(conn, 1)
    assert wards.current(conn).ward.key == "board-vision"
    item = serve(conn, mix.SLOTS.index(mix.IDEA))
    assert item["puzzle"] is None and item["mode"] == "defend"
    assert (item["threat"]["kind"], item["threat"]["game_id"]) == ("vision", 1)


def test_once_your_own_run_out_the_gatehouse_teaches_with_loose_piece_puzzles(conn, tmp_path):
    # Before this, a Gatehouse idea slot fell through to the weakness order (here, the fork).
    puzzles.import_file(
        conn,
        write_csv(tmp_path / "p.csv", [themed_row("f1", "fork short"), themed_row("h1", "hangingPiece short")]),
        log=lambda *a: None,
    )
    item = serve(conn, mix.SLOTS.index(mix.IDEA))
    assert item["puzzle"]["id"] == "h1" and item["mode"] == "taught"


def test_loose_piece_puzzles_never_clear_the_gatehouse(conn, tmp_path):
    # Practice themes are volume, not evidence: only the vision drill holds its lessons.
    rows = [themed_row(f"h{i}", "hangingPiece short") for i in range(5)]
    puzzles.import_file(conn, write_csv(tmp_path / "p.csv", rows), log=lambda *a: None)
    for i in range(5):
        puzzles.answer(conn, f"h{i}", ["b5c7"])
    gatehouse = wards.current(conn)
    assert gatehouse.ward.key == "board-vision"
    assert not any(lesson.held for lesson in gatehouse.lessons)
