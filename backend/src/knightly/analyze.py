"""Stockfish pass: evaluate every position of every game into the `moves` table.

Each worker thread owns one single-threaded Stockfish process; that scales better across
cores than one big multi-threaded engine. Results are written one game per transaction, so
an interrupted run keeps what it finished and the next run picks up the rest.
"""

import io
import math
import os
import re
import shutil
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager

import chess
import chess.engine
import chess.pgn

from . import brilliance, db, positions

MATE_CP = 10000  # mate-in-N stored as +/-(MATE_CP - N)
CLAMP_CP = 1000  # evals clamped to this for cp_loss / win% so mates don't dominate averages
PIECE_VALUES = {chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}

# Drop in the mover's win% (0-100) for each label, Chess.com's "expected points lost"
# bands (0.02 / 0.05 / 0.10 / 0.20) on a 0-100 scale. Smaller drops are "excellent".
THRESHOLDS = [(20, "blunder"), (10, "mistake"), (5, "inaccuracy"), (2, "good")]
# A "miss" fails to cash in an opponent's error: their previous move lost at least MISS_DROP
# (a mistake or blunder), your best reply would have left you at least MISS_EDGE to win, and
# your move ends within MISS_RETURN of where you stood before their error, or worse.
MISS_DROP = 10
MISS_EDGE = 60
MISS_RETURN = 5
# Lichess's win% slope. Accuracy always uses it, so accuracy history stays comparable.
LICHESS_K = 0.00368208
# Classification uses a slope matched to the mover's rating: weaker players convert an
# advantage less reliably, so the same engine loss costs them fewer expected points (as
# Chess.com's expected-points model does). (rating, k) points, linear in between and flat
# outside; unknown ratings use UNKNOWN_RATING's. Fitted on 2026-10-20 by
# scripts/fit-win-curve.py from 93,000 rapid player sides of Lichess's September 2026
# games with evaluations (ratings mapped to Chess.com's by ChessGoals' July 2026 survey)
# plus the local corpus (153 sides): a weighted straight line through the 500-2200 bands,
# k = 0.001732 + 7.96e-7 * rating, which meets Lichess's slope at about 2450.
K_BY_RATING = [(550, 0.002170), (2450, LICHESS_K)]
UNKNOWN_RATING = 1500
# |cp| above this is a mate score (mate in N is stored as MATE_CP - N), not a huge evaluation.
MATE_BAR = MATE_CP - 200
# Great and Brilliant (brilliance.py) need the top move, or one losing less than this.
TOP_DROP = 1

MOVE_COLUMNS = [
    "game_id",
    "ply",
    "move_number",
    "color",
    "is_user",
    "phase",
    "san",
    "uci",
    "best_san",
    "best_uci",
    "eval_before",
    "eval_after",
    "mate_before",
    "mate_after",
    "cp_loss",
    "win_pct_before",
    "win_pct_after",
    "accuracy",
    "classification",
    "clock_left",
    "time_spent",
    "eval_second",
    "best_line",
    "reply_line",
]
# The longest engine line kept per position, as Lichess keeps (Info.LineMaxPlies).
LINE_MAX_PLIES = 12
SUMMARY_COLUMNS = [
    "game_id",
    "engine",
    "depth",
    "nodes",
    "user_acpl",
    "opponent_acpl",
    "user_accuracy",
    "opponent_accuracy",
    "user_inaccuracies",
    "user_mistakes",
    "user_blunders",
    "opponent_blunders",
]


def _clamp(cp: int) -> int:
    return max(-CLAMP_CP, min(CLAMP_CP, cp))


def win_pct(cp: int, k: float = LICHESS_K) -> float:
    """Lichess's win% curve (or the same shape with slope `k`), from the point of view of
    whoever `cp` is relative to."""
    cp = _clamp(cp)
    return 50 + 50 * (2 / (1 + math.exp(-k * cp)) - 1)


def slope(rating: int | None) -> float:
    """The win% slope for a player of `rating` (K_BY_RATING, interpolated)."""
    rating = UNKNOWN_RATING if rating is None else rating
    points = K_BY_RATING
    if rating <= points[0][0]:
        return points[0][1]
    for (r0, k0), (r1, k1) in zip(points, points[1:], strict=False):
        if rating <= r1:
            return k0 + (k1 - k0) * (rating - r0) / (r1 - r0)
    return points[-1][1]


def move_accuracy(win_before: float, win_after: float) -> float:
    """Lichess's per-move accuracy formula (100 = no win% lost)."""
    raw = 103.1668 * math.exp(-0.04354 * max(0.0, win_before - win_after)) - 3.1669
    return max(0.0, min(100.0, raw))


def classify(win_before: float, win_after: float, is_best: bool, special: str | None = None, miss: bool = False) -> str:
    """Label one move from the mover's win% before and after it. `special` is "brilliant"
    or "great" when brilliance.py found the move to be one; `miss` when is_miss said so."""
    if special:
        return special
    if is_best:
        return "best"
    if miss:
        return "miss"
    drop = win_before - win_after
    for threshold, label in THRESHOLDS:
        if drop >= threshold:
            return label
    return "excellent"


def is_miss(
    win_before: float, win_after: float, opponent_drop: float | None, opponent_missed: bool, win_before_error: float
) -> bool:
    """Whether a move failed to cash in the opponent's error. `opponent_drop` is what their
    previous move lost, `opponent_missed` whether it was itself a Miss (no chains of them),
    `win_before_error` where the mover stood before it. All on the mover's curve but the drop."""
    return (
        opponent_drop is not None
        and opponent_drop >= MISS_DROP
        and not opponent_missed
        and win_before >= MISS_EDGE
        and win_after <= win_before_error + MISS_RETURN
        and win_before - win_after >= MISS_RETURN
    )


def special(
    before: chess.Board,
    move: chess.Move,
    is_best: bool,
    win_before: float,
    win_after: float,
    cp_after: int,
    cp_second: int | None,
    rating: int | None = None,
    took_on: chess.Square | None = None,
    just_took: chess.Square | None = None,
) -> str | None:
    """ "brilliant", "great" or None for one move; evals in centipawns from the mover's side,
    win%s on the mover's curve. `took_on`: a square whose piece got there by capturing;
    `just_took`: where the opponent's previous move captured."""
    if not is_best and win_before - win_after >= TOP_DROP:
        return None
    if brilliance.is_brilliant(before, move, cp_after, cp_second):
        return "brilliant"
    win_second = win_pct(cp_second, slope(rating)) if cp_second is not None else None
    if brilliance.is_great(
        before, move, is_best, win_before, win_second, cp_after, cp_second, rating, took_on, just_took
    ):
        return "great"
    return None


def _took_on(rows: list[dict], boards: list[chess.Board], i: int, square: chess.Square) -> chess.Square | None:
    """`square` when the piece standing there before move i got there by capturing (taking
    it is taking back, not free material), else None. Only the latest arrival counts."""
    for j in range(i - 1, -1, -1):
        move = chess.Move.from_uci(rows[j]["uci"])
        if move.to_square == square:
            return square if boards[j].is_capture(move) else None
    return None


def grade(rows: list[dict], boards: list[chess.Board], ratings: tuple[int | None, int | None]) -> None:
    """Set win_pct_before, win_pct_after and classification on one game's moves, in order.
    Each row needs color, uci, best_uci, eval_before, eval_after and eval_second (White's
    point of view); boards[i] is the position rows[i] was played from.
    `ratings` are White's and Black's in that game; win%s are on the mover's curve."""
    prev = None
    for i, row in enumerate(rows):
        white = row["color"] == "white"
        sign, rating = (1, ratings[0]) if white else (-1, ratings[1])
        k = slope(rating)
        before, move = boards[i], chess.Move.from_uci(row["uci"])
        wb, wa = win_pct(sign * row["eval_before"], k), win_pct(sign * row["eval_after"], k)
        is_best = row["uci"] == row["best_uci"]
        second = row["eval_second"]
        took_on = _took_on(rows, boards, i, move.to_square)
        last = chess.Move.from_uci(rows[i - 1]["uci"]) if i > 0 else None
        just_took = took_on if last is not None and last.to_square == took_on else None
        found = special(
            before,
            move,
            is_best,
            wb,
            wa,
            sign * row["eval_after"],
            sign * second if second is not None else None,
            rating,
            took_on,
            just_took,
        )
        miss = prev is not None and is_miss(
            wb, wa, prev["drop"], prev["label"] == "miss", win_pct(sign * prev["eval_before"], k)
        )
        label = classify(wb, wa, is_best, found, miss)
        row.update(win_pct_before=round(wb, 2), win_pct_after=round(wa, 2), classification=label)
        prev = {"drop": wb - wa, "label": label, "eval_before": row["eval_before"]}


def only_move(color: str, eval_best: int | None, eval_second: int | None, bar: float) -> bool:
    """Whether one move was clearly it: the engine's second choice gives up at least `bar`
    points of win chance. Evals are White's point of view, as stored in `moves`.

    Mate is compared separately because win% saturates. Evals are clamped to CLAMP_CP before
    the curve, so a forced mate and a merely winning position both land near 98% and their
    gap reads as zero -- which would say that finding a mate next to another winning move was
    no achievement. A mate the alternative does not share is always the only move; one mate
    against another is not, since either wins."""
    if eval_best is None or eval_second is None:
        return False
    sign = 1 if color == "white" else -1
    best, second = sign * eval_best, sign * eval_second
    if best > MATE_BAR:
        return second <= MATE_BAR
    return win_pct(best) - win_pct(second) >= bar


def phase(board: chess.Board, move_number: int) -> str:
    """Endgame once both sides are down to <= 13 points of pieces (e.g. rook + two minors),
    opening for the first 10 moves otherwise, middlegame in between."""

    def material(color):
        return sum(v * len(board.pieces(p, color)) for p, v in PIECE_VALUES.items())

    if material(chess.WHITE) <= 13 and material(chess.BLACK) <= 13:
        return "endgame"
    return "opening" if move_number <= 10 else "middlegame"


def parse_time_control(tc: str | None) -> tuple[float | None, float]:
    """'600+5' -> (600, 5). Daily ('1/259200') and unknown controls -> (None, 0)."""
    m = re.fullmatch(r"(\d+)(?:\+(\d+))?", tc or "")
    if not m:
        return None, 0.0
    return float(m.group(1)), float(m.group(2) or 0)


def _evaluate(engine, board: chess.Board, depth: int | chess.engine.Limit) -> dict:
    """For one position, White POV: cp and mate-in-N for the best move, cp for the second
    best (None with only one legal move), the best move and the engine's line from it (at
    most LINE_MAX_PLIES). `depth` may be a full Limit, e.g. a node budget."""
    if board.is_checkmate():  # side to move has been mated
        return {
            "cp": -MATE_CP if board.turn == chess.WHITE else MATE_CP,
            "mate": None,
            "second": None,
            "best": None,
            "pv": [],
        }
    if board.is_game_over():  # stalemate, insufficient material, ...
        return {"cp": 0, "mate": None, "second": None, "best": None, "pv": []}
    limit = depth if isinstance(depth, chess.engine.Limit) else chess.engine.Limit(depth=depth)
    infos = engine.analyse(board, limit, multipv=2)
    score = infos[0]["score"].white()
    pv = infos[0].get("pv") or []
    second = infos[1]["score"].white().score(mate_score=MATE_CP) if len(infos) > 1 else None
    return {
        "cp": score.score(mate_score=MATE_CP),
        "mate": score.mate(),
        "second": second,
        "best": pv[0] if pv else None,
        "pv": pv[:LINE_MAX_PLIES],
    }


def _line(evaluation: dict) -> str | None:
    """A position's engine line as stored: space-separated UCI, None when there is none."""
    pv = evaluation.get("pv") or []
    return " ".join(m.uci() for m in pv[:LINE_MAX_PLIES]) or None


def analyze_game(
    engine,
    game_id: int,
    pgn: str,
    user_color: str | None,
    time_control: str | None,
    depth: int | chess.engine.Limit,
    evaluate_all=None,
    ratings: tuple[int | None, int | None] = (None, None),
) -> list[dict]:
    """Evaluate every position in the game and return one dict per half-move.
    `evaluate_all(boards) -> evals` replaces the one-engine loop, e.g. to spread the
    positions over several engines. `ratings` (White's, Black's) set the win% curves."""
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None:
        return []
    base, increment = parse_time_control(time_control)
    board = game.board()
    nodes = list(game.mainline())

    boards = [board.copy()]
    for node in nodes:
        board.push(node.move)
        boards.append(board.copy())
    evals = (evaluate_all or (lambda bs: [_evaluate(engine, b, depth) for b in bs]))(boards)

    last_clock = {chess.WHITE: base, chess.BLACK: base}
    rows = []
    for i, node in enumerate(nodes):
        before = boards[i]
        mover = before.turn
        sign = 1 if mover == chess.WHITE else -1
        cp_before, mate_before, best = evals[i]["cp"], evals[i]["mate"], evals[i]["best"]
        cp_after, mate_after = evals[i + 1]["cp"], evals[i + 1]["mate"]
        cp_second = evals[i]["second"]

        wb, wa = win_pct(sign * cp_before), win_pct(sign * cp_after)  # Lichess's, for accuracy

        clock = node.clock()
        if clock is not None and (not math.isfinite(clock) or clock < 0):
            clock = None
        spent = None
        if base is not None and base > 0 and clock is not None and last_clock[mover] is not None:
            elapsed = last_clock[mover] - clock + increment
            if elapsed >= 0:
                spent = elapsed
        # A missing annotation breaks adjacency. Unsupported controls (including daily
        # PGNs whose clocks represent elapsed time) never produce decision durations.
        last_clock[mover] = clock

        color = "white" if mover == chess.WHITE else "black"
        rows.append(
            {
                "game_id": game_id,
                "ply": i + 1,
                "move_number": before.fullmove_number,
                "color": color,
                "is_user": None if user_color is None else color == user_color,
                "phase": phase(before, before.fullmove_number),
                "san": before.san(node.move),
                "uci": node.move.uci(),
                "best_san": before.san(best) if best else None,
                "best_uci": best.uci() if best else None,
                "eval_before": cp_before,
                "eval_after": cp_after,
                "mate_before": mate_before,
                "mate_after": mate_after,
                "cp_loss": max(0, sign * (_clamp(cp_before) - _clamp(cp_after))),
                "accuracy": round(move_accuracy(wb, wa), 2),
                "clock_left": clock,
                "time_spent": round(spent, 2) if spent is not None else None,
                "eval_second": cp_second,
                "best_line": _line(evals[i]),
                "reply_line": _line(evals[i + 1]),
            }
        )
    grade(rows, boards, ratings)
    return rows


def budget(depth: int | None = None, nodes: int | None = None) -> chess.engine.Limit:
    """How hard to look at each position: a fixed depth when given, else a node budget."""
    return chess.engine.Limit(depth=depth) if depth else chess.engine.Limit(nodes=nodes or db.DEFAULT_NODES)


def describe(limit: chess.engine.Limit) -> str:
    return f"{limit.nodes / 1000:g}k nodes a move" if limit.nodes else f"depth {limit.depth}"


def summarize(game_id: int, rows: list[dict], engine_name: str, depth: int | chess.engine.Limit) -> dict:
    def side(user: bool):
        mine = [r for r in rows if r["is_user"] == user]
        return mine, (lambda f: round(sum(f(r) for r in mine) / len(mine), 1) if mine else None)

    limit = depth if isinstance(depth, chess.engine.Limit) else chess.engine.Limit(depth=depth)
    summary = {"game_id": game_id, "engine": engine_name, "depth": limit.depth, "nodes": limit.nodes}
    if not rows or rows[0]["is_user"] is None:
        return summary  # owner unknown: per-move rows are still useful, per-side stats aren't
    me, my_avg = side(True)
    opp, opp_avg = side(False)

    def count(rs, label):
        return sum(r["classification"] == label for r in rs)

    summary.update(
        user_acpl=my_avg(lambda r: r["cp_loss"]),
        opponent_acpl=opp_avg(lambda r: r["cp_loss"]),
        user_accuracy=my_avg(lambda r: r["accuracy"]),
        opponent_accuracy=opp_avg(lambda r: r["accuracy"]),
        user_inaccuracies=count(me, "inaccuracy"),
        user_mistakes=count(me, "mistake"),
        user_blunders=count(me, "blunder"),
        opponent_blunders=count(opp, "blunder"),
    )
    return summary


def reclassify(conn, log=print) -> int:
    """Re-grade every analysed move from its stored evaluations and the game's ratings (no
    engine needed), e.g. after THRESHOLDS or the win% curves change: win_pct_before/after and
    classification, then the per-game counts. Accuracy is left alone. Returns games updated."""
    games = [
        tuple(r)
        for r in conn.execute(
            """SELECT a.game_id, g.white_elo, g.black_elo FROM game_analysis a
               JOIN games g ON g.id = a.game_id ORDER BY a.game_id"""
        )
    ]
    updated = 0
    with conn:
        for game_id, white_elo, black_elo in games:
            rows = [
                dict(r)
                for r in conn.execute(
                    """SELECT ply, is_user, color, uci, best_uci, cp_loss, accuracy,
                          eval_before, eval_after, eval_second
                   FROM moves WHERE game_id = %s ORDER BY ply""",
                    (game_id,),
                )
            ]
            fens = positions.fens(conn, [game_id])
            if any((game_id, r["ply"]) not in fens for r in rows) or any(
                r["eval_before"] is None or r["eval_after"] is None for r in rows
            ):
                continue  # the game's moves don't replay: keep its labels
            grade(rows, [chess.Board(fens[(game_id, r["ply"])]) for r in rows], (white_elo, black_elo))
            conn.executemany(
                """UPDATE moves SET win_pct_before = %s, win_pct_after = %s, classification = %s
                   WHERE game_id = %s AND ply = %s""",
                [(r["win_pct_before"], r["win_pct_after"], r["classification"], game_id, r["ply"]) for r in rows],
            )
            updated += 1
            counts = summarize(game_id, rows, "", 0)
            if "user_blunders" in counts:
                conn.execute(
                    """UPDATE game_analysis SET user_inaccuracies = %s, user_mistakes = %s,
                       user_blunders = %s, opponent_blunders = %s WHERE game_id = %s""",
                    (
                        counts["user_inaccuracies"],
                        counts["user_mistakes"],
                        counts["user_blunders"],
                        counts["opponent_blunders"],
                        game_id,
                    ),
                )
        db.analysis_changed(conn)
    log(f"Regraded moves in {updated} of {len(games)} games.")
    return updated


def save(conn, game_id: int, rows: list[dict], summary: dict) -> None:
    with conn:  # one transaction per game
        conn.execute("DELETE FROM moves WHERE game_id = %s", (game_id,))
        conn.executemany(
            f"INSERT INTO moves ({', '.join(MOVE_COLUMNS)}) VALUES ({', '.join(['%s'] * len(MOVE_COLUMNS))})",
            [[r[c] for c in MOVE_COLUMNS] for r in rows],
        )
        conn.execute(
            f"INSERT INTO game_analysis ({', '.join(SUMMARY_COLUMNS)}) "
            f"VALUES ({', '.join(['%s'] * len(SUMMARY_COLUMNS))}) ON CONFLICT (game_id) DO UPDATE SET "
            + ", ".join(f"{c} = excluded.{c}" for c in SUMMARY_COLUMNS[1:])
            + ", analyzed_at = iso_now()",
            [summary.get(c) for c in SUMMARY_COLUMNS],
        )
        db.analysis_changed(conn)


def find_engine(path: str | None) -> str:
    found = path or os.environ.get("STOCKFISH") or shutil.which("stockfish")
    if not found:
        raise SystemExit("Stockfish not found. Install it (`brew install stockfish`) or pass --engine PATH.")
    return found


def default_workers() -> int:
    """One engine per core, leaving one core for the rest of the machine."""
    return max(1, (os.cpu_count() or 2) - 1)


@contextmanager
def engine_pool(engine_path: str | None, workers: int | None = None, hash_mb: int = 32):
    """A thread pool and an `engine()` that gives each worker thread its own single-threaded
    Stockfish, opened on first use. On exit the pool stops without waiting and every engine quits."""
    local, engines, lock = threading.local(), [], threading.Lock()

    def engine() -> chess.engine.SimpleEngine:
        if not hasattr(local, "engine"):
            local.engine = chess.engine.SimpleEngine.popen_uci(engine_path)
            local.engine.configure({"Threads": 1, "Hash": hash_mb})
            with lock:
                engines.append(local.engine)
        return local.engine

    pool = ThreadPoolExecutor(max_workers=workers or default_workers())
    try:
        yield pool, engine
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        for e in engines:
            try:
                e.quit()
            except Exception:
                pass


def unanalysed(conn) -> int:
    """How many games `run` would still analyse."""
    return conn.execute("""SELECT count(*) FROM games WHERE variant = 'standard'
                           AND id NOT IN (SELECT game_id FROM game_analysis)""").fetchone()[0]


def run(
    conn,
    depth: int | None = None,
    workers: int | None = None,
    engine_path: str | None = None,
    force: bool = False,
    limit: int | None = None,
    log=print,
    on_progress=None,
    nodes: int | None = None,
) -> int:
    """Analyse games that haven't been analysed yet (or all with force), newest first, at
    most `limit` of them. Each position gets `nodes` (default DEFAULT_NODES), or a fixed
    `depth` when that's given. Returns games analysed. `on_progress(done, total)` is called
    before the first game and after each one."""
    search = budget(depth, nodes)
    engine_path = find_engine(engine_path)
    workers = workers or default_workers()
    sql = """SELECT id, pgn, user_color, time_control, white_elo, black_elo FROM games
             WHERE variant = 'standard' {} ORDER BY played_at DESC NULLS LAST""".format(
        "" if force else "AND id NOT IN (SELECT game_id FROM game_analysis)"
    )
    if limit:
        sql += f" LIMIT {int(limit)}"
    todo = [tuple(r) for r in conn.execute(sql)]
    if on_progress:
        on_progress(0, len(todo))
    if not todo:
        log("Nothing to analyse: every game already has engine analysis (use --force to redo).")
        return 0

    def work(game_id, pgn, user_color, time_control, white_elo, black_elo):
        engine = get_engine()
        rows = analyze_game(engine, game_id, pgn, user_color, time_control, search, ratings=(white_elo, black_elo))
        return game_id, rows, summarize(game_id, rows, engine.id.get("name", "unknown"), search)

    log(f"Analysing {len(todo)} games at {describe(search)} with {workers} Stockfish workers...")
    done, failed, started = 0, 0, time.monotonic()
    with engine_pool(engine_path, workers, hash_mb=64) as (pool, get_engine):
        try:
            futures = {pool.submit(work, *g): g[0] for g in todo}
            for fut in as_completed(futures):
                try:
                    game_id, rows, summary = fut.result()
                except Exception as e:  # one bad game shouldn't stop the run
                    failed += 1
                    log(f"  game {futures[fut]} failed: {e}")
                    continue
                save(conn, game_id, rows, summary)
                done += 1
                if on_progress:
                    on_progress(done, len(todo))
                if done % 10 == 0 or done == len(todo):
                    elapsed = time.monotonic() - started
                    eta = elapsed / done * (len(todo) - done)
                    log(f"  {done}/{len(todo)} games  ({elapsed / 60:.1f} min elapsed, ~{eta / 60:.0f} min left)")
        except KeyboardInterrupt:
            log(f"Interrupted; {done} games saved. Run `knightly analyze` again to continue.")
            raise
    if failed:
        log(f"{failed} games failed; they'll be retried on the next run.")
    return done
