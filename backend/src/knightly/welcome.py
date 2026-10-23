"""The welcome flow's import screen: what the first update has found so far."""

from . import db


def import_counts(conn) -> db.Row:
    """Your games, standard games and analysed games so far."""
    return conn.execute("""SELECT (SELECT count(*) FROM games) AS games,
                                  (SELECT count(*) FROM games WHERE variant = 'standard') AS standard,
                                  (SELECT count(*) FROM game_analysis) AS analysed""").fetchone()


def findings(conn) -> list[dict]:
    """Your three newest blunders, mistakes or misses with a better move to show."""
    return [
        dict(r)
        for r in conn.execute(
            """SELECT g.opponent, g.played_at, m.move_number, m.color, m.san, m.best_san, m.classification
               FROM moves m JOIN games g ON g.id = m.game_id
               WHERE m.is_user AND m.classification IN ('blunder', 'mistake', 'miss') AND m.best_san IS NOT NULL
               ORDER BY g.played_at DESC NULLS LAST, m.ply LIMIT 3"""
        ).fetchall()
    ]


def mistake_counts(conn) -> db.Row:
    """Your blunders, mistakes and misses over every analysed game."""
    return conn.execute(
        """SELECT count(*) FILTER (WHERE classification = 'blunder') AS blunders,
                  count(*) FILTER (WHERE classification = 'mistake') AS mistakes,
                  count(*) FILTER (WHERE classification = 'miss') AS misses
           FROM moves WHERE is_user"""
    ).fetchone()
