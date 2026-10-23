import chess
import chess.engine
import pytest
from conftest import add_blunder_card

from knightly import practice_grades as grades


class Engine:
    id = {'name': 'Testfish 1'}

    def analyse(self, board, limit, multipv=None):
        return {'score': chess.engine.PovScore(chess.engine.Cp(30), chess.WHITE), 'depth': 14}


def test_preparation_keeps_alternative_good_moves():
    result = grades.compute(chess.STARTING_FEN, 'e2e4', 30, Engine())
    assert result['grades']['e2e4'] == 'best'
    assert result['grades']['d2d4'] == 'excellent'
    assert len(result['grades']) == 20


def test_incomplete_search_never_marks_a_move_wrong():
    class Shallow(Engine):
        def analyse(self, board, limit, multipv=None):
            return {'score': chess.engine.PovScore(chess.engine.Cp(-1000), chess.WHITE), 'depth': 3}

    result = grades.compute(chess.STARTING_FEN, 'e2e4', 30, Shallow())
    assert result['grades'] == {'e2e4': 'best'}
    assert result['complete'] is False


def test_wrong_moves_get_causes_and_the_map_keeps_the_threat_and_candidates():
    # White's knight on e4 is attacked by the d5 pawn; a king move leaves it there.
    fen = '7k/8/8/3p4/4N3/8/8/K7 w - - 0 1'

    class Table(Engine):
        def analyse(self, board, limit, multipv=None):
            def info(pv, cp):
                return {
                    'pv': [chess.Move.from_uci(m) for m in pv],
                    'depth': 14,
                    'score': chess.engine.PovScore(chess.engine.Cp(cp), chess.WHITE),
                }

            if multipv and board.turn == chess.BLACK:  # the threat search, White passing
                return [info(['d5e4'], -300)]
            if multipv:  # the root search: the top moves
                return [info(['e4c3'], 0), info(['e4d6'], -20)]
            if board.piece_at(chess.E4) == chess.Piece(chess.KNIGHT, chess.WHITE):
                return info(['d5e4'], -300)
            return info(['h8g8'], 0)

    result = grades.compute(fen, 'e4c3', 0, Table())
    assert result['version'] == 3
    assert result['grades']['a1a2'] == 'wrong'
    assert result['explanations']['a1a2']['cause'] == {
        'cause_kind': 'missedThreat',
        'principle': 'blunderCheck',
        'cause_text': "They were already threatening dxe4 to win your knight. Your move didn't stop it.",
    }
    assert result['threat'] == {'uci': 'd5e4', 'san': 'dxe4', 'line': ['d5e4']}
    assert [c['san'] for c in result['candidates']] == ['Nc3', 'Nd6']
    assert result['candidates'][0]['reason_text'] == 'Stops their threat dxe4.'


def test_required_underpromotion_and_legal_mate():
    fen = '8/6P1/5KBk/8/8/8/8/8 w - - 0 1'
    result = grades.compute(fen, 'g7g8n', 10000, Engine())
    assert result['grades']['g7g8n'] == 'best'
    assert result['grades']['g7g8q'] == 'wrong'


def test_fingerprint_invalidates_changes_to_position_reference_engine_or_policy(monkeypatch):
    key = grades.fingerprint(chess.STARTING_FEN, 'e2e4', 30, 'Testfish 1')
    assert key != grades.fingerprint(chess.STARTING_FEN, 'd2d4', 30, 'Testfish 1')
    assert key != grades.fingerprint(chess.STARTING_FEN, 'e2e4', 50, 'Testfish 1')
    assert key != grades.fingerprint(chess.STARTING_FEN, 'e2e4', 30, 'Testfish 2')
    monkeypatch.setattr(grades, 'VERSION', grades.VERSION + 1)
    assert key != grades.fingerprint(chess.STARTING_FEN, 'e2e4', 30, 'Testfish 1')


def test_prepared_answer_skips_engine_and_preserves_first_grade(db_url, monkeypatch):
    from knightly import db, deck

    conn = db.connect(db_url)
    gid = add_blunder_card(conn, "grade-test")
    monkeypatch.setattr(grades, 'engine_revision', lambda: 'Testfish 1')
    value = grades.compute(chess.STARTING_FEN, 'e2e4', 30, Engine())
    import json

    conn.execute('UPDATE moves SET practice_grades = %s::jsonb WHERE game_id = %s', (json.dumps(value), gid))
    monkeypatch.setattr(deck, 'judge', lambda *args: pytest.fail('prepared answer must not search'))
    result = deck.answer(conn, gid, 1, 'd2d4', seconds=12)
    assert result['quality'] == 'excellent' and result['rating'] == 'good'
    assert deck.answer(conn, gid, 1, 'd2d4')['rating'] is None
    assert conn.execute('SELECT count(*) FROM card_reviews').fetchone()[0] == 1
    conn.close()


def test_cache_reference_change_uses_live_grader(db_url, monkeypatch):
    import json

    from knightly import db, deck

    conn = db.connect(db_url)
    gid = add_blunder_card(conn, "grade-test")
    monkeypatch.setattr(grades, 'engine_revision', lambda: 'Testfish 1')
    value = grades.compute(chess.STARTING_FEN, 'e2e4', 30, Engine())
    conn.execute(
        'UPDATE moves SET practice_grades = %s::jsonb, eval_before = 500 WHERE game_id = %s', (json.dumps(value), gid)
    )
    monkeypatch.setattr(deck, 'judge', lambda *args: 'wrong')
    assert deck.answer(conn, gid, 1, 'd2d4')['quality'] == 'wrong'
    conn.close()


def test_worker_batches_cards_outside_transactions_and_api_queues_once(db_url, monkeypatch):
    from fastapi.testclient import TestClient

    from knightly import api, db, jobs

    conn = db.connect(db_url)
    add_blunder_card(conn, "grade-test")
    monkeypatch.setattr(grades, 'engine_revision', lambda: 'Testfish 1')
    client = TestClient(api.create_app(database_url=db_url))
    assert client.get('/api/deck').json()['card']['feedback'] is None
    client.get('/api/deck')
    assert jobs.pending(conn) == ['practice']

    class WorkingEngine(Engine):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def configure(self, config):
            pass

        def analyse(self, board, limit, multipv=None):
            assert not conn._transactions
            return super().analyse(board, limit, multipv)

    monkeypatch.setattr(chess.engine.SimpleEngine, 'popen_uci', lambda _: WorkingEngine())
    assert jobs.work(db_url, scheduler=False, once=True, log=lambda _: None) == 1
    feedback = client.get('/api/deck').json()['card']['feedback']
    assert feedback['grades']['d2d4'] == 'excellent'
    assert grades.prepare_due(conn) is False
    conn.close()


def test_cache_and_feedback_endpoint_keep_user_isolation(db_url, monkeypatch):
    from fastapi.testclient import TestClient

    from knightly import api, db, users

    conn = db.connect(db_url)
    gid = add_blunder_card(conn, "grade-test")
    conn.execute("UPDATE moves SET practice_grades = '{\"private\":true}'::jsonb WHERE game_id = %s", (gid,))
    owner = db.connect(db_url)
    other_id = users.ensure(owner, 'user_other')
    other = db.connect(db_url, migrate=False, user_id=other_id)
    assert other.execute('SELECT practice_grades FROM moves WHERE game_id = %s', (gid,)).fetchall() == []
    assert other.execute('UPDATE moves SET practice_grades = NULL WHERE game_id = %s', (gid,)).rowcount == 0
    assert TestClient(api.create_app(database_url=db_url)).get('/api/deck/feedback/9999/1').status_code == 404
    other.close()
    owner.close()
    conn.close()


def test_engine_failure_does_not_record_a_wrong_grade(db_url, monkeypatch):
    from fastapi.testclient import TestClient

    from knightly import api, db

    conn = db.connect(db_url)
    gid = add_blunder_card(conn, "grade-test")

    def unavailable(*args):
        raise OSError('engine unavailable')

    monkeypatch.setattr(chess.engine.SimpleEngine, 'popen_uci', unavailable)
    response = TestClient(api.create_app(database_url=db_url)).post(
        '/api/deck/answer', json={'game_id': gid, 'ply': 1, 'uci': 'd2d4'}
    )
    assert response.status_code == 503
    assert conn.execute('SELECT count(*) FROM card_reviews').fetchone()[0] == 0
    conn.close()


def test_partial_cache_missing_move_falls_back_to_server(db_url, monkeypatch):
    import json

    from knightly import db, deck

    conn = db.connect(db_url)
    gid = add_blunder_card(conn, "grade-test")
    monkeypatch.setattr(grades, 'engine_revision', lambda: 'Testfish 1')
    value = grades.compute(chess.STARTING_FEN, 'e2e4', 30, Engine())
    value['grades'] = {'e2e4': 'best'}
    value['complete'] = False
    conn.execute('UPDATE moves SET practice_grades = %s::jsonb WHERE game_id = %s', (json.dumps(value), gid))
    monkeypatch.setattr(deck, 'judge', lambda *args: 'excellent')
    assert deck.answer(conn, gid, 1, 'd2d4')['quality'] == 'excellent'
    conn.close()


def test_preparation_bounds_each_job_and_continues_remaining_cards(db_url, monkeypatch):
    from knightly import db

    conn = db.connect(db_url)
    for i in range(3):
        add_blunder_card(conn, f'card-{i}')
    monkeypatch.setattr(grades, 'engine_revision', lambda: 'Testfish 1')

    class WorkingEngine(Engine):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def configure(self, config):
            pass

    monkeypatch.setattr(chess.engine.SimpleEngine, 'popen_uci', lambda _: WorkingEngine())
    assert grades.prepare_due(conn) is True
    assert conn.execute('SELECT count(*) FROM moves WHERE practice_grades IS NOT NULL').fetchone()[0] == 2
    assert grades.prepare_due(conn) is False
    assert conn.execute('SELECT count(*) FROM moves WHERE practice_grades IS NOT NULL').fetchone()[0] == 3
    # The test engine's searches stop short of LINE_DEPTH: every card keeps its one move.
    lines = [r[0] for r in conn.execute('SELECT practice_line FROM moves')]
    assert [value['moves'] for value in lines] == [['e2e4']] * 3
    conn.close()
