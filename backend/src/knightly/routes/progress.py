"""Progress: the overview's KPIs and skill shape, and what your mistakes come down to."""

from datetime import datetime

from fastapi import APIRouter, Query

from .. import (
    deck,
    game_facts,
    game_trend,
    layers,
    patterns,
    skill_shape,
    time_management,
)
from ..game_facts import MIN_SAMPLE, RANGES, kpis, period_bounds, phase_accuracy
from ..schemas import OverviewOut, PatternsOut
from ..web import Context


def router(ctx: Context) -> APIRouter:
    api = APIRouter()

    @api.get("/api/patterns", response_model=PatternsOut, response_model_exclude_unset=True)
    def what_you_blunder(range: str = Query("90d", pattern="^(30d|90d|all)$")):
        """What your mistakes come down to (patterns.py): how many of your blunders, mistakes
        and misses in rated games in the range carry each tactic, most common first."""
        with ctx.connect() as conn, conn:
            deck.refresh(conn)  # so `memory` covers the same cards as /api/deck
            patterns.tag_all(conn)
        start, end, prev_start = period_bounds(range)
        with ctx.connect() as conn:
            rows = patterns.counts_by_kind(conn, start)
        by: dict[str, dict] = {}
        for r in rows:
            p = by.setdefault(
                r["pattern"], {"pattern": r["pattern"], "total": 0, "blunder": 0, "mistake": 0, "miss": 0}
            )
            p[r["kind"]] = r["n"]
            p["total"] += r["n"]
        pending = by.pop(patterns.PENDING, None)
        ranked = sorted(by.values(), key=lambda p: (p["pattern"] == patterns.OTHER, -p["total"]))
        with ctx.connect() as conn:
            strength = patterns.strength(conn, start, end, prev_start)
            memory = deck.by_pattern(conn)
            health = deck.health(conn)
        # `memory` and `deck_health` are the review deck now, whatever the range.
        return {
            "range": range,
            "patterns": ranked,
            "pending": pending["total"] if pending else 0,
            "strength": strength,
            "memory": memory,
            "deck_health": health,
        }

    @api.get("/api/overview", response_model=OverviewOut)
    def overview(range: str = Query("90d", pattern="^(30d|90d|all)$")):
        start, end, prev_start = period_bounds(range)
        with ctx.connect() as conn:
            layer_counts = layers.counts(conn, start)
            phases = phase_accuracy(conn, start)
            # Like previous_kpis: a comparison needs MIN_SAMPLE games in the earlier period.
            previous_phases = phase_accuracy(conn, prev_start, start, MIN_SAMPLE) if prev_start else None
            # Overview stats are rated games only: unrated daily games are mostly vs bots.
            rated = game_facts.rows(conn, "f.rated")
        current = [r for r in rated if start is None or r["played_at"] >= start]
        previous = [r for r in rated if prev_start and prev_start <= r["played_at"] < start]
        before = [r for r in rated if start and r["played_at"] < start]
        with ctx.connect() as conn:
            shape = skill_shape.summarize(conn, current, previous, start, end, prev_start)
            trend = game_trend.summarize(conn)
            openings = game_facts.top_openings(conn, start)
            ten_minute_games, ten_minute_moves = time_management.load(conn, start)

        ratings = [r["user_rating"] for r in current if r["user_rating"]]
        baseline = before[-1]["user_rating"] if before else (ratings[0] if ratings else None)
        weeks = (
            max(1, RANGES[range] / 7)
            if RANGES[range]
            else max(
                1,
                (
                    (
                        datetime.fromisoformat(current[-1]["played_at"][:10])
                        - datetime.fromisoformat(current[0]["played_at"][:10])
                    ).days
                    / 7
                    if current
                    else 1
                ),
            )
        )

        return {
            "range": range,
            "start": start,
            "end": end,
            "time_management": time_management.summarize(ten_minute_games, ten_minute_moves),
            "rating": {
                "current": ratings[-1] if ratings else None,
                "change": ratings[-1] - baseline if ratings and baseline else None,
                "best": max(ratings) if ratings else None,
            },
            "games_played": len(current),
            "games_per_week": len(current) / weeks,
            "games_analysed": sum(1 for r in current if r["analysed"]),
            "rating_series": [
                {
                    "id": r["id"],
                    "played_at": r["played_at"],
                    "rating": r["user_rating"],
                    "outcome": r["user_outcome"],
                    "opponent": r["opponent"],
                    "opponent_rating": r["opponent_rating"],
                }
                for r in current
                if r["user_rating"]
            ],
            "kpis": kpis(current),
            "previous_kpis": kpis(previous, MIN_SAMPLE) if previous else None,
            "phase_accuracy": {"current": phases, "previous": previous_phases},
            "top_openings": [dict(o) for o in openings],
            # Your mistakes, misses and blunders in the period by layer (layers.py), with
            # "other" (no layer holds) and "pending" (not settled yet).
            "layers": layer_counts,
            # The Progress radar's five 0-100 scores (skill_shape.py); an axis without enough
            # games has no score, never zero.
            "skill_shape": shape,
            # Each skill's mistakes in your recent games against the games before, whatever
            # the range (game_trend.py).
            "game_trend": trend,
        }

    return api
