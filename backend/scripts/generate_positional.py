"""Generate the positional drills (knightly.positional_drills.DATA).

    uv run python scripts/generate_positional.py GAMES.pgn.zst [...] [--per-theme 300]
        [--engine PATH] [--workers 8] [--report report.json] [--plans]

With --plans it makes the plan lessons' drills (positional_drills.PLAN_IDEAS) into
PLANS_DATA instead: the same checks, except that the converting ideas (trade, kingActivity)
start from a better position, between CONVERT_FROM and CONVERT_TO.

GAMES are Lichess broadcast database months (database.lichess.org, CC0): over-the-board
tournament games. A position becomes a drill when the move the player chose there carries one
of positional_drills.IDEAS, and Stockfish confirms it is the one clearly best move: quiet, no
tactic in its line, not in a decided position, at least GAP ahead of the second-best move at
both SCREEN_DEPTH and VERIFY_DEPTH. Laid out as Lichess lays its puzzles out: the position
before the opponent's last move, that move, then the answer.

The rating is an estimate, labelled as one: the theme's base, plus FIND_STEP for every depth
Stockfish needs before it settles on the move (a move a shallow search finds is one a learner
finds sooner). Deterministic for a given input and engine version; the output is committed.
"""

import argparse
import csv
import hashlib
import io
import json
import random
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from concurrent.futures import FIRST_COMPLETED, wait
from pathlib import Path

import chess
import chess.engine
import chess.pgn

from knightly import patterns
from knightly import positional_drills as pd
from knightly.analyze import engine_pool, find_engine

FIELDS = [
    "PuzzleId",
    "FEN",
    "Moves",
    "Rating",
    "RatingDeviation",
    "Popularity",
    "NbPlays",
    "Themes",
    "GameUrl",
    "Gap",
    "Depth",
    "Eval",
]
QUICK_DEPTH = 10
SCREEN_DEPTH = 14
FIND_DEPTH = 12  # how deep the find-depth estimate looks
DECISIVE = 300  # past this the lesson is converting a win, not positional play
FIRST_PLY, LAST_PLY = 4, 80
# Most specific first: a knight to an outpost is the sharper thing to practise even when the
# same move also develops it.
PRIORITY = ("strongSquare", "weakPawn", "openFile", "activity", "castleEarly", "centre", "development")
# Rough ratings for the target-rating pick (puzzles.target_rating), from where Steps places the
# idea: the golden rules in Step 2, activity Step 2-3, weak pawns Step 4, the open file and
# strong squares Step 5.
BASE = {
    "castleEarly": 750,
    "centre": 800,
    "development": 850,
    "activity": 1150,
    "weakPawn": 1300,
    "openFile": 1250,
    "strongSquare": 1350,
}
FIND_STEP = 50
# The plan lessons, rarest-looking first, and where Steps places them: opening advantage and
# material advantage in Step 4, material and time and using pawns in 5, the rest in 6.
PLAN_PRIORITY = ("minorChoice", "badBishop", "gambit", "openLines", "kingActivity", "trade", "pawnPlay")
PLAN_BASE = {
    "openLines": 1400,
    "trade": 1350,
    "gambit": 1500,
    "pawnPlay": 1450,
    "badBishop": 1600,
    "minorChoice": 1600,
    "kingActivity": 1500,
}
CONVERT_FROM, CONVERT_TO = 100, 900  # centipawns: better, not yet a matter of technique alone
VALUES = pd.VALUES


def games(path: Path):
    """(game, url) from a .pgn or .pgn.zst file, decompressed as a stream."""
    if path.suffix != ".zst":
        f = open(path, encoding="utf-8")
        proc = None
    else:
        zstd = shutil.which("zstd")
        if not zstd:
            raise SystemExit("Needs the zstd tool to unpack the file: brew install zstd")
        proc = subprocess.Popen([zstd, "-dc", str(path)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        f = io.TextIOWrapper(proc.stdout, encoding="utf-8")
    try:
        while (game := chess.pgn.read_game(f)) is not None:
            yield game
    finally:
        f.close()
        if proc is not None:
            proc.kill()
            proc.wait()


def in_window(theme: str, cp: int) -> bool:
    """Whether a position's evaluation suits the idea: level-ish for most, better for the
    converting ones."""
    if theme in pd.CONVERTING:
        return CONVERT_FROM <= cp < CONVERT_TO
    return abs(cp) < DECISIVE


def candidates(paths: list[Path], log, max_games: int | None = None, plans: bool = False) -> list[dict]:
    """Positions where the move played carries an idea, one per game and theme, deduplicated
    (a broadcast often carries the same game twice)."""
    out, seen, read = [], set(), 0
    for path in paths:
        for i, game in enumerate(games(path)):
            if max_games and i >= max_games:
                break
            read += 1
            if read % 5000 == 0:
                log(f"  {read:,} games read, {len(out):,} candidates")
            if game.headers.get("Variant", "Standard") != "Standard" or game.headers.get("FEN"):
                continue
            url = game.headers.get("GameURL", "")
            done = set()
            board = game.board()
            prev, prev_fen = None, None
            for ply, child in enumerate(game.mainline()):
                move = child.move
                if ply > LAST_PLY:
                    break
                if ply >= FIRST_PLY and prev is not None and not board.is_check():
                    carried = pd.plan_carries(board, move) if plans else pd.carries(board, move)
                    ideas = [t for t in (PLAN_PRIORITY if plans else PRIORITY) if t in carried]
                    # The broadcaster's own evaluation, when it has one, skips decided positions.
                    ev = child.parent.eval() if child.parent is not game else None
                    cp = ev.pov(board.turn).score(mate_score=100_000) if ev else None
                    if cp is not None:
                        ideas = [t for t in ideas if in_window(t, cp)]
                    fresh = [t for t in ideas if t not in done]
                    key = board.epd() if fresh else None
                    if fresh and key not in seen:
                        seen.add(key)
                        out.append(
                            {
                                "before": prev_fen,
                                "fen": board.fen(),
                                "prev": prev.uci(),
                                "played": move.uci(),
                                "ideas": ideas,
                                "url": f"{url}#{ply}" if url else "",
                                "ply": ply,
                            }
                        )
                        done.update(ideas)
                prev, prev_fen = move, board.fen()
                board.push(move)
    log(f"{read:,} games read, {len(out):,} candidates")
    return out


def _material(board: chess.Board, color: chess.Color) -> int:
    return sum(
        VALUES[p.piece_type] * (1 if p.color == color else -1)
        for p in board.piece_map().values()
        if p.piece_type != chess.KING
    )


def tactical(board: chess.Board, pv: list[chess.Move]) -> bool:
    """The engine's line is a tactic: it names a motif *and* wins something (a mate, or
    patterns.TACTIC_CP of material that survives the reply). Geometry alone names motifs with
    nothing at stake, which threw out real positional positions (the STS measurement on
    issue #328)."""
    if not patterns.in_line(board, list(pv)):
        return False
    b, side = board.copy(stack=False), board.turn
    start = _material(b, side)
    for i, move in enumerate(pv[: patterns.DEEP_PLIES]):
        if move not in b.legal_moves:
            break
        b.push(move)
        if b.is_checkmate():
            return True
        if i % 2 == 1 and (_material(b, side) - start) * 100 >= patterns.TACTIC_CP:
            return True
    return False


def drops(board: chess.Board, pv: list[chess.Move]) -> bool:
    """The second-best line loses material within a few moves: the gap is then a tactic the
    best move parries, not the idea. Recorded, so the report can say how often."""
    b, side = board.copy(stack=False), board.turn
    start = _material(b, side)
    for i, move in enumerate(pv[:6]):
        if move not in b.legal_moves:
            break
        b.push(move)
        if i % 2 == 1 and start - _material(b, side) >= 2:
            return True
    return False


def lines(engine, board: chess.Board, depth: int) -> list[tuple[chess.Move, int, list[chess.Move]]]:
    infos = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=2)
    return [
        (i["pv"][0], i["score"].pov(board.turn).score(mate_score=100_000), list(i["pv"])) for i in infos if i.get("pv")
    ]


def find_depth(engine, board: chess.Board, move: chess.Move) -> int:
    """The shallowest depth from which Stockfish's choice stays `move`, up to FIND_DEPTH."""
    best = {}
    # A new game clears the hash: the deeper searches already made would hand depth 1 the answer.
    with engine.analysis(board, chess.engine.Limit(depth=FIND_DEPTH), game=object()) as analysis:
        for info in analysis:
            if "depth" in info and info.get("pv") and info.get("multipv", 1) == 1:
                best[info["depth"]] = info["pv"][0]
    settled = FIND_DEPTH
    for d in sorted(best, reverse=True):
        if best[d] != move:
            break
        settled = d
    return settled


def judge(engine, c: dict, verify_depth: int) -> tuple[dict | None, str]:
    board = chess.Board(c["fen"])
    played = chess.Move.from_uci(c["played"])
    # A cheap look first: most candidates fail on "played not best" or a small gap.
    quick = lines(engine, board, QUICK_DEPTH)
    if len(quick) < 2:
        return None, "one legal move"
    # Kept when the played move is second here too: deeper searches may still prefer it, and
    # those are the harder drills.
    if played not in (quick[0][0], quick[1][0]) or (quick[0][0] == played and quick[0][1] - quick[1][1] < pd.GAP // 2):
        return None, "quick look: not clearly best"
    first = lines(engine, board, SCREEN_DEPTH)
    if len(first) < 2:
        return None, "one legal move"
    (best, cp, pv), (_, cp2, _) = first[0], first[1]
    theme = c["ideas"][0]
    if best != played:
        return None, "played not best"
    if not in_window(theme, cp):
        return None, "decided" if abs(cp) >= DECISIVE else "not better"
    if cp - cp2 < pd.GAP:
        return None, "gap too small"
    if tactical(board, pv):
        return None, "tactic in line"
    deep = lines(engine, board, verify_depth)
    (best, cp, pv), (_, cp2, pv2) = deep[0], deep[1]
    if best != played or cp - cp2 < pd.GAP or not in_window(theme, cp):
        return None, "unstable"
    if tactical(board, pv):
        return None, "tactic in line"
    return {
        **c,
        "gap": cp - cp2,
        "eval": cp,
        "depth": verify_depth,
        "find": find_depth(engine, board, best),
        "parries": drops(board, pv2),
        "pv": [m.uci() for m in pv[:6]],
        "pv2": [m.uci() for m in pv2[:6]],
    }, "kept"


def drill_rows(kept: dict[str, list[dict]], priority, base: dict[str, int], plans: bool) -> list[dict]:
    """The kept drills in the Lichess puzzle file's layout."""
    rows = []
    for theme in priority:
        for d in kept[theme]:
            board = chess.Board(d["fen"])
            before = d["before"]  # the position before the opponent's last move
            moves = [d["prev"], d["played"]]
            phase = "opening" if board.fullmove_number <= pd.OPENING_MOVES else "middlegame"
            if plans and pd.endgame(board):
                phase = "endgame"
            rows.append(
                {
                    "PuzzleId": "kp" + hashlib.sha1(f"{before} {' '.join(moves)}".encode()).hexdigest()[:10],
                    "FEN": before,
                    "Moves": " ".join(moves),
                    "Rating": base[theme] + FIND_STEP * (d["find"] - 1),
                    "RatingDeviation": 75,
                    "Popularity": 100,
                    "NbPlays": 1000,
                    "Themes": " ".join([*d["ideas"], "positional", phase]),
                    "GameUrl": d["url"],
                    "Gap": d["gap"],
                    "Depth": d["depth"],
                    "Eval": d["eval"],
                }
            )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("games", nargs="+", type=Path)
    parser.add_argument("--engine", default=None)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--per-theme", type=int, default=300)
    parser.add_argument("--depth", type=int, default=pd.VERIFY_DEPTH)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--max-games", type=int, default=None, help="read at most this many games per file")
    parser.add_argument("--out", default=str(pd.DATA))
    parser.add_argument("--report", default=None, help="write counts and every kept drill's lines here")
    parser.add_argument("--keep-parries", action="store_true", help="keep drills whose second-best move drops material")
    parser.add_argument("--plans", action="store_true", help="the plan lessons' ideas, into PLANS_DATA")
    args = parser.parse_args()
    priority, base = (PLAN_PRIORITY, PLAN_BASE) if args.plans else (PRIORITY, BASE)
    if args.plans and args.out == str(pd.DATA):
        args.out = str(pd.PLANS_DATA)

    def log(msg):
        print(msg, file=sys.stderr, flush=True)

    found = candidates(args.games, log, args.max_games, args.plans)
    random.Random(args.seed).shuffle(found)
    # Rare ideas first, so the common ones cannot use up the engine time.
    by_theme = Counter(c["ideas"][0] for c in found)
    log(f"candidates by idea: {dict(by_theme)}")
    found.sort(key=lambda c: by_theme[c["ideas"][0]])

    kept: dict[str, list[dict]] = defaultdict(list)
    reasons: dict[str, Counter] = defaultdict(Counter)
    with engine_pool(find_engine(args.engine), args.workers, hash_mb=64) as (pool, engine):
        queue = iter(found)
        running = {}

        def submit():
            for c in queue:
                if len(kept[c["ideas"][0]]) < args.per_theme:
                    running[pool.submit(lambda c=c: judge(engine(), c, args.depth))] = c
                    return True
            return False

        for _ in range(args.workers * 2):
            submit()
        n = 0
        while running:
            done, _ = wait(running, return_when=FIRST_COMPLETED)
            for f in done:
                c = running.pop(f)
                item, why = f.result()
                theme = c["ideas"][0]
                if item and item["parries"] and not args.keep_parries:
                    item, why = None, "second-best drops material"
                reasons[theme][why] += 1
                if item and len(kept[theme]) < args.per_theme:
                    kept[theme].append(item)
                n += 1
                if n % 200 == 0:
                    log(f"  {n:,} judged; kept {dict((t, len(v)) for t, v in kept.items())}")
                submit()

    rows = drill_rows(kept, priority, base, args.plans)
    if args.plans:
        # A plan drill can be a position and answer the positional drills already have (a
        # lever that is also a centre move): stored once, under the first file's themes.
        with open(pd.DATA, newline="") as f:
            taken = {row["PuzzleId"] for row in csv.DictReader(f)}
        rows = [r for r in rows if r["PuzzleId"] not in taken]
    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    log(f"wrote {len(rows)} drills to {args.out}: {dict((t, len(kept[t])) for t in priority)}")
    if args.report:
        Path(args.report).write_text(
            json.dumps(
                {
                    "candidates": dict(by_theme),
                    "reasons": {t: dict(r) for t, r in reasons.items()},
                    "kept": {t: kept[t] for t in priority},
                },
                indent=1,
            )
        )


if __name__ == "__main__":
    main()
