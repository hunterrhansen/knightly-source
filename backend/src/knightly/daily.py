"""The daily review: today's lesson, the rest of the day's plan, and the streak.

The lesson is the habit's minimum: tonight's watch, GOAL items answered today in the watch's
mix (mix.py: look first, tonight's idea, mixed review and your games). Finishing it keeps the streak; reviewing a game
keeps it only on a day with no lesson (the game's slips join the lesson, so the lesson is
the night's watch whenever there is one). The plan is everything else waiting, for "Keep going": the game to review, every
position due and the day's puzzle session; a step counts once done on the user's day.
Each write that can finish the lesson or a step calls `record`, and Today's summary
records how many steps the plan had, so a day with nothing to do neither breaks nor
extends the streak.

The streak is computed from those rows on every read, oldest first, so it is the same
however often it is asked for. A freeze is earned for every FREEZE_EVERY streak days (at
most MAX_FREEZES held) and is spent on a missed day automatically.
"""

from datetime import date, timedelta

from . import db, deck, game_trend, puzzles

FREEZE_EVERY = 7
MAX_FREEZES = 2
GOAL = 10  # items in a watch, each with its job in the mix (mix.py)
WATCH_SETTING = "watch"  # {time: "HH:MM", anchor, set_on}: when the learner keeps their watch


def lesson(conn, today: date, stats: dict | None = None) -> dict:
    """Tonight's watch: items answered today against GOAL. Puzzles fill any slot the learner's
    own positions cannot, so with puzzles stored the watch is always GOAL long; without them
    it is every position there is today (total 0: nothing to practise)."""
    positions = (stats or deck.stats(conn, today))["today"]
    solved = puzzles.done_today(conn, today)
    total = GOAL if puzzles.available(conn) else min(GOAL, positions["total"])
    return {"done": min(positions["done"] + solved, total), "total": total}


def steps_done(conn, today: date, stats: dict | None = None) -> dict[str, bool]:
    """Which steps are done today, from the records each step writes."""
    reviewed = conn.execute(
        "SELECT count(*) FROM game_reviews WHERE reviewed_at >= %s AND reviewed_at < %s", db.day_range(conn, today)
    ).fetchone()[0]
    stats = stats or deck.stats(conn, today)
    positions = stats["today"]
    saved = lesson(conn, today, stats)
    return {
        "game": reviewed > 0,
        "positions": positions["total"] > 0 and positions["done"] >= positions["total"],
        "puzzles": puzzles.done_today(conn, today) >= puzzles.SESSION,
        "goal": saved["total"] > 0 and saved["done"] >= saved["total"],
        # A game review keeps the night only when there is no lesson to keep it.
        "game_keeps": reviewed > 0 and saved["total"] == 0,
    }


def record(conn, today: date, planned: int | None = None, done: dict[str, bool] | None = None) -> None:
    """Save today's finished lesson and steps (neither un-finishes: new cards arriving later
    in the day don't undo "positions"), and the plan's size when Today shows it. The `game`
    column is whether a game review kept the night (`game_keeps`): only on a day with no
    lesson, so a review never keeps a night that has a lesson."""
    done = done if done is not None else steps_done(conn, today)
    conn.execute(
        """INSERT INTO daily_activity (day, planned, game, positions, puzzles, goal)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (user_id, day) DO UPDATE SET
               planned = coalesce(excluded.planned, daily_activity.planned),
               game = daily_activity.game OR excluded.game,
               positions = daily_activity.positions OR excluded.positions,
               puzzles = daily_activity.puzzles OR excluded.puzzles,
               goal = daily_activity.goal OR excluded.goal,
               updated_at = iso_now()""",
        (
            today.isoformat(),
            planned,
            done.get("game_keeps", False),
            done["positions"],
            done["puzzles"],
            done["goal"],
        ),
    )


def _replay(conn, today: date) -> tuple[dict, dict[str, str], dict[str, int]]:
    """The streak as of today, every past day's state from the first activity on, and each
    done day's night in its streak (1-based; frozen days add none), from one oldest-first
    pass over daily_activity: Today's week and the calendar both read it."""
    rows = {
        r["day"]: r
        for r in conn.execute(
            "SELECT day, planned, game, goal FROM daily_activity WHERE day <= %s ORDER BY day", (today.isoformat(),)
        )
    }
    active = {d for d, r in rows.items() if r["goal"] or r["game"]}
    rest = {d for d, r in rows.items() if d not in active and r["planned"] == 0}
    count = best = freezes = 0
    states: dict[str, str] = {d: "rest" for d in rest}  # rest days before the first activity too
    nights: dict[str, int] = {}
    if active:
        day = date.fromisoformat(min(active))
        while day < today:
            key = day.isoformat()
            if key in active:
                states[key] = "done"
                count += 1
                nights[key] = count
                best = max(best, count)
                if count % FREEZE_EVERY == 0:
                    freezes = min(MAX_FREEZES, freezes + 1)
            elif key in rest:
                pass
            elif count and freezes:
                freezes -= 1
                states[key] = "frozen"
            else:
                states[key] = "missed"
                count = 0
            day += timedelta(days=1)
    safe = today.isoformat() in active
    if safe:
        count += 1
        nights[today.isoformat()] = count
        best = max(best, count)
    states[today.isoformat()] = "done" if safe else "today"
    # The latest day that counted: reminders back off as silence since it grows.
    kept = max(active, default=None)
    totals = {
        "count": count,
        "best": best,
        "freezes": freezes,
        "safe_today": safe,
        "last_kept": kept,
        # Every night kept, all time (frozen days are not kept), for the journey's milestones.
        "nights_total": len(active),
    }
    return totals, states, nights


def kept_nights(conn, today: date) -> list[str]:
    """Every day the streak counted (the lesson finished, or a game reviewed on a day with no
    lesson), oldest first, up to today: the journey's nights."""
    return [
        r["day"]
        for r in conn.execute(
            "SELECT day FROM daily_activity WHERE day <= %s AND (goal OR game) ORDER BY day", (today.isoformat(),)
        )
    ]


def _states(states: dict[str, str], nights: dict[str, int], today: date, start: date, end: date) -> list[dict]:
    """Day by day from start to end inclusive, done days with their night; past days the
    replay never reached (before the first activity) are "none"."""
    out = []
    day = start
    while day <= end:
        key = day.isoformat()
        state = "upcoming" if day > today else states.get(key, "none")
        out.append({"date": key, "state": state, "night": nights.get(key) if state == "done" else None})
        day += timedelta(days=1)
    return out


def streak(conn, today: date) -> dict:
    """The streak as of today: its length, the best ever, freezes held, whether today
    already counts, and this week (Monday first) day by day."""
    totals, states, nights = _replay(conn, today)
    monday = today - timedelta(days=today.weekday())
    return {**totals, "week": _states(states, nights, today, monday, monday + timedelta(days=6))}


def history(conn, today: date, start: date, end: date) -> list[dict]:
    """Each day's streak state from start to end inclusive, as in `streak`'s week."""
    _, states, nights = _replay(conn, today)
    return _states(states, nights, today, start, end)


def watch(conn) -> dict | None:
    """The learner's watch: the time they keep it and the habit it follows, or None."""
    return db.get_setting(conn, WATCH_SETTING)


def set_watch(conn, time: str, anchor: str) -> dict:
    """Saves the watch. `set_on` (the user's today) restarts the reminders' back-off."""
    saved = {"time": time, "anchor": anchor, "set_on": db.today(conn).isoformat()}
    db.set_setting(conn, WATCH_SETTING, saved)
    return saved


def summary(conn, today: date, game_available: bool) -> dict:
    """Today's review for the Today page: the lesson, the plan's steps in order (absent ones
    left out), the streak, deck memory, how many new positions Learn more offers (0 until
    today's queue is finished), tomorrow's load, games analysed and waiting, and when today
    ends. Records the plan."""
    remaining = deck.queue(conn, today)
    stats = deck.stats(conn, today, remaining=remaining)
    done = steps_done(conn, today, stats)
    puzzle_done = puzzles.done_today(conn, today)
    plan = []
    if game_available or done["game"]:
        plan.append({"kind": "game", "done": done["game"]})
    if stats["today"]["total"]:
        plan.append(
            {
                "kind": "positions",
                "done": done["positions"],
                "count": stats["today"]["done"],
                "total": stats["today"]["total"],
            }
        )
    if puzzles.available(conn) or done["puzzles"]:
        plan.append(
            {
                "kind": "puzzles",
                "done": done["puzzles"],
                "count": min(puzzle_done, puzzles.SESSION),
                "total": puzzles.SESSION,
            }
        )
    record(conn, today, planned=len(plan), done=done)
    from . import extra  # it reads the lesson from here
    from . import watch as story  # it reads the streak's nights from here

    saved = lesson(conn, today, stats)
    return {
        "day": today.isoformat(),
        "day_ends_at": db.day_range(conn, today)[1],
        "plan": plan,
        "streak": streak(conn, today),
        "lesson": saved,
        "memory": {
            "total": stats["total"],
            "mastered": stats["mastered"],
            "learning": stats["learning"],
            "new": stats["new"],
            "mastered_today": deck.mastered_today(conn, today),
            # Moves that stopped slipping today (watch.STOPPED_DAYS, the watch story's bar):
            # the Watch page's relit star and kept results.
            "stopped_today": len(story.stopped_today_keys(conn, today)),
        },
        "learn_more": deck.more_available(conn, today, remaining),
        "tomorrow_due": len(deck.queue(conn, today + timedelta(days=1))),
        # Analysed and waiting games, so an empty or small deck can say why.
        "games": deck.game_counts(conn),
        # The skill today's lesson leans toward (game_trend.focus), or None.
        "focus": game_trend.focus(conn, today),
        "watch": watch(conn),
        # The Watch page's preview of tonight's lesson (watch.tonight).
        "tonight": story.tonight(conn, today, saved, remaining),
        # Extra watches finished tonight (extra.py): the path's small nodes after the night.
        "extra_kept": extra.kept_tonight(conn, today),
    }
