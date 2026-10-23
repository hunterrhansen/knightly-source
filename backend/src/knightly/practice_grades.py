"""Prepare practice feedback in the worker, never search in a deck GET.

A partial map is useful; missing moves always fall back to authoritative grading.
Cache identity includes the engine binary and every input to the grading policy.

Each wrong first move also keeps its coaching explanation (explain.py), from the same
search that graded it, with its cause (causes.py) when one holds; the map carries the
solution line's why, the threat that stood before the move and the top candidate moves.
"""

import hashlib
import json
import time
from functools import lru_cache
from pathlib import Path

import chess
import chess.engine

from . import causes, explain, positions, practice_lines, threats
from .analyze import find_engine

VERSION = 3
CANDIDATES = 3
MOVE_TIME = 2.0
CARD_TIME = 30.0
BATCH = 2
PRIORITY = 1
QUALITIES = {'best', 'excellent', 'good', 'wrong'}


@lru_cache(maxsize=4)
def _binary_revision(path, size, modified):
    with open(path, 'rb') as binary:
        return hashlib.file_digest(binary, 'sha256').hexdigest()


def engine_revision():
    try:
        path = Path(find_engine(None)).resolve()
        stat = path.stat()
        return _binary_revision(str(path), stat.st_size, stat.st_mtime_ns)
    except (SystemExit, OSError):
        return None


def fingerprint(fen, best_uci, eval_best, engine, line=None, mate_before=None):
    from . import deck

    value = [
        VERSION,
        fen,
        best_uci,
        eval_best,
        engine,
        deck.JUDGE_DEPTH,
        deck.GOOD_DROP,
        deck.HARD_DROP,
        MOVE_TIME,
        CARD_TIME,
        line or [best_uci],
        mate_before,
        explain.REFUTE_PLIES,
        causes.EQUAL_CP,
        causes.AHEAD,
        CANDIDATES,
    ]
    return hashlib.sha256(json.dumps(value, separators=(',', ':')).encode()).hexdigest()


def likely_first(board, moves):
    """Captures and checks first: the wrong tries worth explaining when time runs out."""
    return sorted(moves, key=lambda m: (not board.is_capture(m), not board.gives_check(m)))


def compute(fen, best_uci, eval_best, engine, revision=None, line=None, mate_before=None):
    """The grade map for `fen`, with an explanation for each wrong first move and the why
    of `line` (the card's solution; its one best move when omitted)."""
    from . import deck

    board = chess.Board(fen)
    line = line or [best_uci]
    solution = explain.why(fen, line, mate_before)
    grades, explanations = {}, {}
    legal = list(board.legal_moves)
    began = time.monotonic()
    # The root searches come first, so a map cut short by CARD_TIME still has them.
    threat_set = threats.search(engine, board, deck.JUDGE_DEPTH, MOVE_TIME)
    infos = (
        engine.analyse(
            board, chess.engine.Limit(depth=deck.JUDGE_DEPTH, time=MOVE_TIME), multipv=min(CANDIDATES, len(legal))
        )
        if legal
        else []
    )
    top = causes.candidates(board, infos if isinstance(infos, list) else [infos], deck.JUDGE_DEPTH, threat_set)
    # The known best is available even if the rest exceeds the batch's CPU budget.
    if chess.Move.from_uci(best_uci) in legal:
        grades[best_uci] = 'best'
    for move in likely_first(board, legal):
        uci = move.uci()
        if uci in grades:
            continue
        after = board.copy()
        after.push(move)
        if after.is_checkmate():
            grades[uci] = 'best'
        elif after.is_game_over():
            grades[uci] = deck.quality_from_score(board.turn, eval_best, 0) if eval_best is not None else 'wrong'
        elif eval_best is not None and time.monotonic() - began < CARD_TIME:
            info = engine.analyse(after, chess.engine.Limit(depth=deck.JUDGE_DEPTH, time=MOVE_TIME))
            # A capped shallow search is uncertainty, not evidence of a bad move.
            if info.get('depth', 0) >= deck.JUDGE_DEPTH and 'score' in info:
                score = info['score'].white().score(mate_score=10000)
                if score is not None:
                    grades[uci] = deck.quality_from_score(board.turn, eval_best, score)
                    if grades[uci] == 'wrong':
                        reason = _explain(board, uci, info, solution, threat_set)
                        if reason:
                            explanations[uci] = reason
    key = fingerprint(fen, best_uci, eval_best, revision or engine.id['name'], line, mate_before)
    threat = threat_set[0] if threat_set else None
    return {
        'version': VERSION,
        'key': key,
        'fen': fen,
        'grades': grades,
        'complete': len(grades) == len(legal),
        'explanations': explanations,
        'why': solution,
        'threat': {k: threat[k] for k in ('uci', 'san', 'line')} if threat else None,
        'candidates': top,
    }


def _explain(board, uci, info, solution, threat_set):
    """#88's explanation of a wrong first move, with its cause and principle when they hold."""
    reason = explain.explain_wrong(board, uci, info, solution)
    mate = info['score'].pov(board.turn).mate()
    found = causes.cause(
        board,
        uci,
        threat_set,
        [m.uci() for m in info.get('pv') or []],
        -mate if mate is not None and mate < 0 else None,
    )
    if found:
        cause = {k: found[k] for k in ('cause_kind', 'cause_text', 'principle')}
        # A cause names the reply, so it stands in when #88 had nothing to say.
        reason = reason or {
            'reply_uci': found['reply_uci'],
            'reply_san': found['reply_san'],
            'reason_kind': 'eval',
            'reason_text': found['cause_text'],
        }
        return {**reason, 'cause': cause}
    if reason and reason['reason_kind'] == 'hangingPiece':
        return {**reason, 'principle': causes.principle(None, None, 'hangingPiece')}
    return reason


def cached(row, fen):
    value = row['practice_grades']
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    if not isinstance(value, dict):
        return None
    revision = engine_revision()
    if not revision:
        return None
    line = practice_lines.line_for(row, fen)
    key = fingerprint(fen, row['best_uci'], row['eval_before'], revision, line, row['mate_before'])
    if value.get('version') != VERSION or value.get('key') != key:
        return None
    grades = value.get('grades')
    if not isinstance(grades, dict) or any(not isinstance(q, str) or q not in QUALITIES for q in grades.values()):
        return None
    legal = {move.uci() for move in chess.Board(fen).legal_moves}
    if value.get('fen') != fen or not set(grades).issubset(legal):
        return None
    if not isinstance(value.get('explanations'), dict) or not set(value['explanations']).issubset(legal):
        return None
    return value


def load(conn, game_id, ply):
    row = conn.execute(
        'SELECT best_uci, eval_before, mate_before, practice_grades, practice_line FROM moves WHERE game_id = %s AND ply = %s',
        (game_id, ply),
    ).fetchone()
    return row, positions.fen_before(conn, game_id, ply) if row else None


def candidates(conn, first=None):
    from . import deck

    ids = [(first['game_id'], first['ply'])] if first else []
    ids += [(r['game_id'], r['ply']) for r in deck.queue(conn)]
    ids += [(r['game_id'], r['ply']) for r in deck.today_results(conn)]
    pending = []
    for game_id, ply in dict.fromkeys(ids):
        row, fen = load(conn, game_id, ply)
        if row and fen and row['best_uci'] and not (cached(row, fen) and practice_lines.cached(row, fen)):
            pending.append((game_id, ply, row, fen))
    return pending


def prepare_due(conn, first=None):
    """Prepare up to BATCH cards, then (with room left) today's served puzzle's feedback.
    True while either still has work."""
    from . import puzzle_feedback

    todo = candidates(conn, first)
    puzzle = puzzle_feedback.pending(conn)
    if not todo and not puzzle:
        return False
    revision = engine_revision()
    if revision is None:
        raise RuntimeError('Stockfish unavailable for practice preparation')
    # The worker already has bounded CPU; one engine is shared serially per batch.
    with chess.engine.SimpleEngine.popen_uci(find_engine(None)) as engine:
        engine.configure({'Threads': 1, 'Hash': 32})
        for game_id, ply, row, fen in todo[:BATCH]:
            # No transaction is held during engine work. Reject a changed reference.
            # The line comes first: the grade map explains it, and its key names it.
            line = practice_lines.cached(row, fen)
            if not line:
                line = practice_lines.compute(fen, row['best_uci'], row['eval_before'], engine, revision)
                conn.execute(
                    '''UPDATE moves SET practice_line = %s::jsonb
                                WHERE game_id = %s AND ply = %s AND best_uci = %s
                                  AND eval_before IS NOT DISTINCT FROM %s''',
                    (json.dumps(line), game_id, ply, row['best_uci'], row['eval_before']),
                )
                row, _ = load(conn, game_id, ply)
                if row is None:
                    continue
            if not cached(row, fen):
                value = compute(
                    fen,
                    row['best_uci'],
                    row['eval_before'],
                    engine,
                    revision,
                    practice_lines.line_for(row, fen),
                    row['mate_before'],
                )
                conn.execute(
                    '''UPDATE moves SET practice_grades = %s::jsonb
                                WHERE game_id = %s AND ply = %s AND best_uci = %s
                                  AND eval_before IS NOT DISTINCT FROM %s''',
                    (json.dumps(value), game_id, ply, row['best_uci'], row['eval_before']),
                )
        if puzzle and len(todo) < BATCH:
            puzzle_feedback.prepare(conn, puzzle, engine, revision)
    return bool(candidates(conn, first)) or puzzle_feedback.pending(conn) is not None
