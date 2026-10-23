"""In your games: each skill's mistakes in your recent games against the games before, next to
how much you practiced it (docs/specs/2026-10-17-learning-loop-design.md, part 1).

Only games count as evidence, never practice answers. The sample is the skill shape's eligible
games (rated, analysed, every mistake settled) inside the layer window, newest first: the newest
`n` games are "recent", the `n` before them "earlier". A change is reported as fewer or more only
when an exact binomial test says the split is unlikely to be chance; it describes, it does not
claim practice caused it."""

from datetime import date, datetime, timedelta
from math import comb

from . import db, layers, patterns, skill_shape

VERSION = 1
WINDOW = 20  # games per window, at most
MIN_GAMES = skill_shape.MIN_GAMES
MIN_MISTAKES = 6  # in both windows together, before a change is called
P_TREND = 0.1  # two-sided: below this, fewer or more; otherwise the same
SKILLS = {"safety": skill_shape.SAFETY, "tactics": ("ownTactic",), "calculation": ("calculation",)}


def p_value(recent: int, earlier: int) -> float:
    """Two-sided exact binomial p of `recent` out of `recent + earlier` at one half: how likely a
    split at least this uneven is when both windows share one rate."""
    k = recent + earlier
    low = sum(comb(k, i) for i in range(recent + 1))
    high = sum(comb(k, i) for i in range(recent, k + 1))
    return min(1.0, 2 * min(low, high) / 2**k)


def change(recent: int, earlier: int) -> str | None:
    if recent + earlier < MIN_MISTAKES:
        return None
    if p_value(recent, earlier) >= P_TREND:
        return "same"
    return "fewer" if recent < earlier else "more"


def _practice(conn, start: str, earlier_start: str) -> dict[str, dict[str, int]]:
    """Graded items per skill answered from `start` to now ("recent") and from `earlier_start`
    to `start` ("earlier"): cards by their move's layer, threat questions for safety and
    Knightly puzzles for tactics. One query: each one costs a round trip."""
    rows = conn.execute(
        """SELECT m.layer AS tag, c.reviewed_at AS at FROM card_reviews c
               JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply WHERE c.reviewed_at >= %s
           UNION ALL SELECT 'threat', reviewed_at FROM threat_reviews
               WHERE rating IS NOT NULL AND reviewed_at >= %s
           UNION ALL SELECT 'puzzle', attempted_at FROM puzzle_attempts
               WHERE source = %s AND attempted_at >= %s""",
        (earlier_start, earlier_start, patterns.PUZZLE_SOURCE, earlier_start),
    ).fetchall()
    extra = {"safety": ("threat",), "tactics": ("puzzle",), "calculation": ()}
    out = {key: {"recent": 0, "earlier": 0} for key in SKILLS}
    for r in rows:
        for key, tags in SKILLS.items():
            if r["tag"] in tags or r["tag"] in extra[key]:
                out[key]["recent" if r["at"] >= start else "earlier"] += 1
    return out


def _games(conn, since: str) -> list[dict]:
    """Rated, analysed games since `since`, newest first: whether every mistake of yours is
    settled, and per skill how many mistakes it had and the win% they lost. One aggregate
    over your mistakes, so it stays cheap enough for every deck request."""
    kinds = ", ".join("%s" for _ in patterns.KINDS)
    parts, params = [], []
    for key, tags in SKILLS.items():
        tag_list = ", ".join("%s" for _ in tags)
        parts.append(
            f"count(x.layer) FILTER (WHERE x.layer IN ({tag_list})) AS {key}_n, "
            f"coalesce(sum(x.lost) FILTER (WHERE x.layer IN ({tag_list})), 0) AS {key}_lost"
        )
        params += [*tags, *tags]
    rows = conn.execute(
        f"""WITH mine AS (
                SELECT m.game_id, m.layer,
                       greatest(0, coalesce(m.win_pct_before, 0) - coalesce(m.win_pct_after, 0)) AS lost
                FROM moves m WHERE m.is_user AND m.classification IN ({kinds}))
            SELECT g.id, g.played_at,
                   coalesce(bool_and(x.layer IS NOT NULL AND x.layer != %s)
                            FILTER (WHERE x.game_id IS NOT NULL), true) AS settled,
                   {", ".join(parts)}
            FROM games g JOIN game_analysis a ON a.game_id = g.id
            LEFT JOIN mine x ON x.game_id = g.id
            WHERE g.rated AND g.played_at >= %s
            GROUP BY g.id, g.played_at ORDER BY g.played_at DESC, g.id DESC""",
        (*patterns.KINDS, layers.UNKNOWN, *params, since),
    ).fetchall()
    return [dict(r) for r in rows]


def summarize(conn: db.Connection, today: date | None = None, practice: bool = True) -> dict:
    """The trend; `practice=False` leaves the practice counts at 0 (the lesson's focus needs
    only the games)."""
    today = today or db.today(conn)
    since = db.stamp(datetime.combine(today, datetime.min.time()) - timedelta(days=layers.SETTLE_DAYS))
    eligible = [g for g in _games(conn, since) if g["settled"]]
    n = min(WINDOW, len(eligible) // 2)
    if n < MIN_GAMES:
        return {
            "version": VERSION,
            "window": 0,
            "games": len(eligible),
            "reason": "few_games",
            "since": None,
            "skills": [
                {
                    "key": key,
                    "recent": 0,
                    "earlier": 0,
                    "cost": None,
                    "change": None,
                    "practice": {"recent": 0, "earlier": 0},
                }
                for key in SKILLS
            ],
        }
    recent, earlier = eligible[:n], eligible[n : 2 * n]
    start, earlier_start = recent[-1]["played_at"], earlier[-1]["played_at"]
    done = _practice(conn, start, earlier_start) if practice else {key: {"recent": 0, "earlier": 0} for key in SKILLS}
    skills = []
    for key in SKILLS:
        now = sum(g[f"{key}_n"] for g in recent)
        before = sum(g[f"{key}_n"] for g in earlier)
        lost = sum(float(g[f"{key}_lost"]) for g in recent)
        skills.append(
            {
                "key": key,
                "recent": now,
                "earlier": before,
                "cost": round(lost / n, 1),
                "change": change(now, before),
                "practice": done[key],
            }
        )
    return {"version": VERSION, "window": n, "games": len(eligible), "reason": None, "since": start, "skills": skills}


# The lesson's focus (spec part 2): the skill costing you most in recent games.
MIN_COST = 1.0  # win% lost a game, at least
MIN_RECENT = 3  # mistakes in the recent window, at least
FOCUS_SETTING = "lesson_focus"
FOCUS_HISTORY = 365  # days of past focus kept


def pick_focus(trend: dict) -> dict | None:
    """The costliest qualifying skill of `trend`, or None; ties keep SKILLS' order."""
    if trend["reason"]:
        return None
    best = None
    for s in trend["skills"]:
        if s["cost"] >= MIN_COST and s["recent"] >= MIN_RECENT and (best is None or s["cost"] > best["cost"]):
            best = s
    return {"key": best["key"], "cost": best["cost"], "window": trend["window"]} if best else None


def by_layer(costs: dict[str, float]) -> dict[str, float]:
    """Per-skill costs spread over the mistake layers each skill covers."""
    return {layer: cost for key, cost in costs.items() for layer in SKILLS.get(key, ())}


def day_trend(conn: db.Connection, today: date | None = None) -> dict:
    """Today's lesson focus and what each skill costs you a game, chosen at the day's first
    request and kept for the day: `{"focus": ... | None, "costs": {skill: win% a game}}`.

    One cached setting for both, because `summarize` loads every move of the window and the
    deck reads this on a request. A day saved before costs were kept recomputes once."""
    today = today or db.today(conn)
    saved = db.get_setting(conn, FOCUS_SETTING) or {}
    day = today.isoformat()
    if saved.get("day") == day and "costs" in saved:
        return {"focus": saved.get("focus"), "costs": saved["costs"]}
    trend = summarize(conn, today, practice=False)
    chosen = pick_focus(trend)
    costs = {s["key"]: s["cost"] for s in trend["skills"] if s["cost"] is not None}
    history = [h for h in saved.get("history", []) if h.get("day") != day][-(FOCUS_HISTORY - 1) :]
    history.append({"day": day, "key": chosen["key"] if chosen else None})
    db.set_setting(conn, FOCUS_SETTING, {"day": day, "focus": chosen, "costs": costs, "history": history})
    return {"focus": chosen, "costs": costs}


def focus(conn: db.Connection, today: date | None = None) -> dict | None:
    """Today's lesson focus alone; `day_trend` holds the rest."""
    return day_trend(conn, today)["focus"]
