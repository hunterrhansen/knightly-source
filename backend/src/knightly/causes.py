"""Blunder causes, candidate moves and principles (docs/specs/2026-10-16-blunder-causes-design.md).

A cause says why the learner missed what a bad move allows, from their side: they were already
threatening it (missedThreat), the king had no escape off the back rank (backRank), or the move
left a piece loose (loosePiece). Candidates are the top engine moves with a reason each. Both
are fixed templates filled with facts of stored engine lines and board geometry: this module
never runs a search, so a GET can build them from what workers stored.
"""

import chess

from .analyze import MATE_CP, win_pct
from .explain import REFUTE_PLIES, _walk, _won, why
from .patterns import TARGET, VALUES, _back_rank
from .positional import reason as positional_reason
from .threats import LOSS

EQUAL_CP = 30  # candidates 2-3 within this many centipawns of the best are "about as good"
AHEAD = 2  # material lead (points) from which trading down is a reason
MAX_TEXT = 120  # the coach bubble's two body lines
NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}


def _fits(text: str) -> str | None:
    return text if len(text) <= MAX_TEXT else None


def _moves(board: chess.Board, ucis: list[str]) -> list[chess.Move]:
    """The UCI moves that replay legally from `board`, up to the first that doesn't."""
    out, b = [], board.copy()
    for uci in ucis:
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            break
        if move not in b.legal_moves:
            break
        out.append(move)
        b.push(move)
    return out


def _net(board: chess.Board, line: list[chess.Move]) -> int:
    """What the side to move in `board` nets over `line`, recaptures followed."""
    _, gained, _ = _walk(board, line, REFUTE_PLIES)
    return gained[board.turn] - gained[not board.turn]


# Causes


def _missed_threat(board, threat_set, reply, they_mate, after, line):
    """Rule 1: the punishing reply is a threat that stood before the move."""
    if not threat_set or reply is None:
        return None
    threat = next((t for t in threat_set if t.get("uci") == reply.uci()), None)
    if threat is None or not (they_mate or _net(after, line) >= LOSS):
        return None
    san = after.san(reply)
    if threat.get("mate"):
        return f"They were threatening mate with {san}, and your move didn't stop it."
    passed = board.copy()
    passed.push(chess.Move.null())
    threat_line = _moves(passed, threat.get("line") or [threat["uci"]])
    _, gained, taken = _walk(passed, threat_line, REFUTE_PLIES)
    them = passed.turn
    won = _won(gained[them] - gained[not them], taken[them], taken[not them])
    if won and won not in ("material", "the exchange"):
        return f"They were already threatening {san} to win your {won.split(' ', 1)[1]}. Your move didn't stop it."
    return f"They were already threatening {san}. Your move didn't stop it."


def _back_rank_mate(after, line, they_mate):
    """Rule 2: the refutation mates the learner's king along its home rank."""
    if not they_mate or not line:
        return None
    b = after.copy()
    for move in line:
        b.push(move)
        if b.is_checkmate():
            break
    if not b.is_checkmate() or not _back_rank(b):
        return None
    san = after.san(line[0])
    if they_mate == 1:
        return f"Your king had no escape square off the back rank: {san} is mate."
    return f"Your king had no escape square off the back rank, so {san} leads to mate."


def loose(board: chess.Board, square: chess.Square):
    """Why the piece on `square` is loose, with the opponent to move or not: ("undefended",),
    ("cheaper", attacker type) or ("outnumbered", attackers, defenders); None when it isn't
    (or isn't attacked, or is a pawn or the king). Counts only: x-rays and pins are ignored."""
    piece = board.piece_at(square)
    if piece is None or piece.piece_type == chess.KING or VALUES[piece.piece_type] < TARGET:
        return None
    attackers = board.attackers(not piece.color, square)
    if not attackers:
        return None
    defenders = board.attackers(piece.color, square)
    if not defenders:
        return ("undefended",)
    cheapest = min((board.piece_type_at(sq) for sq in attackers), key=lambda t: VALUES[t])
    if VALUES[cheapest] < VALUES[piece.piece_type]:
        return ("cheaper", cheapest)
    if len(attackers) > len(defenders):
        return ("outnumbered", len(attackers), len(defenders))
    return None


def _times(n: int) -> str:
    return {1: "once", 2: "twice"}.get(n, f"{n} times")


def _taken(after: chess.Board, line: list[chess.Move], square: chess.Square) -> bool:
    """Whether the refutation's prefix captures the piece standing on `square`."""
    b = after.copy()
    for i, move in enumerate(line):
        if i >= REFUTE_PLIES:
            break
        if b.turn != after.turn and move.from_square == square:
            return False  # the piece moved away first
        if b.turn == after.turn and move.to_square == square and b.is_capture(move):
            return True
        b.push(move)
    return False


def _loose_piece(board, move, after, line):
    """Rule 3: the move left a piece loose and the refutation takes it, netting LOSS."""
    if not line or _net(after, line) < LOSS:
        return None
    learner = board.turn
    found = []
    for sq in chess.SquareSet(after.occupied_co[learner]):
        why_loose = loose(after, sq)
        if not why_loose or not _taken(after, line, sq):
            continue
        mover = sq == move.to_square
        if loose(board, move.from_square if mover else sq):
            continue  # already loose before: the move didn't cause it
        found.append((VALUES[after.piece_type_at(sq)], sq, mover, why_loose))
    if not found:
        return None
    _, sq, mover, why_loose = max(found)
    piece, name, reply = NAMES[after.piece_type_at(sq)], chess.square_name(sq), after.san(line[0])
    if why_loose[0] == "cheaper":
        return f"Your {piece} on {name} can be taken by a {NAMES[why_loose[1]]}, so {reply} wins it."
    if why_loose[0] == "outnumbered":
        return (
            f"Your {piece} on {name} is attacked {_times(why_loose[1])} and defended "
            f"{_times(why_loose[2])}, so {reply} wins it."
        )
    if mover:
        return f"Your {piece} on {name} has no defender there, so {reply} takes it."
    if board.attackers(learner, sq) == chess.SquareSet([move.from_square]):
        mover_name = NAMES[board.piece_type_at(move.from_square)]
        return f"Moving your {mover_name} left your {piece} on {name} undefended, so {reply} takes it."
    return f"Your {piece} on {name} is undefended, so {reply} takes it."


def cause(
    board: chess.Board, uci: str, threat_set: list[dict] | None, refutation: list[str] | None, they_mate: int | None
) -> dict | None:
    """Why the learner missed what `uci` (from `board`, learner to move) allows:
    {cause_kind, cause_text, reply_uci, reply_san, principle}, or None. `threat_set` is the
    threat search before the move (threats.search; None when unknown); `refutation` the
    engine's line after it (UCI); `they_mate` the opponent's mate-in-N there, if any."""
    move = chess.Move.from_uci(uci)
    if move not in board.legal_moves or not refutation:
        return None
    after = board.copy()
    after.push(move)
    line = _moves(after, refutation)
    if not line:
        return None
    they_mate = they_mate if they_mate and they_mate > 0 else None
    for kind, text in (
        ("missedThreat", lambda: _missed_threat(board, threat_set, line[0], they_mate, after, line)),
        ("backRank", lambda: _back_rank_mate(after, line, they_mate)),
        ("loosePiece", lambda: _loose_piece(board, move, after, line)),
    ):
        found = _fits(text() or "")
        if found:
            return {
                "cause_kind": kind,
                "cause_text": found,
                "reply_uci": line[0].uci(),
                "reply_san": after.san(line[0]),
                "principle": principle(None, kind),
            }
    return None


def principle(layer: str | None, cause_kind: str | None = None, reason_kind: str | None = None) -> str | None:
    """The principle a mistake shows: from its cause first, then its layer, then a hanging-piece
    reason (practice moves have no layer)."""
    if cause_kind == "missedThreat":
        return "blunderCheck"
    if cause_kind == "backRank":
        return "backRank"
    if cause_kind == "loosePiece" or (cause_kind is None and reason_kind == "hangingPiece"):
        return "loosePieces"
    return {
        "theirThreat": "blunderCheck",
        "theirReply": "checkReplies",
        "ownTactic": "forcingFirst",
        "calculation": "checkTheEnd",
    }.get(layer)


def for_game_move(fen: str, uci: str, layer: str | None, facts: dict | None) -> dict | None:
    """A game move's cause from the layer step's stored facts (moves.cause_facts): only for
    layer-0 mistakes, whose threat set and refutation were searched to full depth."""
    if layer not in ("theirThreat", "theirReply") or not facts or not facts.get("refutation"):
        return None
    board = chess.Board(fen)
    refutation = facts["refutation"]
    mate = refutation.get("mate")
    learner = board.turn
    # Stored for White; the opponent mates when the sign is theirs.
    they_mate = abs(mate) if mate is not None and (mate > 0) != (learner == chess.WHITE) else None
    found = cause(board, uci, facts.get("threats") or [], refutation.get("line"), they_mate)
    if found is None:
        return None
    return {k: found[k] for k in ("cause_kind", "cause_text", "reply_uci", "reply_san")}


# Candidates


def _material(board: chess.Board, side: chess.Color) -> int:
    return sum(
        VALUES[p.piece_type] for p in board.piece_map().values() if p.color == side and p.piece_type != chess.KING
    )


def _eval_text(cp: int) -> str:
    pawns = round(cp / 100, 1) or 0.0  # never "-0.0"
    chip = f"{'+' if pawns > 0 else ''}{pawns:.1f}"
    if cp >= 100:
        return f"Keeps you ahead ({chip})."
    if cp <= -100:
        return f"Holds on best ({chip})."
    return f"Keeps it level ({chip})."


def _about_equal(a: dict, b: dict) -> bool:
    if a["mate"] is not None or b["mate"] is not None:
        return False
    if abs(a["score_cp"] - b["score_cp"]) <= EQUAL_CP:
        return True
    from .deck import GOOD_DROP

    return (
        min(abs(a["score_cp"]), abs(b["score_cp"])) > 500
        and abs(win_pct(a["score_cp"]) - win_pct(b["score_cp"])) <= GOOD_DROP
    )


def _reason(board: chess.Board, line: list[chess.Move], mate: int | None, threat_set: list[dict]) -> tuple[str, str]:
    learner = board.turn
    white_mate = None if mate is None else (mate if learner == chess.WHITE else -mate)
    ucis = [m.uci() for m in line]
    # A tactic is named only for the candidate's own move: the engine line's later
    # moves are not what the learner would play. Mate and material count the whole line.
    told = why(board.fen(), ucis[:1], None)
    if not told:
        told = why(board.fen(), ucis, white_mate if mate and mate > 0 else None)
        if told and told["why_kind"] not in ("mate", "material"):
            told = None
    if told:
        return told["why_kind"], told["why_text"]
    # Their net over the line is minus the learner's.
    if threat_set and not (mate is not None and mate < 0) and -_net(board, line) < LOSS:
        return "defends", f"Stops their threat {threat_set[0]['san']}."
    if (
        _material(board, learner) - _material(board, not learner) >= AHEAD
        and len(line) >= 2
        and board.is_capture(line[0])
    ):
        after = board.copy()
        after.push(line[0])
        first = board.piece_type_at(line[0].to_square)
        second = after.piece_type_at(line[1].to_square) if after.is_capture(line[1]) else None
        if first and second and VALUES[first] == VALUES[second]:
            return "trade", f"Trades {NAMES[first]}s while you're ahead."
    # No tactic and nothing material: say what the move does to the position instead. Falling
    # straight through to "eval" printed the engine's number, which is the one thing the
    # learner could already read for themselves.
    if found := positional_reason(board, line[0]):
        return found
    return "eval", ""


def candidates(board: chess.Board, infos: list[dict], depth: int, threat_set: list[dict] | None) -> list[dict] | None:
    """Up to three top moves (a MultiPV root search from `board`, learner to move) with a reason
    each, best first. Capped lines are dropped; None with fewer than two left."""
    learner = board.turn
    out = []
    for info in infos:
        pv = info.get("pv") or []
        if info.get("depth", 0) < depth or "score" not in info or not pv or pv[0] not in board.legal_moves:
            continue
        line = _moves(board, [m.uci() for m in pv[:REFUTE_PLIES]])
        score = info["score"].pov(learner)
        mate = score.mate()
        kind, text = _reason(board, line, mate, threat_set or [])
        out.append(
            {
                "uci": line[0].uci(),
                "san": board.san(line[0]),
                "line": [m.uci() for m in line],
                "score_cp": score.score(mate_score=MATE_CP),
                "mate": mate,
                "reason_kind": kind,
                "reason_text": text,
                "about_equal": False,
            }
        )
    if len(out) < 2:
        return None
    best = out[0]
    for c in out[1:]:
        c["about_equal"] = _about_equal(best, c)
        if c["about_equal"] and c["reason_kind"] == "eval":
            c["reason_text"] = f"About as good as {best['san']}."
    for c in out:
        if c["reason_kind"] == "eval" and not c["reason_text"]:
            c["reason_text"] = f"Mate in {c['mate']}." if c["mate"] and c["mate"] > 0 else _eval_text(c["score_cp"])
    return [c for c in out[:3] if _fits(c["reason_text"])]
