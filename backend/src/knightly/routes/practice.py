"""Practice: the review deck and its threat and "Your move" questions."""

import logging
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException, Query, Response

from .. import (
    daily,
    db,
    deck,
    drill,
    extra,
    game_trend,
    jobs,
    mix,
    positions,
    practice_grades,
    practice_lines,
    puzzle_feedback,
    puzzles,
    timing,
    unannounced,
    wards,
    watch,
)
from ..schemas import (
    AnswerIn,
    CardIn,
    DeckAnswerOut,
    DeckOut,
    FeedbackOut,
    HintIn,
    HintOut,
    LearnMoreOut,
    SuspendedCardOut,
    SuspendedOut,
    SuspendIn,
    ThreatAnswerIn,
    ThreatAnswerOut,
    UnannouncedAnswerIn,
    UnannouncedAnswerOut,
)
from ..web import Context

NO_EXTRA = "Start an extra watch first."


def _deck_today(ctx: Context, mode: str) -> dict:
    with ctx.connect() as conn, conn:
        deck.refresh(conn)
        today = db.today(conn)
        # An extra watch (extra.py) shows its own answers, from when it started.
        watching = extra.current(conn, today) if mode == "extra" else None
        if mode == "extra" and watching is None:
            raise HTTPException(409, NO_EXTRA)
        remaining = timing.call("queue", deck.queue, conn, today=today)
        asked = timing.call("drill", drill.plan, conn, today)
        moves = timing.call("unannounced", unannounced.plan, conn, today)
        info = timing.call("stats", deck.stats, conn, today=today, remaining=remaining, asked=asked, moves=moves)
        info["server_day"] = today.isoformat()
        # The ward tonight's new material comes from (wards.py). Never gates a due review.
        info["ward"] = timing.call("ward", lambda c: wards.as_json(wards.current(c)), conn)
        info["games"] = deck.game_counts(conn)
        info["results"] = results = timing.call("results", deck.today_results, conn, today=today)
        if watching:
            # Tonight's first answers in order: the watch's own come after those before it.
            info["results"] = results = results[watching["cards"] :]
        # A move that stopped slipping tonight is named on the Watch page ("Fork stopped
        # slipping"); only those few need their label.
        names = watch.explain(conn, [(r["game_id"], r["ply"]) for r in results if r["stopped"]])
        for r in results:
            r["label"] = names.get((r["game_id"], r["ply"]), {}).get("label")
        info["lesson"] = saved = timing.call("lesson", daily.lesson, conn, today, info)
        # The skill the lesson leans toward today (game_trend.focus), or None.
        info["focus"] = game_trend.focus(conn, today)

        # Each item has a job in the watch's mix (mix.py), by its place in the watch.
        def pick(n: int) -> dict:
            return timing.call(
                "mix", mix.serve, conn, today, n, asked, moves, remaining, extra_watch=watching is not None
            )

        if watching:
            item, info["extra"] = timing.call("extra", extra.serve, conn, today, watching, pick)
        else:
            empty = {"card": None, "threat": None, "move": None, "puzzle": None, "mode": None}
            item = pick(saved["done"]) if saved["done"] < saved["total"] else empty
        info["puzzle"], info["mode"] = item["puzzle"], item["mode"]
        threat_next, move_next = item["threat"], item["move"]
        nxt = [{"game_id": item["card"][0], "ply": item["card"][1]}] if item["card"] else []
        if move_next and move_next["feedback"] is None:
            jobs.enqueue(
                conn,
                "practice",
                {"game_id": move_next["game_id"], "ply": move_next["ply"]},
                priority=practice_grades.PRIORITY,
            )
        if info["puzzle"]:
            # Coaching for the puzzle's wrong first moves comes from the worker.
            info["puzzle"]["feedback"] = puzzle_feedback.cached(conn, info["puzzle"])
            if info["puzzle"]["feedback"] is None:
                jobs.enqueue(conn, "practice", priority=practice_grades.PRIORITY)
        with timing.stage("puzzles"):
            info["puzzles"] = {
                "done": puzzles.done_today(conn, today),
                "session": puzzles.SESSION,
                "available": puzzles.available(conn),
            }
            info["puzzle_results"] = puzzles.today_results(conn, today)[watching["puzzles"] if watching else 0 :]
    card = None
    if nxt:
        with timing.stage("card"):
            card = _deck_card(ctx, nxt[0]["game_id"], nxt[0]["ply"])
    return {**info, "card": card, "threat_item": threat_next, "unannounced_item": move_next}


def _deck_card(ctx: Context, game_id: int, ply: int) -> dict:
    """A review card as the app shows it: the position, its solution and its grade map."""
    with ctx.connect() as conn:
        card = dict(deck.card_row(conn, game_id, ply))
        # Missed again and again: the app opens it with what to look at first.
        card["leech"] = card["lapses"] >= deck.LEECH_LAPSES
        row, fen = practice_grades.load(conn, card["game_id"], card["ply"])
        card["fen_before"] = fen
        # The position before the opponent's last move, so the app can play it in.
        card["fen_prev"] = positions.fen_before(conn, card["game_id"], card["ply"] - 1) if card["ply"] > 1 else None
        card["feedback"] = practice_grades.cached(row, fen) if row else None
        line = practice_lines.line_for(row, fen)
        # The solution goes out with the position so the app answers instantly;
        # the answer endpoint still re-grades what it saves.
        card["line"] = line
        card["line_key"] = practice_lines.key(fen, line)
        # "What do they threaten?" first, when this move ignored a threat.
        card["threat"] = drill.card_threat(conn, card["game_id"], card["ply"])
        # When it comes back for each rating, so the app can say so after the answer.
        card.update(deck.preview(conn, card["game_id"], card["ply"]))
        if card["feedback"] is None:
            jobs.enqueue(
                conn,
                "practice",
                {"game_id": card["game_id"], "ply": card["ply"]},
                priority=practice_grades.PRIORITY,
            )
    return card


def _deck_routes(ctx: Context) -> APIRouter:
    """The review deck: today's cards, hidden cards and polling a card's grades."""
    api = APIRouter()

    @api.get("/api/deck", response_model=DeckOut, response_model_exclude_unset=True)
    def deck_today(
        response: Response,
        mode: str = Query("lesson", pattern="^(lesson|extra)$"),
    ):
        """Tonight's watch: the deck's counts and the watch's next item, by its job in the
        watch's mix (mix.py): a review card, a threat question, a "Your move" or a puzzle (all
        null once the watch is done). Adds cards for newly analysed games first, so the deck
        is always current. `mode=extra` continues tonight's extra watch, the same mix (POST
        /api/lesson/extra starts one; 409 before that)."""
        with timing.collect() as sample:
            with timing.stage("deck_total"):
                result = _deck_today(ctx, mode)
        response.headers["Server-Timing"] = timing.header(sample)
        return result

    @api.post("/api/lesson/extra", response_model=DeckOut, response_model_exclude_unset=True)
    def lesson_extra(response: Response):
        """Start tonight's next extra watch, or resume the open one, and serve it as
        `/api/deck?mode=extra` does: another watch the size of tonight's, in the same mix,
        never a card answered tonight (extra.py). As many as the learner wants. `extra` is its
        progress and how many extra watches were kept tonight. 409 until tonight's lesson is
        finished; it never keeps the night or the streak."""
        with ctx.connect() as conn, conn:
            deck.refresh(conn)
            try:
                extra.start(conn, db.today(conn))
            except extra.NotKept as error:
                raise HTTPException(409, str(error)) from None
        with timing.collect() as sample:
            with timing.stage("deck_total"):
                result = _deck_today(ctx, "extra")
        response.headers["Server-Timing"] = timing.header(sample)
        return result

    @api.post("/api/deck/suspend", response_model=SuspendedOut, response_model_exclude_unset=True)
    def deck_suspend(body: SuspendIn):
        """Don't show this again: hide a card with a reason, keeping its schedule and history.
        No grade is recorded. Hiding a hidden card changes nothing."""
        with ctx.connect() as conn, conn:
            if not deck.suspend(conn, body.game_id, body.ply, body.reason):
                raise HTTPException(404, "No such position in your deck.")
        return {"suspended": True}

    @api.post("/api/deck/unsuspend", response_model=SuspendedOut, response_model_exclude_unset=True)
    def deck_unsuspend(body: CardIn):
        """Show a hidden card again; its schedule resumes where it was."""
        with ctx.connect() as conn, conn:
            if not deck.unsuspend(conn, body.game_id, body.ply):
                raise HTTPException(404, "No such position in your deck.")
        return {"suspended": False}

    @api.get("/api/deck/suspended", response_model=list[SuspendedCardOut])
    def deck_suspended():
        """Hidden positions, most recently hidden first, for Progress's list."""
        with ctx.connect() as conn:
            return deck.suspended(conn)

    @api.post("/api/deck/more", response_model=LearnMoreOut, response_model_exclude_unset=True)
    def deck_more():
        """Learn more: once today's queue is finished, raise today's new-position limit by
        one pace's worth (fewer when the deck has fewer), for today only (deck.learn_more).
        `added` is 0 when there was nothing to add."""
        with ctx.connect() as conn, conn:
            today = db.today(conn)
            added = deck.learn_more(conn, today)
        return {"added": added, "day": today.isoformat()}

    @api.get("/api/deck/feedback/{game_id}/{ply}", response_model=FeedbackOut, response_model_exclude_unset=True)
    def deck_feedback(game_id: int, ply: int):
        """Poll a worker-prepared map; never run Stockfish or grade a card here."""
        with ctx.connect() as conn:
            if not deck.has_card(conn, game_id, ply):
                raise HTTPException(404, "No card for that position.")
            row, fen = practice_grades.load(conn, game_id, ply)
            return {"feedback": practice_grades.cached(row, fen) if row else None}

    return api


# Domain errors an answer can raise, as HTTP errors: (status, detail), where a None detail
# means the error's own message.
CARD_ERRORS = {
    KeyError: (404, "No card for that position."),
    practice_lines.LineChanged: (409, None),
    practice_lines.PrefixMismatch: (422, None),
    deck.GradeUnavailable: (503, None),
}
NEW_DAY = "A new day has started. Reopen this position before answering."


@contextmanager
def _http_errors(errors: dict):
    """Raise the domain errors in `errors` as their HTTP errors."""
    try:
        yield
    except tuple(errors) as error:
        status, detail = next(v for kind, v in errors.items() if isinstance(error, kind))
        raise HTTPException(status, detail or str(error)) from None


def _answer_day(conn, expected_day, message: str = NEW_DAY):
    """Today, unless the app answered for a day that has ended (409: reopen the position)."""
    today = db.today(conn)
    if expected_day is not None and expected_day != today:
        raise HTTPException(409, message)
    return today


def _answer_routes(ctx: Context) -> APIRouter:
    """Answers: review cards, "Your move", threat questions and hints."""
    api = APIRouter()

    @api.post("/api/deck/answer", response_model=DeckAnswerOut, response_model_exclude_unset=True)
    def deck_answer(body: AnswerIn, response: Response):
        with timing.collect() as sample:
            try:
                with timing.stage("answer_total"), _http_errors(CARD_ERRORS), ctx.connect() as conn, conn:
                    today = _answer_day(
                        conn, body.expected_day, "A new review day has started. Reopen this position before answering."
                    )
                    result = timing.call(
                        "answer",
                        deck.answer,
                        conn,
                        body.game_id,
                        body.ply,
                        body.uci,
                        moves=body.moves,
                        line_key=body.line_key,
                        hinted=body.hinted,
                        redo=body.redo,
                        seconds=body.seconds,
                        today=today,
                    )
                    if result["status"] != "continue":
                        daily.record(conn, today)
            finally:
                logging.getLogger("uvicorn.error").info(
                    "Practice answer timing %s", {k: round(v, 2) for k, v in sample.items()}
                )
        response.headers["Server-Timing"] = timing.header(sample)
        return result

    @api.post("/api/unannounced/answer", response_model=UnannouncedAnswerOut, response_model_exclude_unset=True)
    def unannounced_answer(body: UnannouncedAnswerIn):
        """Judge a "Your move" answer like a card's first move; logged, never scheduled.
        The result has a card answer's shape plus its `unannounced` kind."""
        errors = {
            KeyError: (404, "No such position of yours."),
            ValueError: (422, None),
            deck.GradeUnavailable: (503, None),
        }
        with ctx.connect() as conn, conn:
            today = _answer_day(conn, body.expected_day)
            with _http_errors(errors):
                result = unannounced.answer(conn, body.game_id, body.ply, body.moves, hinted=body.hinted, today=today)
            # A "Your move" item is one of the lesson's items.
            daily.record(conn, today)
        return result

    @api.post("/api/threats/answer", response_model=ThreatAnswerOut, response_model_exclude_unset=True)
    def threat_answer(body: ThreatAnswerIn):
        errors = {KeyError: (404, "No threat drill item for that position."), ValueError: (422, None)}
        with ctx.connect() as conn, conn:
            today = _answer_day(conn, body.expected_day)
            with _http_errors(errors):
                result = drill.answer(conn, body.game_id, body.ply, body.answer, body.seconds, today=today)
            # An own threat question is one of the lesson's items.
            daily.record(conn, today)
            return result

    @api.post("/api/deck/hint", response_model=HintOut, response_model_exclude_unset=True)
    def deck_hint(body: HintIn):
        """The move behind the two-step Hint: the piece to move, then the arrow."""
        hint_errors = {kind: v for kind, v in CARD_ERRORS.items() if kind is not deck.GradeUnavailable}
        with ctx.connect() as conn, conn, _http_errors(hint_errors):
            return deck.hint(conn, body.game_id, body.ply, body.moves, body.line_key)

    return api


def router(ctx: Context) -> APIRouter:
    api = APIRouter()
    api.include_router(_deck_routes(ctx))
    api.include_router(_answer_routes(ctx))
    return api
