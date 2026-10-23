"""Positional reasons, the words the coach was missing above beginner level.

Each test fixes a position where one idea is the obvious thing to say about a move, and
checks both that we say it and that we do not say it when the idea is absent. The negative
half matters more than the positive: a reason that fires on the wrong move teaches a wrong
idea, and the learner has no way to tell.
"""

import chess

from knightly import positional


def reason(fen: str, san: str):
    board = chess.Board(fen)
    return positional.reason(board, board.parse_san(san))


OPENING = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"


def test_castling_is_named_for_the_king_not_the_rook():
    kind, text = reason(OPENING, "O-O")
    assert kind == "kingSafety"
    assert "king" in text and "short" in text


def test_developing_a_minor_piece_off_the_back_rank():
    kind, text = reason(OPENING, "Nc3")
    assert (kind, text) == ("development", "Develops the knight off the back rank.")


def test_a_knight_already_out_is_not_developed_again():
    # Nf3-g5 is a knight move, but the knight left the back rank long ago.
    assert reason(OPENING, "Ng5") is None


# Rooks on d1 and f1 with a lone knight on e1 between them.
APART = "4k3/8/8/8/8/8/8/3RNR1K w - - 0 1"


def test_the_last_piece_out_connects_the_rooks():
    assert reason(APART, "Nc2") == ("connectedRooks", "Connects the rooks.")


def test_a_move_that_leaves_the_rooks_apart_says_nothing_about_them():
    # The king steps aside, but the knight still stands between the rooks.
    assert reason(APART, "Kg2") is None


def test_a_rook_taking_a_file_with_no_pawns_on_it():
    fen = "6k1/pp3ppp/2p5/8/8/2P5/PP3PPP/R5K1 w - - 0 1"
    assert reason(fen, "Rd1") == ("openFile", "Takes the open d-file with the rook.")


def test_a_rook_already_on_the_file_is_not_taking_it():
    """Rd1-d4 is a rook doing something else; saying "takes the open file" would be wrong."""
    fen = "3r2k1/pp3ppp/2p5/8/8/2P5/PP3PPP/3R2K1 w - - 0 1"
    assert reason(fen, "Rd4") is None


def test_a_file_with_our_own_pawn_on_it_is_not_open():
    fen = "6k1/pp3ppp/2p5/8/8/2PP4/PP3PPP/R5K1 w - - 0 1"
    assert reason(fen, "Rd1") is None


def test_a_half_open_file_faces_their_pawn():
    fen = "6k1/pp1p1ppp/2p5/8/8/2P5/PP3PPP/R5K1 w - - 0 1"
    kind, text = reason(fen, "Rd1")
    assert kind == "openFile" and "half-open" in text


def test_a_rook_on_the_seventh_is_named_before_the_file_it_came_down():
    fen = "6k1/pp3ppp/2p5/8/8/2P5/PP3PPP/3R2K1 w - - 0 1"
    kind, text = reason(fen, "Rd7")
    assert kind == "seventhRank" and "seventh" in text


def test_the_seventh_is_only_worth_naming_when_something_is_on_it():
    # Their pawns have all left the seventh and the king is off the back rank.
    fen = "8/5k2/pp3ppp/8/8/2P5/PP3PPP/3R2K1 w - - 0 1"
    assert reason(fen, "Rd7") is None


def test_a_knight_lands_where_no_pawn_can_ever_chase_it():
    # d5 is held by the c4 pawn, and Black has no c- or e-pawn left to attack it.
    fen = "r2qkb1r/pp3ppp/2n2n2/8/2P5/2N5/PP3PPP/R1BQKB1R w KQkq - 0 1"
    kind, text = reason(fen, "Nd5")
    assert kind == "outpost" and "d5" in text


def test_a_square_their_pawn_can_still_attack_is_no_outpost():
    # The same square, but Black keeps the e-pawn that can play ...e6.
    fen = "r2qkb1r/pp2pppp/2n2n2/8/2P5/2N5/PP3PPP/R1BQKB1R w KQkq - 0 1"
    assert reason(fen, "Nd5") is None


def test_an_undefended_square_is_no_outpost():
    # No white pawn holds d5, so the knight is merely visiting.
    fen = "r2qkb1r/pp3ppp/2n2n2/8/8/2N5/PP3PPP/R1BQKB1R w KQkq - 0 1"
    assert reason(fen, "Nd5") is None


def test_a_pawn_push_that_drives_a_piece_back():
    fen = "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 0 1"
    kind, text = reason(fen, "d4")
    assert kind == "space" and "bishop" in text


def test_a_push_that_attacks_nothing_is_not_called_space():
    fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1"
    assert reason(fen, "a3") is None


def test_a_move_we_have_no_word_for_says_nothing():
    """The point of the module is to stay silent rather than invent a reason."""
    assert reason("8/8/4k3/8/8/4K3/8/8 w - - 0 1", "Kd3") is None


def test_an_illegal_move_is_refused_rather_than_guessed_at():
    board = chess.Board()
    assert positional.reason(board, chess.Move.from_uci("e2e5")) is None


def test_a_move_carrying_several_ideas_reports_them_all():
    """`reason` names a move by its sharpest idea, which is the right thing to show and the
    wrong thing to credit on: a rook taking the open file *and* reaching the seventh has done
    both. Crediting on the top idea alone put `seventhRank` at 0% in production."""
    # Ra7-d7 takes the open d-file and reaches the seventh in the same move.
    board = chess.Board("6k1/R4ppp/2p5/8/8/2P5/PP3PPP/R5K1 w - - 0 1")
    move = chess.Move.from_uci("a7d7")
    assert positional.reason(board, move)[0] == "seventhRank"
    assert positional.ideas(board, move) == {"seventhRank", "openFile"}


def test_ideas_is_empty_for_a_move_we_have_no_word_for():
    board = chess.Board("8/8/4k3/8/8/4K3/8/8 w - - 0 1")
    assert positional.ideas(board, board.parse_san("Kd3")) == frozenset()


def test_ideas_refuses_an_illegal_move():
    assert positional.ideas(chess.Board(), chess.Move.from_uci("e2e5")) == frozenset()
