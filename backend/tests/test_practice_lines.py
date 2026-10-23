import chess
import chess.engine
import pytest

from knightly import practice_lines as lines

START = chess.STARTING_FEN


def cp(value):
    return chess.engine.PovScore(chess.engine.Cp(value), chess.WHITE)


def mate(n):
    return chess.engine.PovScore(chess.engine.Mate(n), chess.WHITE)


class Scripted:
    """An engine answering from a script: {fen-prefix: [(uci, score), ...]} in its order of
    preference. Unscripted positions are an error, so a test sees every search it causes."""

    id = {"name": "Scripted 1"}

    def __init__(self, script, depth=lines.LINE_DEPTH):
        self.script, self.depth, self.searches = script, depth, 0

    def analyse(self, board, limit, multipv=None):
        self.searches += 1
        options = self.script[board.board_fen()]
        infos = [{"pv": [chess.Move.from_uci(u)], "score": s, "depth": self.depth} for u, s in options[: multipv or 1]]
        return infos if multipv else infos[0]


def fen_after(*moves):
    board = chess.Board()
    for m in moves:
        board.push_uci(m)
    return board.board_fen()


def script(second_gap=300, third_gap=300):
    """White to move from the start: 1.e4 e5 2.Nf3 Nc6 3.Bc4, each White move clear by
    default (White's evals)."""
    return {
        fen_after("e2e4"): [("e7e5", cp(30))],
        fen_after("e2e4", "e7e5"): [("g1f3", cp(40)), ("f2f4", cp(40 - second_gap))],
        fen_after("e2e4", "e7e5", "g1f3"): [("b8c6", cp(40))],
        fen_after("e2e4", "e7e5", "g1f3", "b8c6"): [("f1c4", cp(50)), ("f1b5", cp(50 - third_gap))],
    }


def test_line_extends_through_clear_moves_up_to_three_of_yours():
    assert lines.build(START, "e2e4", Scripted(script())) == ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"]


def test_line_ends_on_your_last_clear_move():
    assert lines.build(START, "e2e4", Scripted(script(second_gap=10))) == ["e2e4"]
    assert lines.build(START, "e2e4", Scripted(script(third_gap=10))) == ["e2e4", "e7e5", "g1f3"]


def test_line_still_needs_the_clear_gap_that_cards_do_not():
    # A second choice about 7 win% worse is enough for a card (deck.CARD_GAP), not a line.
    assert lines.build(START, "e2e4", Scripted(script(second_gap=78))) == ["e2e4"]


def test_any_shallow_search_keeps_one_move():
    assert lines.build(START, "e2e4", Scripted(script(), depth=lines.LINE_DEPTH - 1)) == ["e2e4"]


def test_engine_failure_keeps_one_move():
    class Broken:
        def analyse(self, *args, **kwargs):
            raise chess.engine.EngineTerminatedError()

    assert lines.build(START, "e2e4", Broken()) == ["e2e4"]


def test_a_mate_is_unique_only_when_the_second_choice_does_not_mate():
    both = {**script(), fen_after("e2e4", "e7e5"): [("g1f3", mate(3)), ("f2f4", mate(4))]}
    assert lines.build(START, "e2e4", Scripted(both)) == ["e2e4"]
    one = {**script(), fen_after("e2e4", "e7e5"): [("g1f3", mate(3)), ("f2f4", cp(900))]}
    assert lines.build(START, "e2e4", Scripted(one))[:3] == ["e2e4", "e7e5", "g1f3"]


def test_a_mating_first_move_needs_no_search():
    fools = "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"
    engine = Scripted({})
    assert lines.build(fools, "d8h4", engine) == ["d8h4"] and engine.searches == 0


LINE = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"]


def test_step_continues_on_the_lines_move_and_finishes_on_the_last():
    assert lines.step(START, LINE, ["e2e4"]) == {"step": 0, "expected": "e2e4", "status": "continue", "reply": "e7e5"}
    done = lines.step(START, LINE, LINE)
    assert done["status"] == "solved" and done["exact"] and done["step"] == 2


def test_a_wrong_move_at_a_later_step_fails():
    failed = lines.step(START, LINE, ["e2e4", "e7e5", "b1c3"])
    assert failed["status"] == "failed" and failed["step"] == 1 and failed["expected"] == "g1f3"


def test_any_mate_counts_on_a_later_step():
    # Scholar's mate: the line wants Qxf7# but another mate would do too; a non-mate fails.
    line = ["d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]
    fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
    assert lines.step(fen, line, line)["status"] == "solved"
    assert lines.step(fen, line, line[:4] + ["h5h7"])["status"] == "failed"
    alt_fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"  # Ra8# is a mate the line didn't name
    assert lines.step(alt_fen, ["a1a2"], ["a1a8"]) == {
        "step": 0,
        "expected": "a1a2",
        "status": "solved",
        "quality": "best",
        "exact": False,
    }


def test_first_move_alternatives_use_the_cards_judge():
    assert lines.step(START, LINE, ["d2d4"], lambda uci: "excellent")["status"] == "solved"
    assert lines.step(START, LINE, ["d2d4"], lambda uci: "wrong")["status"] == "failed"
    assert lines.step(START, LINE, ["d2d4"])["status"] == "failed"  # puzzles: the line only


def test_show_solution_at_any_step():
    shown = lines.step(START, LINE, ["e2e4", "e7e5", lines.SKIP])
    assert shown["status"] == "shown" and shown["expected"] == "g1f3"


@pytest.mark.parametrize(
    "moves",
    [
        ["e2e4", "e7e5"],  # ends on the opponent's move
        ["d2d4", "e7e5", "g1f3"],  # a first move that isn't the line's
        ["e2e4", "d7d5", "g1f3"],  # a reply that isn't the line's
        LINE + ["g8f6", "d2d3"],  # past the line's end
        [],
    ],
)
def test_moves_the_line_cannot_have_produced_are_rejected(moves):
    with pytest.raises(lines.PrefixMismatch):
        lines.step(START, LINE, moves)


def test_hint_names_the_current_steps_move():
    assert lines.hint_move(LINE, []) == "e2e4"
    assert lines.hint_move(LINE, ["e2e4", "e7e5"]) == "g1f3"
    with pytest.raises(lines.PrefixMismatch):
        lines.hint_move(LINE, ["e2e4"])
    with pytest.raises(lines.PrefixMismatch):
        lines.hint_move(LINE, ["d2d4", "e7e5"])


def test_cached_line_is_invalidated_by_a_changed_reference(monkeypatch):
    from knightly import practice_grades

    monkeypatch.setattr(practice_grades, "engine_revision", lambda: "Scripted 1")
    value = lines.compute(START, "e2e4", 30, Scripted(script()))
    row = {"best_uci": "e2e4", "eval_before": 30, "practice_line": value}
    assert lines.line_for(row, START) == LINE
    assert lines.line_for({**row, "best_uci": "d2d4"}, START) == ["d2d4"]
    assert lines.line_for({**row, "eval_before": 80}, START) == ["e2e4"]
    monkeypatch.setattr(practice_grades, "engine_revision", lambda: "Scripted 2")
    assert lines.line_for(row, START) == ["e2e4"]
