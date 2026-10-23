"""Fetch recent Chess.com games and analyse them with Stockfish, with no database.

A standalone version of what `analyze.py` does inside the app, for looking at a game together.
It uses the same win% curve and the same label thresholds, so what it prints is what Knightly
would say about the move -- but it writes nothing and needs no local Postgres.

    python scripts/review_game.py <chesscom-username> --games 2

Chess.com's public read API needs no key. Analysis runs two searches per move (the position
before, and the position after), so a 40-move game at --seconds 0.5 takes about a minute.
"""

import argparse
import io
import json
import math
import urllib.request
from datetime import UTC, datetime

import chess
import chess.engine
import chess.pgn

CLAMP_CP = 1000
MATE_CP = 10000
THRESHOLDS = [(20, "blunder"), (10, "mistake"), (5, "inaccuracy"), (2, "good")]
MISS_DROP = 10
# One move clearly better than the rest: the bar a position has to clear to become a card.
CLEAR_GAP = 10
PIECE_NAMES = {1: "pawn", 2: "knight", 3: "bishop", 4: "rook", 5: "queen", 6: "king"}


def clamp(cp: int) -> int:
    return max(-CLAMP_CP, min(CLAMP_CP, cp))


def win_pct(cp: int) -> float:
    """Lichess's win% curve, from the point of view of whoever `cp` is relative to."""
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * clamp(cp))) - 1)


def classify(before: float, after: float, is_best: bool, opponent_drop: float | None) -> str:
    if is_best:
        return "best"
    drop = before - after
    if opponent_drop is not None and opponent_drop >= MISS_DROP and drop >= MISS_DROP:
        return "miss"
    for threshold, label in THRESHOLDS:
        if drop >= threshold:
            return label
    return "excellent"


def score_cp(score: chess.engine.PovScore, pov: chess.Color) -> int:
    """The score from `pov`, mates folded onto the centipawn scale as analyze.py stores them."""
    relative = score.pov(pov)
    mate = relative.mate()
    if mate is not None:
        return (MATE_CP - abs(mate)) * (1 if mate > 0 else -1)
    return relative.score() or 0


def fetch(user: str, want: int) -> list[dict]:
    """The learner's `want` most recent games, newest first, from the public archives."""
    base = f"https://api.chess.com/pub/player/{user.lower()}"
    headers = {"User-Agent": "knightly-review-script (local analysis)"}

    def get(url):
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
            return json.load(r)

    archives = get(f"{base}/games/archives")["archives"]
    if not archives:
        raise SystemExit(f"No games found for {user}.")
    games: list[dict] = []
    for url in reversed(archives):  # newest month first; walk back until we have enough
        month = sorted(get(url)["games"], key=lambda g: g.get("end_time", 0), reverse=True)
        games.extend(month)
        if len(games) >= want:
            break
    return games[:want]


def describe(board: chess.Board, move: chess.Move) -> str:
    """A short plain-English note about what the move does, to anchor the position."""
    piece = board.piece_at(move.from_square)
    bits = []
    if board.is_capture(move):
        taken = board.piece_at(move.to_square)
        bits.append(f"takes the {PIECE_NAMES[taken.piece_type]}" if taken else "takes en passant")
    after = board.copy()
    after.push(move)
    if after.is_checkmate():
        bits.append("mate")
    elif after.is_check():
        bits.append("check")
    name = PIECE_NAMES[piece.piece_type] if piece else "piece"
    return f"{name} {chess.square_name(move.from_square)}-{chess.square_name(move.to_square)}" + (
        f", {', '.join(bits)}" if bits else ""
    )


def analyse(engine, game: chess.pgn.Game, hero: chess.Color, seconds: float, multipv: int) -> list[dict]:
    """Every move of the game with its evaluation, label, and the engine's preferred move."""
    limit = chess.engine.Limit(time=seconds)
    board = game.board()
    out: list[dict] = []
    previous_drop: float | None = None
    for ply, move in enumerate(game.mainline_moves(), start=1):
        mover = board.turn
        info = engine.analyse(board, limit, multipv=multipv)
        lines = info if isinstance(info, list) else [info]
        best_cp = score_cp(lines[0]["score"], mover)
        best_move = lines[0]["pv"][0]
        second_cp = score_cp(lines[1]["score"], mover) if len(lines) > 1 else None
        before = win_pct(best_cp)

        played_san = board.san(move)
        best_san = board.san(best_move)
        note = describe(board, move)
        fen_before = board.fen()
        board.push(move)
        after_info = engine.analyse(board, limit)
        after = win_pct(score_cp(after_info["score"], mover))

        drop = before - after
        label = classify(before, after, move == best_move, previous_drop if mover == hero else None)
        gap = before - win_pct(second_cp) if second_cp is not None else None
        out.append(
            {
                "ply": ply,
                "number": (ply + 1) // 2,
                "mover": "white" if mover == chess.WHITE else "black",
                "hero": mover == hero,
                "played": played_san,
                "best": best_san,
                "note": note,
                "win_before": before,
                "win_after": after,
                "drop": drop,
                "label": label,
                "only_move": gap is not None and gap >= CLEAR_GAP,
                "fen_before": fen_before,
                "pv": [m.uci() for m in lines[0]["pv"][:6]],
            }
        )
        previous_drop = drop
    return out


def report(game: chess.pgn.Game, moves: list[dict], hero_name: str) -> None:
    headers = game.headers
    hero_white = headers.get("White", "").lower() == hero_name.lower()
    you, them = ("White", "Black") if hero_white else ("Black", "White")
    print(f"\n{'=' * 78}")
    print(f"{headers.get('White')} ({headers.get('WhiteElo')}) vs {headers.get('Black')} ({headers.get('BlackElo')})")
    print(f"{headers.get('Result')}   {headers.get('Date')}   {headers.get('TimeControl')}   you are {you}")
    print(f"{headers.get('ECO', '')} {headers.get('ECOUrl', '').rsplit('/', 1)[-1].replace('-', ' ')}")
    print("=" * 78)

    yours = [m for m in moves if m["hero"]]
    counts: dict[str, int] = {}
    for m in yours:
        counts[m["label"]] = counts.get(m["label"], 0) + 1
    order = ("blunder", "mistake", "miss", "inaccuracy", "good", "excellent", "best")
    print("your moves: " + "  ".join(f"{k} {counts[k]}" for k in order if k in counts))
    lost = sum(m["drop"] for m in yours if m["drop"] > 0)
    print(f"win% lost across the game: {lost:.0f}  ({len(yours)} moves)")

    bad = [m for m in yours if m["label"] in ("blunder", "mistake", "miss")]
    print(f"\n--- {len(bad)} moments that cost you ---")
    for m in bad:
        dots = "..." if m["mover"] == "black" else "."
        card = "  [would become a review card]" if m["only_move"] else ""
        print(f"\n  {m['number']}{dots} {m['played']}   {m['label'].upper()}   -{m['drop']:.0f} win%{card}")
        print(f"      you played   {m['played']:<8} ({m['note']})")
        print(f"      engine wants {m['best']:<8} -- win% {m['win_before']:.0f} instead of {m['win_after']:.0f}")
        print(f"      its line: {' '.join(m['pv'])}")
        print(f"      FEN: {m['fen_before']}")

    swing = max(yours, key=lambda m: m["drop"], default=None)
    if swing and swing["drop"] > 0:
        print(f"\n  biggest single swing: move {swing['number']} {swing['played']} (-{swing['drop']:.0f} win%)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("user", help="your Chess.com username")
    ap.add_argument("--games", type=int, default=2, help="how many recent games")
    ap.add_argument("--seconds", type=float, default=0.5, help="engine time per position")
    ap.add_argument("--multipv", type=int, default=2, help="2 so the only-move gap can be measured")
    ap.add_argument("--threads", type=int, default=4)
    args = ap.parse_args()

    print(f"Fetching {args.games} recent games for {args.user}...")
    raw = fetch(args.user, args.games)
    engine = chess.engine.SimpleEngine.popen_uci("stockfish")
    engine.configure({"Threads": args.threads, "Hash": 256})
    try:
        for entry in raw:
            game = chess.pgn.read_game(io.StringIO(entry["pgn"]))
            if game is None:
                continue
            hero = chess.WHITE if game.headers.get("White", "").lower() == args.user.lower() else chess.BLACK
            played = datetime.fromtimestamp(entry.get("end_time", 0), UTC).strftime("%Y-%m-%d %H:%M UTC")
            print(f"\nAnalysing {entry.get('url', '')}  ({played})", flush=True)
            moves = analyse(engine, game, hero, args.seconds, args.multipv)
            report(game, moves, args.user)
    finally:
        engine.quit()


if __name__ == "__main__":
    main()
