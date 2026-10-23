"""The public profile behind a handle: the avatar an opponent shows on Chess.com.

A game carries a username and nothing else -- Chess.com's game JSON has no avatar -- so the
avatar comes from a second endpoint, /pub/player/{handle}, one call per handle. The worker
does that after a sync, never a request: a first import of a few hundred games can bring a
couple of hundred new opponents, and they are fetched a batch a run.

Lichess has no equivalent for most players and a PGN import has no profile at all, so those
handles keep the initials the app falls back to.
"""

import urllib.error
from datetime import UTC, datetime, timedelta

from .http import get_json

API = "https://api.chess.com/pub/player"
SOURCE = "chesscom"
# A profile is re-read after this long: avatars change, but rarely.
TTL_DAYS = 30
# Profiles fetched in one run. The rest wait for the next: polite to a public API, and a
# missing avatar costs nothing (the app shows initials).
PER_RUN = 50


def _cutoff(days: int = TTL_DAYS) -> str:
    """The ISO-8601 UTC text a profile must be newer than, in iso_now()'s format."""
    return (datetime.now(UTC) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _country(url: str | None) -> str | None:
    """'https://api.chess.com/pub/country/US' -> 'US'."""
    return url.rstrip("/").rsplit("/", 1)[-1] if url else None


def profile(handle: str) -> dict | None:
    """`handle`'s public profile, or None when Chess.com doesn't know the name (a closed
    account, or an opponent whose handle a PGN spelled differently)."""
    try:
        return get_json(f"{API}/{handle}")
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return None
        raise


def known(conn, source: str = SOURCE) -> dict[str, str]:
    """Each handle this user has a profile for, to the avatar it shows (handles without one
    are left out, so a caller can treat a miss and no avatar alike)."""
    rows = conn.execute(
        "SELECT handle, avatar_url FROM players WHERE source = %s AND avatar_url IS NOT NULL", (source,)
    ).fetchall()
    return {r["handle"]: r["avatar_url"] for r in rows}


def stale(conn, limit: int = PER_RUN, source: str = SOURCE) -> list[str]:
    """Handles worth asking about: this user's own Chess.com accounts first, then the
    opponents they have played, skipping any profile read within TTL_DAYS."""
    rows = conn.execute(
        """
        WITH handles AS (
            SELECT lower(handle) AS handle, 0 AS rank FROM accounts WHERE source = %s
            UNION ALL
            SELECT DISTINCT lower(opponent), 1 FROM games
             WHERE source = %s AND opponent IS NOT NULL AND opponent <> ''
        ), ranked AS (
            SELECT handle, min(rank) AS rank FROM handles GROUP BY handle
        )
        SELECT r.handle FROM ranked r
        LEFT JOIN players p ON p.source = %s AND p.handle = r.handle
        WHERE p.handle IS NULL OR p.fetched_at < %s
        ORDER BY r.rank, r.handle
        LIMIT %s
        """,
        (source, source, source, _cutoff(), limit),
    ).fetchall()
    return [r["handle"] for r in rows]


def save(conn, handle: str, data: dict | None, source: str = SOURCE) -> None:
    """Store what `handle`'s profile said, or that there was none to read."""
    conn.execute(
        """
        INSERT INTO players (source, handle, avatar_url, display_name, title, country, missing, fetched_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, iso_now())
        ON CONFLICT (user_id, source, handle) DO UPDATE SET
            avatar_url = EXCLUDED.avatar_url, display_name = EXCLUDED.display_name,
            title = EXCLUDED.title, country = EXCLUDED.country,
            missing = EXCLUDED.missing, fetched_at = EXCLUDED.fetched_at
        """,
        (
            source,
            handle,
            (data or {}).get("avatar"),
            (data or {}).get("name"),
            (data or {}).get("title"),
            _country((data or {}).get("country")),
            data is None,
        ),
    )


def refresh(conn, limit: int = PER_RUN, log=print) -> int:
    """Read the profiles of up to `limit` handles that need one. Returns how many were
    read. A network failure stops the batch rather than the run: the next one carries on
    from the same list."""
    handles = stale(conn, limit)
    read = 0
    for handle in handles:
        try:
            data = profile(handle)
        except (urllib.error.URLError, OSError, ValueError) as e:
            log(f"  profile {handle}: {e}")
            break
        with conn:
            save(conn, handle, data)
        read += 1
    if read:
        log(f"Read {read} of {len(handles)} profiles.")
    return read


def avatar(conn, source: str, handle: str | None) -> str | None:
    """One handle's avatar, for a single game's detail."""
    if not handle:
        return None
    row = conn.execute(
        "SELECT avatar_url FROM players WHERE source = %s AND handle = lower(%s)", (source, handle)
    ).fetchone()
    return row["avatar_url"] if row else None
