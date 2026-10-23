"""Your account and settings: who you are, the chess accounts you follow, imports, updates, export and deletion."""

import functools
import json
import os
import re
import shutil
import subprocess

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from .. import (
    config,
    daily,
    db,
    deck,
    export,
    jobs,
    limits,
    lookup,
    patterns,
    update,
    users,
    welcome,
)
from ..schemas import (
    AccountIn,
    AdminOut,
    AnalysisIn,
    AnalysisOut,
    HttpErrorOut,
    ImportStatusOut,
    LinkedAccountOut,
    LookupAccountOut,
    MeOut,
    OkOut,
    OnboardingOut,
    PracticeIn,
    PracticeOut,
    SettingsOut,
    TimezoneIn,
    TimezoneOut,
    UpdateQueuedOut,
    WatchIn,
    WatchOut,
)
from ..web import Context, current_user

SOURCES = ("chesscom", "lichess")
HANDLE = re.compile(r"^[A-Za-z0-9_-]{2,40}$")
KEYCHAIN_SERVICE = "knightly-lichess"  # same entry `cli.keychain_token` reads


@functools.cache
def engine_name() -> str | None:
    """ "Stockfish 19" from the engine's banner, or None if it isn't installed."""
    path = os.environ.get("STOCKFISH") or shutil.which("stockfish")
    if not path:
        return None
    try:
        out = subprocess.run([path], input="quit\n", capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return " ".join(out.stdout.split()[:2]) or None


def lichess_token_saved() -> bool:
    """Whether a token is available, without ever reading the secret itself."""
    if os.environ.get("LICHESS_TOKEN"):
        return True
    if not config.on_mac():
        return False
    found = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE], capture_output=True)
    return found.returncode == 0


def _check_account(source: str, handle: str) -> None:
    if source not in SOURCES:
        raise HTTPException(400, f"source must be one of {', '.join(SOURCES)}")
    if not HANDLE.match(handle):
        raise HTTPException(400, "That doesn't look like a username.")


def _progress(run) -> dict | None:
    """An update's step list, if it has one."""
    return json.loads(run["progress"]) if run and run["progress"] else None


def _run_json(row) -> dict | None:
    """An update's row with its step list and errors decoded (None: no such update)."""
    if row is None:
        return None
    run = dict(row)
    if "progress" in run:
        run["progress"] = _progress(row)
    if "errors" in run:
        run["errors"] = json.loads(run["errors"]) if run["errors"] else []
    return run


def _whole_database(size, counts) -> dict:
    """The whole database and its backups: only without sign-in (your own Mac, where `size`
    is read). On a server they're everyone's, and where the database lives isn't anyone's
    business."""
    if size is None:
        return {"database": None, "backups": None}
    backups = sorted(update.backup_dir().glob(update.BACKUP_GLOB))
    return {
        "database": {**dict(size), "games": counts["games"], "analysed": counts["analysed"]},
        "backups": {"dir": str(update.backup_dir()), "count": len(backups), "keep": update.KEEP_BACKUPS},
    }


def _you_routes(ctx: Context) -> APIRouter:
    """Who you are, your data and the admin page."""
    api = APIRouter()

    @api.get("/api/me", response_model=MeOut, responses={401: {"model": HttpErrorOut}})
    def me():
        """Who's signed in, as the app needs it: whether to show the admin page, and the
        limits that apply to them."""
        return {"admin": ctx.is_admin(), "limits": limits.describe()}

    @api.get(
        "/api/export",
        response_class=StreamingResponse,
        responses={200: {"content": {"application/zip": {"schema": {"type": "string", "format": "binary"}}}}},
    )
    def download_data():
        """Everything Knightly keeps about you, as a zip: your games as PGN and every table
        as CSV."""
        with ctx.connect() as conn:
            body = export.zip_for(conn)
            day = db.today(conn)
        name = f"knightly-export-{day:%Y-%m-%d}.zip"
        return StreamingResponse(
            export.chunks(body),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )

    @api.delete("/api/account", status_code=204)
    def delete_account():
        """Delete you and everything of yours, right away (the web app then deletes the Clerk
        account, and Clerk's user.deleted webhook would do this again, harmlessly)."""
        if ctx.clerk is None:
            raise HTTPException(400, "Without sign-in there's no account to delete.")
        with ctx.admin() as conn:
            users.delete(conn, current_user.get().clerk_id)

    @api.get(
        "/api/admin",
        dependencies=[Depends(ctx.require_admin)],
        response_model=AdminOut,
        response_model_exclude_unset=True,
    )
    def admin_overview():
        """The admin page: the job queue and everyone's usage."""
        with ctx.admin() as conn:
            return jobs.overview(conn)

    @api.post(
        "/api/admin/jobs/{job_id}/retry",
        dependencies=[Depends(ctx.require_admin)],
        response_model=OkOut,
        response_model_exclude_unset=True,
    )
    def retry_job(job_id: int):
        with ctx.admin() as conn:
            if not jobs.retry(conn, job_id):
                raise HTTPException(404, "No failed job with that id.")
        return {"ok": True}

    return api


def _account_routes(ctx: Context) -> APIRouter:
    """The chess accounts you follow, and the welcome flow's import."""
    api = APIRouter()

    @api.get("/api/accounts", response_model=list[LinkedAccountOut])
    def accounts():
        with ctx.connect() as conn:
            return [dict(r) for r in db.accounts(conn)]

    @api.post("/api/accounts", status_code=201, response_model=LinkedAccountOut)
    def add_account(body: AccountIn):
        _check_account(body.source, body.handle)
        with ctx.connect() as conn, conn:
            if db.other_accounts(conn, body.source, body.handle) >= limits.MAX_ACCOUNTS:
                raise HTTPException(400, f"You can follow up to {limits.MAX_ACCOUNTS} accounts.")
            db.add_account(conn, body.source, body.handle)
            jobs.enqueue(conn, "update", {"trigger": "account"})  # bring its games in now
        return {"source": body.source, "handle": body.handle}

    @api.get("/api/lookup", response_model=LookupAccountOut)
    def lookup_account(source: str, handle: str):
        """A public account, before adding it: the welcome flow's "Is this you?"."""
        _check_account(source, handle)
        site = "Chess.com" if source == "chesscom" else "Lichess"
        try:
            found = lookup.account(source, handle)
        except Exception:
            raise HTTPException(502, f"Couldn't reach {site} just now. Try again in a moment.") from None
        if found is None:
            raise HTTPException(404, f"No {site} account is called {handle}.")
        return found

    @api.get("/api/onboarding", response_model=OnboardingOut)
    def onboarding():
        """The welcome flow's import screen: how far the first update has got, what it has
        found so far, and (once the newest games are in) the summary for "Your first lesson
        is ready"."""
        with ctx.connect() as conn:
            counts = welcome.import_counts(conn)
            running = update.current_run(conn, ("progress",))
            waiting = jobs.pending(conn)
            findings = welcome.findings(conn)
            summary = welcome.mistake_counts(conn)
            top = patterns.most_common(conn)
            positions_ready = len(deck._qualifying(conn))
            accounts = [dict(r) for r in db.accounts(conn)]
        progress = _progress(running) or {}
        return {
            "accounts": accounts,
            "games": counts["games"],
            "analysed": counts["analysed"],
            # The first update analyses the newest FIRST_BATCH; the rest come in backfills.
            "target": min(jobs.FIRST_BATCH, counts["standard"]),
            "working": bool(running) or "update" in waiting,
            "step": progress.get("current"),
            "findings": findings,
            "summary": {**dict(summary), "positions": positions_ready, "pattern": top},
        }

    @api.delete("/api/accounts/{source}/{handle}", status_code=204)
    def remove_account(source: str, handle: str):
        # Games already imported stay; the account just stops being synced.
        with ctx.connect() as conn, conn:
            db.remove_account(conn, source, handle)

    return api


def _settings_routes(ctx: Context) -> APIRouter:
    """Settings and the daily update."""
    api = APIRouter()

    @api.get("/api/settings", response_model=SettingsOut, response_model_exclude_unset=True)
    def settings():
        with ctx.connect() as conn:
            cursors = db.sync_cursors(conn)
            last = update.last_runs(conn, update.RUN_COLUMNS, limit=4)
            current = update.current_run(conn)
            counts = db.data_counts(conn)
            accounts = db.accounts(conn)
            database = None if ctx.clerk else db.size(conn)
            fsrs = deck.tuning(conn)
            nodes = db.analysis_nodes(conn)
            pace = deck.pace(conn)
            waiting = jobs.pending(conn)
            zone = db.get_setting(conn, db.TIMEZONE_SETTING)
            day = db.today(conn)
            watch = daily.watch(conn)
        return {
            "fsrs": fsrs,
            "accounts": [
                {**dict(a), "synced_through": cursors.get((a["source"], a["handle"].lower(), "games"))}
                for a in accounts
            ],
            "lichess_token": lichess_token_saved(),
            "last_run": _run_json(last[0]) if last else None,
            # The runs before it, for the history under it (without their step lists).
            "earlier_runs": [{k: v for k, v in _run_json(r).items() if k != "progress"} for r in last[1:]],
            "current_run": _run_json(current),
            "running": bool(current) or bool(waiting),
            "engine": engine_name(),
            "nodes": nodes,
            "pace": pace,
            # The user's IANA zone (None: the server's) and the review day it makes today.
            "timezone": zone,
            "day": day.isoformat(),
            # When the learner keeps their watch and what it follows, or None until chosen.
            "watch": watch,
            # Yours alone: what Download your data and Delete account act on.
            "your_data": {
                **dict(counts),
                "approx_bytes": counts["games"] * jobs.GAME_BYTES + counts["analysed"] * jobs.ANALYSED_BYTES,
            },
            "limits": limits.describe(),
            **_whole_database(database, counts),
        }

    @api.get("/api/status", response_model=ImportStatusOut)
    def status():
        """The sidebar's account row: your accounts with their latest rating, and the daily
        update's state (the run in progress, else the last one)."""
        with ctx.connect() as conn:
            current = update.current_run(conn, ("started_at", "progress"))
            last = update.last_runs(
                conn, ("started_at", "finished_at", "status", "new_games", "games_analysed", "errors")
            )
            accounts = [
                {
                    **dict(a),
                    **lookup.headline_rating(a["source"], lookup.latest_snapshot(conn, a["source"], a["handle"])),
                }
                for a in db.accounts(conn, chesscom_first=True)
            ]
            waiting = jobs.pending(conn)
        return {
            "accounts": accounts,
            # Jobs queued but not started yet (update, backfill): "Waiting to start".
            "queued": [] if current else waiting,
            "current_run": _run_json(current),
            "last_run": _run_json(last[0]) if last else None,
        }

    @api.put("/api/settings/analysis", response_model=AnalysisOut, response_model_exclude_unset=True)
    def set_analysis(body: AnalysisIn):
        with ctx.connect() as conn, conn:
            db.set_setting(conn, "analysis_nodes", body.nodes)
        return {"nodes": body.nodes}

    @api.put("/api/settings/practice", response_model=PracticeOut, response_model_exclude_unset=True)
    def set_practice(body: PracticeIn):
        """How many new review positions a day (Light, Standard, Intense). Today's queue
        follows it at once; positions already answered today still count."""
        with ctx.connect() as conn, conn:
            db.set_setting(conn, deck.PACE_SETTING, body.pace)
        return {"pace": body.pace}

    @api.put("/api/settings/timezone", response_model=TimezoneOut, response_model_exclude_unset=True)
    def set_timezone(body: TimezoneIn):
        """The user's time zone, which decides when their review day starts: daily counts,
        due positions and the day answers are checked against. The app sends the device's."""
        try:
            db.parse_zone(body.timezone)
        except ValueError as e:
            raise HTTPException(422, str(e)) from None
        with ctx.connect() as conn, conn:
            db.set_setting(conn, db.TIMEZONE_SETTING, body.timezone)
            conn.forget_zone()
            day = db.today(conn)
        return {"timezone": body.timezone, "day": day.isoformat()}

    @api.put("/api/settings/watch", response_model=WatchOut)
    def set_watch(body: WatchIn):
        """The learner's watch: the local time they keep it and the habit it follows
        ("After I finish dinner"). Reminders use both; saving restarts their back-off."""
        with ctx.connect() as conn, conn:
            return daily.set_watch(conn, body.time, body.anchor)

    @api.post("/api/update/run", status_code=202, response_model=UpdateQueuedOut)
    def run_update():
        """Queue an update (jobs.py); a worker picks it up within seconds. Asking while one
        is waiting or running changes nothing."""
        with ctx.connect() as conn:
            queued = jobs.enqueue(conn, "update", {"trigger": "manual"})
        return {"started": True, "queued": queued}

    return api


def router(ctx: Context) -> APIRouter:
    api = APIRouter()
    api.include_router(_you_routes(ctx))
    api.include_router(_account_routes(ctx))
    api.include_router(_settings_routes(ctx))
    return api
