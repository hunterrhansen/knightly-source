"""Your games: the list, one game's review, its engine lines, exploring a position from it, and
finishing a review."""

import json
from datetime import UTC, datetime

import chess
import chess.engine
from fastapi import APIRouter, Depends, HTTPException, Query

from .. import (
    causes,
    daily,
    db,
    deck,
    game_facts,
    layers,
    lines,
    players,
    positions,
    watch,
)
from ..analyze import find_engine
from ..game_facts import KPI_FILTERS, game_json, period_bounds
from ..schemas import (
    EngineLinesOut,
    GameDetailOut,
    GamesListOut,
    PositionPreviewIn,
    PositionPreviewOut,
    ReviewedOut,
    ReviewIn,
)
from ..web import Context

PAGE_SIZE = 50


def _needs_review(r) -> bool:
    return r["analysed"] and r["user_color"] in ("white", "black") and not r["reviewed_at"]


def _list_filters(q, speed, color, range, analysed, unrated) -> tuple[list[str], list]:
    """The games list's search and Filters popover, as conditions on game_facts rows."""
    where, params = ["TRUE"], []
    if q:
        where.append("(f.opponent ILIKE %s OR f.opening ILIKE %s OR f.eco ILIKE %s)")
        params += [f"%{q}%"] * 3
    if speed:
        where.append("f.speed = %s")
        params.append(speed)
    if color:
        where.append("f.user_color = %s")
        params.append(color)
    start, _, _ = period_bounds(range)
    if start:
        where.append("f.played_at >= %s")
        params.append(start)
    if analysed:
        where.append("f.analysed")
    if not unrated:
        where.append("f.rated")
    return where, params


def _quick_filters(where, params, kpi, result) -> tuple[list[str], list]:
    """`where` narrowed by the quick filters on top of the list: a KPI and the result."""
    where, params = [*where], [*params]
    if kpi:
        where.append(KPI_FILTERS[kpi])
    if result:
        where.append("f.user_outcome = %s")
        params.append(result)
    return where, params


def _quick_counts(rows) -> dict[str, int]:
    """Each quick filter's number for the list as searched and filtered."""
    return {
        "all": len(rows),
        "to_review": sum(1 for r in rows if _needs_review(r)),
        "wins": sum(1 for r in rows if r["user_outcome"] == "win"),
        "losses": sum(1 for r in rows if r["user_outcome"] == "loss"),
        "blunders": sum(1 for r in rows if (r["blunders"] or 0) > 0),
        "thrown": sum(1 for r in rows if r["was_winning"] and r["user_outcome"] == "loss"),
    }


def _by_review_status(rows, status: str | None) -> list:
    if status == "to_review":
        return [r for r in rows if _needs_review(r)]
    if status == "reviewed":
        return [r for r in rows if r["reviewed_at"]]
    return rows


def _by_slips(rows, slips: dict[int, dict | None], scope: str | None) -> list:
    """Games with moves that slipped past you, or analysed games with none (Clean). Games
    still being analysed are in neither."""
    if scope == "slipped":
        return [r for r in rows if slips[r["id"]] and sum(slips[r["id"]].values()) > 0]
    if scope == "clean":
        return [r for r in rows if slips[r["id"]] is not None and sum(slips[r["id"]].values()) == 0]
    return rows


def _over(board: chess.Board) -> bool:
    return board.is_game_over() or board.is_repetition(3) or board.is_fifty_moves()


def _played_out(fen: str, moves: list[str]) -> chess.Board:
    """`fen` with `moves` played. ValueError unless the position is valid and each move is
    legal in a position that isn't over."""
    board = chess.Board(fen)
    if not board.is_valid():
        raise ValueError("invalid position")
    for uci in moves:
        if _over(board):
            raise ValueError("the position is over")
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            raise ValueError("illegal move")
        board.push(move)
    return board


def _preview(board: chess.Board) -> dict:
    """One bounded Stockfish preview. Terminal positions need no process, including
    repetition in the supplied history."""
    if _over(board):
        return lines.preview(board, None)
    with chess.engine.SimpleEngine.popen_uci(find_engine(None)) as engine:
        engine.configure({"Threads": 1, "Hash": 32})

        def analyse(position):
            info = engine.analyse(position, chess.engine.Limit(depth=18, nodes=250_000, time=1.5))
            return info["score"], info.get("pv", [])

        return lines.preview(board, analyse)


def _compute_lines(ctx: Context, game_id: int, ply: int, depth: int, fen: str, move) -> dict:
    """One move's lines from Stockfish, counted against the engine quota, then kept in the
    engine_lines table."""
    ctx.engine_quota()
    try:
        with lines.Engine(depth) as engine:
            data = lines.compute(fen, move["uci"], lines.answerer(move), engine)
    except SystemExit as e:  # Stockfish not installed
        raise HTTPException(503, str(e)) from None
    with ctx.connect() as conn, conn:
        lines.save(conn, game_id, ply, depth, data)
    return data


def _game_detail(conn, game_id: int) -> dict:
    rows = game_facts.rows(conn, "f.id = %s", (game_id,))
    if not rows:
        raise HTTPException(404, "game not found")
    g = game_facts.game_record(conn, game_id)
    a = game_facts.game_accuracy(conn, game_id)
    deck_plies = deck.game_plies(conn, game_id)
    marks = game_facts.review_marks(conn, game_id)
    moves = game_facts.game_moves(conn, game_id)
    fens = positions.fens(conn, [game_id]) if any(m["cause_facts"] for m in moves) else {}
    return {
        **game_json(rows[0]),
        "account": g["account"],
        "user_avatar": players.avatar(conn, g["source"], g["account"]),
        "white": g["white"],
        "black": g["black"],
        "white_elo": g["white_elo"],
        "black_elo": g["black_elo"],
        "start_fen": g["start_fen"],
        # Always present, so unanalysed games can still be stepped through.
        "san": (g["moves_san"] or "").split(),
        "engine_accuracy": a["user_accuracy"] if a else None,
        "opponent_accuracy": a["opponent_accuracy"] if a else None,
        # layer: which habit or skill a mistake of yours came from (layers.py); null when
        # none holds, not settled yet, or a search was capped.
        # cause: why you missed what your move allowed (causes.py, from the layer step's
        # stored lines; no search); principle: the habit to work on, from cause and layer.
        "plies": [_ply_json(m, fens.get((game_id, m["ply"]))) for m in moves],
        # Your moves from this game that are review-deck positions (or will be once the
        # deck next syncs): the review lesson asks you to find these.
        "deck_plies": deck_plies,
        # Those already in the deck, with their state on the watch, next due day, label,
        # one-line reason and answers held in a row (watch.deck_cards).
        "deck_cards": watch.deck_cards(conn, game_id),
        # How each step of the last finished review lesson went, if it was saved.
        "review_marks": marks,
    }


def _ply_json(m, fen):
    row = {k: v for k, v in dict(m).items() if k != "cause_facts"}
    layer = m["layer"] if m["layer"] in layers.LAYERS else None
    facts = m["cause_facts"]
    if isinstance(facts, str):
        facts = json.loads(facts)
    found = causes.for_game_move(fen, m["uci"], layer, facts) if fen and m["is_user"] else None
    return {
        **row,
        "layer": layer,
        "cause": found,
        "principle": causes.principle(layer, found["cause_kind"] if found else None),
    }


def _line_routes(ctx: Context) -> APIRouter:
    """Engine lines for a game's moves, and exploring a position from it."""
    api = APIRouter()

    @api.get("/api/games/{game_id}/lines", response_model=dict[str, EngineLinesOut], response_model_exclude_unset=True)
    def game_lines(game_id: int):
        """Every move's "Why" and "Best line" at once, from the lines the game's analysis
        stored (and any deeper ones computed on demand), so review opens them without a
        request per tap. Moves analysed before lines were stored are left out; the app asks
        for those one at a time."""
        with ctx.connect() as conn:
            moves = lines.stored_moves(conn, game_id)
            fens = positions.fens(conn, [game_id]) if moves else {}
            cached = lines.cached(conn, game_id, db.DEFAULT_DEPTH)
        out = {
            m["ply"]: lines.from_analysis(fens[(game_id, m["ply"])], m["uci"], lines.answerer(m), m)
            for m in moves
            if (game_id, m["ply"]) in fens
        }
        out.update(cached)
        return {str(ply): data for ply, data in sorted(out.items())}

    @api.get("/api/games/{game_id}/lines/{ply}", response_model=EngineLinesOut, response_model_exclude_unset=True)
    def engine_lines(game_id: int, ply: int):
        """The "Why" and "Best line" for one move: from the game's stored analysis when it
        has them, else computed with Stockfish (about a second, at depth 18, counted
        against the engine quota) and served from the engine_lines table after that."""
        depth = db.DEFAULT_DEPTH
        with ctx.connect() as conn:
            cached = lines.cached(conn, game_id, depth, ply)
            if ply in cached:
                return cached[ply]
            move = lines.stored_move(conn, game_id, ply)
            fen = positions.fen_before(conn, game_id, ply)
        if not move or not fen:
            raise HTTPException(404, "No analysed move there; run `knightly analyze` first.")
        if move["best_line"] or move["reply_line"]:
            return lines.from_analysis(fen, move["uci"], lines.answerer(move), move)
        return _compute_lines(ctx, game_id, ply, depth, fen, move)

    @api.post(
        "/api/review/position",
        dependencies=[Depends(ctx.engine_quota)],
        response_model=PositionPreviewOut,
        response_model_exclude_unset=True,
    )
    def position_preview(body: PositionPreviewIn):
        """Free review exploration: a legal history, one bounded Stockfish preview."""
        try:
            board = _played_out(body.fen, body.moves)
        except ValueError:
            raise HTTPException(400, "Not a valid position or legal continuation.") from None
        try:
            return _preview(board)
        except (SystemExit, OSError, TimeoutError, chess.engine.EngineError):
            raise HTTPException(503, "Stockfish is unavailable. You can still explore moves.") from None

    return api


def _game_routes(ctx: Context) -> APIRouter:
    """The games list, one game's review and finishing it."""
    api = APIRouter()

    @api.get("/api/games", response_model=GamesListOut)
    def games(
        q: str | None = None,
        speed: str | None = None,
        color: str | None = Query(None, pattern="^(white|black)$"),
        result: str | None = Query(None, pattern="^(win|loss|draw)$"),
        range: str = Query("all", pattern="^(30d|90d|all)$"),
        analysed: bool = False,
        unrated: bool = False,
        kpi: str | None = None,
        to_review: bool = False,
        review_status: str | None = Query(None, pattern="^(to_review|reviewed)$"),
        slips: str | None = Query(None, pattern="^(slipped|clean)$"),
        page: int = Query(1, ge=1),
    ):
        """The games list. Search and the Filters popover narrow the whole list; the quick
        filters on top (result, kpi, to_review) pick within it, and `counts` gives each quick
        filter's number for the list as narrowed. `slips` is the scope: games with moves
        that slipped past you, or analysed games with none (Clean)."""
        if kpi and kpi not in KPI_FILTERS:
            raise HTTPException(400, f"unknown kpi {kpi!r}")
        where, params = _list_filters(q, speed, color, range, analysed, unrated)
        with ctx.connect() as conn, conn:
            # Cards for newly analysed games, so their slips count (cheap when nothing changed).
            deck.refresh(conn)
        with ctx.connect() as conn:
            base = game_facts.rows(conn, " AND ".join(where), params, order="f.played_at DESC NULLS LAST")
            rows = base
            if kpi or result:
                where, params = _quick_filters(where, params, kpi, result)
                rows = game_facts.rows(conn, " AND ".join(where), params, order="f.played_at DESC NULLS LAST")
        review_counts = {
            "all": len(rows),
            "to_review": sum(1 for r in rows if _needs_review(r)),
            "reviewed": sum(1 for r in rows if r["reviewed_at"]),
        }
        next_review = next((r for r in rows if _needs_review(r)), None)
        rows = _by_review_status(rows, "to_review" if to_review else review_status)
        with ctx.connect() as conn:
            if slips:
                by_game = watch.slips(conn, rows)
                rows = _by_slips(rows, by_game, slips)
            page_rows = rows[(page - 1) * PAGE_SIZE : page * PAGE_SIZE]
            if not slips:
                by_game = watch.slips(conn, page_rows)
            week = watch.week(conn)
        return {
            "total": len(rows),
            "page": page,
            "page_size": PAGE_SIZE,
            "counts": _quick_counts(base),
            "games": [{**game_json(r), "slips": by_game[r["id"]]} for r in page_rows],
            "review_counts": review_counts,
            "next_review": game_json(next_review) if next_review is not None else None,
            # The last seven days for the summary card: games, slips and where they are.
            "week": week,
        }

    @api.get("/api/games/{game_id}", response_model=GameDetailOut, response_model_exclude_unset=True)
    def game(game_id: int):
        with ctx.connect() as conn:
            return _game_detail(conn, game_id)

    @api.post("/api/games/{game_id}/review", response_model=ReviewedOut, response_model_exclude_unset=True)
    def finish_review(game_id: int, body: ReviewIn | None = None):
        """Marks a game reviewed ("Finish review"), with how each lesson step went for the
        summary's marks. Finishing again moves the time forward and replaces the marks. Also
        makes sure the game's positions are in the review deck, so the summary can say so."""
        with ctx.connect() as conn, conn:
            if not game_facts.game_exists(conn, game_id):
                raise HTTPException(404, "game not found")
            deck.sync(conn)
            now = db.stamp(datetime.now(UTC))
            game_facts.save_review(
                conn, game_id, now, [m.model_dump() for m in body.marks] if body and body.marks else None
            )
            daily.record(conn, db.today(conn))
        return {"reviewed_at": now}

    return api


def router(ctx: Context) -> APIRouter:
    api = APIRouter()
    api.include_router(_line_routes(ctx))
    api.include_router(_game_routes(ctx))
    return api
