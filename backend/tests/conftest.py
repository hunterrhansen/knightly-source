"""Each test that takes `db_url` gets its own empty, migrated Postgres database, copied from a
template made once per run. Point $KNIGHTLY_TEST_DATABASE_URL at a server you can create
databases on (default: the local one, postgresql:///postgres).

The template has the "local" user (id 1), and a test's own connections act for it by default
(app.user_id=1), so fixtures can insert rows as they did before users. The app under test
signs in as that user too, unless a test takes the `clerk` fixture.

Test data shared between test modules is built here (insert_game and the add_* helpers);
import it with `from conftest import ...`."""

import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from knightly import db, deck, users

ADMIN_URL = os.environ.get("KNIGHTLY_TEST_DATABASE_URL", "postgresql:///postgres")
TEMPLATE = "knightly_test_template"
LOCAL_ID = 1


def _url(name: str, **extra) -> str:
    return psycopg.conninfo.make_conninfo(ADMIN_URL, dbname=name, **extra)


def _admin(sql: str) -> None:
    with psycopg.connect(ADMIN_URL, autocommit=True) as conn:
        conn.execute(sql)


@pytest.fixture(scope="session")
def template_db():
    _admin(f"DROP DATABASE IF EXISTS {TEMPLATE} WITH (FORCE)")
    _admin(f"CREATE DATABASE {TEMPLATE}")
    with db.connect(_url(TEMPLATE)) as conn:  # migrate it once
        assert users.ensure(conn, users.LOCAL) == LOCAL_ID
    conn.close()
    yield TEMPLATE
    _admin(f"DROP DATABASE IF EXISTS {TEMPLATE} WITH (FORCE)")


@pytest.fixture
def db_url(template_db):
    name = f"knightly_test_{uuid.uuid4().hex[:12]}"
    _admin(f"CREATE DATABASE {name} TEMPLATE {template_db}")
    yield _url(name, options=f"-c app.user_id={LOCAL_ID}")
    _admin(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)")


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    """Backups and sounds go to the test's own folder, and the app signs in as the local
    user (in server mode too, as on CI)."""
    monkeypatch.setenv("KNIGHTLY_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("KNIGHTLY_AUTH", "local")
    for name in (
        "CLERK_PUBLISHABLE_KEY",
        "CLERK_JWT_KEY",
        "CLERK_WEBHOOK_SECRET",
        "KNIGHTLY_ALLOWED_ORIGINS",
        "KNIGHTLY_ALLOW_NATIVE_AUTH",
    ):
        monkeypatch.delenv(name, raising=False)
    return tmp_path


# Test data. A test module's own helpers stay in it; these are shared between modules.


# Games are Chess.com rapid games against "opp" with no PGN unless a test says otherwise.
GAME_DEFAULTS = {"source": "chesscom", "speed": "rapid", "opponent": "opp", "pgn": ""}


def insert_game(conn, gid: int | None = None, **columns) -> int:
    """Insert a game with `columns` over GAME_DEFAULTS; with `gid` it gets that id and
    source_id. Returns its id."""
    row = {**GAME_DEFAULTS, **columns}
    if gid is not None:
        row = {"id": gid, "source_id": str(gid), **row}
    sql = f"INSERT INTO games ({', '.join(row)}) VALUES ({', '.join('%s' for _ in row)}) RETURNING id"
    return conn.execute(sql, tuple(row.values())).fetchone()[0]


NOW = datetime.now(UTC)


def days_ago(n: float) -> str:
    return (NOW - timedelta(days=n)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _flag(value):
    """A 0/1 test shorthand as the boolean the column holds (None stays unknown)."""
    return None if value is None else bool(value)


def add_kpi_game(
    conn,
    gid,
    *,
    played_at,
    outcome,
    rated=True,
    rating=900,
    opening="Pirc Defense",
    termination="me won by resignation",
    moves=None,
    blunders=None,
):
    """A game as the overview's KPIs see it (you play White), plus engine analysis when
    `moves` is given as [(is_user, win_pct_after, classification), ...] for plies 1, 2, ..."""
    insert_game(
        conn,
        gid,
        played_at=played_at,
        rated=rated,
        user_color="white",
        user_outcome=outcome,
        user_rating=rating,
        opponent_rating=880,
        eco="B07",
        opening=opening,
        termination=termination,
        ply_count=len(moves or []),
        url=f"https://example.com/{gid}",
    )
    if moves is None:
        return
    conn.execute(
        """INSERT INTO game_analysis (game_id, engine, depth, user_accuracy, user_blunders,
           user_mistakes, user_inaccuracies) VALUES (%s, 'test', 1, 80, %s, 0, 0)""",
        (gid, blunders if blunders is not None else sum(1 for u, _, c in moves if u and c == "blunder")),
    )
    before = 50  # mover's win% before each move: the other side's win% after the last one
    for ply, (is_user, win_pct, cls) in enumerate(moves, start=1):
        conn.execute(
            """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase,
               san, uci, win_pct_before, win_pct_after, classification, eval_after)
               VALUES (%s, %s, %s, %s, %s, 'opening', 'e4', 'e2e4', %s, %s, %s, 50)""",
            (gid, ply, (ply + 1) // 2, "white" if ply % 2 else "black", _flag(is_user), before, win_pct, cls),
        )
        before = 100 - win_pct


# Each review game's moves, so positions.py can rebuild the position before any ply up to 10.
REVIEW_MOVES = "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6"


def add_review_game(conn, gid, played_at="2026-10-01T12:00:00Z"):
    """A game you lost as Black, for review-deck positions (add_review_move)."""
    insert_game(conn, gid, played_at=played_at, user_color="black", user_outcome="loss", moves_san=REVIEW_MOVES)


def add_review_move(
    conn,
    gid,
    ply,
    *,
    cls="blunder",
    is_user=True,
    color="black",
    best=-50,
    second=300,
    after=300,
    best_uci="e7e5",
    uci="g7g5",
):
    """A move with the engine's best, second-best and resulting evals (White's point of view).

    The defaults describe a real blunder: Black stood slightly better at -50 and the move hands
    White +300. `patterns.decisive` reads `after` to decide whether anything was at stake, so a
    fixture that leaves it out is a move that cost nothing and gets no tactic named."""
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san,
           uci, best_san, best_uci, eval_before, eval_second, eval_after, classification, win_pct_before)
           VALUES (%s, %s, %s, %s, %s, 'opening', 'g5', %s, 'e5', %s, %s, %s, %s, %s, 50)""",
        (gid, ply, (ply + 1) // 2, color, is_user, uci, best_uci, best, second, after, cls),
    )


@pytest.fixture
def no_engine(monkeypatch):
    """Judge answers without Stockfish: the engine's move is best, "d7d5" is within 5 points
    (a good move), anything else is wrong."""

    def fake(fen, uci, best_uci, eval_best):
        if uci == deck.SKIP:
            return "shown"
        if uci == best_uci:
            return "best"
        return "good" if uci == "d7d5" else "wrong"

    monkeypatch.setattr(deck, "judge", fake)


# Clerk sign-in: requests signed with KEY, for tests that take the `clerk` fixture.
HOST = "test-knightly.clerk.accounts.dev"
PUBLISHABLE = "pk_test_" + base64.b64encode(f"{HOST}$".encode()).decode().rstrip("=")
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_PEM = (
    KEY.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
)
WEBHOOK_SECRET = "whsec_" + base64.b64encode(b"a secret of exactly 32 bytes!!!!").decode()


def token(sub: str, key=KEY, *, omit_azp=False, **claims) -> str:
    now = int(time.time())
    body = {
        "sub": sub,
        "iss": f"https://{HOST}",
        "iat": now,
        "nbf": now - 5,
        "exp": now + 60,
        "azp": "https://knightly.example",
        **claims,
    }
    if omit_azp:
        del body["azp"]
    return jwt.encode(body, key, algorithm="RS256")


def as_user(sub: str, **claims) -> dict:
    return {"Authorization": f"Bearer {token(sub, **claims)}"}


def signed(body: dict, secret=WEBHOOK_SECRET, at=None) -> tuple[dict, bytes]:
    raw = json.dumps(body).encode()
    stamp = str(int(at or time.time()))
    key = base64.b64decode(secret.removeprefix("whsec_"))
    sig = base64.b64encode(hmac.new(key, f"msg_1.{stamp}.".encode() + raw, hashlib.sha256).digest()).decode()
    return {"svix-id": "msg_1", "svix-timestamp": stamp, "svix-signature": f"v1,{sig}"}, raw


@pytest.fixture
def clerk(monkeypatch):
    monkeypatch.delenv("KNIGHTLY_AUTH")
    monkeypatch.setenv("CLERK_PUBLISHABLE_KEY", PUBLISHABLE)
    monkeypatch.setenv("CLERK_JWT_KEY", PUBLIC_PEM)
    monkeypatch.setenv("CLERK_WEBHOOK_SECRET", WEBHOOK_SECRET)


def seed(db_url, clerk_id: str, first_id: int, handle: str, opponent: str) -> int:
    """A user with an account, three games (two analysed) and a review, all marked with
    `handle` and `opponent` so a leak shows up in any response."""
    with db.connect(db_url) as owner:
        user_id = users.ensure(owner, clerk_id)
    conn = db.connect(db_url, migrate=False, user_id=user_id)
    with conn:
        db.add_account(conn, "chesscom", handle)
        for i, outcome in enumerate(["win", "loss", "draw"]):
            add_kpi_game(
                conn,
                first_id + i,
                played_at=days_ago(i + 1),
                outcome=outcome,
                opening=f"{handle} Gambit",
                moves=[(1, 85, "best"), (0, 15, "good"), (1, 10, "blunder")] if i < 2 else None,
            )
        conn.execute("UPDATE games SET opponent = %s", (opponent,))
        conn.execute("INSERT INTO game_reviews (game_id, reviewed_at) VALUES (%s, %s)", (first_id, days_ago(0)))
    conn.close()
    return user_id


def shape_ply(is_user, san, uci, cls="good", layer=None, best=None, before=None, second=None, win=50.0):
    return {
        "is_user": is_user,
        "san": san,
        "uci": uci,
        "cls": cls,
        "layer": layer,
        "best": best,
        "before": before,
        "second": second,
        "win": win,
    }


def add_shape_game(conn, gid, *, played_at, outcome="win", plies=(), start_fen=None, sans=None):
    """A rated, analysed game you play White, with `plies` (shape_ply) as its moves: what
    the skill shape and game trend count."""
    insert_game(
        conn,
        gid,
        played_at=played_at,
        rated=True,
        user_color="white",
        user_outcome=outcome,
        moves_san=sans or " ".join(p["san"] for p in plies),
        start_fen=start_fen,
        ply_count=len(plies),
    )
    conn.execute("INSERT INTO game_analysis (game_id, engine, depth, user_accuracy) VALUES (%s, 'test', 1, 80)", (gid,))
    for n, p in enumerate(plies, start=1):
        conn.execute(
            """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci, best_uci,
               eval_before, eval_second, win_pct_before, win_pct_after, classification, layer)
               VALUES (%s, %s, %s, %s, %s, 'middlegame', %s, %s, %s, %s, %s, 50, %s, %s, %s)""",
            (
                gid,
                n,
                (n + 1) // 2,
                "white" if n % 2 else "black",
                _flag(p["is_user"]),
                p["san"],
                p["uci"],
                p["best"],
                p["before"],
                p["second"],
                p["win"],
                p["cls"],
                p["layer"],
            ),
        )


# Black's d5 pawn attacks White's e4 knight; White ignored it with Kb1.
THREATENED = "7k/8/8/3p4/4N3/8/8/K7 w - - 0 1"
DXE4 = {"uci": "d5e4", "san": "dxe4", "line": ["d5e4"], "net": 3, "mate": None}


def add_threat_game(conn, gid, fen, san, played_at):
    """A rated 10-minute game you lost as White, from `fen`."""
    insert_game(
        conn,
        gid,
        played_at=played_at,
        user_color="white",
        user_outcome="loss",
        moves_san=san,
        start_fen=fen,
        rated=True,
        time_control="600",
    )


def add_threat_move(conn, gid, uci, cls, layer=None, facts=None):
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci, best_san,
           best_uci, eval_before, eval_second, classification, win_pct_before, layer, cause_facts)
           VALUES (%s, 1, 1, 'white', true, 'middlegame', 'Kb1', %s, 'Nc5', 'e4c5', 0, 300, %s, 50, %s, %s::jsonb)""",
        (gid, uci, cls, layer, json.dumps(facts) if facts else None),
    )


def threat_item(conn, gid=1, played_at="2026-10-10T12:00:00Z", card=True):
    add_threat_game(conn, gid, THREATENED, "Kb1", played_at)
    add_threat_move(conn, gid, "a1b1", "blunder", "theirThreat", {"threats": [DXE4], "refutation": None})
    if card:
        conn.execute("INSERT INTO cards (game_id, ply) VALUES (%s, 1)", (gid,))


PUZZLE_HEADER = "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags\n"


def write_csv(path, rows):
    path.write_text(PUZZLE_HEADER + "".join(rows))
    return path


# 1.e4 sets it up; you (Black) answer 1...e5, they play 2.Nf3, you find 2...Nc6.
OPENING = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def line_row(pid):
    return f"{pid},{OPENING},e2e4 e7e5 g1f3 b8c6,1200,75,95,1000,fork short,https://lichess.org/x,\n"


# Scholar's mate: White's 3.Bc4 and 4.Qxf7# are fine, Black's 3...Nf6?? is the blunder.
SCHOLARS_MATE = """[Event "test"]
[White "me"]
[Black "them"]
[Result "1-0"]
[TimeControl "180+2"]

1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:03:00]} 2. Qh5 {[%clk 0:02:55]} 2... Nc6 {[%clk 0:02:50]}
3. Bc4 {[%clk 0:02:52]} 3... Nf6 {[%clk 0:02:40]} 4. Qxf7# {[%clk 0:02:51]} 1-0
"""


def ten_minute_sample(gid=1):
    clocks = [200] * 10 + [198, 196, 166, 25, 23]
    parts = []
    rows = []
    for i, clock in enumerate(clocks, 1):
        white, black = ('Nf3', 'Nf6') if i % 2 else ('Ng1', 'Ng8')
        parts.append(f'{i}. {white} {{[%clk 0:{clock // 60:02}:{clock % 60:02}]}} {black}')
        rows.append(
            dict(
                game_id=gid,
                ply=i * 2 - 1,
                is_user=True,
                uci='g1f3' if i % 2 else 'f3g1',
                san=white,
                phase='opening' if i <= 10 else 'middlegame',
                win_pct_before=50,
                win_pct_after=30 if i in (11, 13) else 50,
            )
        )
    return dict(
        id=gid,
        source='chesscom',
        time_control='600',
        variant='standard',
        user_color='white',
        pgn='[Result "*"]\n\n' + ' '.join(parts) + ' *',
        engine='test',
        nodes=1,
        depth=None,
        termination='Opponent won on time',
        user_outcome='loss',
    ), rows


def add_blunder_card(conn, source_id: str) -> int:
    """An over-the-board game whose first move (d4, where e4 was clearly best) is a review
    card. Returns the game's id."""
    gid = insert_game(
        conn, source="otb", source_id=source_id, speed=None, opponent=None, moves_san="e4 e5", played_at="2026-10-09"
    )
    conn.execute(
        """INSERT INTO moves (game_id, ply, move_number, color, is_user, phase, san, uci,
                  best_uci, best_san, eval_before, eval_second, classification)
                  VALUES (%s, 1, 1, 'white', true, 'opening', 'd4', 'd2d4', 'e2e4', 'e4', 30, -300, 'blunder')""",
        (gid,),
    )
    deck.sync(conn)
    return gid
