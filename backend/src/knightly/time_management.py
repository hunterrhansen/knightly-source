"""Descriptive 10+0 diagnostics. Reconstruct from PGN so old timing rows cannot skew rates."""

import io
import math
from collections import defaultdict

import chess.pgn

from .analyze import THRESHOLDS

POLICY = "10+0-descriptive-v1"
ERROR_DROP = THRESHOLDS[1][0]


def summarize(games, moves):
    by_game = defaultdict(dict)
    for move in moves:
        by_game[move['game_id']][move['ply']] = move
    samples = []
    total = 0
    eligible_games = []
    versions = set()
    for g in games:
        if g['source'] != 'chesscom' or g['time_control'] not in ('600', '600+0') or g['variant'] != 'standard':
            continue
        eligible_games.append(g)
        versions.add(f"{g['engine']} / {g['nodes']} nodes / depth {g['depth']}")
        game = chess.pgn.read_game(io.StringIO(g['pgn'] or ''))
        if game is None or game.errors or g['user_color'] not in ('white', 'black'):
            continue
        board = game.board()
        # A setup position has no reliable original clock baseline.
        last = {
            True: None if game.headers.get('SetUp') == '1' else 600,
            False: None if game.headers.get('SetUp') == '1' else 600,
        }
        for ply, node in enumerate(game.mainline(), 1):
            side = board.turn
            mine = (g['user_color'] == 'white') == side
            clock = node.clock()
            if clock is not None and (not math.isfinite(clock) or clock < 0):
                clock = None
            start = last[side]
            m = by_game[g['id']].get(ply)
            if mine:
                total += 1
                if (
                    start is not None
                    and clock is not None
                    and 0 <= clock <= start
                    and m is not None
                    and m['is_user']
                    and m['uci'] == node.move.uci()
                    and m['win_pct_before'] is not None
                    and m['win_pct_after'] is not None
                ):
                    samples.append(
                        dict(
                            game=g['id'],
                            ply=ply,
                            san=m['san'],
                            start=start,
                            spent=round(start - clock, 2),
                            error=m['win_pct_before'] - m['win_pct_after'] >= ERROR_DROP,
                            eligible=m['phase'] != 'opening' and board.legal_moves.count() > 1,
                        )
                    )
            last[side] = clock
            board.push(node.move)

    def metric(rs, errors=False, conditional=False):
        numerator = sum(r['error'] for r in rs) if errors else sum(r['start'] < 30 for r in rs)
        distinct = len({r['game'] for r in rs})
        ready = bool(rs) and (not conditional or distinct >= 50 and len(rs) >= 100)
        return dict(
            numerator=numerator,
            decisions=len(rs),
            games=distinct,
            rate=numerator / len(rs) if ready else None,
            reason=None if ready else 'insufficient_sample',
            examples=[
                dict(
                    game_id=r['game'],
                    ply=r['ply'],
                    san=r['san'],
                    seconds=round(r['spent'], 2),
                    starting_clock=round(r['start'], 2),
                )
                for r in rs
                if r['error']
            ][:3]
            if errors
            else [
                dict(
                    game_id=r['game'],
                    ply=r['ply'],
                    san=r['san'],
                    seconds=round(r['spent'], 2),
                    starting_clock=round(r['start'], 2),
                )
                for r in rs
                if r['start'] < 30
            ][:3],
        )

    ample = [r for r in samples if r['eligible'] and r['start'] >= 120]
    # Unknown and abandoned terminations are excluded rather than assumed non-timeouts.
    known = [
        g
        for g in eligible_games
        if g['user_outcome'] in ('win', 'loss', 'draw')
        and g['termination']
        and any(
            word in g['termination'].lower()
            for word in (
                'checkmate',
                'resignation',
                'repetition',
                'stalemate',
                'insufficient',
                '50-move',
                'on time',
                'timeout',
            )
        )
        and 'abandon' not in g['termination'].lower()
    ]
    timeout = sum(
        g['user_outcome'] == 'loss' and any(word in g['termination'].lower() for word in ('on time', 'timeout'))
        for g in known
    )
    return dict(
        policy=POLICY,
        control='600+0',
        analysis_versions=sorted(versions),
        analysed_games=len(eligible_games),
        timed_decisions=len(samples),
        excluded_decisions=total - len(samples),
        pressure=metric(samples),
        fast=metric([r for r in ample if 0.2 < r['spent'] <= 2], True, True),
        long=metric([r for r in ample if r['spent'] >= 30], True, True),
        timeouts=dict(
            losses=timeout,
            games=len(known),
            examples=[
                g['id']
                for g in known
                if g['user_outcome'] == 'loss'
                and any(word in g['termination'].lower() for word in ('on time', 'timeout'))
            ][:3],
        ),
    )


def load(conn, since: str | None):
    """The rated, analysed Chess.com 10+0 games since `since` (None: all time) and their
    moves, as summarize takes them."""
    scope = """WHERE g.rated AND g.source = 'chesscom' AND g.time_control IN ('600', '600+0')
                 AND g.variant = 'standard' """ + ("AND g.played_at >= %s " if since else "")
    params = (since,) if since else ()
    games = conn.execute(
        "SELECT g.*, a.engine, a.nodes, a.depth FROM games g JOIN game_analysis a ON a.game_id=g.id "
        + scope
        + "ORDER BY g.played_at, g.id",
        params,
    ).fetchall()
    moves = conn.execute(
        "SELECT m.* FROM moves m JOIN games g ON g.id=m.game_id JOIN game_analysis a ON a.game_id=g.id " + scope,
        params,
    ).fetchall()
    return games, moves
