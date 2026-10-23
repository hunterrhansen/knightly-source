"""The Postgres database: connecting, migrations, and the few writes every importer shares.

`connect()` returns a `Connection`: `execute` with psycopg's `%s` placeholders, rows readable
by name or position, and `with conn:` as a transaction. Outside a `with` block each
statement commits on its own, so a long engine run never holds a transaction open. A query
run with parameters writes a literal `%` as `%%`.

A connection made with `user_id` acts for that user: it can only see and write their rows
(row-level security, migrations/0003_users.sql). Without one it's the owner's connection,
for migrations and managing users.
"""

import json
import os
from datetime import UTC, date, datetime, time, timedelta, tzinfo
from importlib import resources
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import psycopg
from psycopg.types.numeric import FloatLoader

DEFAULT_URL = os.environ.get("KNIGHTLY_DATABASE_URL", "postgresql:///knightly")
# Timestamps are stored as ISO UTC text, which sorts and compares as time does.
STAMP_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def stamp(at: datetime) -> str:
    """`at` as the ISO UTC text the tables store, e.g. 2026-10-18T13:00:00Z. An aware time is
    converted to UTC first; a naive one is taken to be UTC already."""
    return (at.astimezone(UTC) if at.tzinfo else at).strftime(STAMP_FORMAT)


GAME_COLUMNS = [
    "source",
    "source_id",
    "account",
    "url",
    "played_at",
    "variant",
    "speed",
    "time_control",
    "rated",
    "white",
    "black",
    "white_elo",
    "black_elo",
    "result",
    "termination",
    "user_color",
    "user_outcome",
    "user_rating",
    "opponent",
    "opponent_rating",
    "user_accuracy",
    "opponent_accuracy",
    "eco",
    "opening",
    "start_fen",
    "ply_count",
    "moves_san",
    "pgn",
    "raw",
]

PUZZLE_COLUMNS = [
    "source",
    "puzzle_id",
    "account",
    "attempted_at",
    "success",
    "fen",
    "last_move",
    "solution",
    "themes",
    "puzzle_rating",
    "plays",
    "url",
    "raw",
]

MIGRATION_LOCK = 4_243_001  # pg_advisory_xact_lock key: one migrating process at a time


class Row(tuple):
    """A result row, read by column name (`row["ply"]`) or position (`row[0]`).
    `dict(row)` gives {column: value}."""

    def __new__(cls, values, names, index):
        row = super().__new__(cls, values)
        row._names, row._index = names, index
        return row

    def __getitem__(self, key):
        return tuple.__getitem__(self, self._index[key] if isinstance(key, str) else key)

    def keys(self):
        return list(self._names)


def _row_factory(cursor):
    names = [c.name for c in cursor.description or []]
    index = {name: i for i, name in enumerate(names)}
    return lambda values: Row(values, names, index)


class _Remembered:
    """A read's rows, served again: the slice of psycopg.Cursor the app uses."""

    def __init__(self, rows: list, description):
        self._rows, self._at, self.description = rows, 0, description
        self.rowcount = len(rows)

    def fetchone(self):
        if self._at >= len(self._rows):
            return None
        self._at += 1
        return self._rows[self._at - 1]

    def fetchall(self):
        rest, self._at = self._rows[self._at :], len(self._rows)
        return rest

    def __iter__(self):
        while (row := self.fetchone()) is not None:
            yield row


# Reads with side effects, which must always run.
_NOT_A_PLAIN_READ = ("set_config", "nextval", "for update", "pg_advisory")


class Connection:
    def __init__(self, pg: psycopg.Connection):
        self.pg = pg
        self._transactions = []
        self.user_id: int | None = None
        self._zone: tuple[tzinfo | None] | None = None
        # Rows of identical reads, while remember_reads() is on: None when it is off.
        self._memo: dict | None = None

    def remember_reads(self) -> "Connection":
        """Serve a repeated identical SELECT from the rows it returned the first time,
        until anything writes. For one request's short-lived connection only: a home
        load asks the same small questions dozens of times (deck.stats inside
        daily.summary, the same setting nine times), and each costs a round trip to the
        database. Any statement that is not a plain SELECT forgets everything."""
        self._memo = {}
        return self

    @property
    def zone(self) -> tzinfo | None:
        """The user's time zone (Settings: "timezone"), read once per connection; None means
        the server's own, as for the owner's connection or a user who never sent one."""
        if self._zone is None:
            name = get_setting(self, TIMEZONE_SETTING) if self.user_id is not None else None
            try:
                self._zone = (parse_zone(name) if name else None,)
            except ValueError:
                self._zone = (None,)
        return self._zone[0]

    def forget_zone(self) -> None:
        """After the setting changes, so this connection reads it again."""
        self._zone = None

    def execute(self, query: str, params=None) -> psycopg.Cursor:
        if self._memo is not None:
            text = query.lstrip().lower()
            if text.startswith("select") and not any(s in text for s in _NOT_A_PLAIN_READ):
                try:
                    key = (query, None if params is None else tuple(params))
                    hash(key)
                except TypeError:  # unhashable parameters (a list, a dict): just run it
                    key = None
                if key is not None:
                    if key in self._memo:
                        rows, description = self._memo[key]
                        return _Remembered(rows, description)  # type: ignore[return-value]
                    cur = self.pg.cursor()
                    cur.execute(query, None if params is None else list(params))
                    rows = cur.fetchall()
                    self._memo[key] = (rows, cur.description)
                    return _Remembered(rows, cur.description)  # type: ignore[return-value]
            else:
                self._memo.clear()
        cur = self.pg.cursor()
        cur.execute(query, None if params is None else list(params))
        return cur

    def executemany(self, query: str, rows) -> psycopg.Cursor:
        if self._memo is not None:
            self._memo.clear()
        cur = self.pg.cursor()
        cur.executemany(query, [list(r) for r in rows])
        return cur

    def __enter__(self):
        transaction = self.pg.transaction()
        transaction.__enter__()
        self._transactions.append(transaction)
        return self

    def __exit__(self, *exc):
        # A rolled-back transaction's reads may have seen its own writes: forget them.
        if self._memo is not None:
            self._memo.clear()
        return self._transactions.pop().__exit__(*exc)

    def close(self) -> None:
        self.pg.close()


APP_ROLE = "knightly_app"  # has no right to bypass row-level security


def connect(url: str = DEFAULT_URL, migrate: bool = True, user_id: int | None = None) -> Connection:
    pg = psycopg.connect(url, autocommit=True, row_factory=_row_factory)
    pg.adapters.register_loader("numeric", FloatLoader)  # avg(), round(): floats, not Decimal
    conn = Connection(pg)
    if migrate:
        apply_migrations(conn)
    if user_id is not None:
        conn.execute(f"SET ROLE {APP_ROLE}")
        conn.execute("SELECT set_config('app.user_id', %s, false)", (str(user_id),))
        conn.user_id = user_id
    return conn


def migrations() -> list[tuple[str, str]]:
    """(version, sql) for each file in migrations/, in order: "0001_initial.sql" is "0001"."""
    folder = resources.files("knightly").joinpath("migrations")
    files = sorted(f for f in folder.iterdir() if f.name.endswith(".sql"))
    return [(f.name.split("_", 1)[0], f.read_text()) for f in files]


def apply_migrations(conn: Connection) -> list[str]:
    """Apply the migrations this database hasn't had yet, each in its own transaction.
    Returns the versions applied."""
    conn.execute("""CREATE TABLE IF NOT EXISTS schema_migrations (
                        version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())""")
    applied = []
    for version, sql in migrations():
        with conn:
            conn.execute("SELECT pg_advisory_xact_lock(%s)", (MIGRATION_LOCK,))
            if conn.execute("SELECT 1 FROM schema_migrations WHERE version = %s", (version,)).fetchone():
                continue
            conn.execute(sql)
            conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))
            applied.append(version)
    return applied


TIMEZONE_SETTING = "timezone"


def parse_zone(name) -> ZoneInfo:
    """An IANA time zone name ("America/Denver") as a zone; ValueError for anything else."""
    if not isinstance(name, str) or not 0 < len(name) <= 64 or name.startswith(("/", ".")) or ".." in name:
        raise ValueError(f"Unknown time zone {name!r}.")
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError(f"Unknown time zone {name!r}.") from None


def _midnight(day: date, zone: tzinfo | None) -> datetime:
    naive = datetime.combine(day, time.min)
    return naive.replace(tzinfo=zone) if zone else naive.astimezone()


def today(conn) -> date:
    """The user's calendar day now: the review day that daily counts and limits reset on."""
    return datetime.now(conn.zone).date()


def local_date(conn, at: datetime) -> date:
    """The user's calendar day an aware instant falls on."""
    return at.astimezone(conn.zone).date() if conn.zone else at.astimezone().date()


def day_range(conn, day: date) -> tuple[str, str]:
    """The user's calendar day `day` as [start, end) in the ISO UTC text the tables store, for
    "answered today" queries: `reviewed_at >= %s AND reviewed_at < %s`. Days around a daylight
    saving change are 23 or 25 hours long."""
    start, end = _midnight(day, conn.zone), _midnight(day + timedelta(days=1), conn.zone)
    return tuple(stamp(t) for t in (start, end))


def _encode(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, separators=(",", ":"))
    return value


def _insert(conn, table, columns, row) -> bool:
    """Insert unless the natural key already exists. Returns True if a row was added."""
    placeholders = ", ".join("%s" for _ in columns)
    cur = conn.execute(
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders}) ON CONFLICT DO NOTHING",
        [_encode(row.get(c)) for c in columns],
    )
    return cur.rowcount == 1


def insert_game(conn, game: dict) -> bool:
    return _insert(conn, "games", GAME_COLUMNS, game)


def insert_puzzle_attempt(conn, attempt: dict) -> bool:
    return _insert(conn, "puzzle_attempts", PUZZLE_COLUMNS, attempt)


def add_account(conn, source: str, handle: str) -> None:
    conn.execute("INSERT INTO accounts (source, handle) VALUES (%s, %s) ON CONFLICT DO NOTHING", (source, handle))


def accounts(conn, chesscom_first: bool = False) -> list[Row]:
    """The accounts you follow (source, handle), by source; Chess.com first when asked."""
    order = "source = 'chesscom' DESC, source" if chesscom_first else "source"
    return conn.execute(f"SELECT source, handle FROM accounts ORDER BY {order}").fetchall()


def other_accounts(conn, source: str, handle: str) -> int:
    """How many accounts you follow besides this one."""
    return conn.execute(
        "SELECT count(*) FROM accounts WHERE NOT (source = %s AND handle = %s)", (source, handle)
    ).fetchone()[0]


def remove_account(conn, source: str, handle: str) -> None:
    conn.execute("DELETE FROM accounts WHERE source = %s AND handle = %s", (source, handle))


def add_snapshot(conn, source: str, account: str, kind: str, data) -> None:
    conn.execute(
        "INSERT INTO snapshots (source, account, kind, data) VALUES (%s, %s, %s, %s)",
        (source, account, kind, json.dumps(data)),
    )


DEFAULT_DEPTH = 18  # Why / Best line, and analysis on the command line with --depth
# Positions Stockfish searches per move when analysing games, unless changed in Settings.
# `knightly bench`: about 0.65 CPU-minutes a game, against 0.9 at depth 18, for much the same labels.
DEFAULT_NODES = 500_000


def get_setting(conn, key: str, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key = %s", (key,)).fetchone()
    return json.loads(row[0]) if row else default


def set_setting(conn, key: str, value) -> None:
    conn.execute(
        """INSERT INTO settings (key, value) VALUES (%s, %s)
           ON CONFLICT (user_id, key) DO UPDATE
           SET value = excluded.value, updated_at = iso_now()""",
        (key, json.dumps(value)),
    )


# Counts writes to `moves` from game analysis, so the review deck can tell when it has
# something new to add (deck.refresh) without scanning every move on every request.
ANALYSIS_VERSION = "analysis_version"


def analysis_changed(conn) -> None:
    """Call in the same transaction as any write that adds or relabels analysed moves."""
    conn.execute(
        """INSERT INTO settings (key, value) VALUES (%s, '1')
           ON CONFLICT (user_id, key) DO UPDATE
           SET value = (settings.value::bigint + 1)::text, updated_at = iso_now()""",
        (ANALYSIS_VERSION,),
    )


def analysis_version(conn) -> int:
    return get_setting(conn, ANALYSIS_VERSION, 0)


def analysis_nodes(conn) -> int:
    """How many positions Stockfish searches per move when analysing games (Settings ›
    Analysis: Fast, Standard, Deep)."""
    return int(get_setting(conn, "analysis_nodes", DEFAULT_NODES))


def get_cursor(conn, source: str, account: str, kind: str) -> str | None:
    row = conn.execute(
        "SELECT cursor FROM sync_state WHERE source = %s AND account = %s AND kind = %s",
        (source, account.lower(), kind),
    ).fetchone()
    return row["cursor"] if row else None


def set_cursor(conn, source: str, account: str, kind: str, cursor: str) -> None:
    conn.execute(
        """INSERT INTO sync_state (source, account, kind, cursor) VALUES (%s, %s, %s, %s)
           ON CONFLICT (user_id, source, account, kind) DO UPDATE
           SET cursor = excluded.cursor, updated_at = iso_now()""",
        (source, account.lower(), kind, cursor),
    )


def sync_cursors(conn) -> dict[tuple[str, str, str], str]:
    """Every sync cursor, by (source, lowercased account, kind)."""
    return {
        (r["source"], r["account"], r["kind"]): r["cursor"]
        for r in conn.execute("SELECT source, account, kind, cursor FROM sync_state").fetchall()
    }


def data_counts(conn) -> Row:
    """Your games, analysed games and first game's date: what your data amounts to."""
    return conn.execute("""SELECT (SELECT count(*) FROM games) AS games,
                                  (SELECT count(*) FROM game_analysis) AS analysed,
                                  (SELECT min(played_at) FROM games) AS first_game""").fetchone()


def size(conn) -> Row:
    """Where the whole database is (path) and how big (bytes): the owner's, on your own Mac."""
    return conn.execute("""SELECT current_database() || ' on ' || coalesce(host(inet_server_addr()), 'this Mac')
                                  AS path, pg_database_size(current_database()) AS bytes""").fetchone()
