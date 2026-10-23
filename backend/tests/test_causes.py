import chess
import chess.engine

from knightly import causes

# White's knight on e4 is already attacked by Black's d5 pawn.
THREATENED = "7k/8/8/3p4/4N3/8/8/K7 w - - 0 1"
KNIGHT_THREAT = [{"uci": "d5e4", "san": "dxe4", "line": ["d5e4"], "net": 3, "mate": None}]


def test_missed_threat_when_the_punishing_reply_was_already_threatened():
    found = causes.cause(chess.Board(THREATENED), "a1a2", KNIGHT_THREAT, ["d5e4"], None)
    assert found["cause_kind"] == "missedThreat"
    assert found["cause_text"] == ("They were already threatening dxe4 to win your knight. Your move didn't stop it.")
    assert (found["reply_san"], found["principle"]) == ("dxe4", "blunderCheck")


def test_no_missed_threat_for_another_reply_an_unknown_threat_or_a_pawn():
    board = chess.Board(THREATENED)
    # The engine punishes with a different move: the move created a new problem.
    assert causes.cause(board, "a1a2", KNIGHT_THREAT, ["h8g8"], None) is None
    # Capped threat search: unknown is never evidence. The knight was loose before the move,
    # so it isn't a loose-piece cause either.
    assert causes.cause(board, "a1a2", None, ["d5e4"], None) is None
    # Only a pawn hangs: nothing wins two points.
    pawn = "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1"
    assert causes.cause(chess.Board(pawn), "a1a2", [], ["d5e4"], None) is None


def test_back_rank_mate_and_a_smothered_mate_that_is_not_one():
    back_rank = chess.Board("r5k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1")
    found = causes.cause(back_rank, "g1h1", [], ["a8a1"], 1)
    assert found["cause_kind"] == "backRank"
    assert found["cause_text"] == "Your king had no escape square off the back rank: Ra1# is mate."
    smothered = chess.Board("6k1/8/8/8/4n3/8/P5PP/6RK w - - 0 1")
    assert causes.cause(smothered, "a2a3", [], ["e4f2"], 1) is None


def test_loose_piece_variants():
    undefended = chess.Board("4r2k/8/8/8/8/5N2/8/K7 w - - 0 1")
    assert (
        causes.cause(undefended, "f3e5", [], ["e8e5"], None)["cause_text"]
        == "Your knight on e5 has no defender there, so Rxe5 takes it."
    )
    # Defended by the b4 pawn, but a pawn takes it: a knight for a pawn.
    cheaper = chess.Board("k7/8/3p4/8/1P6/1N6/8/K7 w - - 0 1")
    assert (
        causes.cause(cheaper, "b3c5", [], ["d6c5", "b4c5"], None)["cause_text"]
        == "Your knight on c5 can be taken by a pawn, so dxc5 wins it."
    )
    defender_left = chess.Board("2r4k/8/8/8/8/2N5/1B6/K7 w - - 0 1")
    assert (
        causes.cause(defender_left, "b2a3", [], ["c8c3"], None)["cause_text"]
        == "Moving your bishop left your knight on c3 undefended, so Rxc3 takes it."
    )
    # d4: hit by the d8 rook and the a4 queen, covered only by the d1 rook.
    outnumbered = chess.Board("3r3k/8/8/8/q7/8/3R4/3R3K w - - 0 1")
    found = causes.cause(outnumbered, "d2d4", [], ["d8d4", "d1d4", "a4d4"], None)
    assert found["cause_text"] == "Your rook on d4 is attacked twice and defended once, so Rxd4 wins it."
    assert found["principle"] == "loosePieces"


def test_no_loose_piece_when_the_trade_is_even_or_the_line_never_takes_it():
    # Rook for rook: the line nets nothing.
    even = chess.Board("3r3k/8/8/8/6R1/8/8/K2R4 w - - 0 1")
    assert causes.cause(even, "g4d4", [], ["d8d4", "d1d4"], None) is None
    undefended = chess.Board("4r2k/8/8/8/8/5N2/8/K7 w - - 0 1")
    assert causes.cause(undefended, "f3e5", [], ["h8g8"], None) is None


def _info(uci, cp=None, mate=None, depth=14, turn=chess.WHITE):
    score = chess.engine.Mate(mate) if mate is not None else chess.engine.Cp(cp)
    return {"pv": [chess.Move.from_uci(u) for u in uci], "depth": depth, "score": chess.engine.PovScore(score, turn)}


def test_candidates_compare_within_30_centipawns_and_drop_capped_lines():
    board = chess.Board()
    top = causes.candidates(board, [_info(["e2e4"], 30), _info(["d2d4"], 0), _info(["c2c4"], -1)], 14, [])
    assert [c["about_equal"] for c in top] == [False, True, False]
    assert top[1]["reason_text"] == "About as good as e4."
    assert top[2]["reason_text"] == "Keeps it level (0.0)."
    assert all(len(c["reason_text"]) <= causes.MAX_TEXT for c in top)
    # A capped line is dropped; one line left is no comparison.
    assert causes.candidates(board, [_info(["e2e4"], 30), _info(["d2d4"], 0, depth=10)], 14, []) is None


def test_trading_is_a_reason_only_when_ahead():
    ahead = chess.Board("3qk3/8/8/8/8/8/8/3QK2R w - - 0 1")
    infos = [_info(["d1d8", "e8d8"], 500), _info(["h1h7"], 450)]
    assert causes.candidates(ahead, infos, 14, [])[0]["reason_text"] == "Trades queens while you're ahead."
    level = chess.Board("3qk3/8/8/8/8/8/8/3QK3 w - - 0 1")
    infos = [_info(["d1d8", "e8d8"], 0), _info(["d1d2"], -10)]
    assert causes.candidates(level, infos, 14, [])[0]["reason_kind"] == "eval"


def test_defending_the_threat_is_a_reason():
    infos = [_info(["e4c3"], 0), _info(["e4d6"], 0)]
    top = causes.candidates(chess.Board(THREATENED), infos, 14, KNIGHT_THREAT)
    assert top[0]["reason_text"] == "Stops their threat dxe4."


def test_principles_follow_cause_then_layer():
    assert causes.principle("theirReply", "loosePiece") == "loosePieces"
    assert causes.principle("theirReply") == "checkReplies"
    assert causes.principle("calculation") == "checkTheEnd"
    assert causes.principle("ownTactic") == "forcingFirst"
    assert causes.principle(None, None, "hangingPiece") == "loosePieces"
    assert causes.principle(None) is None


def test_game_moves_get_causes_only_from_settled_layer_zero_facts():
    facts = {"threats": KNIGHT_THREAT, "refutation": {"line": ["d5e4"], "cp": -300, "mate": None}}
    found = causes.for_game_move(THREATENED, "a1a2", "theirThreat", facts)
    assert found["cause_kind"] == "missedThreat" and found["reply_uci"] == "d5e4"
    assert causes.for_game_move(THREATENED, "a1a2", None, facts) is None
    assert causes.for_game_move(THREATENED, "a1a2", "ownTactic", facts) is None
    # Mate stored for White: Black (the opponent) mates when it's negative.
    back_rank = {"threats": [], "refutation": {"line": ["a8a1"], "cp": None, "mate": -1}}
    assert (
        causes.for_game_move("r5k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1", "g1h1", "theirReply", back_rank)["cause_kind"]
        == "backRank"
    )


def test_a_candidate_is_named_for_its_own_move_not_a_later_one_in_its_line():
    # h3 is quiet; the fork (Nc7+ on king and rook) comes two moves later in the line.
    board = chess.Board("r3k3/p7/8/3N4/8/8/7P/4K3 w - - 0 1")
    infos = [_info(["d5c7", "e8d8", "c7a8"], 400), _info(["h2h3", "a7a6", "d5c7"], 380)]
    top = causes.candidates(board, infos, 14, [])
    assert top[0]["reason_kind"] in ("fork", "material")
    assert top[1]["reason_kind"] == "eval" and "Fork" not in top[1]["reason_text"]
