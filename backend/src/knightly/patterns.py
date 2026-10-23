"""What your mistakes come down to: the tactic behind each one.

A blunder or mistake is tagged by what the opponent's punishing line does to you: a fork, a
pin, a skewer, a discovered attack, taking a loose piece, or mate. A miss is tagged by what
your own best line would have done to them. Anything else, usually a slower positional slip,
is "other".

Two passes. `tag_all` is instant (board geometry on the moves already stored: the engine's
best reply is the next ply's best move) and catches one-move tactics; what it can't name is
left "pending". `deepen` then asks Stockfish for the line and looks for the tactic in its
first few moves, which catches combinations (a trade, then the fork); it runs in the daily
update and in `knightly patterns`.

`tag_chances` is a third pass, over the other side of the ledger: the tactic behind each clear
chance you had, taken or not. Mistakes alone say how often a motif beat you, never how often
you met it, so a motif that simply comes up a lot reads as a weakness. Counting chances gives
it a rate. It tags from the *best* move, never from the played one, so a chance taken and a
chance missed are recognised by the same rule.

The tags are Lichess puzzle theme names, so the path can later serve puzzles of the same
theme.
"""

from datetime import date, datetime, timedelta

import chess
import chess.engine

from . import db, positional, positions
from .analyze import MISS_DROP, engine_pool, find_engine, only_move

THEMES = [
    "hangingPiece",
    "fork",
    "pin",
    "skewer",
    "discoveredAttack",
    "backRankMate",
    "mate",
    "promotion",
    "enPassant",
    "advancedPawn",
    "trappedPiece",
    "smotheredMate",
]
OTHER = "other"
PENDING = "pending"  # no one-move tactic; waiting for `deepen` to look further
# The gate (docs/specs/2026-10-18-tactic-recognition-design.md). A mistake where no single
# move stood out had no tactic to find, so failing to name one is the right answer rather
# than a gap. Keeping the two apart is what stops a catch-all rule swallowing everything:
# `other` now means "a tactic was there and we could not name it", which is measurable.
POSITIONAL = "positional"
# Names that are not a tactic: no family, and no evidence about a motif either way.
NAMELESS = (OTHER, PENDING, POSITIONAL)
# How much material, in centipawns, has to actually be at stake before a position counts as
# tactical at all. 200cp is Lichess's own floor -- it is where their "advantage" theme starts,
# so it is also the floor beneath which nothing in our training corpus was ever labelled.
#
# This is the bar that stops the rules naming tactics in positions that have none. Without it
# they fire on geometry alone: measured over 2,574 of your mistakes they named a tactic in
# 41% of positions where the opponent gained under two pawns, against the classifier's 6%.
# Those labels fed weakness scores, so the app was prescribing drills for tactics you never
# actually missed.
TACTIC_CP = 200
# How much better the engine's move has to be before a *positional* idea counts as a chance
# you had. Nothing like TACTIC_CP: a developing move is never best by two pawns, which is why
# the tactical gate left development, castling and connecting the rooks permanently
# unmeasurable. Low enough to catch the idea, high enough that two near-equal opening moves
# do not become a finding.
POSITIONAL_CP = 50
DEEP_DEPTH = 12  # engine depth for `deepen`'s lines
# Five of your own moves, about as long as one combination runs. Scoring against Lichess's
# labels, 6 plies missed a third of the mates.
DEEP_PLIES = 10
RECENT_DAYS = 90  # "the tactics you miss most" counts rated games this recent
# The move labels that count as your mistakes: tactic tags, layers and the review deck share them.
KINDS = ("mistake", "miss", "blunder")
VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100}
TARGET = 3  # a fork or discovered attack has to hit something worth at least a minor piece
CHANCE_BATCH = 200  # games examined for tactic chances per run; the rest wait
# Pseudo-chances pulling a thin tactic's rate toward your overall one. Most tactics see a few
# dozen chances in RECENT_DAYS, so a raw rate over them swings on one or two answers.
PRIOR_CHANCES = 25


def _value(piece: chess.Piece | None) -> int:
    return VALUES[piece.piece_type] if piece else 0


def _targets(board: chess.Board, square: chess.Square, side: chess.Color) -> list[chess.Square]:
    """Pieces of `side` that the piece on `square` attacks and could win: the king, anything
    worth more than the attacker, or anything worth a minor piece or more left undefended."""
    attacker = _value(board.piece_at(square))
    out = []
    for sq in board.attacks(square):
        piece = board.piece_at(sq)
        if not piece or piece.color != side:
            continue
        v = _value(piece)
        if piece.piece_type == chess.KING or v > attacker or (v >= TARGET and not board.is_attacked_by(side, sq)):
            out.append(sq)
    return out


def _pinned(board: chess.Board, side: chess.Color) -> int:
    return sum(
        1
        for sq in chess.SquareSet(board.occupied_co[side])
        if board.piece_type_at(sq) != chess.KING and board.is_pinned(side, sq) and _value(board.piece_at(sq)) >= TARGET
    )


def _back_rank(board: chess.Board) -> bool:
    """Checkmate with the king on its own back rank, mated along that rank, and shut in by its
    own pieces. The last part is the pattern: a king mated on the back rank that could have
    stepped up was merely cornered, and Lichess only calls the shut-in one a back-rank mate."""
    side = board.turn
    king = board.king(side)
    home = 0 if side == chess.WHITE else 7
    if king is None or chess.square_rank(king) != home:
        return False
    if not any(
        chess.square_rank(sq) == home and board.piece_type_at(sq) in (chess.ROOK, chess.QUEEN)
        for sq in board.checkers()
    ):
        return False
    # Every square it could step up to is taken by one of its own.
    up = home + (1 if side == chess.WHITE else -1)
    file = chess.square_file(king)
    ahead = [chess.square(f, up) for f in (file - 1, file, file + 1) if 0 <= f < 8]
    return all((p := board.piece_at(sq)) is not None and p.color == side for sq in ahead)


def _skewer(board: chess.Board, square: chess.Square, side: chess.Color) -> bool:
    """A slider on `square` checks the king, and behind the king on the same line stands a
    piece of `side` that will be taken once the king steps aside."""
    if board.piece_type_at(square) not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        return False
    king = board.king(side)
    if king is None or square not in board.checkers():
        return False
    df = chess.square_file(king) - chess.square_file(square)
    dr = chess.square_rank(king) - chess.square_rank(square)
    step_f, step_r = (df > 0) - (df < 0), (dr > 0) - (dr < 0)
    f, r = chess.square_file(king) + step_f, chess.square_rank(king) + step_r
    while 0 <= f < 8 and 0 <= r < 8:
        piece = board.piece_at(chess.square(f, r))
        if piece:
            return piece.color == side and _value(piece) >= TARGET
        f, r = f + step_f, r + step_r
    return False


def _trapped(board: chess.Board, after: chess.Board, move: chess.Move) -> bool:
    """Whether the move leaves a piece of theirs worth a minor or more attacked with nowhere
    to go: every square it could move to is covered by us too. Lichess calls it trappedPiece,
    and without it the move reads as whatever it incidentally captured."""
    me, them = board.turn, not board.turn
    for sq in chess.SquareSet(after.occupied_co[them]):
        piece = after.piece_at(sq)
        if piece.piece_type == chess.KING or _value(piece) < TARGET:
            continue
        if not after.is_attacked_by(me, sq) or after.is_attacked_by(them, sq):
            continue  # not attacked, or defended: the exchange, not a trap
        flights = [m for m in after.legal_moves if m.from_square == sq]
        if flights and all(after.is_attacked_by(me, m.to_square) for m in flights):
            return True
    return False


def _advanced_pawn(board: chess.Board, move: chess.Move) -> bool:
    """A pawn pushed to the last two ranks: close enough to promote that it is the point."""
    if board.piece_type_at(move.from_square) != chess.PAWN:
        return False
    rank = chess.square_rank(move.to_square)
    return rank >= 6 if board.turn == chess.WHITE else rank <= 1


def _smothered(after: chess.Board) -> bool:
    """Mate with the king walled in by its own pieces.

    Only a knight can check through such a wall, so requiring one is not a narrowing -- it is
    what makes the pattern the thing it is. Scored against Lichess's labels over 20,000
    puzzles this is right every time it speaks and never misses: 100% precision, 100% recall
    on their 544."""
    if not after.is_checkmate():
        return False
    king = after.king(after.turn)
    if king is None:
        return False
    checkers = after.checkers()
    if len(checkers) != 1 or after.piece_type_at(next(iter(checkers))) != chess.KNIGHT:
        return False
    return all((p := after.piece_at(sq)) is not None and p.color == after.turn for sq in after.attacks(king))


def motif(board: chess.Board, move: chess.Move) -> str | None:
    """The tactic `move` (by the side to move in `board`) carries out against the other side,
    or None. In order: mate, fork, pin, skewer, discovered attack, promotion, en passant, a
    pawn pushed deep, taking a loose piece."""
    me, them = board.turn, not board.turn
    captured = board.piece_at(move.to_square)
    if board.is_en_passant(move):
        captured = chess.Piece(chess.PAWN, them)
    loose = captured is not None and _value(captured) >= TARGET and not board.is_attacked_by(them, move.to_square)
    pins_before = _pinned(board, them)
    # Valuable pieces of theirs that pieces other than the mover already attacked.
    hit_before = {
        sq
        for sq in chess.SquareSet(board.occupied_co[them])
        if _value(board.piece_at(sq)) >= 5 and any(a != move.from_square for a in board.attackers(me, sq))
    }

    after = board.copy()
    after.push(move)
    if after.is_checkmate():
        if _smothered(after):
            return "smotheredMate"
        return "backRankMate" if _back_rank(after) else "mate"
    if len(_targets(after, move.to_square, them)) >= 2:
        return "fork"
    if _pinned(after, them) > pins_before:
        return "pin"
    if _skewer(after, move.to_square, them):
        return "skewer"
    hit_after = {
        sq
        for sq in chess.SquareSet(after.occupied_co[them])
        if _value(after.piece_at(sq)) >= 5 and any(a != move.to_square for a in after.attackers(me, sq))
    }
    if hit_after - hit_before:
        return "discoveredAttack"
    if _trapped(board, after, move):
        return "trappedPiece"
    if move.promotion:
        return "promotion"
    if board.is_en_passant(move):
        return "enPassant"
    if _advanced_pawn(board, move):
        return "advancedPawn"
    if loose:
        return "hangingPiece"
    return None


def decisive(
    kind: str,
    color: str,
    eval_before: int | None,
    eval_after: int | None,
    eval_second: int | None,
    mate_after: int | None,
) -> bool:
    """Whether anything concrete was actually at stake, asked before we try to name anything.

    A tactic is not a shape on the board, it is a shape that wins something. The question
    differs by kind because the move in question does. A `miss` is named for the move you did
    not play, so it asks how far that move beat the next one; a mistake or blunder is named
    for the reply it allowed, so it asks what the opponent won by it. Either way the answer is
    in centipawns, against TACTIC_CP.

    Both gradients were measured against the classifier over your own mistakes. Misses: it
    named a tactic in 13% of positions under a pawn and 80% of those over eight. Mistakes and
    blunders, by what the opponent gained: 6% under two pawns, 44% over eight. Where the
    engine says nothing was at stake, there is nothing to name, and saying so is the answer
    rather than a gap in our vocabulary."""
    if mate_after is not None:
        return True
    sign = 1 if color == "white" else -1
    if kind == "miss":  # how far your best move beat the next one
        if eval_before is None or eval_second is None:
            return False
        return sign * (eval_before - eval_second) >= TACTIC_CP
    if eval_before is None or eval_after is None:  # what the opponent won
        return False
    return sign * (eval_before - eval_after) >= TACTIC_CP


def tag(
    fen_before: str,
    played: str,
    best: str | None,
    reply: str | None,
    kind: str,
    mate_after: int | None,
    color: str,
    eval_before: int | None = None,
    eval_after: int | None = None,
    eval_second: int | None = None,
) -> str:
    """The pattern for one of your mistakes. A miss is about the move you didn't play
    (`best`); a mistake or blunder about the reply it allowed (`reply`, the opponent's best
    move afterwards). `mate_after` is White's mate-in-N after your move, if any.

    Nothing is named in a position where nothing was at stake (`decisive`): the rules match on
    geometry, and geometry is present in most positions whether or not it wins anything."""
    if not decisive(kind, color, eval_before, eval_after, eval_second, mate_after):
        return POSITIONAL
    board = chess.Board(fen_before)
    if kind == "miss":
        if best:
            found = motif(board, chess.Move.from_uci(best))
            if found:
                return found
        return PENDING
    after = board.copy()
    after.push(chess.Move.from_uci(played))
    if reply:
        try:
            found = motif(after, chess.Move.from_uci(reply))
        except (ValueError, AssertionError):
            found = None
        if found:
            return found
    # They can force mate, but the first move of it isn't a recognisable tactic.
    sign = 1 if color == "white" else -1
    if mate_after is not None and sign * mate_after < 0:
        return "mate"
    return PENDING


# Which tactic a line is about when it carries more than one. Taking a free piece is last:
# almost any combination captures something along the way, so naming a line by the first
# capture in it buries whatever the line was actually for.
DECISIVE = (
    "mate",
    "smotheredMate",
    "backRankMate",
    "fork",
    "pin",
    "skewer",
    "discoveredAttack",
    "trappedPiece",
    "promotion",
    "enPassant",
    "advancedPawn",
    "hangingPiece",
)


def in_line(board: chess.Board, line: list[chess.Move]) -> str | None:
    """The tactic the side to move in `board` carries out in `line` (its moves only, within
    DEEP_PLIES). The most decisive one, not the first: a combination that ends in mate is
    about the mate, even though it took a loose piece on the way."""
    b, found = board.copy(), set()
    for i, move in enumerate(line[:DEEP_PLIES]):
        if move not in b.legal_moves:
            break
        if i % 2 == 0 and (name := motif(b, move)):
            found.add(name)
        b.push(move)
    return next((m for m in DECISIVE if m in found), None)


def deepen(
    conn: db.Connection, engine_path: str | None = None, workers: int | None = None, depth: int = DEEP_DEPTH, log=print
) -> int:
    """Settle every "pending" tag with the engine's line: for a blunder or mistake, the line
    after your move (their tactic); for a miss, the line before it (yours).

    Anything still pending has already cleared `decisive`, so the engine says something was at
    stake here. A line we cannot name is therefore a real gap in our vocabulary -- `other` --
    not an absence of tactic; `positional` was decided before we ever got here. Returns how
    many were settled."""
    rows = conn.execute(
        """SELECT game_id, ply, uci, classification, color, eval_before, eval_second, layer
           FROM moves WHERE is_user AND pattern = %s""",
        (PENDING,),
    ).fetchall()
    if not rows:
        return 0
    fens = positions.fens(conn, [r["game_id"] for r in rows])
    engine_path = find_engine(engine_path)  # only needed when there's something to look at
    log(f"Looking deeper at {len(rows)} mistakes for their tactic...")

    def work(r):
        fen = fens.get((r["game_id"], r["ply"]))
        if fen is None:  # the game's moves don't replay
            return OTHER, r["game_id"], r["ply"]
        board = chess.Board(fen)
        if r["classification"] != "miss":
            board.push(chess.Move.from_uci(r["uci"]))
        if board.is_game_over():
            return OTHER, r["game_id"], r["ply"]
        info = engine().analyse(board, chess.engine.Limit(depth=depth))
        return in_line(board, info.get("pv") or []) or OTHER, r["game_id"], r["ply"]

    with engine_pool(engine_path, workers) as (pool, engine):
        tags = list(pool.map(work, rows))
    with conn:
        conn.executemany("UPDATE moves SET pattern = %s WHERE game_id = %s AND ply = %s", tags)
    return len(tags)


def clear(conn: db.Connection) -> int:
    """Drop every tag so the next pass reads each mistake again. Returns how many were cleared.

    `tag_all` only looks at rows whose pattern is NULL, so a change to the naming rules or to
    the gate reaches new mistakes and never the ones already tagged -- the learner keeps seeing
    conclusions drawn by rules we have since corrected. The vocabulary changes whenever we learn
    something, so re-reading has to be a command with a test behind it rather than a hand-written
    UPDATE typed at production."""
    with conn:
        done = conn.execute(
            f"""UPDATE moves SET pattern = NULL, chance_motif = NULL
                WHERE is_user AND classification IN ({", ".join("%s" for _ in KINDS)})""",
            KINDS,
        )
    return done.rowcount


def tag_all(conn: db.Connection) -> int:
    """First pass over every one of your mistakes, misses and blunders that isn't tagged yet
    (new games, or re-analysed ones, whose rows come back untagged): one-move tactics are
    named, the rest left PENDING for `deepen`, which settles them. Returns how many were
    tagged."""
    rows = conn.execute(
        f"""SELECT m.game_id, m.ply, m.uci, m.best_uci, m.classification, m.color,
                   m.mate_after, m.eval_before, m.eval_after, m.eval_second, n.best_uci AS reply
            FROM moves m LEFT JOIN moves n ON n.game_id = m.game_id AND n.ply = m.ply + 1
            WHERE m.is_user AND m.pattern IS NULL
              AND m.classification IN ({", ".join("%s" for _ in KINDS)})""",
        KINDS,
    ).fetchall()
    fens = positions.fens(conn, [r["game_id"] for r in rows])

    def safe(r):
        fen = fens.get((r["game_id"], r["ply"]))
        if fen is None:  # the game's moves don't replay
            return OTHER
        try:
            return tag(
                fen,
                r["uci"],
                r["best_uci"],
                r["reply"],
                r["classification"],
                r["mate_after"],
                r["color"],
                r["eval_before"],
                r["eval_after"],
                r["eval_second"],
            )
        except (ValueError, AssertionError):  # a position python-chess can't read
            return OTHER

    tags = [(safe(r), r["game_id"], r["ply"]) for r in rows]
    conn.executemany("UPDATE moves SET pattern = %s WHERE game_id = %s AND ply = %s", tags)
    return len(tags)


PUZZLE_SOURCE = "knightly"  # puzzles.SOURCE (puzzles imports this module)
_HAS_THEME = "EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.themes::jsonb) t WHERE t = %s)"


def strength(conn: db.Connection, start: str | None, end: str, prev_start: str | None) -> list[dict]:
    """How you do in practice at each tactic, Lichess-dashboard style: first tries only.

    A review position counts under its mistake's tag, a Knightly puzzle under its themes
    (Lichess tags a back-rank mate "mate" too; our "mate" means any other mate).
    `card_reviews` keeps a card's first graded answer of the day, correct only when found
    without a hint; `puzzle_attempts` keeps a puzzle's first finished try. Finding it on a
    retry never counts as a first-try solve. `previous` is the period of the same length
    before `start`, or None for all time."""

    def counts(since: str | None, until: str) -> dict[str, dict[str, int]]:
        out = {p: {"attempts": 0, "first_try": 0} for p in THEMES}
        cards = conn.execute(
            f"""SELECT m.pattern, count(*) AS n, count(*) FILTER (WHERE c.correct) AS won
                FROM card_reviews c JOIN moves m ON m.game_id = c.game_id AND m.ply = c.ply
                WHERE m.pattern IN ({", ".join("%s" for _ in THEMES)}) AND c.reviewed_at < %s
                  {"AND c.reviewed_at >= %s" if since else ""}
                GROUP BY m.pattern""",
            (*THEMES, until, *([since] if since else [])),
        ).fetchall()
        for r in cards:
            out[r["pattern"]] = {"attempts": r["n"], "first_try": r["won"]}
        for pattern in THEMES:
            theme = f"{_HAS_THEME} AND NOT {_HAS_THEME}" if pattern == "mate" else _HAS_THEME
            r = conn.execute(
                f"""SELECT count(*) AS n, count(*) FILTER (WHERE p.success) AS won
                    FROM puzzle_attempts p
                    WHERE p.source = %s AND {theme} AND p.attempted_at < %s
                      {"AND p.attempted_at >= %s" if since else ""}""",
                (
                    PUZZLE_SOURCE,
                    pattern,
                    *(["backRankMate"] if pattern == "mate" else []),
                    until,
                    *([since] if since else []),
                ),
            ).fetchone()
            out[pattern]["attempts"] += r["n"]
            out[pattern]["first_try"] += r["won"]
        return out

    now = counts(start, end)
    before = counts(prev_start, start) if start and prev_start else None
    return [{"pattern": p, **now[p], "previous": before[p] if before else None} for p in THEMES]


def _gap(color: str, eval_before: int | None, eval_second: int | None) -> int | None:
    """How far the engine's move beat its next choice, in centipawns, from your side."""
    if eval_before is None or eval_second is None:
        return None
    return (1 if color == "white" else -1) * (eval_before - eval_second)


def tag_chances(conn: db.Connection, batch: int = CHANCE_BATCH) -> int:
    """Name the tactic behind every clear chance of yours (`moves.chance_motif`): the motif the
    engine's move carries, on moves where one move was clearly it (`analyze.only_move` at
    MISS_DROP) *and* something was actually at stake (`decisive`). Whether you took the chance
    is `uci = best_uci`, so a motif's finds and misses are counted by one rule -- unlike
    `pattern`, which names your mistakes by the opponent's refutation and so cannot be a
    denominator for them. Moves that were no clear chance, or whose chance carries no nameable
    tactic, settle as OTHER so each is examined once.

    `only_move` alone is not enough: it asks whether one move stood out, which is a question
    about the shape of the choice, not about the size of the prize. A move can be uniquely best
    by a wide win% margin and still win nothing at all. Since this is what `weakness` counts,
    naming a motif here without that check is what puts tactics in front of you that you never
    actually failed.

    Runs a whole game at a time (its FENs replay together) and at most `batch` games a run,
    newest first; the rest wait for the next. Board geometry only, no engine."""
    games = [
        r["id"]
        for r in conn.execute(
            """SELECT g.id FROM games g
           WHERE EXISTS (SELECT 1 FROM moves m WHERE m.game_id = g.id
                           AND m.is_user AND m.chance_motif IS NULL)
           ORDER BY g.played_at DESC NULLS LAST LIMIT %s""",
            (batch,),
        )
    ]
    if not games:
        return 0
    rows = conn.execute(
        """SELECT game_id, ply, color, uci, best_uci, eval_before, eval_second
           FROM moves WHERE game_id = ANY(%s) AND is_user AND chance_motif IS NULL""",
        (games,),
    ).fetchall()
    fens = positions.fens(conn, games)

    def chance(r):
        """`(motif, whether you took it)` for one move of yours."""
        fen = fens.get((r["game_id"], r["ply"]))
        if not r["best_uci"] or fen is None:  # unanalysed, or the game's moves don't replay
            return OTHER, None
        try:
            board = chess.Board(fen)
            best = chess.Move.from_uci(r["best_uci"])
            if best not in board.legal_moves:
                return OTHER, None
            tactic = motif(board, best)
            # A tactical chance: one move clearly stood out, and it won something. Taking it
            # means playing that move -- there is no other way to win the piece.
            if (
                tactic
                and only_move(r["color"], r["eval_before"], r["eval_second"], MISS_DROP)
                and decisive("miss", r["color"], r["eval_before"], None, r["eval_second"], None)
            ):
                return tactic, r["uci"] == r["best_uci"]
            # A positional one: no tactic to find, but the engine wanted an idea we have a
            # word for. Taking it means playing *a* move carrying that idea -- developing the
            # bishop instead of the knight is still developing -- so the move itself is not
            # the test.
            gap = _gap(r["color"], r["eval_before"], r["eval_second"])
            if tactic is None and gap is not None and gap >= POSITIONAL_CP:
                idea = positional.reason(board, best)
                if idea:
                    # Named by the sharpest idea the engine's move carries, but credited on
                    # any overlap: a move can carry several, and doing one of the things the
                    # engine wanted is finding the idea.
                    yours = chess.Move.from_uci(r["uci"]) if r["uci"] else None
                    mine = positional.ideas(board, yours) if yours else frozenset()
                    return idea[0], bool(mine & positional.ideas(board, best))
            return OTHER, None
        except (ValueError, AssertionError):  # a position python-chess can't read
            return OTHER, None

    tags = [(*chance(r), r["game_id"], r["ply"]) for r in rows]
    conn.executemany("UPDATE moves SET chance_motif = %s, chance_found = %s WHERE game_id = %s AND ply = %s", tags)
    return len(tags)


def chance_rates(conn: db.Connection, today: date) -> dict[str, dict[str, int]]:
    """For each tactic, the clear chances to play it in your rated games of the last
    RECENT_DAYS and how many you took: `{motif: {"found": n, "chances": n}}`, most chances
    first. A rate over these is comparable between tactics; a raw mistake count is not,
    because a tactic that simply arises often outranks one you actually fail."""
    since = db.stamp(datetime.combine(today, datetime.min.time()) - timedelta(days=RECENT_DAYS))
    rows = conn.execute(
        """SELECT m.chance_motif AS motif,
                  count(*) AS chances,
                  count(*) FILTER (WHERE m.chance_found) AS found
           FROM moves m JOIN games g ON g.id = m.game_id
           WHERE m.is_user AND g.rated AND g.played_at >= %s
             AND m.chance_motif IS NOT NULL AND m.chance_motif <> ALL(%s)
           GROUP BY m.chance_motif ORDER BY chances DESC, m.chance_motif""",
        (since, list(NAMELESS)),
    ).fetchall()
    return {r["motif"]: {"found": r["found"], "chances": r["chances"]} for r in rows}


def weakness(conn: db.Connection, today: date) -> dict[str, float]:
    """Each tactic's find rate, shrunk toward your overall rate: `{motif: 0..1}`, lower is
    weaker. This is what practice is ordered by: a raw mistake count would rank a tactic
    that merely arises often above one you actually fail.

    Shrinkage because the denominators are small. On the production account only
    hangingPiece, fork and discoveredAttack see 20 chances in RECENT_DAYS, so an unshrunk
    rate would let one answer move a tactic from first to last. A tactic with no chances at
    all is absent: never meeting it is not evidence of weakness.

    Game chances only, never practice answers, for the reason
    docs/specs/2026-10-17-learning-loop-design.md part 1 gives: practice is the input and
    games the outcome, so folding first tries in here would let drilling a tactic retire it
    from practice without the games changing. `strength` reports those separately."""
    rates = chance_rates(conn, today)
    chances = sum(v["chances"] for v in rates.values())
    if not chances:
        return {}
    overall = sum(v["found"] for v in rates.values()) / chances
    return {m: (v["found"] + PRIOR_CHANCES * overall) / (v["chances"] + PRIOR_CHANCES) for m, v in rates.items()}


# Lichess's own tactical vocabulary, for scoring ours against theirs. Goal, phase, length and
# provenance tags are left out: they say what the puzzle is worth or where it came from, not
# what the tactic is. Ours (THEMES) is a subset.
THEIR_MOTIFS = frozenset(
    {
        "advancedPawn",
        "attackingF2F7",
        "attraction",
        "capturingDefender",
        "clearance",
        "deflection",
        "discoveredAttack",
        "discoveredCheck",
        "doubleCheck",
        "enPassant",
        "exposedKing",
        "fork",
        "hangingPiece",
        "interference",
        "intermezzo",
        "kingsideAttack",
        "pin",
        "promotion",
        "queensideAttack",
        "quietMove",
        "sacrifice",
        "skewer",
        "trappedPiece",
        "underPromotion",
        "xRayAttack",
        "zugzwang",
        "mate",
        "backRankMate",
        "smotheredMate",
        "anastasiaMate",
        "arabianMate",
        "bodenMate",
        "doubleBishopMate",
        "dovetailMate",
        "hookMate",
        "operaMate",
        "vukovicMate",
    }
)


def evaluate(conn: db.Connection, limit: int | None = None) -> dict:
    """Score `in_line` -- the tagger that names your mistakes -- against Lichess's labels.

    The stored puzzles are ground truth: a few hundred thousand positions a different tagger
    has already named. Running ours over them says, per motif, how often it is right when it
    speaks (precision) and how often it speaks when it should (recall), and which of their
    motifs ours has no rule for at all. Without this there is no way to tell whether a new
    rule helps, or whether an untagged mistake is a tagger gap or simply has no tactic.

    `in_line`, not `motif`, because that is what `deepen` uses on a real mistake: the first
    tactic the solver carries out within DEEP_PLIES."""
    sql = "SELECT fen, moves, themes FROM lichess_puzzles"
    rows = conn.execute(sql + (f" LIMIT {int(limit)}" if limit else "")).fetchall()
    tp = {m: 0 for m in THEMES}
    fp = {m: 0 for m in THEMES}
    fn = {m: 0 for m in THEMES}
    silent_on = {}  # their motif, on puzzles where we found nothing: what to add a rule for
    confused = {}  # our motif -> what they called it instead, when we were wrong
    scored = 0
    for r in rows:
        moves = r["moves"].split()
        try:
            board = chess.Board(r["fen"])
            board.push(chess.Move.from_uci(moves[0]))
            line = [chess.Move.from_uci(m) for m in moves[1:]]
        except (ValueError, AssertionError, IndexError):
            continue
        scored += 1
        theirs = set(r["themes"].split()) & THEIR_MOTIFS
        ours = in_line(board, line)
        if ours:
            (tp if ours in theirs else fp)[ours] += 1
        for m in theirs & set(THEMES):
            if m != ours:
                fn[m] += 1
        if ours is None:
            for m in theirs - set(THEMES):
                silent_on[m] = silent_on.get(m, 0) + 1
        elif ours not in theirs:
            got = confused.setdefault(ours, {})
            for m in theirs or {"(nothing tactical)"}:
                got[m] = got.get(m, 0) + 1

    def rate(a, b):
        return round(a / b, 3) if b else None

    motifs = [
        {
            "motif": m,
            "found": tp[m] + fp[m],
            "theirs": tp[m] + fn[m],
            "precision": rate(tp[m], tp[m] + fp[m]),
            "recall": rate(tp[m], tp[m] + fn[m]),
        }
        for m in THEMES
    ]
    return {
        "scored": scored,
        "named": sum(tp.values()) + sum(fp.values()),
        "right": sum(tp.values()),
        "motifs": sorted(motifs, key=lambda d: -d["theirs"]),
        "silent_on": dict(sorted(silent_on.items(), key=lambda kv: -kv[1])),
        "confused": {k: dict(sorted(v.items(), key=lambda kv: -kv[1])[:6]) for k, v in confused.items()},
    }


def counts_by_kind(conn, since: str | None) -> list[db.Row]:
    """How many of your tagged moves in rated games since `since` (None: all time) carry
    each pattern, by kind (blunder, mistake, miss)."""
    return conn.execute(
        f"""SELECT m.pattern, m.classification AS kind, count(*) AS n FROM moves m
            JOIN games g ON g.id = m.game_id
            WHERE m.is_user AND g.rated AND m.pattern IS NOT NULL
              {"AND g.played_at >= %s" if since else ""}
            GROUP BY m.pattern, m.classification""",
        (since,) if since else (),
    ).fetchall()


def most_common(conn) -> str | None:
    """Your most common named tactic over every game, if any is tagged yet."""
    row = conn.execute(
        """SELECT pattern FROM moves WHERE is_user AND pattern IS NOT NULL
             AND pattern <> ALL(%s) GROUP BY pattern ORDER BY count(*) DESC LIMIT 1""",
        (list(NAMELESS),),
    ).fetchone()
    return row["pattern"] if row else None


def most_common_rated(conn, since: str) -> tuple[db.Row | None, int]:
    """Your most common named tactic in rated games since `since` (pattern, n), if any, and
    how many of your moves there carry any tag."""
    top = conn.execute(
        """SELECT m.pattern, count(*) AS n FROM moves m JOIN games g ON g.id = m.game_id
           WHERE m.is_user AND g.rated AND g.played_at >= %s
             AND m.pattern IS NOT NULL AND m.pattern <> ALL(%s)
           GROUP BY m.pattern ORDER BY n DESC LIMIT 1""",
        (since, list(NAMELESS)),
    ).fetchone()
    tagged = conn.execute(
        """SELECT count(*) AS n FROM moves m JOIN games g ON g.id = m.game_id
           WHERE m.is_user AND g.rated AND g.played_at >= %s AND m.pattern IS NOT NULL""",
        (since,),
    ).fetchone()["n"]
    return top, tagged
