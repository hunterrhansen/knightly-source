"""Threat questions inside daily practice: "What do they threaten?"

docs/specs/2026-10-16-safety-habit-training-design.md, part 1. Each item is a position from
your own rated games, right after the opponent's move. You say what they threaten, by playing
their threat on the board, or "No threat". Two kinds:

- threat: a move of yours tagged `theirThreat` (layers.py). When it is a review card, the
  card opens with the threat question before "find the best move", whenever it is served.
  Threat items that are no card (several moves defend, say) are asked on their own.
- allows: a move of yours tagged `theirReply` (layers.py) -- your move handed them a short
  forcing reply. Any reply of theirs that mates or wins LOSS points is right, not only the
  engine's first choice. The position is shown *after* your own move, so you see what you played and
  then find what it allowed. This is the other half of the habit, and the commoner error:
  the threat drill asks what they threatened before you moved, this asks what you gave them.
- vision: a position from your own games where the opponent simply left a piece loose and
  taking it is the engine's move. Ward 1's drill, and the one the corpus cannot supply --
  Lichess tags by tactic and "is this piece defended?" is not a tactic. Selected by
  **verified geometry, never by a tag**: `chance_motif = 'hangingPiece'` is the obvious
  filter and the least reliable signal we have (0.17 precision), so a third of those items
  would secretly be about some other tactic. The test is that nothing of theirs defends the
  square and the capturing piece is not attacked afterwards, which is checkable rather than
  guessed.
- calm: a sound move of yours where the threat search finds nothing. The answer is "No
  threat", so "there's always a threat" is never a safe guess.

The watch asks the questions that stand on their own (`queue`) in its "look first" slots
(mix.py), scheduled with FSRS from the answer like cards; they count toward the day's
positions.
"""

import json
import math
from datetime import UTC, date, datetime, timedelta

import chess
import chess.engine
from fsrs import Card

from . import db, deck, layers, patterns, positions, practice_grades, threats
from .analyze import find_engine

THREAT_BATCH = 50  # new items prepared per run
CALM_SHARE = 3  # threat items per calm item
NEW_PER_DAY = 5  # new threat questions a day
# New questions a day of the kind the current post teaches (ward 1's vision), on top of
# NEW_PER_DAY: on those nights the post's idea slots are these, not puzzles (mix.py).
POST_NEW_PER_DAY = 10
REVIEW_LIMIT = 30  # due threat questions a day
EASY_SECONDS = 10  # a correct answer this fast is Easy
NONE = "none"  # the answer "No threat"
# Which search made an item's accepted answers (migrations/0030): items made under an older
# set are searched again by `widen`, WIDEN_BATCH a run.
ANSWER_SET = 2
WIDEN_BATCH = 100
SOUND = ("best", "excellent", "good")


def _since(today: date) -> str:
    return db.stamp(datetime.combine(today, datetime.min.time()) - timedelta(days=patterns.RECENT_DAYS))


def _threats(value) -> list[dict]:
    if isinstance(value, str):
        value = json.loads(value)
    return value if isinstance(value, list) else []


def prepare(
    conn: db.Connection, engine_path: str | None = None, log=print, today: date | None = None, engine=None
) -> int:
    """Add drill items: every `theirThreat` move not yet in the drill, then calm positions
    until there is one per CALM_SHARE threat items. At most THREAT_BATCH new items a run.
    Then widen the accepted answers of items made under an older ANSWER_SET.
    Returns how many were added."""
    today = today or db.today(conn)
    rows = conn.execute(
        """SELECT m.game_id, m.ply, m.cause_facts FROM moves m
           LEFT JOIN threat_cards t ON t.game_id = m.game_id AND t.ply = m.ply
           WHERE m.layer = 'theirThreat' AND t.game_id IS NULL
           ORDER BY m.game_id DESC, m.ply LIMIT %s""",
        (THREAT_BATCH,),
    ).fetchall()
    added = 0
    with conn:
        for r in rows:
            facts = r["cause_facts"]
            facts = json.loads(facts) if isinstance(facts, str) else facts
            found = _threats((facts or {}).get("threats"))
            if found:
                # The stored search may predate ANSWER_SET: `widen` searches it again.
                conn.execute(
                    "INSERT INTO threat_cards (game_id, ply, kind, threats) VALUES (%s, %s, 'threat', %s::jsonb)",
                    (r["game_id"], r["ply"], json.dumps(found)),
                )
                added += 1
    added += _prepare_allows(conn, THREAT_BATCH - added)
    added += _prepare_vision(conn, min(VISION_BATCH, THREAT_BATCH - added), today)
    started = None

    def search_engine():
        nonlocal started
        if engine is not None:
            return engine
        if started is None:
            started = chess.engine.SimpleEngine.popen_uci(find_engine(engine_path))
            started.configure({"Threads": 1, "Hash": 32})
        return started

    try:
        added += _prepare_calm(conn, THREAT_BATCH - added, today, search_engine, log)
        widen(conn, search_engine, log=log)
    finally:
        if started is not None:
            started.quit()
    return added


def _prepare_calm(conn: db.Connection, room: int, today: date, search_engine, log) -> int:
    """Add calm items until there is one per CALM_SHARE items that do have something there."""
    counts = {r["kind"]: r["n"] for r in conn.execute("SELECT kind, count(*) AS n FROM threat_cards GROUP BY kind")}
    # Calm items are the reason "something is always there" is not a safe guess, so they are
    # counted against both kinds that do have something there.
    asking = counts.get("threat", 0) + counts.get("allows", 0) + counts.get("vision", 0)
    want = min(room, math.ceil(asking / CALM_SHARE) - counts.get("calm", 0))
    if want <= 0:
        return 0
    candidates = conn.execute(
        f"""SELECT m.game_id, m.ply FROM moves m JOIN games g ON g.id = m.game_id
            LEFT JOIN threat_cards t ON t.game_id = m.game_id AND t.ply = m.ply
            WHERE m.is_user AND g.rated AND g.played_at >= %s AND t.game_id IS NULL
              AND m.phase != 'opening' AND m.classification IN ({", ".join("%s" for _ in SOUND)})
            ORDER BY g.played_at DESC, m.ply LIMIT %s""",
        (_since(today), *SOUND, want * 3),
    ).fetchall()
    if not candidates:
        return 0
    fens = positions.fens(conn, [r["game_id"] for r in candidates])
    calm = 0
    log(f"Looking for calm positions for the threat drill ({want} wanted)...")
    for r in candidates:
        if calm >= want:
            break
        fen = fens.get((r["game_id"], r["ply"]))
        if fen is None or threats.passed(chess.Board(fen)) is None:
            found = None  # unreadable, in check or over: nothing to ask there
        else:
            found = threats.search(search_engine(), chess.Board(fen), patterns.DEEP_DEPTH, layers.SEARCH_TIME)
            if found is None:  # capped: ask again another run
                continue
        kind = "calm" if found == [] else "skip"
        with conn:
            conn.execute(
                "INSERT INTO threat_cards (game_id, ply, kind, answer_set) VALUES (%s, %s, %s, %s)",
                (r["game_id"], r["ply"], kind, ANSWER_SET),
            )
        calm += kind == "calm"
    return calm


def _score(refutation: dict) -> chess.engine.PovScore:
    mate = refutation.get("mate")
    value = chess.engine.Mate(mate) if mate is not None else chess.engine.Cp(refutation.get("cp") or 0)
    return chess.engine.PovScore(value, chess.WHITE)


def widen(conn: db.Connection, search_engine, room: int = WIDEN_BATCH, log=print) -> int:
    """Search again the accepted answers of up to `room` threat, calm and allows items made
    under an older ANSWER_SET: the opponent's top threats.LINES lines, and every winning reply
    for an allows item. An answer accepted before stays accepted. A calm item where a threat
    turns up becomes a threat item. `search_engine()` returns the engine. Returns how many
    items were widened; a capped search waits for the next run."""
    rows = conn.execute(
        """SELECT t.game_id, t.ply, t.kind, t.threats, m.uci AS played_uci, m.cause_facts
           FROM threat_cards t JOIN moves m ON m.game_id = t.game_id AND m.ply = t.ply
           WHERE t.answer_set < %s AND t.kind IN ('threat', 'calm', 'allows')
           ORDER BY t.game_id DESC, t.ply LIMIT %s""",
        (ANSWER_SET, room),
    ).fetchall()
    if not rows:
        return 0
    log(f"Widening the accepted answers of {len(rows)} threat questions...")
    fens = positions.fens(conn, [r["game_id"] for r in rows])
    widened = 0
    for r in rows:
        kind, old = r["kind"], _threats(r["threats"])
        fen = fens.get((r["game_id"], r["ply"]))
        found: list[dict] | None = None
        if fen is not None and kind == "allows":
            after = _after(fen, r["played_uci"])
            if after is not None:
                board = chess.Board(after)
                found = threats.replies(search_engine(), board, patterns.DEEP_DEPTH, layers.SEARCH_TIME)
                # The stored refutation was the answer until now: describe it in full.
                facts = r["cause_facts"]
                facts = json.loads(facts) if isinstance(facts, str) else facts
                refutation = (facts or {}).get("refutation") or {}
                line = [chess.Move.from_uci(u) for u in refutation.get("line") or []]
                first = threats.describe(board, line, _score(refutation)) if line else None
                old = [first] if first else []
        elif fen is not None and threats.passed(chess.Board(fen)) is not None:
            found = threats.search(search_engine(), chess.Board(fen), patterns.DEEP_DEPTH, layers.SEARCH_TIME)
        else:
            found = []  # unreadable or nothing to ask: keep what it has
        if found is None:
            continue
        seen = {t["uci"] for t in found}
        merged = found + [t for t in old if t.get("uci") not in seen and "san" in t]
        if kind == "calm" and merged:
            kind = "threat"
        with conn:
            conn.execute(
                "UPDATE threat_cards SET kind = %s, threats = %s::jsonb, answer_set = %s WHERE game_id = %s AND ply = %s",
                (kind, json.dumps(merged), ANSWER_SET, r["game_id"], r["ply"]),
            )
        widened += 1
    return widened


def _after(fen: str | None, uci: str | None) -> str | None:
    """The position after `uci` is played from `fen`, or None if that is not possible."""
    if not fen or not uci:
        return None
    board = chess.Board(fen)
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return None
    if move not in board.legal_moves:
        return None
    board.push(move)
    return board.fen()


def _refutation(facts) -> list[str]:
    facts = json.loads(facts) if isinstance(facts, str) else facts
    line = ((facts or {}).get("refutation") or {}).get("line")
    return line if isinstance(line, list) else []


def _prepare_allows(conn: db.Connection, room: int) -> int:
    """Add an item for every `theirReply` move with a stored refutation: the answer is the
    first move of the engine's line, which is exactly the reply the move handed them.

    No engine work here -- `layers.settle_one` already searched this position and stored the
    line. `widen` then adds their other winning replies.
    """
    if room <= 0:
        return 0
    rows = conn.execute(
        """SELECT m.game_id, m.ply, m.cause_facts FROM moves m
           LEFT JOIN threat_cards t ON t.game_id = m.game_id AND t.ply = m.ply
           WHERE m.layer = 'theirReply' AND t.game_id IS NULL
           ORDER BY m.game_id DESC, m.ply LIMIT %s""",
        (room,),
    ).fetchall()
    added = 0
    with conn:
        for r in rows:
            line = _refutation(r["cause_facts"])
            if not line:
                continue  # settled before the refutation was stored: nothing to ask
            conn.execute(
                "INSERT INTO threat_cards (game_id, ply, kind, threats) VALUES (%s, %s, 'allows', %s::jsonb)",
                (r["game_id"], r["ply"], json.dumps([{"uci": line[0]}])),
            )
            added += 1
    return added


VISION_MIN_VALUE = 3  # a minor piece: taking a loose pawn is not the lesson
VISION_BATCH = 200


def free_capture(board: chess.Board, uci: str | None) -> bool:
    """Whether `uci` takes a piece the opponent simply left loose.

    Three checks, all geometry: it is a capture, the victim is worth a minor piece or more,
    nothing of theirs defends the square, and our capturing piece is not attacked once it
    lands. No engine and no tag -- the position either has a free piece on it or it does not.
    """
    if not uci:
        return False
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        return False
    if move not in board.legal_moves or not board.is_capture(move):
        return False
    victim = board.piece_at(move.to_square)
    if victim is None or patterns.VALUES[victim.piece_type] < VISION_MIN_VALUE:
        return False
    if board.attackers(not board.turn, move.to_square):
        return False  # defended: taking it is a trade, not a free piece
    after = board.copy()
    after.push(move)
    return not after.attackers(after.turn, move.to_square)


def _prepare_vision(conn: db.Connection, room: int, today: date | None = None) -> int:
    """Add ward 1's items: own-game positions where the engine's move takes a loose piece."""
    if room <= 0:
        return 0
    rows = conn.execute(
        """SELECT m.game_id, m.ply, m.best_uci FROM moves m
           JOIN games g ON g.id = m.game_id
           LEFT JOIN threat_cards t ON t.game_id = m.game_id AND t.ply = m.ply
           WHERE m.is_user AND g.rated AND m.best_uci IS NOT NULL AND t.game_id IS NULL
             AND m.phase <> 'opening' AND NOT coalesce(m.time_trouble, false)
           ORDER BY g.played_at DESC NULLS LAST, m.ply LIMIT %s""",
        (room * 5,),
    ).fetchall()
    fens = positions.fens(conn, [r["game_id"] for r in rows])
    added = 0
    with conn:
        for r in rows:
            if added >= room:
                break
            fen = fens.get((r["game_id"], r["ply"]))
            if not fen or not free_capture(chess.Board(fen), r["best_uci"]):
                continue
            conn.execute(
                "INSERT INTO threat_cards (game_id, ply, kind, threats, answer_set) VALUES (%s, %s, 'vision', %s::jsonb, %s)",
                (r["game_id"], r["ply"], json.dumps([{"uci": r["best_uci"]}]), ANSWER_SET),
            )
            added += 1
    return added


# A lesson taught by a drill can also be held by the games themselves. The bar is the share
# of chances taken, and the floor is how many chances it takes before a share means anything
# (a rate on fewer chances is noise).
IN_GAME_BAR = 0.8
IN_GAME_ENOUGH = 10


def in_game_rate(conn, kind: str = "vision") -> tuple[int, int]:
    """(taken, chances) for a drill kind, from the games the items came from.

    The items are already verified positions -- `_prepare_vision` checked the geometry when
    it made them -- and each records the move actually played, so whether the learner took
    the chance at the board is a join rather than a re-scan. Deliberately **not**
    `chance_motif = 'hangingPiece'`, which is the obvious signal and the least reliable one
    we have at 0.17 precision; selecting drills on it was rejected for that reason and
    clearing a ward on it would be the same mistake wearing a different hat.
    """
    row = conn.execute(
        """SELECT count(*) AS chances, count(*) FILTER (WHERE m.uci = m.best_uci) AS taken
           FROM threat_cards t JOIN moves m ON m.game_id = t.game_id AND m.ply = t.ply
           WHERE t.kind = %s""",
        (kind,),
    ).fetchone()
    return int(row["taken"]), int(row["chances"])


def held_in_games(conn, kind: str = "vision") -> bool:
    """Whether the learner's own games already show they do this, so the drill has nothing
    to teach them. Needs enough chances for the share to mean anything."""
    taken, chances = in_game_rate(conn, kind)
    return chances >= IN_GAME_ENOUGH and taken / chances >= IN_GAME_BAR


def _reviewed_today(conn, today: date) -> set[tuple[int, int]]:
    rows = conn.execute(
        "SELECT DISTINCT game_id, ply FROM threat_reviews WHERE reviewed_at >= %s AND reviewed_at < %s",
        db.day_range(conn, today),
    )
    return {(r["game_id"], r["ply"]) for r in rows}


def card_threat(conn, game_id: int, ply: int) -> dict | None:
    """The threat question for a review card: {"threats": [...]} when the card's move ignored
    a threat (a 'threat' drill item), else None. Asked whenever the card is."""
    row = conn.execute(
        "SELECT threats FROM threat_cards WHERE game_id = %s AND ply = %s AND kind = 'threat'", (game_id, ply)
    ).fetchone()
    found = _threats(row["threats"]) if row else []
    return {"threats": found} if found else None


def _introduced_today(conn, today: date) -> int:
    """Own threat questions (not a card's) answered for the first time ever today."""
    start, end = db.day_range(conn, today)
    rows = conn.execute(
        """SELECT game_id, ply FROM threat_reviews GROUP BY game_id, ply
           HAVING min(reviewed_at) >= %s AND min(reviewed_at) < %s""",
        (start, end),
    ).fetchall()
    return len({(r["game_id"], r["ply"]) for r in rows} - _card_keys(conn))


def queue(conn, today: date | None = None) -> list[db.Row]:
    """Today's threat questions still to ask on their own (calm items, and threat items that
    are no review card: a card asks its own): due ones first, then up to NEW_PER_DAY new ones,
    newest games first with a calm item after every CALM_SHARE threat items."""
    today = today or db.today(conn)
    done = _reviewed_today(conn, today)
    rows = [
        r
        for r in conn.execute(
            """SELECT t.game_id, t.ply, t.kind, t.due FROM threat_cards t JOIN games g ON g.id = t.game_id
           LEFT JOIN cards c ON c.game_id = t.game_id AND c.ply = t.ply
           WHERE (t.kind IN ('calm', 'allows', 'vision') OR (t.kind = 'threat' AND c.game_id IS NULL))
             AND (t.due IS NULL OR t.due <= %s)
           ORDER BY t.due IS NULL, t.due, g.played_at DESC NULLS LAST, t.ply""",
            (today.isoformat(),),
        ).fetchall()
        if (r["game_id"], r["ply"]) not in done
    ]
    due = [r for r in rows if r["due"] is not None][:REVIEW_LIMIT]
    fresh = [r for r in rows if r["due"] is None]
    threat_new = [r for r in fresh if r["kind"] in ("threat", "allows", "vision")]
    calm_new = [r for r in fresh if r["kind"] == "calm"]
    mixed = []
    while threat_new or calm_new:
        mixed.extend(threat_new[:CALM_SHARE])
        threat_new = threat_new[CALM_SHARE:]
        if calm_new:
            mixed.append(calm_new.pop(0))
    room = max(0, NEW_PER_DAY - _introduced_today(conn, today))
    return due + mixed[:room]


def post_item(conn, today: date, kinds: list[str]) -> db.Row | None:
    """The next question of the kinds the current post teaches (wards.current_drills), for
    the watch's idea slots: due ones first, then new ones, newest games first, up to
    NEW_PER_DAY + POST_NEW_PER_DAY introduced today. None when there is none."""
    if not kinds:
        return None
    done = _reviewed_today(conn, today)
    rows = [
        r
        for r in conn.execute(
            """SELECT t.game_id, t.ply, t.kind, t.due FROM threat_cards t JOIN games g ON g.id = t.game_id
               WHERE t.kind = ANY(%s) AND (t.due IS NULL OR t.due <= %s)
               ORDER BY t.due IS NULL, t.due, g.played_at DESC NULLS LAST, t.ply""",
            (kinds, today.isoformat()),
        ).fetchall()
        if (r["game_id"], r["ply"]) not in done
    ]
    due = [r for r in rows if r["due"] is not None]
    if due:
        return due[0]
    fresh = [r for r in rows if r["due"] is None]
    if fresh and _introduced_today(conn, today) < NEW_PER_DAY + POST_NEW_PER_DAY:
        return fresh[0]
    return None


def answered_today(conn, today: date) -> int:
    """Own threat questions (not a card's) answered today."""
    return len(_reviewed_today(conn, today) - _card_keys(conn))


def plan(conn, today: date) -> dict:
    """{done, total, next}: today's own threat questions answered, planned (answered plus
    still to ask) and the next one, or None."""
    done = answered_today(conn, today)
    waiting = queue(conn, today)
    return {"done": done, "total": done + len(waiting), "next": waiting[0] if waiting else None}


def _card_keys(conn) -> set[tuple[int, int]]:
    return {(r["game_id"], r["ply"]) for r in conn.execute("SELECT game_id, ply FROM cards")}


def _answer_board(kind: str, fen: str | None, played_uci: str | None) -> chess.Board | None:
    """The board an answer is a move on: after your own move for 'allows' (their reply), your
    own turn for 'vision' (your capture), else the opponent moving out of turn (`passed`)."""
    if not fen:
        return None
    if kind == "allows":
        after = _after(fen, played_uci)
        return chess.Board(after) if after else None
    if kind == "vision":
        return chess.Board(fen)
    return threats.passed(chess.Board(fen))


def _complete(board: chess.Board | None, found: list[dict]) -> list[dict]:
    """`found` with every entry in full (SAN, line, net, mate), as the app shows it: items
    stored with a bare move ('vision', an 'allows' item not yet widened) are described from
    `board`. An entry that is not a legal move there is dropped."""
    out = []
    for t in found:
        if "san" in t:
            out.append(t)
            continue
        try:
            move = chess.Move.from_uci(t.get("uci") or "")
        except ValueError:
            continue
        described = (
            threats.describe(board, [move], chess.engine.PovScore(chess.engine.Cp(0), board.turn)) if board else None
        )
        if described:
            out.append(described)
    return out


def item(conn, game_id: int, ply: int) -> dict | None:
    """One drill item for the app: the position after the opponent's move (and before it, to
    play it in), whose turn it is, the threat set, and for threat items the card's grade map
    for your own move afterwards."""
    row = conn.execute(
        """SELECT t.kind, t.threats, m.color, m.san, m.best_san, m.uci AS played_uci,
                  prev.uci AS prev_uci, g.opponent, g.played_at
           FROM threat_cards t JOIN moves m ON m.game_id = t.game_id AND m.ply = t.ply
           JOIN games g ON g.id = t.game_id
           LEFT JOIN moves prev ON prev.game_id = t.game_id AND prev.ply = t.ply - 1
           WHERE t.game_id = %s AND t.ply = %s""",
        (game_id, ply),
    ).fetchone()
    if row is None:
        return None
    fen = positions.fen_before(conn, game_id, ply)
    if fen is None:
        return None
    if row["kind"] == "allows":
        # You answer from after your own move, so what you played animates in as the setup:
        # the question is what it allowed, and their reply is then a legal move.
        after = _after(fen, row["played_uci"])
        if after is None:
            return None
        answered_from, setup_uci, setup_fen = after, row["played_uci"], fen
    else:
        answered_from, setup_uci, setup_fen = (
            fen,
            row["prev_uci"],
            positions.fen_before(conn, game_id, ply - 1) if ply > 1 else None,
        )
    out = {
        "game_id": game_id,
        "ply": ply,
        "kind": row["kind"],
        "color": row["color"],
        "fen_before": answered_from,
        "prev_uci": setup_uci,
        "fen_prev": setup_fen,
        "threats": _complete(_answer_board(row["kind"], fen, row["played_uci"]), _threats(row["threats"])),
        "opponent": row["opponent"],
        "played_at": row["played_at"],
        "played_san": row["san"],
        "best_san": row["best_san"],
        "grades": None,
    }
    if row["kind"] == "threat":
        card_row, card_fen = practice_grades.load(conn, game_id, ply)
        prepared = practice_grades.cached(card_row, card_fen) if card_row else None
        out["grades"] = prepared["grades"] if prepared else None
    return out


def answer(
    conn,
    game_id: int,
    ply: int,
    given: str,
    seconds: float | None = None,
    today: date | None = None,
    now: datetime | None = None,
) -> dict:
    """Grade a threat answer (a UCI move of the opponent's, or NONE) against the stored set.
    The day's first answer schedules the item: Again when wrong, Easy when right within
    EASY_SECONDS, else Good. Raises KeyError for an unknown item, ValueError for a move the
    opponent couldn't play there."""
    today = today or db.today(conn)
    row = conn.execute(
        """SELECT t.kind, t.threats, t.fsrs, m.uci AS played_uci FROM threat_cards t
           JOIN moves m ON m.game_id = t.game_id AND m.ply = t.ply
           WHERE t.game_id = %s AND t.ply = %s AND t.kind != 'skip'""",
        (game_id, ply),
    ).fetchone()
    if row is None:
        raise KeyError((game_id, ply))
    # An 'allows' answer is a real move for the side to move, from after the learner's own
    # move; a 'vision' answer is your own move; a threat answer is the opponent moving out of
    # turn, so it needs the passed-move board.
    board = _answer_board(row["kind"], positions.fen_before(conn, game_id, ply), row["played_uci"])
    found = _complete(board, _threats(row["threats"]))
    if given != NONE:
        try:
            move = chess.Move.from_uci(given)
        except ValueError:
            raise ValueError("Not a move.") from None
        if board is None or move not in board.legal_moves:
            raise ValueError("That move can't be played there.")
    correct = given in {t["uci"] for t in found} if found else given == NONE
    when = now or datetime.now(UTC)
    stamp = db.stamp(when)
    rating = None
    due = None
    state = Card.from_dict(json.loads(row["fsrs"])) if row["fsrs"] else Card()
    if (game_id, ply) not in _reviewed_today(conn, today):
        rating = "again" if not correct else "easy" if seconds is not None and seconds <= EASY_SECONDS else "good"
        duration = round(seconds * 1000) if seconds is not None else None
        state, _ = deck.scheduler(conn).review_card(state, deck.RATING[rating], when, review_duration=duration)
        due = db.local_date(conn, state.due).isoformat()
        conn.execute(
            """UPDATE threat_cards SET fsrs = %s, due = %s, reviews = reviews + 1, lapses = lapses + %s
               WHERE game_id = %s AND ply = %s""",
            (json.dumps(state.to_dict()), due, int(rating == "again"), game_id, ply),
        )
    conn.execute(
        "INSERT INTO threat_reviews (game_id, ply, reviewed_at, answer, correct, rating) "
        "VALUES (%s, %s, %s, %s, (%s::int = 1), %s)",
        (game_id, ply, stamp, given, correct, rating),
    )
    return {"correct": correct, "threats": found, "rating": rating, "due": due}
