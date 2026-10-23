"""Mistake layers: which habit or skill each of your game mistakes came from.

docs/specs/2026-10-16-safety-habit-training-design.md. Layers 0-2 are tagged from engine and
board facts; positional mistakes (layer 3) are left untagged. In order, the first that holds:

- theirThreat (0): the opponent already threatened something before your move, and the move
  that punishes yours is one of those threats.
- theirReply (0): your move allowed a short, forcing reply: mate in one or two, or a line that
  wins them a piece for a pawn (or more) within its first three plies.
- calculation (2): you started a forcing line (a capture or check) that loses a piece for a
  pawn or more only later in the engine's line.
- ownTactic (1): you missed a tactic of your own; the engine's best move carries one out.

Time trouble is a separate flag: the decision began with less than a tenth of the base time
or less than 30 seconds on the clock.
"""

import json
import re
from datetime import date, datetime, timedelta

import chess
import chess.engine

from . import db, patterns, positions, threats
from .analyze import engine_pool, find_engine
from .explain import REFUTE_PLIES, _walk
from .threats import LOSS

LAYERS = ("theirThreat", "theirReply", "calculation", "ownTactic")
OTHER = "other"  # settled; no layer holds
UNKNOWN = "unknown"  # a search was capped: not a fact either way
REPLY_PLIES = 3  # theirReply: the loss comes within this many plies of their reply
SEARCH_TIME = 1.5  # seconds per search
LAYER_BATCH = 200  # rows settled per run; the rest wait for the next
# Settle this far back: two of Progress's 90-day periods, so the skill shape's previous
# period has layers too (skill_shape.py).
SETTLE_DAYS = 2 * patterns.RECENT_DAYS
LOW_CLOCK_SHARE = 0.1
LOW_CLOCK_SECONDS = 30
CLOCK = re.compile(r"^(\d+)(?:\+(\d+))?$")


def _net(board: chess.Board, moves: list[chess.Move], limit: int) -> int:
    """What the opponent of the side to move in `board` nets over `moves` (the learner's
    move first), counted for `limit` moves with recaptures followed."""
    learner = board.turn
    _, gained, _ = _walk(board, moves, limit)
    return gained[not learner] - gained[learner]


def classify(
    board: chess.Board,
    uci: str,
    classification: str,
    best_uci: str | None,
    threat_set: list[dict] | None,
    refutation: dict | None,
) -> str | None:
    """The layer of the learner's move `uci` from `board`, or None. `threat_set` is the threat
    search before the move ([] when there was none, or nothing to ask); `refutation` is the
    engine's line after it: {"pv": [Move], "score": PovScore}."""
    move = chess.Move.from_uci(uci)
    learner = board.turn
    if classification in ("mistake", "blunder") and refutation and refutation.get("pv"):
        pv = refutation["pv"]
        mate = refutation["score"].pov(learner).mate()
        they_mate = mate is not None and mate < 0
        line = [move, *pv]
        costly = they_mate or _net(board, line, 1 + REFUTE_PLIES) >= LOSS
        if costly and threat_set and pv[0].uci() in {t["uci"] for t in threat_set}:
            return "theirThreat"
        if (they_mate and -mate <= 2) or _net(board, line, 1 + REPLY_PLIES) >= LOSS:
            return "theirReply"
        if costly and (board.is_capture(move) or board.gives_check(move)):
            return "calculation"
    if best_uci:
        best = chess.Move.from_uci(best_uci)
        if best in board.legal_moves and patterns.motif(board, best) is not None:
            return "ownTactic"
    return None


def time_trouble(time_control: str | None, ply: int, previous_clock: float | None, setup: bool) -> bool | None:
    """Whether the decision at `ply` began low on the clock: below a tenth of the base time or
    30 seconds. The starting clock is the player's clock after their previous move, or the base
    for their first. None when it can't be known (no supported clock, a setup position)."""
    m = CLOCK.match(time_control or "")
    if not m:
        return None
    base = int(m.group(1))
    if ply <= 2:
        start = None if setup else base
    else:
        start = previous_clock
    if start is None:
        return None
    return start < max(LOW_CLOCK_SHARE * base, LOW_CLOCK_SECONDS)


def _line_json(board: chess.Board, info: dict) -> dict:
    score = info["score"].white()
    return {"line": [m.uci() for m in (info.get("pv") or [])[:REFUTE_PLIES]], "cp": score.score(), "mate": score.mate()}


def settle_one(
    engine: chess.engine.SimpleEngine,
    fen: str,
    uci: str,
    classification: str,
    best_uci: str | None,
    depth: int = patterns.DEEP_DEPTH,
    time: float = SEARCH_TIME,
) -> tuple[str, dict | None]:
    """(layer, cause facts) for one learner move: the threat search before it and the
    refutation after it (mistakes and blunders only; a miss needs no search)."""
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    if move not in board.legal_moves:
        return OTHER, None
    if classification == "miss":
        return classify(board, uci, classification, best_uci, None, None) or OTHER, None
    threat_set = threats.search(engine, board, depth, time)
    if threat_set is None and threats.passed(board) is not None:
        return UNKNOWN, None
    after = board.copy()
    after.push(move)
    refutation = None
    if not after.is_game_over():
        info = engine.analyse(after, chess.engine.Limit(depth=depth, time=time))
        if info.get("depth", 0) < depth or "score" not in info:
            return UNKNOWN, None
        refutation = {"pv": info.get("pv") or [], "score": info["score"]}
    layer = classify(board, uci, classification, best_uci, threat_set or [], refutation)
    facts = {"threats": threat_set, "refutation": _line_json(after, refutation) if refutation else None}
    return layer or OTHER, facts


def settle(
    conn: db.Connection,
    engine_path: str | None = None,
    workers: int | None = None,
    depth: int = patterns.DEEP_DEPTH,
    log=print,
    today: date | None = None,
) -> int:
    """Tag up to LAYER_BATCH of your unsettled mistakes, misses and blunders in rated games of
    the last SETTLE_DAYS, newest first. Returns how many were settled."""
    today = today or db.today(conn)
    since = db.stamp(datetime.combine(today, datetime.min.time()) - timedelta(days=SETTLE_DAYS))
    rows = conn.execute(
        f"""SELECT m.game_id, m.ply, m.uci, m.best_uci, m.classification,
                   p.clock_left AS previous_clock, g.time_control, g.start_fen
            FROM moves m JOIN games g ON g.id = m.game_id
            LEFT JOIN moves p ON p.game_id = m.game_id AND p.ply = m.ply - 2
            WHERE m.is_user AND m.layer IS NULL AND g.rated AND g.played_at >= %s
              AND m.classification IN ({", ".join("%s" for _ in patterns.KINDS)})
            ORDER BY g.played_at DESC, m.game_id, m.ply LIMIT %s""",
        (since, *patterns.KINDS, LAYER_BATCH),
    ).fetchall()
    if not rows:
        return 0
    fens = positions.fens(conn, [r["game_id"] for r in rows])
    needs_engine = any(r["classification"] != "miss" for r in rows)
    engine_path = find_engine(engine_path) if needs_engine else None
    log(f"Tagging {len(rows)} mistakes by what went wrong...")

    def work(r):
        fen = fens.get((r["game_id"], r["ply"]))
        trouble = time_trouble(r["time_control"], r["ply"], r["previous_clock"], bool(r["start_fen"]))
        if fen is None:  # the game's moves don't replay
            return OTHER, trouble, None, r["game_id"], r["ply"]
        layer, facts = settle_one(
            engine() if r["classification"] != "miss" else None,
            fen,
            r["uci"],
            r["classification"],
            r["best_uci"],
            depth,
        )
        return layer, trouble, json.dumps(facts) if facts else None, r["game_id"], r["ply"]

    with engine_pool(engine_path, workers) as (pool, engine):
        settled = list(pool.map(work, rows))
    with conn:
        conn.executemany(
            "UPDATE moves SET layer = %s, time_trouble = %s, cause_facts = %s::jsonb WHERE game_id = %s AND ply = %s",
            settled,
        )
    return len(settled)


def counts(conn: db.Connection, since: str | None) -> dict[str, int]:
    """How many of your mistakes, misses and blunders in rated games since `since` (None: all
    time) fall in each layer, plus "other" (untagged) and "pending" (not settled or capped)."""
    rows = conn.execute(
        f"""SELECT coalesce(m.layer, 'pending') AS layer, count(*) AS n FROM moves m
            JOIN games g ON g.id = m.game_id
            WHERE m.is_user AND g.rated
              AND m.classification IN ({", ".join("%s" for _ in patterns.KINDS)})
              {"AND g.played_at >= %s" if since else ""}
            GROUP BY 1""",
        (*patterns.KINDS, *((since,) if since else ())),
    ).fetchall()
    out = {k: 0 for k in (*LAYERS, OTHER, "pending")}
    for r in rows:
        key = "pending" if r["layer"] == UNKNOWN else r["layer"]
        out[key] = out.get(key, 0) + r["n"]
    return out
