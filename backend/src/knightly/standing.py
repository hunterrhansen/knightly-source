"""Where you stand: your current rating from your real games."""

from . import db

RECENT_GAMES = 40  # rated games the current rating is averaged over


def rating(conn: db.Connection) -> int | None:
    """Your current rating: the mean of the last `RECENT_GAMES` rated games.

    A mean over all history would say 688 where the recent games say 916, which is the
    difference between puzzles aimed at back-rank mates and ones aimed at forks."""
    rows = conn.execute(
        """SELECT user_rating FROM games
           WHERE rated AND user_rating IS NOT NULL
           ORDER BY played_at DESC NULLS LAST LIMIT %s""",
        (RECENT_GAMES,),
    ).fetchall()
    ratings = [r["user_rating"] for r in rows]
    return round(sum(ratings) / len(ratings)) if ratings else None
