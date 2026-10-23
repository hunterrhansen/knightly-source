"""Coaching explanations: why a wrong first move fails, and why the solution works.

Every sentence is a fixed template filled with facts the engine's own search or the board's
geometry established: a mate score, the material the engine's line wins, or a tactic
`patterns.motif` names. Nothing is claimed that replaying the stored line can't check, and
when no fact holds there is no explanation (the app shows its plain verdict).

`refutation` explains a wrong move from the search that graded it (practice_grades already
runs one per legal first move), so it costs no extra engine time. `why` explains a solution
line with board geometry only.
"""

import chess
import chess.engine

from .analyze import MATE_CP
from .patterns import VALUES, _skewer, _targets, _value, motif

REFUTE_PLIES = 6  # how far into the engine's reply line material is counted
MINOR = 3  # a tactic is only named when its line wins at least a minor piece
TAKE_OVER_CP = -100  # "they take over": the learner is at least this far behind afterwards
NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}
TACTICS = ("fork", "pin", "skewer", "discoveredAttack")


def _name(piece_type) -> str:
    return NAMES[piece_type]


def _pair(types) -> str:
    """'king and queen': the two most valuable, most valuable first."""
    names = [_name(t) for t in sorted(types, key=lambda t: -VALUES[t])[:2]]
    return " and ".join(names)


def _walk(board: chess.Board, moves: list[chess.Move], limit: int | None = None):
    """Play `moves` from `board` (stopping at an illegal one) and tally captures: per side,
    the value taken (promotions count as the piece gained) and the piece types taken.
    Continues past `limit` while captures keep trading, so a recapture is never cut off."""
    b = board.copy()
    gained = {chess.WHITE: 0, chess.BLACK: 0}
    taken = {chess.WHITE: [], chess.BLACK: []}
    for i, move in enumerate(moves):
        if move not in b.legal_moves:
            break
        if limit is not None and i >= limit and not (b.move_stack and b.is_capture(move) and _was_capture(b)):
            break
        side = b.turn
        if b.is_capture(move):
            victim = chess.PAWN if b.is_en_passant(move) else b.piece_type_at(move.to_square)
            gained[side] += VALUES[victim]
            taken[side].append(victim)
        if move.promotion:
            gained[side] += VALUES[move.promotion] - VALUES[chess.PAWN]
        b.push(move)
    return b, gained, taken


def _was_capture(b: chess.Board) -> bool:
    last = b.pop()
    try:
        return b.is_capture(last)
    finally:
        b.push(last)


def _won(net: int, taken: list[int], lost: list[int]) -> str | None:
    """'the queen', 'a rook', 'the exchange', 'material': what a net gain of `net` points,
    having taken `taken` and lost `lost`, amounts to. None when nothing was won."""
    if net <= 0:
        return None
    fits = [t for t in taken if VALUES[t] <= net and t != chess.KING]
    if fits:
        best = max(fits, key=lambda t: VALUES[t])
        return "the queen" if best == chess.QUEEN else f"a {_name(best)}"
    if chess.ROOK in taken and any(t in (chess.KNIGHT, chess.BISHOP) for t in lost):
        return "the exchange"
    return "material"


def refutation(board: chess.Board, uci: str, info: dict) -> dict | None:
    """Why `uci` (a legal move of the side to move in `board`, graded wrong) fails, from
    `info`: the engine search of the position after it. None when the search has no line."""
    learner = board.turn
    move = chess.Move.from_uci(uci)
    after = board.copy()
    after.push(move)
    pv = info.get("pv") or []
    if not pv or pv[0] not in after.legal_moves or "score" not in info:
        return None
    reply = pv[0]
    reply_san = after.san(reply)
    out = {"reply_uci": reply.uci(), "reply_san": reply_san}
    score = info["score"].pov(learner)
    mate = score.mate()
    if mate is not None and mate < 0:
        text = f"This allows mate: {reply_san}." if mate == -1 else f"This walks into mate in {-mate}."
        return {**out, "reason_kind": "mate", "reason_text": text}

    # Your move's own capture counts too: Bxf7+ Kxf7 gives a bishop for a pawn.
    _, gained, taken = _walk(board, [move, *pv], REFUTE_PLIES + 1)
    them = not learner
    net = gained[them] - gained[learner]
    lost = _won(net, taken[them], taken[learner])
    found = motif(after, reply)
    if found in TACTICS and net >= MINOR:
        text = _tactic_against(after, reply, found, reply_san)
        if text:
            return {**out, "reason_kind": found, "reason_text": text}
    if lost:
        kind = "hangingPiece" if found == "hangingPiece" else "material"
        if lost == "material":
            text = f"That loses material to {reply_san}."
        elif lost == "the exchange":
            text = f"That loses the exchange to {reply_san}."
        else:
            text = f"That drops your {lost.split(' ', 1)[1]} to {reply_san}."
        return {**out, "reason_kind": kind, "reason_text": text}
    cp = score.score(mate_score=MATE_CP)
    if cp is not None and cp <= TAKE_OVER_CP:
        return {**out, "reason_kind": "eval", "reason_text": f"That lets them take over after {reply_san}."}
    return {**out, "reason_kind": "eval", "reason_text": None}


def _tactic_against(after: chess.Board, reply: chess.Move, kind: str, reply_san: str) -> str | None:
    """'{reply} forks your king and queen.' and the like, for the learner's pieces."""
    victim = not after.turn
    b = after.copy()
    b.push(reply)
    if kind == "fork":
        hit = [b.piece_type_at(sq) for sq in _targets(b, reply.to_square, victim)]
        return f"{reply_san} forks your {_pair(hit)}." if len(hit) >= 2 else None
    if kind == "pin":
        pinned = _new_pin(after, b, victim)
        return f"{reply_san} pins your {_name(pinned)} to your king." if pinned else None
    if kind == "skewer":
        behind = _skewered(b, reply.to_square, victim)
        return f"{reply_san} skewers your king and {_name(behind)}." if behind else None
    if kind == "discoveredAttack":
        target = _uncovered(after, b, reply, victim)
        return f"{reply_san} uncovers an attack on your {_name(target)}." if target else None
    return None


def _new_pin(before: chess.Board, after: chess.Board, side: chess.Color):
    """The most valuable piece of `side` pinned to its king in `after` but not `before`."""
    found = [
        after.piece_type_at(sq)
        for sq in chess.SquareSet(after.occupied_co[side])
        if after.piece_type_at(sq) != chess.KING
        and after.is_pinned(side, sq)
        and not before.is_pinned(side, sq)
        and _value(after.piece_at(sq)) >= MINOR
    ]
    return max(found, key=lambda t: VALUES[t]) if found else None


def _skewered(b: chess.Board, square: chess.Square, side: chess.Color):
    """The piece behind `side`'s king on the line the slider on `square` checks along."""
    if not _skewer(b, square, side):
        return None
    king = b.king(side)
    df = chess.square_file(king) - chess.square_file(square)
    dr = chess.square_rank(king) - chess.square_rank(square)
    step_f, step_r = (df > 0) - (df < 0), (dr > 0) - (dr < 0)
    f, r = chess.square_file(king) + step_f, chess.square_rank(king) + step_r
    while 0 <= f < 8 and 0 <= r < 8:
        piece = b.piece_at(chess.square(f, r))
        if piece:
            return piece.piece_type
        f, r = f + step_f, r + step_r
    return None


def _uncovered(before: chess.Board, after: chess.Board, move: chess.Move, side: chess.Color):
    """The most valuable piece of `side` (rook or more) that a piece other than the mover
    attacks after `move` and didn't before: the target of a discovered attack."""
    me = not side

    def hit(b, mover):
        return {
            sq
            for sq in chess.SquareSet(b.occupied_co[side])
            if _value(b.piece_at(sq)) >= 5 and any(a != mover for a in b.attackers(me, sq))
        }

    new = hit(after, move.to_square) - hit(before, move.from_square)
    return max((after.piece_type_at(sq) for sq in new), key=lambda t: VALUES[t]) if new else None


def why(fen: str, line: list[str], mate_before: int | None = None) -> dict | None:
    """Why the solution `line` (UCI from `fen`, learner moves at even indexes) works: mate,
    the learner's first tactic in it, or the material it wins. `mate_before` is White's
    mate-in-N in `fen`, when the engine found one. None when no fact holds."""
    board = chess.Board(fen)
    learner = board.turn
    try:
        moves = [chess.Move.from_uci(u) for u in line]
    except ValueError:
        return None
    final, gained, taken = _walk(board, moves)
    if len(final.move_stack) - len(board.move_stack) != len(moves):
        return None  # the line doesn't replay
    learner_moves = (len(moves) + 1) // 2
    sign = 1 if learner == chess.WHITE else -1
    if final.is_checkmate():
        text = "Checkmate." if learner_moves == 1 else f"Mate in {learner_moves}."
        return {"why_kind": "mate", "why_text": text}
    if mate_before is not None and sign * mate_before > 0:
        return {"why_kind": "mate", "why_text": f"Mate in {sign * mate_before}."}

    b = board.copy()
    for i, move in enumerate(moves):
        if i % 2 == 0:
            found = motif(b, move)
            text = _tactic_for(b, move, found) if found else None
            if text:
                return {"why_kind": found, "why_text": text}
        b.push(move)

    them = not learner
    net = gained[learner] - gained[them]
    last = moves[-1]
    # The line ends on the learner's move: a capture there only counts if it can't be retaken.
    banked = not final.move_stack or not _was_capture(final) or not final.is_attacked_by(them, last.to_square)
    won = _won(net, taken[learner], taken[them]) if banked else None
    if won and won != "material":
        return {"why_kind": "material", "why_text": f"This wins {won}."}
    return None


def _tactic_for(b: chess.Board, move: chess.Move, kind: str) -> str | None:
    """'Fork: the knight hits king and queen.' and the like, for the learner's move."""
    if kind not in TACTICS and kind != "hangingPiece":
        return None
    them = not b.turn
    piece = _name(b.piece_type_at(move.from_square))
    after = b.copy()
    after.push(move)
    if kind == "fork":
        hit = [after.piece_type_at(sq) for sq in _targets(after, move.to_square, them)]
        return f"Fork: the {piece} hits {_pair(hit)}." if len(hit) >= 2 else None
    if kind == "pin":
        pinned = _new_pin(b, after, them)
        return f"Pin: the {piece} pins the {_name(pinned)} to the king." if pinned else None
    if kind == "skewer":
        behind = _skewered(after, move.to_square, them)
        return f"Skewer: the {piece} hits the king and the {_name(behind)} behind it." if behind else None
    if kind == "discoveredAttack":
        target = _uncovered(b, after, move, them)
        return f"Discovered attack: moving the {piece} uncovers an attack on the {_name(target)}." if target else None
    victim = chess.PAWN if b.is_en_passant(move) else b.piece_type_at(move.to_square)
    return f"The {_name(victim)} was there for the taking." if victim and victim != chess.PAWN else None


def missed(reason: dict, solution: dict | None, info: dict, learner: chess.Color) -> dict:
    """Turn an 'eval' reason into 'missed' when the move loses nothing but the solution wins
    something: point at it without naming the move."""
    if reason.get("reason_kind") != "eval" or not solution:
        return reason
    cp = info["score"].pov(learner).score(mate_score=MATE_CP)
    if cp is None or cp <= TAKE_OVER_CP:
        return reason
    look = (
        "Look for a way to give mate."
        if solution["why_kind"] == "mate"
        else "Look for a way to win material."
        if solution["why_kind"] in ("material", "hangingPiece")
        else "Look for a tactic."
    )
    return {**reason, "reason_kind": "missed", "reason_text": f"Safe, but there’s a stronger move here. {look}"}


def explain_wrong(board: chess.Board, uci: str, info: dict, solution: dict | None) -> dict | None:
    """The full explanation for a wrong first move, or None when there's nothing to say."""
    reason = refutation(board, uci, info)
    if reason is None:
        return None
    reason = missed(reason, solution, info, board.turn)
    return reason if reason["reason_text"] else None
