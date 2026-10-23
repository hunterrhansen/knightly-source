"""Unannounced positions, "Your move" (docs/specs/2026-10-17-learning-loop-design.md, part 4).

A position from your own rated games, right after the opponent's move, with no sign of
whether there is anything to find. Two kinds, mixed so guessing doesn't pay:

- critical: a position with one clearly best move (the engine's top two at least
  deck.CARD_GAP apart): your review cards in long-term memory, then moves where you found
  that best move in the game.
- calm: a sound move of yours, past the opening, where the engine's top two moves are within
  deck.HARD_DROP of each other, so any safe move is fine.

Answers are judged as cards are (within HARD_DROP of the best move) and logged, never
scheduled: the item measures noticing (`noticing`) rather than teaching an answer.
"""

import json
from datetime import UTC, date, datetime, timedelta

from . import db, deck, patterns, positions, practice_grades, practice_lines
from .analyze import MATE_BAR, only_move, win_pct

KINDS = ("critical", "calm")
PER_DAY = 2  # "Your move" items a day
REST_DAYS = 30  # a position isn't asked again this soon
SCAN = 400  # newest qualifying moves looked at per kind
FOUND = ("best", "great", "brilliant")
SOUND = ("best", "excellent", "good")
MIN_NOTICING = 20  # critical answers before the noticing rate shows
NOTICING_DAYS = 30


def _gap(row) -> float | None:
    """Win% the engine's second choice would have cost the mover."""
    if row["eval_before"] is None or row["eval_second"] is None:
        return None
    sign = 1 if row["color"] == "white" else -1
    return win_pct(sign * row["eval_before"]) - win_pct(sign * row["eval_second"])


def kind_of(row) -> str | None:
    """The kind a position of yours would be asked as, or None when it is neither."""
    if row["best_uci"] is None or _gap(row) is None:
        return None
    # A review card is a mistake of yours whose best move stood out: critical too.
    if only_move(row["color"], row["eval_before"], row["eval_second"], deck.CARD_GAP) and (
        row["classification"] in FOUND or row["card"]
    ):
        return "critical"
    # Nothing winning by force is a quiet position. Evals clamp at CLAMP_CP before the win%
    # curve, so a mate and a crushing alternative both read as no gap, which looked quiet.
    sign = 1 if row["color"] == "white" else -1
    if sign * row["eval_before"] > MATE_BAR:
        return None
    if (
        not only_move(row["color"], row["eval_before"], row["eval_second"], deck.HARD_DROP)
        and row["classification"] in SOUND
        and row["phase"] != "opening"
    ):
        return "calm"
    return None


def _since(days: int, now: datetime | None = None) -> str:
    return db.stamp((now or datetime.now(UTC)) - timedelta(days=days))


def _rested(conn, today: date) -> set[tuple[int, int]]:
    """Positions asked within REST_DAYS, today included."""
    start = db.day_range(conn, today - timedelta(days=REST_DAYS))[0]
    return {
        (r["game_id"], r["ply"])
        for r in conn.execute("SELECT DISTINCT game_id, ply FROM unannounced_answers WHERE answered_at >= %s", (start,))
    }


def _candidates(conn, kind: str, today: date) -> list[tuple[int, int]]:
    """Positions of `kind` not asked lately, in the order they're offered."""
    rested = _rested(conn, today)
    found: list[tuple[int, int]] = []
    if kind == "critical":
        # Cards in long-term memory first: they're the ones you are told about least.
        for r in conn.execute(
            """SELECT c.game_id, c.ply, c.fsrs FROM cards c
                   JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
                   WHERE c.fsrs IS NOT NULL AND c.suspended_at IS NULL AND m.best_uci IS NOT NULL
                   ORDER BY c.game_id DESC, c.ply"""
        ):
            if (json.loads(r["fsrs"]).get("stability") or 0) >= deck.MASTERED_DAYS:
                found.append((r["game_id"], r["ply"]))
    classes = FOUND if kind == "critical" else SOUND
    rows = conn.execute(
        f"""SELECT m.game_id, m.ply, m.color, m.classification, m.phase, m.best_uci,
                   m.eval_before, m.eval_second, false AS card
            FROM moves m JOIN games g ON g.id = m.game_id
            LEFT JOIN cards c ON c.game_id = m.game_id AND c.ply = m.ply
            WHERE m.is_user AND g.rated AND g.played_at >= %s AND c.game_id IS NULL
              AND m.classification IN ({", ".join("%s" for _ in classes)})
              AND m.eval_before IS NOT NULL AND m.eval_second IS NOT NULL
            ORDER BY g.played_at DESC, m.game_id DESC, m.ply LIMIT %s""",
        (_since(patterns.RECENT_DAYS), *classes, SCAN),
    ).fetchall()
    found += [(r["game_id"], r["ply"]) for r in rows if kind_of(r) == kind]
    return [key for key in dict.fromkeys(found) if key not in rested]


def _answered_today(conn, today: date) -> list[str]:
    """Kinds of today's distinct positions, in the order first answered."""
    rows = conn.execute(
        """SELECT DISTINCT ON (game_id, ply) kind, answered_at FROM unannounced_answers
           WHERE answered_at >= %s AND answered_at < %s ORDER BY game_id, ply, answered_at""",
        db.day_range(conn, today),
    ).fetchall()
    return [r["kind"] for r in sorted(rows, key=lambda r: r["answered_at"])]


def plan(conn, today: date | None = None) -> dict:
    """{done, total, next}: today's "Your move" items answered, planned, and the next one
    ({game_id, ply, kind}) or None. Two critical for every calm one; the other kind when one
    runs out."""
    today = today or db.today(conn)
    done = len(_answered_today(conn, today))
    nxt = None
    if done < PER_DAY:
        first = "calm" if done % 3 == 2 else "critical"
        for kind in (first, *(k for k in KINDS if k != first)):
            if found := _candidates(conn, kind, today):
                nxt = {"game_id": found[0][0], "ply": found[0][1], "kind": kind}
                break
    return {"done": done, "total": done + (1 if nxt else 0), "next": nxt}


def answered_today(conn, today: date) -> int:
    """ "Your move" positions answered today."""
    return len(_answered_today(conn, today))


def _load(conn, game_id: int, ply: int):
    row = conn.execute(
        """SELECT m.game_id, m.ply, m.color, m.classification, m.phase, m.san, m.uci, m.move_number,
                  m.best_uci, m.best_san, m.eval_before, m.eval_second, m.mate_before,
                  m.practice_grades, m.practice_line, m.pattern, prev.uci AS prev_uci,
                  g.opponent, g.played_at, c.game_id IS NOT NULL AS card
           FROM moves m JOIN games g ON g.id = m.game_id
           LEFT JOIN cards c ON c.game_id = m.game_id AND c.ply = m.ply
           LEFT JOIN moves prev ON prev.game_id = m.game_id AND prev.ply = m.ply - 1
           WHERE m.game_id = %s AND m.ply = %s AND m.is_user""",
        (game_id, ply),
    ).fetchone()
    if row is None:
        raise KeyError((game_id, ply))
    return row


def item(conn, game_id: int, ply: int) -> dict | None:
    """One "Your move" item for the app, shaped like a review card so practice judges it the
    same way, with `unannounced` naming its kind. The line is the best move alone."""
    row = _load(conn, game_id, ply)
    kind = kind_of(row)
    fen = positions.fen_before(conn, game_id, ply)
    if kind is None or fen is None:
        return None
    line = [row["best_uci"]]
    prepared = practice_grades.cached(row, fen)
    return {
        "game_id": game_id,
        "ply": ply,
        "reviews": 0,
        "fen_before": fen,
        "fen_prev": positions.fen_before(conn, game_id, ply - 1) if ply > 1 else None,
        "prev_uci": row["prev_uci"],
        "color": row["color"],
        "san": row["san"],
        "uci": row["uci"],
        "move_number": row["move_number"],
        "classification": row["classification"],
        "opponent": row["opponent"],
        "pattern": None,
        "line": line,
        "line_key": practice_lines.key(fen, line),
        "feedback": prepared,
        "unannounced": kind,
    }


def answer(
    conn,
    game_id: int,
    ply: int,
    moves: list[str],
    *,
    hinted: bool = False,
    today: date | None = None,
    now: datetime | None = None,
) -> dict:
    """Judge a "Your move" answer: the first move against the best one, as a card's first
    move is (within HARD_DROP). The day's first answer to the position is logged; nothing
    is scheduled. The result has the shape of a card's finished answer, plus its kind."""
    today = today or db.today(conn)
    row = _load(conn, game_id, ply)
    kind = kind_of(row)
    fen = positions.fen_before(conn, game_id, ply)
    if kind is None or fen is None:
        raise KeyError((game_id, ply))
    if len(moves) != 1:
        raise ValueError("Your move is a single move.")
    prepared = practice_grades.cached(row, fen)
    move = moves[0]
    quality = (prepared["grades"].get(move) if prepared else None) or deck.judge(
        fen, move, row["best_uci"], row["eval_before"]
    )
    passed = quality in SOUND
    first = conn.execute(
        """SELECT 1 FROM unannounced_answers WHERE game_id = %s AND ply = %s
             AND answered_at >= %s AND answered_at < %s""",
        (game_id, ply, *db.day_range(conn, today)),
    ).fetchone()
    if first is None:
        conn.execute(
            # The driver adapts Python booleans to integers, so compare.
            """INSERT INTO unannounced_answers (game_id, ply, kind, answer_uci, correct, answered_at)
               VALUES (%s, %s, %s, %s, (%s::int = 1), %s)""",
            (
                game_id,
                ply,
                kind,
                move,
                passed and not hinted,
                db.stamp(now or datetime.now(UTC)),
            ),
        )
    line = [row["best_uci"]]
    result = {"status": "shown" if quality == "shown" else "solved" if passed else "failed"}
    explanation, why = deck.coaching(prepared, fen, line, row["mate_before"], moves, result)
    return {
        "status": result["status"],
        "step": 0,
        "correct": passed,
        "quality": quality,
        "rating": None,
        "best_uci": row["best_uci"],
        "best_san": row["best_san"] or practice_lines.san_line(fen, line)[0],
        "line": {"uci": line, "san": [row["best_san"] or practice_lines.san_line(fen, line)[0]]},
        "due": None,
        "mastered": False,
        "explanation": explanation,
        "why": why,
        "candidates": prepared.get("candidates") if prepared else None,
        "unannounced": kind,
    }


def noticing(conn, now: datetime | None = None) -> dict | None:
    """The share of critical "Your move" positions found (each day's first answer) over the
    last NOTICING_DAYS, or None below MIN_NOTICING answers."""
    r = conn.execute(
        """SELECT count(*) AS n, count(*) FILTER (WHERE correct) AS found FROM unannounced_answers
           WHERE kind = 'critical' AND answered_at >= %s""",
        (_since(NOTICING_DAYS, now),),
    ).fetchone()
    if r["n"] < MIN_NOTICING:
        return None
    return {"rate": round(r["found"] / r["n"], 3), "answers": r["n"]}
