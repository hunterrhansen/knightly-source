"""Home: the improvement path, today's goal and the streak calendar."""

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query

from .. import (
    daily,
    db,
    deck,
    game_facts,
    path,
    patterns,
    puzzles,
    wards,
    watch,
)
from ..game_facts import game_json, period_bounds
from ..schemas import HomeOut, JourneyMapOut, KeptNightOut, StreakDaysOut
from ..web import Context

NEW_GAME_DAYS = 3  # a game you haven't reviewed counts as new on Home for this long
STREAK_DAYS_MAX = 42  # six calendar weeks: a whole month view


def router(ctx: Context) -> APIRouter:
    api = APIRouter()

    @api.get("/api/home", response_model=HomeOut, response_model_exclude_unset=True)
    def home():
        """Home: today's goal and the journey. Today's game is your newest analysed game you
        haven't reviewed, played after the newest one you have (and in the last NEW_GAME_DAYS
        days)."""
        start, _, _ = period_bounds("90d")
        # One connection, and its repeated reads served from the first answer
        # (db.Connection.remember_reads): every round trip to the database costs ~44 ms.
        with ctx.connect() as conn:
            conn.remember_reads()
            # Newer than the newest game you've reviewed: reviewing an old game from the list
            # doesn't make yesterday's game stop counting as new.
            last = game_facts.last_reviewed_played_at(conn)
            since = max(filter(None, [last, db.stamp(datetime.now(UTC) - timedelta(days=NEW_GAME_DAYS))]))
            fresh = game_facts.rows(
                conn,
                "f.analysed AND f.reviewed_at IS NULL AND f.played_at > %s",
                (since,),
                order="f.played_at DESC NULLS LAST",
            )
            pick = fresh[0] if fresh else None
            # The Games tile's badge: new games with a move that slipped past you.
            slipped = sum(1 for s in watch.slips(conn, fresh).values() if s and sum(s.values()))
            reviewed_today = game_facts.reviewed_between(conn, *db.day_range(conn, db.today(conn)))

            with conn:
                deck.refresh(conn)
                positions = deck.stats(conn)
                puzzles_done = puzzles.done_today(conn)
                puzzles_ready = puzzles.available(conn)
                review = daily.summary(conn, db.today(conn), game_available=pick is not None)
                journey = watch.journey_summary(conn, db.today(conn))
            # Your most common tactic over the last 90 days: the path's puzzles train it.
            top, tagged = patterns.most_common_rated(conn, start)
        return {
            # Stars and rank (watch.py): the full map is /api/journey.
            "journey": journey,
            "today": {
                "game": game_json(pick) if pick else None,
                "new_games": len(fresh),
                "new_games_slipped": slipped,
                "reviewed_today": reviewed_today,
                "positions": positions["today"],
                "deck_total": positions["total"],
                "puzzles": {
                    "theme": top["pattern"] if top else None,
                    "share": round(top["n"] / tagged, 2) if top and tagged else None,
                    "done": puzzles_done,
                    "session": puzzles.SESSION,
                    "available": puzzles_ready,
                },
                # The daily review: plan steps, streak, memory, tomorrow (daily.py).
                **review,
            },
        }

    @api.get("/api/journey", response_model=JourneyMapOut)
    def journey_map():
        """The Progress map: stars (dimmed while their card has lapsed), ranks with the post
        that reaches each and the day it was reached, and nights kept with their milestones;
        for the home path, the week ahead by the cards' due dates, every kept night and extra
        watch with what it held, and the first star's progress."""
        with ctx.connect() as conn, conn:
            conn.remember_reads()
            today = db.today(conn)
            # The curriculum in order: the home path's nodes (wards.py). First, so the
            # wards it records reached count toward the ranks in the same response.
            path_wards = wards.path(conn, today)
            journey = watch.journey(conn, today)
            return {
                **journey,
                "wards": path_wards,
                # The home path (path.py): the schedule ahead, exact history, the first star.
                "ahead": path.ahead(conn, today),
                "history": path.history(conn, today),
                "first_star": path.first_star(conn, journey["stars"]),
                # Every move by where it is on the watch: Progress's "Your moves" ring.
                "moves": watch.deck_states(conn),
            }

    @api.get("/api/journey/night", response_model=KeptNightOut)
    def journey_night(day: date = Query(alias="date")):
        """A kept night's watch on the path: what it held and where each of its moves stands
        now. 404 for a night that was not kept."""
        with ctx.connect() as conn, conn:
            found = path.night(conn, db.today(conn), day)
        if found is None:
            raise HTTPException(404, "That night was not kept.")
        return found

    @api.get("/api/streak/days", response_model=StreakDaysOut)
    def streak_days(start: date = Query(alias="from"), end: date = Query(alias="to")):
        """Each day's streak state from `from` to `to` inclusive (at most 42 days,
        ending no later than your today), as in Today's `streak.week`, for the streak calendar."""
        with ctx.connect() as conn:
            today = db.today(conn)
            if end < start:
                raise HTTPException(422, "`from` is after `to`.")
            if end > today:
                raise HTTPException(422, f"`to` is after today ({today.isoformat()}).")
            if (end - start).days >= STREAK_DAYS_MAX:
                raise HTTPException(422, f"At most {STREAK_DAYS_MAX} days at a time.")
            return {"days": daily.history(conn, today, start, end)}

    return api
