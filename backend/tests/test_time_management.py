from conftest import ten_minute_sample

from knightly import time_management


def test_conditional_rates_require_games_and_decisions_and_include_costly_misses():
    games, moves = [], []
    for gid in range(1, 51):
        game, rows = ten_minute_sample(gid)
        games.append(game)
        moves.extend(rows)
    below = time_management.summarize(games[:49], moves)
    assert below['fast']['rate'] is None
    assert below['fast']['decisions'] == 98
    result = time_management.summarize(games, moves)
    assert result['fast']['rate'] == 0.5
    assert result['fast']['numerator'] == 50
    assert result['long']['rate'] == 0.5
    assert result['pressure']['numerator'] == 50
    assert result['pressure']['decisions'] == 750
    assert result['timeouts'] == {'losses': 50, 'games': 50, 'examples': [1, 2, 3]}
    assert result['fast']['examples'][0]['ply'] == 21


def test_invalid_clocks_and_other_controls_do_not_become_timed_decisions():
    game, rows = ten_minute_sample()
    game['pgn'] = game['pgn'].replace('{[%clk 0:03:18]}', '')
    result = time_management.summarize([game], rows)
    assert result['excluded_decisions'] == 2
    assert result['fast']['decisions'] == 0
    game['time_control'] = '600+5'
    assert time_management.summarize([game], rows)['analysed_games'] == 0


def test_unknown_endings_and_timeout_draws_are_not_timeout_losses():
    game, rows = ten_minute_sample()
    game['termination'] = 'Opponent won - game abandoned'
    assert time_management.summarize([game], rows)['timeouts'] == {'losses': 0, 'games': 0, 'examples': []}
    game.update(termination='Game drawn by timeout vs insufficient material', user_outcome='draw')
    assert time_management.summarize([game], rows)['timeouts'] == {'losses': 0, 'games': 1, 'examples': []}
