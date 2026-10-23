"""Improvement KPIs, all computed from one row per game (GAME_FACTS).

The games list filters on the same rows (KPI_FILTERS), so a KPI and the games it links to
always agree.
"""

import json
from datetime import UTC, datetime, timedelta

from . import db
from .analyze import THRESHOLDS

# A position counts as "winning" once the user's win chance reaches this after one of
# their own moves, and as "lost" once it falls to LOST_PCT. Lichess win% scale, 0-100.
WINNING_PCT = 80
LOST_PCT = 20
BLUNDER_DROP = THRESHOLDS[0][0]  # win% lost that makes a move a blunder
RANGES = {"30d": 30, "90d": 90, "all": None}
MIN_SAMPLE = 10  # fewer games than this and a KPI is too noisy to show or compare

# One row per game with everything the overview and filters need. Engine columns are NULL
# for games that haven't been analysed yet.
GAME_FACTS = f"""
WITH peaks AS (
    SELECT game_id,
           max(CASE WHEN is_user THEN win_pct_after END) AS peak,
           min(CASE WHEN is_user THEN win_pct_after END) AS trough,
           -- Blunder-sized moves of yours, whatever their label: a "miss" that throws away
           -- 20+ points is as costly as any other blunder.
           count(*) FILTER (WHERE is_user AND win_pct_before - win_pct_after >= {BLUNDER_DROP}) AS big_drops
    FROM moves GROUP BY game_id
), punish AS (
    -- Opponent blunders (by size, since a blunder that answers your own error is labelled
    -- "miss"), and how many the user answered with a best, excellent or good move.
    SELECT o.game_id, count(*) AS opp_blunders,
           count(*) FILTER (WHERE n.classification IN ('brilliant', 'great', 'best', 'excellent', 'good')) AS punished
    FROM moves o JOIN moves n ON n.game_id = o.game_id AND n.ply = o.ply + 1
    WHERE NOT o.is_user AND o.win_pct_before - o.win_pct_after >= {BLUNDER_DROP} AND n.is_user
    GROUP BY o.game_id
), move10 AS (
    -- Eval after Black's 10th move, from the user's side, clamped like cp_loss.
    SELECT m.game_id,
           greatest(-1000, least(1000, CASE WHEN g.user_color = 'white' THEN m.eval_after
                                            ELSE -m.eval_after END)) AS eval10
    FROM moves m JOIN games g ON g.id = m.game_id WHERE m.ply = 20
)
SELECT g.id, g.played_at, g.speed, g.rated, g.time_control, g.url, g.user_color,
       g.user_outcome, g.user_rating, g.opponent, g.opponent_rating, g.eco, g.opening,
       g.termination, g.ply_count,
       a.game_id IS NOT NULL AS analysed,
       coalesce(a.user_accuracy, g.user_accuracy) AS accuracy,
       a.user_accuracy AS engine_accuracy,
       CASE WHEN a.game_id IS NOT NULL THEN coalesce(p.big_drops, 0) END AS blunders,
       a.user_mistakes AS mistakes,
       a.user_inaccuracies AS inaccuracies,
       p.peak >= {WINNING_PCT} AS was_winning,
       p.trough <= {LOST_PCT} AS was_lost,
       coalesce(pu.opp_blunders, CASE WHEN a.game_id IS NOT NULL THEN 0 END) AS opp_blunders,
       coalesce(pu.punished, CASE WHEN a.game_id IS NOT NULL THEN 0 END) AS punished,
       m10.eval10,
       r.reviewed_at,
       pl.avatar_url AS opponent_avatar
FROM games g
LEFT JOIN game_analysis a ON a.game_id = g.id
LEFT JOIN peaks p ON p.game_id = g.id
LEFT JOIN punish pu ON pu.game_id = g.id
LEFT JOIN move10 m10 ON m10.game_id = g.id
LEFT JOIN game_reviews r ON r.game_id = g.id
-- The opponent's public profile, when the worker has read it (players.py).
LEFT JOIN players pl ON pl.source = g.source AND pl.handle = lower(g.opponent)
"""

# Overview KPI -> the games behind it, used by the games list's `kpi` filter.
KPI_FILTERS = {
    "blunders": "f.blunders > 0",
    "thrown": "f.was_winning AND f.user_outcome = 'loss'",
    "unconverted": "f.was_winning AND f.user_outcome != 'win'",
    "unpunished": "f.punished < f.opp_blunders",
    "comebacks": "f.was_lost AND f.user_outcome != 'loss'",
    "analysed": "f.analysed",
}


def _mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def _ratio(num, den):
    return num / den if den else None


def kpis(rows, min_sample: int = 1) -> dict:
    """Improvement KPIs over a list of GAME_FACTS rows. A KPI is None when it rests on
    fewer than `min_sample` games."""
    analysed = [r for r in rows if r["analysed"]]
    winning = [r for r in analysed if r["was_winning"]]
    lost = [r for r in analysed if r["was_lost"]]
    # Engine accuracy only: Chess.com's own numbers run on a lower scale, so mixing them
    # in makes trends move when only the source changed.
    with_acc = [r["engine_accuracy"] for r in analysed if r["engine_accuracy"] is not None]
    opp_blunders = sum(r["opp_blunders"] or 0 for r in analysed)

    def enough(sample, value):
        return value if len(sample) >= min_sample else None

    return {
        "blunders_per_game": enough(analysed, _mean([r["blunders"] for r in analysed])),
        "conversion": enough(winning, _ratio(sum(r["user_outcome"] == "win" for r in winning), len(winning))),
        "winning_games": len(winning),
        "thrown": sum(r["user_outcome"] == "loss" for r in winning),
        "punish_rate": enough(analysed, _ratio(sum(r["punished"] or 0 for r in analysed), opp_blunders)),
        "opp_blunders": opp_blunders,
        "accuracy": enough(with_acc, _mean(with_acc)),
        "opening_edge": enough(analysed, _mean([r["eval10"] for r in analysed])),
        "comeback_rate": enough(lost, _ratio(sum(r["user_outcome"] != "loss" for r in lost), len(lost))),
        "lost_games": len(lost),
        "analysed": len(analysed),
    }


PHASES = ("opening", "middlegame", "endgame")  # analyze.phase


def phase_accuracy(conn, since: str | None, until: str | None = None, min_games: int = 1) -> dict:
    """Mean per-move accuracy of your moves in each game phase, over rated games played from
    `since` (None: all time) to before `until`, with the moves and games behind it. A
    phase's accuracy is None when fewer than `min_games` games reached it."""
    bounds = (" AND g.played_at >= %s" if since else "") + (" AND g.played_at < %s" if until else "")
    rows = conn.execute(
        f"""SELECT m.phase, avg(m.accuracy) AS accuracy, count(*) AS moves,
                   count(DISTINCT m.game_id) AS games
            FROM moves m JOIN games g ON g.id = m.game_id
            WHERE m.is_user AND g.rated AND m.accuracy IS NOT NULL{bounds}
            GROUP BY m.phase""",
        tuple(v for v in (since, until) if v),
    ).fetchall()
    by = {r["phase"]: r for r in rows}
    out = {}
    for phase in PHASES:
        r = by.get(phase)
        games = r["games"] if r else 0
        out[phase] = {
            "accuracy": float(r["accuracy"]) if r and games >= min_games else None,
            "moves": r["moves"] if r else 0,
            "games": games,
        }
    return out


ENDINGS = [  # substring of Chess.com/Lichess termination text -> short label
    ("checkmate", "Checkmate"),
    ("resignation", "Resigned"),
    ("abandoned", "Abandoned"),
    ("timeout vs insufficient", "Time vs material"),
    ("on time", "Time"),
    ("stalemate", "Stalemate"),
    ("repetition", "Repetition"),
    ("50-move", "50-move rule"),
    ("insufficient material", "Material"),
    ("agreement", "Agreement"),
]


def ended_by(termination: str | None) -> str | None:
    text = (termination or "").lower()
    return next((label for key, label in ENDINGS if key in text), termination)


def period_bounds(range_: str, now: datetime | None = None):
    """(start, end, prev_start) as ISO strings; start/prev_start are None for 'all'."""
    days = RANGES[range_]
    now = now or datetime.now(UTC)
    if days is None:
        return None, db.stamp(now), None
    start = now - timedelta(days=days)
    return db.stamp(start), db.stamp(now), db.stamp(start - timedelta(days=days))


def game_json(r) -> dict:
    return {
        "id": r["id"],
        "played_at": r["played_at"],
        "speed": r["speed"],
        "rated": bool(r["rated"]),
        "time_control": r["time_control"],
        "url": r["url"],
        "color": r["user_color"],
        "outcome": r["user_outcome"],
        "rating": r["user_rating"],
        "opponent": r["opponent"],
        "opponent_rating": r["opponent_rating"],
        "opponent_avatar": r["opponent_avatar"],
        "eco": r["eco"],
        "opening": r["opening"] or None,
        "ended_by": ended_by(r["termination"]),
        "moves": (r["ply_count"] + 1) // 2 if r["ply_count"] else None,
        "analysed": bool(r["analysed"]),
        "accuracy": r["accuracy"],
        "blunders": r["blunders"],
        "mistakes": r["mistakes"],
        "inaccuracies": r["inaccuracies"],
        "reviewed_at": r["reviewed_at"],
    }


def rows(conn, where: str = "TRUE", params=(), order: str = "f.played_at NULLS FIRST") -> list[db.Row]:
    """GAME_FACTS rows (as `f`) matching `where`, in `order`."""
    return conn.execute(f"SELECT * FROM ({GAME_FACTS}) f WHERE {where} ORDER BY {order}", params).fetchall()


def game_record(conn, game_id: int) -> db.Row | None:
    """What a game's review shows beyond its GAME_FACTS row: players, start and moves."""
    return conn.execute(
        "SELECT source, white, black, white_elo, black_elo, start_fen, moves_san, account FROM games WHERE id = %s",
        (game_id,),
    ).fetchone()


def game_exists(conn, game_id: int) -> bool:
    return conn.execute("SELECT 1 FROM games WHERE id = %s", (game_id,)).fetchone() is not None


def game_accuracy(conn, game_id: int) -> db.Row | None:
    """Both sides' engine accuracy, once the game is analysed."""
    return conn.execute(
        "SELECT user_accuracy, opponent_accuracy FROM game_analysis WHERE game_id = %s", (game_id,)
    ).fetchone()


def game_moves(conn, game_id: int) -> list[db.Row]:
    """Every move of a game, in order, with its analysis (NULL where there's none)."""
    return conn.execute(
        """SELECT ply, color, is_user, san, uci, best_san, best_uci, eval_after,
                  mate_after, win_pct_before, win_pct_after, classification,
                  clock_left, time_spent, pattern, layer, time_trouble, cause_facts
           FROM moves WHERE game_id = %s ORDER BY ply""",
        (game_id,),
    ).fetchall()


def review_marks(conn, game_id: int) -> list:
    """How each step of the game's last finished review lesson went, if it was saved."""
    row = conn.execute("SELECT marks FROM game_reviews WHERE game_id = %s", (game_id,)).fetchone()
    return json.loads(row["marks"]) if row and row["marks"] else []


def save_review(conn, game_id: int, reviewed_at: str, marks: list | None) -> None:
    """Mark a game reviewed; again moves the time forward and replaces the marks."""
    conn.execute(
        """INSERT INTO game_reviews (game_id, reviewed_at, marks) VALUES (%s, %s, %s)
           ON CONFLICT (game_id) DO UPDATE SET reviewed_at = excluded.reviewed_at,
                                               marks = excluded.marks""",
        (game_id, reviewed_at, json.dumps(marks) if marks else None),
    )


def last_reviewed_played_at(conn) -> str | None:
    """When the newest game you've reviewed was played."""
    return conn.execute(
        "SELECT max(g.played_at) AS at FROM game_reviews r JOIN games g ON g.id = r.game_id"
    ).fetchone()["at"]


def reviewed_between(conn, start: str, end: str) -> int:
    """How many games you finished reviewing in [start, end)."""
    return conn.execute(
        "SELECT count(*) AS n FROM game_reviews WHERE reviewed_at >= %s AND reviewed_at < %s", (start, end)
    ).fetchone()["n"]


def top_openings(conn, since: str | None) -> list[db.Row]:
    """Your three most played openings in rated games since `since` (None: all time), with
    their win rate. Grouped by ECO code; named after the variation played most within it."""
    return conn.execute(
        f"""
        WITH g AS (SELECT * FROM games WHERE rated AND eco IS NOT NULL
                   {"AND played_at >= %s" if since else ""}),
        names AS (SELECT eco, user_color, opening, row_number() OVER (
                      PARTITION BY eco, user_color ORDER BY count(*) DESC) AS rn
                  FROM g WHERE opening != '' GROUP BY eco, user_color, opening)
        SELECT g.eco, n.opening, g.user_color AS color, count(*) AS games,
               avg((g.user_outcome = 'win')::int) AS win_rate
        FROM g LEFT JOIN names n ON n.eco = g.eco AND n.user_color = g.user_color AND n.rn = 1
        GROUP BY g.eco, g.user_color, n.opening ORDER BY games DESC LIMIT 3""",
        (since,) if since else (),
    ).fetchall()
