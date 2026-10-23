"""Endgame shapes: the filters that let the endgame track draw drills from a corpus tagged
by which pieces are left rather than by which technique the position teaches."""

import chess

from knightly import curriculum, endgame_drills, endgames

# Kings and one pawn each, nothing else: where the opposition decides it.
BARE = "8/8/4k3/8/4P3/4K3/8/8 w - - 0 1"
# A passed pawn and a king close enough behind it that the race is the question.
RACE = "8/8/8/4k3/7P/8/8/4K3 w - - 0 1"
# A rook ending: a piece on the board, so simple but never bare.
ROOK = "8/8/8/8/k6P/8/8/R3K3 w - - 0 1"
# A middlegame that happens to have pawns: not an ending at all.
MIDDLE = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"


def test_pieces_left_counts_neither_kings_nor_pawns():
    assert endgames.pieces_left(chess.Board(BARE)) == 0
    assert endgames.pieces_left(chess.Board(ROOK)) == 1
    assert endgames.pieces_left(chess.Board(MIDDLE)) == 14


def test_signature_names_the_material():
    assert endgames.signature(chess.Board(BARE)) == "KP v K"
    assert endgames.signature(chess.Board(ROOK)) == "KRP v K"


def test_simple_separates_an_ending_from_a_middlegame():
    assert endgames.simple(chess.Board(BARE))
    assert endgames.simple(chess.Board(ROOK)), "one piece is still an ending"
    assert not endgames.simple(chess.Board(MIDDLE))


def test_bare_is_stricter_than_simple_because_the_tag_already_means_no_pieces():
    # Lichess's pawnEndgame tag already implies no pieces, so `simple` would be a no-op on
    # it and two lessons would draw the identical pool. `bare` is what separates them.
    assert endgames.bare(chess.Board(BARE))
    assert not endgames.bare(chess.Board(ROOK)), "a rook on the board is not king-and-pawn play"
    crowded = "8/pppppppp/8/8/8/8/PPPPPPPP/4K2k w - - 0 1"
    assert endgames.simple(chess.Board(crowded))
    assert not endgames.bare(chess.Board(crowded)), "eight pawns a side is not a key-square lesson"


def test_passers_ignores_a_pawn_that_is_blocked_or_challenged():
    assert endgames.passers(chess.Board(RACE), chess.WHITE) == [chess.H4]
    blocked = "8/7p/7P/8/k7/8/8/4K3 w - - 0 1"  # h6 faces h7
    assert endgames.passers(chess.Board(blocked), chess.WHITE) == []
    neighbour = "8/6p1/7P/8/k7/8/8/4K3 w - - 0 1"  # g7 covers the h-pawn's path
    assert endgames.passers(chess.Board(neighbour), chess.WHITE) == []


def test_racing_fires_when_the_promotion_race_is_close_and_not_otherwise():
    assert endgames.racing(chess.Board(RACE))
    # The same pawn with the defending king already on the promotion square: no race.
    caught = "7k/8/8/8/7P/8/8/4K3 w - - 0 1"
    assert not endgames.racing(chess.Board(caught))


def test_matches_passes_everything_through_when_a_lesson_asks_for_no_shape():
    assert endgames.matches(MIDDLE, None)
    assert endgames.matches(MIDDLE, "not-a-shape"), "an unknown shape must not silently drop drills"
    assert not endgames.matches(MIDDLE, "simple")


def test_matches_survives_an_unreadable_position():
    assert not endgames.matches("not a fen", "simple")


def test_the_three_endgame_technique_lessons_draw_different_pools():
    # The finding this module exists for: pawn endings and the square of the pawn once drew the
    # identical pool, because Lichess does not tag the technique. Each now leads with its own
    # generated drills (endgame_drills.py).
    lessons = {lesson.key: lesson for w in curriculum.WARDS for lesson in w.lessons}
    leading = {k: lessons[k].themes[0] for k in ("pawn-endings", "square-of-pawn", "key-squares")}
    assert len(set(leading.values())) == 3, leading
    assert set(leading.values()) <= set(endgame_drills.THEMES)


def test_every_shape_a_lesson_names_exists():
    for ward in curriculum.WARDS:
        for lesson in ward.lessons:
            if lesson.shape is not None:
                assert lesson.shape in endgames.SHAPES, f"{lesson.key}: unknown shape {lesson.shape}"
