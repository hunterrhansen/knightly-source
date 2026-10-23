"""Fit the win% curve's slope k per 100-point rating band from analysed games.

The curve is Lichess's shape, win% = 100 / (1 + e^(-k * cp)), from the mover's side. Every
evaluated position after a move (clamped as analyze.py clamps it) is paired with the mover's
score in that game (1, 0.5 or 0), and k is the maximum-likelihood slope for each band of
the mover's Chess.com rating. The 90% interval is cluster-robust by player side (one player
in one game), since positions in a game are not independent.

Sources, combined:
- analysed games in a Knightly database (read-only SELECTs):

    KNIGHTLY_DATABASE_URL=postgresql://127.0.0.1:55439/knightly_local_dev \\
        uv run python scripts/fit-win-curve.py

- Lichess's open database (database.lichess.org), rapid games with [%eval]. Extract the
  few fields used from a stream of PGN once, then fit from the extract:

    curl -s -r 0-399999999 https://database.lichess.org/standard/lichess_db_standard_rated_2026-09.pgn.zst \\
        | zstd -dc 2>/dev/null | uv run python scripts/fit-win-curve.py --lichess-extract evals.jsonl
    uv run python scripts/fit-win-curve.py --lichess evals.jsonl

  Lichess ratings run well above Chess.com's, so they are mapped (LICHESS_TO_CHESSCOM).

The result goes into analyze.py's K_BY_RATING by hand, with the date and sample sizes. See
docs/specs/2026-10-20-move-grading-parity-design.md.
"""

import argparse
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

import psycopg

CLAMP_CP = 1000  # as analyze.CLAMP_CP: mates and huge evals count as +/-1000
MATE_CP = 10000  # as analyze.MATE_CP: mate in N is +/-(MATE_CP - N)
LICHESS_K = 0.00368208
K_MAX = 0.05  # a slope this steep means a band's results don't depend on the evaluation
SCORES = {"1-0": (1.0, 0.0), "0-1": (0.0, 1.0), "1/2-1/2": (0.5, 0.5)}
# Lichess rapid rating -> Chess.com rapid rating, linear in between and beyond the ends.
# From ChessGoals' rating comparison (chessgoals.com/rating-comparison, updated July 2026,
# survey of players active on both sites): each row of its Chess.com blitz pivot gives
# Chess.com rapid (N = 10,156) and Lichess rapid (N = 1,066, rating deviation under 150).
LICHESS_TO_CHESSCOM = [
    (1290, 815),
    (1360, 905),
    (1425, 995),
    (1490, 1085),
    (1555, 1170),
    (1615, 1255),
    (1680, 1340),
    (1740, 1420),
    (1795, 1500),
    (1850, 1580),
    (1905, 1655),
    (1960, 1730),
    (2015, 1800),
    (2065, 1870),
    (2115, 1935),
    (2165, 1995),
    (2215, 2055),
    (2260, 2110),
    (2310, 2165),
]
# Lichess's speed for a game it rates as rapid: estimated duration base + 40 * increment.
RAPID_SECONDS = (480, 1500)

QUERY = """
SELECT m.game_id, m.color, m.eval_after, g.result,
       CASE WHEN m.color = 'white' THEN g.white_elo ELSE g.black_elo END AS rating
FROM moves m JOIN games g ON g.id = m.game_id
WHERE m.eval_after IS NOT NULL AND g.result IN ('1-0', '0-1', '1/2-1/2') AND g.variant = 'standard'
ORDER BY m.game_id, m.ply
"""


def _sigmoid(x: float) -> float:
    if x >= 0:
        return 1 / (1 + math.exp(-x))
    e = math.exp(x)
    return e / (1 + e)


def _clamp(cp: int) -> int:
    return max(-CLAMP_CP, min(CLAMP_CP, cp))


def fit_k(points: Counter) -> float | None:
    """The k maximising sum(n * (s*log(p) + (1-s)*log(1-p))), p = sigmoid(k*cp), over
    {(cp, s): n}: Newton's method on one parameter, kept within (0, K_MAX]."""
    if not any(cp for cp, _ in points):
        return None
    k = LICHESS_K
    for _ in range(100):
        grad = hess = 0.0
        for (cp, s), n in points.items():
            p = _sigmoid(k * cp)
            grad += n * (s - p) * cp
            hess -= n * p * (1 - p) * cp * cp
        if hess == 0:
            return None
        step = grad / hess
        k = min(K_MAX, max(K_MAX / 1000, k - step))
        if abs(step) < 1e-10:
            break
    return k


def robust_interval(k: float, sides: list[Counter]) -> tuple[float, float]:
    """k +/- 1.645 cluster-robust standard errors, one cluster per player side."""
    hess, meat = 0.0, 0.0
    for side in sides:
        g = 0.0
        for (cp, s), n in side.items():
            p = _sigmoid(k * cp)
            g += n * (s - p) * cp
            hess += n * p * (1 - p) * cp * cp
        meat += g * g
    se = math.sqrt(meat) / hess if hess else float("inf")
    return k - 1.645 * se, k + 1.645 * se


def chesscom_rating(lichess: int) -> int:
    table = LICHESS_TO_CHESSCOM
    i = 1 if lichess <= table[0][0] else len(table) - 1
    for j in range(1, len(table)):
        if lichess <= table[j][0]:
            i = j
            break
    (x0, y0), (x1, y1) = table[i - 1], table[i]
    return round(y0 + (y1 - y0) * (lichess - x0) / (x1 - x0))


def sides(evals: list[int], result: str, white: int | None, black: int | None):
    """(rating, Counter{(cp, score): n}) for each side of one game whose ply i's position
    after the move has White-POV eval evals[i]."""
    ws, bs = SCORES[result]
    for color, rating, score in ((0, white, ws), (1, black, bs)):
        if rating is None:
            continue
        sign = 1 if color == 0 else -1
        side = Counter((_clamp(sign * e), score) for e in evals[color::2])
        if side:
            yield rating, side


def local_sides(url: str):
    with psycopg.connect(url) as conn:
        conn.read_only = True
        games = defaultdict(lambda: {"evals": [], "ratings": {}})
        for game_id, color, eval_after, result, rating in conn.execute(QUERY):
            g = games[game_id]
            g["evals"].append(eval_after)
            g["result"] = result
            g["ratings"][color] = rating
    for g in games.values():
        yield from sides(g["evals"], g["result"], g["ratings"].get("white"), g["ratings"].get("black"))


def lichess_sides(path: str):
    with open(path) as f:
        for line in f:
            g = json.loads(line)
            if not _rapid(g.get("tc")):
                continue
            yield from sides(g["e"], g["r"], chesscom_rating(g["w"]), chesscom_rating(g["b"]))


def _rapid(tc: str | None) -> bool:
    m = re.fullmatch(r"(\d+)\+(\d+)", tc or "")
    return bool(m) and RAPID_SECONDS[0] <= int(m.group(1)) + 40 * int(m.group(2)) < RAPID_SECONDS[1]


EVAL = re.compile(r"\[%eval (#?)(-?[\d.]+)\]")


def extract(stream, out) -> None:
    """Lichess PGN -> one JSON line per finished game with evals and both ratings:
    {"w", "b": ratings, "r": result, "tc": time control, "e": White-POV eval after each ply}.
    Nothing else (no names, no moves) is kept. A cut-off final game is dropped."""
    headers, moves, read, kept = {}, [], 0, 0

    def flush():
        nonlocal kept
        text = " ".join(moves)
        if "[%eval" not in text or headers.get("Result") not in SCORES:
            return
        try:
            w, b = int(headers["WhiteElo"]), int(headers["BlackElo"])
        except (KeyError, ValueError):
            return
        evals = []
        for mate, v in EVAL.findall(text):
            if mate:
                n = int(v)
                evals.append((MATE_CP - abs(n)) * (1 if n > 0 else -1))
            else:
                evals.append(round(float(v) * 100))
        out.write(json.dumps({"w": w, "b": b, "r": headers["Result"], "tc": headers.get("TimeControl"), "e": evals}))
        out.write("\n")
        kept += 1

    for raw in stream:
        line = raw.decode("utf-8", "replace").rstrip("\n")
        if line.startswith("[Event "):
            if headers:
                read += 1
                flush()
            headers, moves = {}, []
        if line.startswith("["):
            m = re.match(r'\[(\w+) "(.*)"\]', line)
            if m:
                headers[m.group(1)] = m.group(2)
        elif line:
            moves.append(line)
    print(f"{read} games read, {kept} with evals kept", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--url", default=os.environ.get("KNIGHTLY_DATABASE_URL"), help="Knightly database")
    parser.add_argument("--lichess", help="extract written by --lichess-extract")
    parser.add_argument("--lichess-extract", metavar="OUT", help="read Lichess PGN on stdin, write OUT, stop")
    parser.add_argument("--width", type=int, default=100, help="rating band width")
    args = parser.parse_args()
    if args.lichess_extract:
        with open(args.lichess_extract, "w") as out:
            extract(sys.stdin.buffer, out)
        return
    if not args.url and not args.lichess:
        raise SystemExit("Set KNIGHTLY_DATABASE_URL, pass --url or --lichess.")

    bands: dict[int, dict[str, list[Counter]]] = defaultdict(lambda: defaultdict(list))
    sources = [("local", local_sides(args.url))] if args.url else []
    if args.lichess:
        sources.append(("lichess", lichess_sides(args.lichess)))
    for name, found in sources:
        for rating, side in found:
            bands[rating // args.width * args.width][name].append(side)

    print(f"{'band':>6} {'local':>6} {'lichess':>8} {'positions':>10} {'k':>9} {'90% interval':>21}  vs Lichess")
    for b in sorted(bands):
        every = [s for ss in bands[b].values() for s in ss]
        points = sum(every, Counter())
        k = fit_k(points)
        if k is None:
            continue
        lo, hi = robust_interval(k, every)
        print(
            f"{b:>6} {len(bands[b]['local']):>6} {len(bands[b]['lichess']):>8} {sum(points.values()):>10} "
            f"{k:>9.6f} {lo:>9.6f} - {hi:>9.6f}  {k / LICHESS_K:.2f}x"
        )


if __name__ == "__main__":
    main()
