import json
import shutil
from pathlib import Path

import chess
import pytest
from conftest import SCHOLARS_MATE

from knightly import analyze, db


def test_win_pct_and_accuracy():
    assert analyze.win_pct(0) == 50
    assert analyze.win_pct(5000) == analyze.win_pct(1000) > 95  # clamped
    assert analyze.win_pct(-300) == pytest.approx(100 - analyze.win_pct(300))
    assert analyze.move_accuracy(60, 60) == pytest.approx(100, abs=0.01)
    assert analyze.move_accuracy(60, 70) == analyze.move_accuracy(60, 60)  # gaining win% is never penalised
    assert analyze.move_accuracy(80, 20) < 10


def test_classify():
    assert analyze.classify(50, 10, is_best=True) == "best"
    assert analyze.classify(50, 49, is_best=False) == "excellent"
    assert analyze.classify(50, 47, is_best=False) == "good"
    assert analyze.classify(50, 44, is_best=False) == "inaccuracy"
    assert analyze.classify(50, 39, is_best=False) == "mistake"
    assert analyze.classify(50, 35, is_best=False) == "mistake"  # 15 points: a blunder before
    assert analyze.classify(50, 30, is_best=False) == "blunder"


def test_win_curve_is_matched_to_the_movers_rating():
    ks = [analyze.slope(r) for r in range(400, 3001, 25)]
    assert ks == sorted(ks)  # stronger players convert an advantage more reliably
    assert analyze.slope(2500) == analyze.slope(2800) == analyze.LICHESS_K  # top band: Lichess's curve
    assert analyze.slope(2000) > 0.9 * analyze.LICHESS_K  # and approaches it by 2000
    assert analyze.slope(None) == analyze.slope(1500)  # unknown rating (over the board)
    assert analyze.win_pct(300, analyze.slope(900)) < analyze.win_pct(300)  # the same edge is worth less
    assert analyze.win_pct(0, analyze.slope(900)) == 50


def test_a_miss_fails_to_cash_in_their_error():
    # 14...Re8 in the reference game: White's blunder took Black from 68 to 91, and Black's
    # reply went back to 67. Chess.com and the spec call it a Miss.
    def miss(win_before=91, win_after=67, opponent_drop=23, opponent_missed=False, win_before_error=68):
        return analyze.is_miss(win_before, win_after, opponent_drop, opponent_missed, win_before_error)

    assert miss()
    assert not miss(opponent_drop=8)  # 1. their move was only an inaccuracy
    assert not miss(win_before=58, win_after=35, win_before_error=40)  # 2. nothing real on offer
    assert not miss(win_after=80)  # 3. kept most of it: a size label instead
    assert not miss(opponent_missed=True)  # 4. no chains of Misses
    assert analyze.classify(91, 67, is_best=False, miss=True) == "miss"
    assert analyze.classify(91, 67, is_best=False) == "blunder"


def test_classify_special_moves_win():
    assert analyze.classify(50, 50, is_best=True, special="great") == "great"
    assert analyze.classify(50, 50, is_best=True, special="brilliant") == "brilliant"
    assert analyze.classify(50, 50, is_best=True) == "best"


def test_phase_and_time_control():
    assert analyze.phase(chess.Board(), 1) == "opening"
    assert analyze.phase(chess.Board(), 25) == "middlegame"
    assert analyze.phase(chess.Board("4k3/8/8/8/8/8/8/R3K3 w - - 0 40"), 40) == "endgame"
    assert analyze.parse_time_control("600+5") == (600, 5)
    assert analyze.parse_time_control("180") == (180, 0)
    assert analyze.parse_time_control("1/259200") == (None, 0)
    assert analyze.parse_time_control(None) == (None, 0)


@pytest.mark.parametrize(
    'control,clocks,expected',
    [
        ('600+5', ['0:10:04.7', None, '0:09:50', '0:09:48'], [0.3, None, None, 7]),
        ('600', ['0:09:58', '0:10:01', '0:10:02', '0:09:55'], [2, None, None, 7]),
        ('1/604800', ['0:09:58', '0:09:50', '0:09:45', '0:09:40'], [None] * 4),
    ],
)
def test_missing_or_impossible_clocks_do_not_create_false_quick_moves(control, clocks, expected):
    white = ['e4', 'Nf3', 'Bc4', 'd3']
    black = ['e5', 'Nc6', 'Nf6', 'Bc5']
    moves = []
    for i, (w, b, clock) in enumerate(zip(white, black, clocks, strict=False), 1):
        annotation = f'{{[%clk {clock}]}}' if clock else ''
        moves.append(f'{i}. {w} {annotation} {b}')
    pgn = '[Result "*"]\n\n' + ' '.join(moves) + ' *'

    def evaluate(boards):
        return [dict(cp=0, mate=None, second=0, best=None) for _ in boards]

    rows = analyze.analyze_game(None, 1, pgn, 'white', control, 1, evaluate_all=evaluate)
    actual = [r['time_spent'] for r in rows if r['is_user']]
    assert actual == expected


def test_each_move_keeps_the_engine_lines_before_and_after_it():
    # Review's Best and Why come from these, with no engine run per tap (as Lichess stores
    # Info.variation): the line from the position before the move, and from the one after.
    pgn = '[Result "*"]\n\n1. e4 e5 *'
    shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'] * 4  # longer than Lichess's 12-ply cap
    pvs = [['e2e4', 'e7e5', 'g1f3'], ['e7e5'] + shuffle, []]

    def evaluate(boards):
        return [
            dict(
                cp=0,
                mate=None,
                second=0,
                best=chess.Move.from_uci(pv[0]) if pv else None,
                pv=[chess.Move.from_uci(u) for u in pv],
            )
            for pv in pvs
        ]

    rows = analyze.analyze_game(None, 1, pgn, 'white', None, 1, evaluate_all=evaluate)
    assert rows[0]['best_line'] == 'e2e4 e7e5 g1f3'
    assert rows[0]['reply_line'].split() == ['e7e5'] + shuffle[:11]
    assert rows[1]['best_line'] == rows[0]['reply_line']
    assert rows[1]['reply_line'] is None  # no line from the final position


@pytest.mark.skipif(not shutil.which("stockfish"), reason="stockfish not installed")
def test_analyze_game_end_to_end(db_url, tmp_path):
    conn = db.connect(db_url)
    conn.execute(
        "INSERT INTO games (source, source_id, pgn, user_color, time_control, variant) "
        "VALUES ('otb', 'x', %s, 'white', '180+2', 'standard')",
        (SCHOLARS_MATE,),
    )
    assert analyze.run(conn, depth=10, workers=1, log=lambda _: None) == 1
    assert analyze.run(conn, depth=10, workers=1, log=lambda _: None) == 0  # already done

    moves = conn.execute("SELECT * FROM moves ORDER BY ply").fetchall()
    assert [m["san"] for m in moves] == ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]
    assert [m["is_user"] for m in moves] == [True, False, True, False, True, False, True]
    nf6 = moves[5]
    assert nf6["classification"] == "blunder" and nf6["color"] == "black"
    assert nf6["eval_after"] > 9000 and nf6["mate_after"] == 1  # White mates in 1
    assert moves[6]["classification"] == "best" and moves[6]["eval_after"] == analyze.MATE_CP
    # Clocks: Black went 2:50 -> 2:40 with a 2s increment = 12s spent on Nf6.
    assert nf6["clock_left"] == 160 and nf6["time_spent"] == 12
    assert moves[0]["time_spent"] == 2  # first move: 3:00 base -> 3:00 + 2s increment

    summary = conn.execute("SELECT * FROM game_analysis").fetchone()
    assert summary["engine"].startswith("Stockfish")
    assert summary["user_blunders"] == 0 and summary["opponent_blunders"] >= 1
    assert summary["user_accuracy"] > summary["opponent_accuracy"]


@pytest.mark.skipif(not shutil.which("stockfish"), reason="stockfish not installed")
def test_games_are_analysed_with_a_node_budget(db_url):
    conn = db.connect(db_url)
    conn.execute(
        "INSERT INTO games (source, source_id, pgn, user_color, time_control, variant) "
        "VALUES ('otb', 'x', %s, 'white', '180+2', 'standard')",
        (SCHOLARS_MATE,),
    )
    assert analyze.run(conn, nodes=20_000, workers=1, log=lambda _: None) == 1
    row = conn.execute("SELECT depth, nodes FROM game_analysis").fetchone()
    assert (row["depth"], row["nodes"]) == (None, 20_000)  # which budget analysed it
    assert analyze.describe(analyze.budget(nodes=500_000)) == "500k nodes a move"
    assert analyze.budget().nodes == db.DEFAULT_NODES and analyze.budget(depth=12).depth == 12


def _graded_game():
    """The reference game's stored evals, graded as analyze and reclassify do."""
    game = json.loads((Path(__file__).parent / "fixtures" / "graded-game.json").read_text())
    board, boards, rows = chess.Board(), [], []
    for ply, (uci, best, before, after, second) in enumerate(game["moves"], start=1):
        boards.append(board.copy())
        color = "white" if board.turn == chess.WHITE else "black"
        rows.append(
            dict(ply=ply, color=color, uci=uci, best_uci=best, eval_before=before, eval_after=after, eval_second=second)
        )
        board.push_uci(uci)
    analyze.grade(rows, boards, (game["white_elo"], game["black_elo"]))
    return game, {r["ply"]: r["classification"] for r in rows}


# 14.O-O-O and 16.Qf3 lose just over 20 points on the fitted ~1000 curve (Chess.com: mistakes).
EDGE = "a drop just over the blunder line on the fitted curve"


@pytest.mark.parametrize(
    "ply",
    [
        71,
        50,
        28,
        39,
        45,
        72,
        pytest.param(27, marks=pytest.mark.xfail(strict=True, reason=EDGE)),
        pytest.param(31, marks=pytest.mark.xfail(strict=True, reason=EDGE)),
        # 22.Qxg5 follows an inaccuracy, not a mistake: the spec's Miss can't see it.
        pytest.param(43, marks=pytest.mark.xfail(strict=True, reason="Miss after an inaccuracy")),
    ],
)
def test_reference_game_matches_chesscom(ply):
    # Chess.com's labels, not ours. 14.O-O-O, 16.Qf3, 36.Na4 and 25...Kh7 lost 21-26 points
    # on the fixed curve; for players rated about 1000 Chess.com calls them mistakes.
    # 14...Re8 and 22.Qxg5 are its Misses; 20.Qg3 (worse position), 36...Rc2 (slightly
    # worse) and 23.gxf3 (taking back after queens came off) its Greats.
    game, labels = _graded_game()
    assert labels[ply] == game["chesscom"][str(ply)]


# 44.Ra6 and 45.Rd1 follow 43...Rd2 and 44...Rd6, which this engine scores as mistakes; the
# spec puts 43...Rd2 down to engine depth, and Chess.com shows no Miss here.
DEPTH = "follows an error Chess.com's deeper engine may not see"


@pytest.mark.parametrize(
    "ply",
    [
        *range(77, 87),
        pytest.param(87, marks=pytest.mark.xfail(strict=True, reason=DEPTH)),
        88,
        pytest.param(89, marks=pytest.mark.xfail(strict=True, reason=DEPTH)),
        90,
    ],
)
def test_reference_game_has_no_scramble_of_misses(ply):
    # Moves 39-45 traded errors back and forth; the old rule called seven of them Misses.
    game, labels = _graded_game()
    first, last = game["chesscom_no_miss"]
    assert first <= ply <= last and labels[ply] != "miss"


def test_reclassify_regrades_saved_games_on_the_rating_curves(db_url):
    game = json.loads((Path(__file__).parent / "fixtures" / "graded-game.json").read_text())
    board, sans, rows = chess.Board(), [], []
    for ply, (uci, best, before, after, second) in enumerate(game["moves"], start=1):
        move = chess.Move.from_uci(uci)
        color = "white" if board.turn == chess.WHITE else "black"
        sans.append(board.san(move))
        board.push(move)
        sign = 1 if color == "white" else -1
        # Saved as the old code saved them: Lichess's curve for both players, labelled blunder.
        wb, wa = analyze.win_pct(sign * before), analyze.win_pct(sign * after)
        rows.append(
            (1, ply, (ply + 1) // 2, color, color == "black", sans[-1], uci, best, before, after, second, wb, wa)
        )
    conn = db.connect(db_url)
    conn.execute(
        """INSERT INTO games (id, source, source_id, pgn, user_color, variant, white_elo, black_elo, moves_san)
           VALUES (1, 'chesscom', 'x', '', 'black', 'standard', %s, %s, %s)""",
        (game["white_elo"], game["black_elo"], " ".join(sans)),
    )
    conn.executemany(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, san, uci, best_uci, eval_before,
               eval_after, eval_second, win_pct_before, win_pct_after, accuracy, classification, phase, cp_loss)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 77.0, 'blunder', 'middlegame', 0)""",
        rows,
    )
    conn.execute(
        "INSERT INTO game_analysis (game_id, engine, user_blunders, opponent_blunders) VALUES (1, 'sf', 59, 58)"
    )

    assert analyze.reclassify(conn, log=lambda _: None) == 1

    moves = {m["ply"]: m for m in conn.execute("SELECT * FROM moves ORDER BY ply")}
    # 36.Na4: 78.5% before on Lichess's curve; a 1043 converts less reliably, so nearer 50.
    assert 50 < moves[71]["win_pct_before"] < 78.52 and moves[71]["classification"] == "mistake"
    assert moves[28]["classification"] == "miss"  # 14...Re8
    assert all(m["accuracy"] == 77.0 for m in moves.values())  # accuracy keeps the fixed curve
    counts = conn.execute("SELECT * FROM game_analysis").fetchone()
    assert counts["user_blunders"] == sum(m["is_user"] and m["classification"] == "blunder" for m in moves.values())
    assert counts["opponent_blunders"] == sum(
        not m["is_user"] and m["classification"] == "blunder" for m in moves.values()
    )
