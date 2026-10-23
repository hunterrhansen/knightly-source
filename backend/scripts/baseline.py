"""A read-only baseline over production: chance conversion and mistake mix, with the clock
confound separated out and windows counted in games rather than days.

Written to settle two objections to the numbers in docs/status.md. First, a flat 90-day
calendar window mixes a climbing player with who they are now, which is why `game_trend` and
`standing` already count games instead; `patterns.chance_rates` still does not. Second, a
chance missed with 15 seconds left is evidence about a clock, not about chess, and
`moves.time_trouble` has recorded which is which all along without anything reading it.

Writes nothing. Run it against production with:

    ssh -i ~/.ssh/knightly-mac knightly@<host> \\
      'docker exec -i production-api-1 python -' < backend/scripts/baseline.py
"""

from knightly import db

WINDOWS = (20, 40, 80)  # games per window, as game_trend counts them
SAFETY = ("theirThreat", "theirReply")
NAMELESS = ("other", "pending", "positional")


def rule(title):
    print(f"\n{'=' * 72}\n{title}\n{'=' * 72}")


def rows(conn, sql, params=()):
    return conn.execute(sql, params).fetchall()


conn = db.connect(migrate=False)

rule("Accounts")
for r in rows(conn, "SELECT id, clerk_id FROM users ORDER BY id"):
    n = rows(conn, "SELECT count(*) AS n FROM games WHERE user_id = %s", (r["id"],))[0]["n"]
    print(f"  user {r['id']}  games {n:>6}  clerk {str(r['clerk_id'])[:12]}...")
user_id = rows(conn, "SELECT user_id FROM games GROUP BY user_id ORDER BY count(*) DESC LIMIT 1")[0]["user_id"]
print(f"\n  analysing user {user_id}")

rule("What was played, and how fast")
for r in rows(
    conn,
    """SELECT g.speed, g.time_control, count(*) AS games,
              min(g.played_at) AS first, max(g.played_at) AS last
       FROM games g WHERE g.user_id = %s AND g.rated
       GROUP BY g.speed, g.time_control ORDER BY games DESC LIMIT 12""",
    (user_id,),
):
    print(
        f"  {str(r['speed']):<12}{str(r['time_control']):<10}{r['games']:>6} games   "
        f"{str(r['first'])[:10]} to {str(r['last'])[:10]}"
    )

# Only games whose moves are analysed can contribute a chance or a mistake; an unanalysed
# game would otherwise shrink every rate by sitting in the denominator of the window.
analysed = rows(
    conn,
    """SELECT g.id, g.played_at, g.user_rating FROM games g
       WHERE g.user_id = %s AND g.rated
         AND EXISTS (SELECT 1 FROM moves m WHERE m.game_id = g.id AND m.best_uci IS NOT NULL)
       ORDER BY g.played_at DESC NULLS LAST""",
    (user_id,),
)
print(f"\n  {len(analysed)} rated games with analysis")

rule("Rating by window (mean of the window's rated games)")
for n in WINDOWS:
    ids = [g["id"] for g in analysed[:n]]
    ratings = [g["user_rating"] for g in analysed[:n] if g["user_rating"]]
    if ratings:
        span = f"{str(analysed[min(n, len(analysed)) - 1]['played_at'])[:10]} to {str(analysed[0]['played_at'])[:10]}"
        print(f"  last {n:>3} games: {round(sum(ratings) / len(ratings)):>5}   {span}   ({len(ids)} games)")

CHANCES = """
    SELECT count(*) AS chances,
           count(*) FILTER (WHERE m.chance_found) AS found
    FROM moves m
    WHERE m.game_id = ANY(%s) AND m.is_user
      AND m.chance_motif IS NOT NULL AND m.chance_motif <> ALL(%s) {clock}
"""

rule("Clear chances taken -- the label-independent number")
print("  A 'chance' is a position where one move clearly stood out (analyze.only_move).")
print("  'Taken' is uci = best_uci. Neither depends on the motif being named correctly.\n")
print(f"  {'window':<16}{'all':>18}{'clock OK':>18}{'time trouble':>18}")
for n in WINDOWS:
    ids = [g["id"] for g in analysed[:n]]
    cells = []
    for clock in ("", "AND NOT coalesce(m.time_trouble, false)", "AND m.time_trouble"):
        r = rows(conn, CHANCES.format(clock=clock), (ids, list(NAMELESS)))[0]
        pct = f"{100 * r['found'] / r['chances']:.0f}%" if r["chances"] else "--"
        cells.append(f"{r['found']}/{r['chances']} {pct}")
    print(f"  last {n:<11}" + "".join(f"{c:>18}" for c in cells))

rule("By motif, last 40 games, time trouble excluded")
print("  Remember hangingPiece fires at 0.17 precision: read the totals, not the split.\n")
ids = [g["id"] for g in analysed[:40]]
for r in rows(
    conn,
    """SELECT m.chance_motif AS motif, count(*) AS chances,
              count(*) FILTER (WHERE m.chance_found) AS found
       FROM moves m
       WHERE m.game_id = ANY(%s) AND m.is_user AND m.chance_motif IS NOT NULL
         AND m.chance_motif <> ALL(%s) AND NOT coalesce(m.time_trouble, false)
       GROUP BY m.chance_motif ORDER BY chances DESC""",
    (ids, list(NAMELESS)),
):
    pct = f"{100 * r['found'] / r['chances']:.0f}%" if r["chances"] else "--"
    print(f"  {r['motif']:<22}{r['found']:>5}/{r['chances']:<6}{pct:>6}")

rule("Mistake mix: is there a tactic there at all?")
print(f"  {'window':<16}{'named':>12}{'positional':>12}{'gap/other':>12}{'untagged':>12}{'total':>8}")
for n in WINDOWS:
    ids = [g["id"] for g in analysed[:n]]
    r = rows(
        conn,
        """SELECT count(*) AS total,
                  count(*) FILTER (WHERE m.pattern IS NOT NULL AND m.pattern <> ALL(%s)) AS named,
                  count(*) FILTER (WHERE m.pattern = 'positional') AS positional,
                  count(*) FILTER (WHERE m.pattern IN ('other', 'pending')) AS other,
                  count(*) FILTER (WHERE m.pattern IS NULL) AS untagged
           FROM moves m
           WHERE m.game_id = ANY(%s) AND m.is_user
             AND m.classification IN ('mistake', 'miss', 'blunder')""",
        (list(NAMELESS), ids),
    )[0]
    t = max(r["total"], 1)
    print(
        f"  last {n:<11}"
        + "".join(f"{r[k]} ({100 * r[k] / t:.0f}%)".rjust(12) for k in ("named", "positional", "other", "untagged"))
        + f"{r['total']:>8}"
    )

rule("Safety against tactics, last 40 games -- the comparison I over-claimed")
print("  cost = mean win% lost per game on moves of that skill. status.md put these 0.2 apart")
print("  and called that inside the noise. Does excluding time trouble separate them?\n")
ids = [g["id"] for g in analysed[:40]]
games = max(len(ids), 1)
for label, layers in (("safety", SAFETY), ("tactics", ("ownTactic",)), ("calculation", ("calculation",))):
    line = [f"  {label:<14}"]
    for name, clock in (("all", ""), ("clock OK", "AND NOT coalesce(m.time_trouble, false)")):
        r = rows(
            conn,
            f"""SELECT count(*) AS n,
                       coalesce(sum(greatest(m.win_pct_before - m.win_pct_after, 0)), 0) AS lost
                FROM moves m
                WHERE m.game_id = ANY(%s) AND m.is_user AND m.layer = ANY(%s)
                  AND m.classification IN ('mistake', 'miss', 'blunder') {clock}""",
            (ids, list(layers)),
        )[0]
        line.append(f"{name}: {r['n']:>3} mistakes, {r['lost'] / games:>5.1f} win%/game   ")
    print("".join(line))

rule("How much of this is the clock?")
for n in WINDOWS:
    ids = [g["id"] for g in analysed[:n]]
    r = rows(
        conn,
        """SELECT count(*) AS total, count(*) FILTER (WHERE m.time_trouble) AS trouble
           FROM moves m WHERE m.game_id = ANY(%s) AND m.is_user
             AND m.classification IN ('mistake', 'miss', 'blunder')""",
        (ids,),
    )[0]
    pct = f"{100 * r['trouble'] / r['total']:.0f}%" if r["total"] else "--"
    print(f"  last {n:>3} games: {r['trouble']:>4} of {r['total']:>4} mistakes in time trouble ({pct})")

r = rows(
    conn,
    """SELECT count(*) AS cards, count(*) FILTER (WHERE m.time_trouble) AS trouble
       FROM cards c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
       WHERE c.user_id = %s AND c.suspended_at IS NULL""",
    (user_id,),
)[0]
pct = f"{100 * r['trouble'] / r['cards']:.0f}%" if r["cards"] else "--"
print(f"\n  review deck: {r['trouble']} of {r['cards']} live cards come from a time-trouble move ({pct})")
