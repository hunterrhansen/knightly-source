"""Skill shape: the five 0-100 scores on the Progress radar (docs/specs/2026-10-11-progress-design.md,
"Skill shape scores"). Each is a plain success rate over a counted sample, in this order:

- safety: games with no `theirThreat` or `theirReply` mistake, of settled games.
- tactics: tactics found in games (the engine's best move carries one and the second-best is
  MISS_DROP win% worse; you played it) plus practice first tries solved, over those chances,
  `ownTactic` misses and practice first tries.
- calculation: your captures and checks that are not recaptures and not mistakes, over those
  plus the ones tagged `calculation`.
- converting / defending: wins once your win% reached 80, saves once it fell to 20.

A mistake counts against the axis its layer names and no other. Below its minimum an axis has
no score (with a reason and its counts), never zero."""

import chess

from . import layers, patterns, positions
from .analyze import MISS_DROP, win_pct

VERSION = 1
AXES = ("safety", "tactics", "calculation", "converting", "defending")
MIN_GAMES = 10
MIN_CHANCES = 20  # tactics: game chances; calculation: forcing starts
SAFETY = ("theirThreat", "theirReply")


def _rate(successes: int, attempts: int, games: int, excluded: int, chances: int | None = None) -> dict:
    """One period of one axis. `chances` is the in-game sample that also needs MIN_CHANCES."""
    reason = (
        "few_games" if games < MIN_GAMES else "few_chances" if chances is not None and chances < MIN_CHANCES else None
    )
    return {
        "score": round(100 * successes / attempts) if reason is None and attempts else None,
        "reason": reason,
        "successes": successes,
        "attempts": attempts,
        "games": games,
        "excluded": excluded,
    }


def _moves(conn, game_ids: list[int]) -> dict[int, list]:
    """Each game's moves in ply order, yours and theirs."""
    by: dict[int, list] = {gid: [] for gid in game_ids}
    if not game_ids:
        return by
    for m in conn.execute(
        """SELECT game_id, ply, color, is_user, san, uci, best_uci, eval_before, eval_second,
                      classification, layer
               FROM moves WHERE game_id = ANY(%s) ORDER BY game_id, ply""",
        (game_ids,),
    ):
        by[m["game_id"]].append(m)
    return by


def _settled(moves: list) -> bool:
    return all(
        m["layer"] not in (None, layers.UNKNOWN)
        for m in moves
        if m["is_user"] and m["classification"] in patterns.KINDS
    )


def _gap(m) -> float | None:
    """How much win% the second-best move would have cost the mover."""
    if m["eval_before"] is None or m["eval_second"] is None:
        return None
    sign = 1 if m["color"] == "white" else -1
    return win_pct(sign * m["eval_before"]) - win_pct(sign * m["eval_second"])


def _forcing_start(m, previous) -> bool:
    """A capture or check of yours that is not a recapture on the square they just captured on."""
    san = m["san"] or ""
    if "x" not in san and "+" not in san and "#" not in san:
        return False
    return not (
        previous is not None
        and "x" in (previous["san"] or "")
        and (previous["uci"] or "")[2:4] == (m["uci"] or "")[2:4]
    )


def _period(conn, rows: list, practice: dict[str, int]) -> dict[str, dict]:
    """All five axes for one period's GAME_FACTS rows (rated games)."""
    analysed = [r for r in rows if r["analysed"]]
    moves = _moves(conn, [r["id"] for r in analysed])
    settled = [gid for gid, ms in moves.items() if _settled(ms)]
    excluded = len(analysed) - len(settled)

    safe = sum(not any(m["is_user"] and m["layer"] in SAFETY for m in moves[gid]) for gid in settled)

    # Tactics you played: only boards for best moves that mattered.
    candidates = [
        m
        for gid in settled
        for m in moves[gid]
        if m["is_user"] and m["best_uci"] and m["uci"] == m["best_uci"] and (_gap(m) or 0) >= MISS_DROP
    ]
    fens = positions.fens(conn, sorted({m["game_id"] for m in candidates}))
    found = 0
    for m in candidates:
        fen = fens.get((m["game_id"], m["ply"]))
        if fen is None:
            continue
        board = chess.Board(fen)
        move = chess.Move.from_uci(m["uci"])
        if move in board.legal_moves and patterns.motif(board, move) is not None:
            found += 1
    missed = sum(bool(m["is_user"]) and m["layer"] == "ownTactic" for gid in settled for m in moves[gid])
    chances = found + missed

    held = failed = 0
    for gid in settled:
        ms = moves[gid]
        for i, m in enumerate(ms):
            if not m["is_user"] or not _forcing_start(m, ms[i - 1] if i else None):
                continue
            if m["classification"] not in patterns.KINDS:
                held += 1
            elif m["layer"] == "calculation":
                failed += 1

    winning = [r for r in analysed if r["was_winning"]]
    lost = [r for r in analysed if r["was_lost"]]
    tactics = _rate(found + practice["first_try"], chances + practice["attempts"], len(settled), excluded, chances)
    tactics["parts"] = {
        "games": {"found": found, "chances": chances},
        "practice": {"solved": practice["first_try"], "tries": practice["attempts"]},
    }
    return {
        "safety": _rate(safe, len(settled), len(settled), excluded),
        "tactics": tactics,
        "calculation": _rate(held, held + failed, len(settled), excluded, held + failed),
        "converting": _rate(sum(r["user_outcome"] == "win" for r in winning), len(winning), len(winning), 0),
        "defending": _rate(sum(r["user_outcome"] != "loss" for r in lost), len(lost), len(lost), 0),
    }


def summarize(conn, current: list, previous: list | None, start: str | None, end: str, prev_start: str | None) -> dict:
    """The radar's five axes for the period from `start` (None: all time) to `end`, each with the
    period of the same length before (`previous` rows; None for all time). A previous score
    shows only when the axis qualifies in both periods."""

    def practice(entries, key=None):
        picked = [e[key] if key else e for e in entries]
        return {
            "attempts": sum(p["attempts"] for p in picked if p),
            "first_try": sum(p["first_try"] for p in picked if p),
        }

    strength = patterns.strength(conn, start, end, prev_start)
    now = _period(conn, current, practice(strength))
    before = _period(conn, previous or [], practice(strength, "previous")) if start and prev_start else None
    axes = []
    for key in AXES:
        axis = {"key": key, **now[key], "previous": None}
        if before is not None:
            prev = before[key]
            if axis["score"] is None:
                prev = {**prev, "score": None}
            prev.pop("parts", None)
            axis["previous"] = prev
        axes.append(axis)
    return {"version": VERSION, "axes": axes}
