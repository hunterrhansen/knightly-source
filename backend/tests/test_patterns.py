from datetime import date

import chess
import pytest

from knightly import analyze, db, patterns


def motif(fen, uci):
    return patterns.motif(chess.Board(fen), chess.Move.from_uci(uci))


def test_fork():
    # Nc7+ hits the king and the rook on a8.
    assert motif("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "b5c7") == "fork"


def test_loose_piece():
    # The rook on d4 has no defender.
    assert motif("4k3/8/8/8/3r4/8/8/3RK3 w - - 0 1", "d1d4") == "hangingPiece"


def test_back_rank_mate():
    assert motif("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1a8") == "backRankMate"


def test_pin():
    # Bb5 pins the knight on c6 to the king.
    assert motif("4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1", "f1b5") == "pin"


def test_skewer():
    # Rh8+ and the queen behind the king on the eighth rank falls.
    assert motif("q3k3/8/8/8/8/8/8/4K2R w - - 0 1", "h1h8") == "skewer"


def test_quiet_move_has_no_motif():
    assert motif(chess.STARTING_FEN, "e2e4") is None


def test_tag_blunder_by_the_reply_and_miss_by_the_best_move():
    fen = "4k3/8/8/8/8/8/3r4/3RK3 w - - 0 1"
    # A whole rook is at stake either way, so the gate lets all of these through.
    lost = {"eval_before": 0, "eval_after": -500, "eval_second": -500}
    # Kf1 leaves the rook on d1 loose, and Black's best reply takes it.
    assert patterns.tag(fen, "e1f1", None, "d2d1", "blunder", None, "white", **lost) == "hangingPiece"
    # The miss: White could have taken Black's loose rook on d2 instead.
    assert patterns.tag(fen, "e1f1", "d1d2", None, "miss", None, "white", **lost) == "hangingPiece"
    # Nothing to go on yet: left for the engine pass.
    assert patterns.tag(fen, "e1f1", None, None, "mistake", None, "white", **lost) == patterns.PENDING
    assert patterns.tag(fen, "e1f1", None, None, "blunder", -3, "white", **lost) == "mate"


def test_a_tactic_that_wins_nothing_is_not_named():
    """The rules match geometry, which is on the board whether or not it wins anything.

    Same position and same loose rook as above, but the evals say the move cost almost
    nothing. Before the gate this was tagged `hangingPiece` and counted against the learner.
    """
    fen = "4k3/8/8/8/8/8/3r4/3RK3 w - - 0 1"
    nothing = {"eval_before": 0, "eval_after": -40, "eval_second": -40}
    assert patterns.tag(fen, "e1f1", None, "d2d1", "blunder", None, "white", **nothing) == patterns.POSITIONAL
    assert patterns.tag(fen, "e1f1", "d1d2", None, "miss", None, "white", **nothing) == patterns.POSITIONAL
    # Mate is always at stake, whatever the centipawns say.
    assert patterns.tag(fen, "e1f1", None, None, "blunder", -3, "white", **nothing) == "mate"


def test_tag_without_evals_names_nothing():
    """No evals means no evidence anything was at stake, so there is nothing to name."""
    fen = "4k3/8/8/8/8/8/3r4/3RK3 w - - 0 1"
    assert patterns.tag(fen, "e1f1", None, "d2d1", "blunder", None, "white") == patterns.POSITIONAL


def test_smothered_mate_is_named_apart_from_an_ordinary_mate():
    """The king walled in by its own pieces, mated by the one piece that checks through a
    wall. Scored against Lichess over 20,000 puzzles this is right every time it speaks and
    never misses: 544 of their 544."""
    # Kh8 is boxed in by its own rook on g8 and pawns on g7/h7; Nf7 is mate.
    board = chess.Board("6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1")
    assert patterns.motif(board, chess.Move.from_uci("h6f7")) == "smotheredMate"


def test_only_a_knight_smothers():
    """Any other checker would have to stand next to the king, which means the king is not
    walled in after all -- so requiring a knight is the pattern, not a narrowing of it."""
    board = chess.Board("6rk/6pp/8/8/8/8/8/6KR w - - 0 1")
    assert patterns.motif(board, chess.Move.from_uci("h1h7")) != "smotheredMate"


def test_a_mate_with_an_escape_square_is_not_smothered():
    """Every square round the king has to be blocked by its *own* pieces."""
    board = chess.Board("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
    assert patterns.motif(board, chess.Move.from_uci("a1a8")) == "backRankMate"


def test_in_line_finds_the_tactic_later_in_the_line():
    # A quiet knight move first; after ...Ke7, Nc6+ forks the king and the rook on d8.
    board = chess.Board("3rk3/8/8/8/2N5/8/8/4K3 w - - 0 1")
    line = [chess.Move.from_uci(u) for u in ("c4a5", "e8e7", "a5c6")]
    assert patterns.motif(board, line[0]) is None
    assert patterns.in_line(board, line) == "fork"
    # Black's moves in the line don't count as White's tactics.
    assert patterns.in_line(board, line[:2]) is None


# --- only_move: was one move clearly it? ---------------------------------------------------


def test_only_move_needs_the_second_best_to_give_up_the_bar():
    assert analyze.only_move("white", 900, 300, 10)
    assert not analyze.only_move("white", 900, 880, 10)
    assert not analyze.only_move("white", 900, None, 10)


def test_only_move_counts_a_mate_the_alternative_does_not_share():
    # Regression: evals are clamped to CLAMP_CP before win_pct, so a forced mate and a merely
    # winning move both land near 98% and their gap reads as zero. Mate was not being counted
    # as the only move, which discarded 92% of mate finds on the production account.
    mate, winning = analyze.MATE_CP - 1, 900
    assert analyze.win_pct(mate) - analyze.win_pct(winning) < 10  # the gap the clamp leaves
    assert analyze.only_move("white", mate, winning, 10)


def test_only_move_does_not_count_one_mate_against_another():
    assert not analyze.only_move("white", analyze.MATE_CP - 1, analyze.MATE_CP - 8, 10)


def test_only_move_reads_evals_from_the_movers_side():
    assert analyze.only_move("black", -900, -300, 10)
    assert not analyze.only_move("white", -900, -300, 10)


# --- tag_chances: the tactic behind a clear chance, taken or not ----------------------------


@pytest.fixture
def conn(db_url):
    c = db.connect(db_url)
    yield c
    c.close()


# Nc7+ forks the king on e8 and the rook on a8; the alternative (Kf1) is far worse.
FORK_CHANCE = "r3k3/8/8/1N6/8/8/8/5K2 w - - 0 1"
# A king move with nothing to find.
QUIET = "4k3/8/8/8/8/8/8/4K3 w - - 0 1"


def chance_game(
    conn,
    gid,
    start_fen,
    san,
    uci,
    *,
    best_uci=None,
    cls="best",
    before=900,
    second=300,
    played_at="2026-10-10T12:00:00Z",
    rated=True,
):
    conn.execute(
        """INSERT INTO games (id, source, source_id, played_at, speed, user_color, user_outcome,
           opponent, pgn, moves_san, start_fen, rated, time_control)
           VALUES (%s, 'chesscom', %s, %s, 'rapid', 'white', 'win', 'opp', '', %s, %s, %s, '600')""",
        (gid, str(gid), played_at, san, start_fen, rated),
    )
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
           best_uci, eval_before, eval_second, classification, win_pct_before)
           VALUES (%s, 1, 1, 'white', true, 'middlegame', %s, %s, %s, %s, %s, %s, 50)""",
        (gid, san, uci, best_uci or uci, before, second, cls),
    )


def motifs(conn):
    return {
        r["game_id"]: r["chance_motif"]
        for r in conn.execute("SELECT game_id, chance_motif FROM moves ORDER BY game_id")
    }


def test_tag_chances_names_the_tactic_you_played(conn):
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7")
    assert patterns.tag_chances(conn) == 1
    assert motifs(conn)[1] == "fork"


def test_tag_chances_names_the_same_tactic_you_missed(conn):
    # The gate must not depend on whether you took the chance: this is the asymmetry that made
    # a motif's finds and misses incomparable.
    chance_game(conn, 1, FORK_CHANCE, "Kg1", "f1g1", best_uci="b5c7", cls="miss")
    patterns.tag_chances(conn)
    assert motifs(conn)[1] == "fork"


def test_tag_chances_settles_a_quiet_move_as_other(conn):
    chance_game(conn, 1, QUIET, "Kd1", "e1d1")
    patterns.tag_chances(conn)
    assert motifs(conn)[1] == patterns.OTHER


def test_tag_chances_ignores_a_position_with_another_good_move(conn):
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7", second=895)
    patterns.tag_chances(conn)
    assert motifs(conn)[1] == patterns.OTHER


def test_tag_chances_counts_a_mate_against_a_merely_winning_move(conn):
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7", before=analyze.MATE_CP - 1, second=900)
    patterns.tag_chances(conn)
    assert motifs(conn)[1] == "fork"


def test_tag_chances_examines_each_move_once(conn):
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7")
    assert patterns.tag_chances(conn) == 1
    assert patterns.tag_chances(conn) == 0


def test_retagging_reads_every_mistake_again(conn):
    """`tag_all` skips rows that already have a tag, so a rules change never reaches them.

    Without this the learner keeps seeing conclusions drawn by rules we have since corrected:
    the gate re-labelled 455 of 2,626 production mistakes, and not one of those rows would
    have changed on its own.
    """
    chance_game(conn, 1, FORK_CHANCE, "Kg1", "f1g1", best_uci="b5c7", cls="miss")
    assert patterns.tag_chances(conn) == 1
    assert motifs(conn) == {1: "fork"}
    # Nothing left to look at until the tags are dropped.
    assert patterns.tag_chances(conn) == 0

    assert patterns.clear(conn) == 1
    assert motifs(conn) == {1: None}
    assert patterns.tag_chances(conn) == 1
    assert motifs(conn) == {1: "fork"}


def test_clearing_leaves_moves_that_are_not_your_mistakes_alone(conn):
    """A move you played well keeps its tag: only mistakes, misses and blunders are re-read."""
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7", cls="best")
    patterns.tag_chances(conn)
    assert patterns.clear(conn) == 0
    assert motifs(conn) == {1: "fork"}


def test_tag_chances_stops_at_the_batch_and_takes_the_newest_first(conn):
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7", played_at="2026-01-01T12:00:00Z")
    chance_game(conn, 2, FORK_CHANCE, "Nc7+", "b5c7", played_at="2026-10-10T12:00:00Z")
    assert patterns.tag_chances(conn, batch=1) == 1
    assert motifs(conn) == {1: None, 2: "fork"}


# Nc3 and Bg5 both develop; a3 does not. No tactic anywhere in the position.
DEVELOPING = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1"


def test_a_positional_chance_is_counted_when_the_engine_wanted_an_idea(conn):
    """The tactical gate asks whether one move won material by TACTIC_CP, which a developing
    move never does -- so development, castling and connecting the rooks were permanently
    unmeasurable. A smaller gap and no tactic in sight is what makes it a positional chance."""
    chance_game(conn, 1, DEVELOPING, "Nc3", "b1c3", best_uci="b1c3", before=100, second=0)
    assert patterns.tag_chances(conn) == 1
    assert motifs(conn) == {1: "development"}


def test_taking_a_positional_chance_is_about_the_idea_not_the_move(conn):
    """Developing the bishop instead of the knight is still developing. `uci = best_uci`
    would call that a miss, which is why the answer is stored rather than inferred."""
    chance_game(conn, 1, DEVELOPING, "Bg5", "c1g5", best_uci="b1c3", before=100, second=0)
    patterns.tag_chances(conn)
    row = conn.execute("SELECT chance_motif, chance_found FROM moves WHERE game_id = 1").fetchone()
    assert row["chance_motif"] == "development"
    assert row["chance_found"] is True


def test_sharing_any_idea_with_the_engines_move_counts_as_taking_the_chance(conn):
    """A move can carry several ideas, and doing one of the things the engine wanted is
    finding the idea. Matching on the top idea alone undercounted badly: on production it put
    `space` at 11% and `seventhRank` at 0%."""
    # Ra7-d7 takes the open d-file and reaches the seventh; Ra1-d1 only takes the file.
    fen = "6k1/R4ppp/2p5/8/8/2P5/PP3PPP/R5K1 w - - 0 1"
    chance_game(conn, 1, fen, "Rad1", "a1d1", best_uci="a7d7", before=100, second=0)
    patterns.tag_chances(conn)
    row = conn.execute("SELECT chance_motif, chance_found FROM moves WHERE game_id = 1").fetchone()
    assert row["chance_found"] is True, "both moves take the open d-file"


def test_a_move_without_the_idea_misses_the_positional_chance(conn):
    chance_game(conn, 1, DEVELOPING, "a3", "a2a3", best_uci="b1c3", before=100, second=0)
    patterns.tag_chances(conn)
    row = conn.execute("SELECT chance_motif, chance_found FROM moves WHERE game_id = 1").fetchone()
    assert row["chance_motif"] == "development" and row["chance_found"] is False


def test_two_near_equal_opening_moves_are_not_a_finding(conn):
    """Below POSITIONAL_CP the engine barely prefers its move, and saying you missed an idea
    there would be noise dressed as a weakness."""
    chance_game(conn, 1, DEVELOPING, "a3", "a2a3", best_uci="b1c3", before=20, second=0)
    patterns.tag_chances(conn)
    assert motifs(conn) == {1: patterns.OTHER}


def test_a_tactic_beats_a_positional_idea_for_the_same_move(conn):
    """Nc7+ develops nothing, but even where the best move would read as positional the
    tactic is the better thing to count."""
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7")
    patterns.tag_chances(conn)
    assert motifs(conn) == {1: "fork"}


def test_chance_rates_counts_taken_chances_over_all_of_them(conn):
    chance_game(conn, 1, FORK_CHANCE, "Nc7+", "b5c7")  # taken
    chance_game(conn, 2, FORK_CHANCE, "Kg1", "f1g1", best_uci="b5c7", cls="miss")  # missed
    chance_game(conn, 3, FORK_CHANCE, "Kg1", "f1g1", best_uci="b5c7", cls="miss")  # missed
    chance_game(conn, 4, QUIET, "Kd1", "e1d1")  # no chance
    chance_game(conn, 5, FORK_CHANCE, "Nc7+", "b5c7", rated=False)  # unrated
    chance_game(conn, 6, FORK_CHANCE, "Nc7+", "b5c7", played_at="2025-01-01T12:00:00Z")  # old
    patterns.tag_chances(conn)
    assert patterns.chance_rates(conn, date(2026, 10, 17)) == {"fork": {"found": 1, "chances": 3}}


# --- weakness: the shrunk find rate practice is ordered by ---------------------------------


def chances(conn, gid_start, motif_fen, *, found, missed, best="b5c7", other="f1g1"):
    """`found` taken chances and `missed` untaken ones at the tactic in `motif_fen`."""
    gid = gid_start
    for _ in range(found):
        chance_game(conn, gid, motif_fen, "x", best)
        gid += 1
    for _ in range(missed):
        chance_game(conn, gid, motif_fen, "x", other, best_uci=best, cls="miss")
        gid += 1
    return gid


# A back-rank mate: Ra8#. The king has no escape, so the alternative is far worse.
MATE_CHANCE = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"


def test_weakness_leaves_out_a_tactic_you_have_never_met(conn):
    chances(conn, 1, FORK_CHANCE, found=3, missed=1)
    patterns.tag_chances(conn)
    assert set(patterns.weakness(conn, date(2026, 10, 17))) == {"fork"}


def test_weakness_ranks_a_failed_tactic_below_a_common_one_you_usually_find(conn):
    # The base-rate case the raw mistake count gets backwards: 30 fork mistakes against 120
    # fork chances is a better rate than 6 back-rank mistakes against 9 chances, but a count
    # ranks fork first purely because forks come up more.
    nxt = chances(conn, 1, FORK_CHANCE, found=90, missed=30)
    chances(conn, nxt, MATE_CHANCE, found=3, missed=6, best="a1a8", other="g1f1")
    patterns.tag_chances(conn)
    weak = patterns.weakness(conn, date(2026, 10, 17))
    assert weak["backRankMate"] < weak["fork"], weak
    assert min(weak, key=weak.get) == "backRankMate"


def test_weakness_shrinks_a_thin_tactic_toward_your_overall_rate(conn):
    # Two missed back-rank chances is a 0% raw rate; shrinkage must not read that as certainty.
    nxt = chances(conn, 1, FORK_CHANCE, found=90, missed=10)
    chances(conn, nxt, MATE_CHANCE, found=0, missed=2, best="a1a8", other="g1f1")
    patterns.tag_chances(conn)
    weak = patterns.weakness(conn, date(2026, 10, 17))
    assert weak["backRankMate"] > 0.5, weak  # nowhere near the raw 0.0
    assert weak["backRankMate"] < weak["fork"]  # still ranked the weaker of the two


# --- what the tagger names, scored against Lichess's own labels ----------------------------


def in_line(fen, ucis):
    board = chess.Board(fen)
    return patterns.in_line(board, [chess.Move.from_uci(u) for u in ucis])


def test_a_line_is_named_by_its_decisive_tactic_not_its_first_capture():
    # Rxd5 takes a free knight, then Ra8 mates. Naming the line by the first capture buries
    # what it was for; scoring against Lichess showed this costing 5,000 agreements.
    fen = "r5k1/5ppp/8/3n4/8/8/8/3R2K1 w - - 0 1"
    assert in_line(fen, ["d1d5", "a8a7", "d5d8"]) == "backRankMate"
    assert in_line(fen, ["d1d5"]) == "hangingPiece"  # alone, it is just the capture


def test_a_back_rank_mate_needs_the_king_shut_in_by_its_own_pieces():
    # Pawns on f7/g7/h7: the king cannot step up, so Ra8 is the back-rank pattern.
    assert in_line("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", ["a1a8"]) == "backRankMate"
    # Requiring the shut-in king took backRankMate's precision from 0.27 to 0.75. Here the
    # escape squares are empty and only covered, so it is a mate on the back rank without
    # the pattern.
    assert in_line("6k1/8/5QP1/8/8/8/8/3R3K w - - 0 1", ["d1d8"]) == "mate"


def test_a_promotion_outranks_the_capture_that_made_it():
    assert in_line("8/1P6/8/8/8/8/8/k5K1 w - - 0 1", ["b7b8q"]) == "promotion"


def test_an_en_passant_capture_is_named():
    assert in_line("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", ["e5d6"]) == "enPassant"


def test_a_pawn_pushed_to_the_last_ranks_is_named():
    assert in_line("4k3/8/1P6/8/8/8/8/4K3 w - - 0 1", ["b6b7"]) == "advancedPawn"
    # Not deep enough to be the point.
    assert in_line("4k3/8/8/8/1P6/8/8/4K3 w - - 0 1", ["b4b5"]) is None


def test_hanging_piece_needs_a_genuinely_free_piece():
    # An undefended knight: free.
    assert in_line("4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1", ["d1d5"]) == "hangingPiece"
    # The same knight defended by a pawn is a trade, not a free piece. The old rule counted
    # any capture winning the exchange and scored 0.11 precision.
    assert in_line("4k3/8/2p5/3n4/8/8/8/3RK3 w - - 0 1", ["d1d5"]) is None
    # A free pawn is not the point of a position either.
    assert in_line("4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1", ["d1d5"]) is None


def test_evaluate_scores_the_tagger_against_stored_puzzles(conn):
    conn.execute(
        """INSERT INTO lichess_puzzles (puzzle_id, fen, moves, rating, popularity, plays, themes)
           VALUES ('aaaaa', 'r3k3/7p/8/1N6/8/8/8/4K3 b - - 0 1', 'h7h6 b5c7', 1200, 95, 900,
                   'fork short')"""
    )
    r = patterns.evaluate(conn)
    assert r["scored"] == 1
    fork = next(m for m in r["motifs"] if m["motif"] == "fork")
    assert (fork["found"], fork["precision"], fork["recall"]) == (1, 1.0, 1.0)


def test_a_piece_with_nowhere_to_go_is_trapped():
    # A real position Lichess tags trappedPiece: Kb7 attacks the bishop on a7, and its only
    # two diagonal squares are covered by that same king while its own pawn blocks the rest.
    assert in_line("8/b6p/P1K5/2p1k1p1/6P1/8/1P3P2/8 w - - 2 50", ["c6b7"]) == "trappedPiece"


def test_a_piece_that_can_run_is_not_trapped():
    # The same king move with the c5 pawn gone: the bishop has the long diagonal and is not
    # trapped, so the move is not about trapping it.
    assert in_line("8/b6p/P1K5/4k1p1/6P1/8/1P3P2/8 w - - 2 50", ["c6b7"]) != "trappedPiece"


# --- the gate: was there a tactic here at all ----------------------------------------------


def test_the_gate_asks_how_far_your_best_move_beat_the_next_for_a_miss():
    # A miss is named for the move you did not play, so the question is what that move won.
    assert patterns.decisive("miss", "white", 900, None, 100, None)
    assert not patterns.decisive("miss", "white", 120, None, 100, None)
    # Black reads the other way: a lower eval is the better move.
    assert patterns.decisive("miss", "black", -900, None, -100, None)
    assert not patterns.decisive("miss", "black", -120, None, -100, None)


def test_the_gate_asks_what_the_opponent_won_for_a_mistake():
    # A mistake is named for the reply it allowed, so your own best-move gap is beside the
    # point. These evals would make a miss decisive, and they are ignored here.
    assert patterns.decisive("blunder", "white", 900, 100, 100, None)
    assert not patterns.decisive("blunder", "white", 900, 800, 100, None)
    assert patterns.decisive("blunder", "black", -900, -100, -100, None)


def test_a_forced_mate_is_always_at_stake():
    for kind in patterns.KINDS:
        assert patterns.decisive(kind, "white", 0, 0, 0, -3)


def test_missing_evals_are_not_evidence_that_something_was_at_stake():
    assert not patterns.decisive("miss", "white", None, None, 100, None)
    assert not patterns.decisive("blunder", "white", 900, None, 100, None)


def test_nameless_patterns_get_no_family():
    from knightly import deck

    assert deck.has_family("fork")
    for nameless in patterns.NAMELESS:
        assert not deck.has_family(nameless), nameless
