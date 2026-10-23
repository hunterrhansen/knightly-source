"""HTTP API over the Postgres database for the Knightly app (`knightly serve`): the app,
sign-in and public routes. The signed-in routes live in routes/, by area."""

import os
from contextlib import closing
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from . import auth, config, db, monitoring, users
from .routes import account, games, home, practice, progress, puzzles
from .schemas import PublicConfigOut
from .web import Context, User, current_user

# Your own recordings in `sounds/` beside the database, if present (README: Sounds)
LOCAL_SOUNDS = ("move-self.mp3", "capture.mp3", "game-start.mp3", "game-end.mp3")


def cors_origins() -> list[str]:
    origins = [value.strip() for value in os.environ.get("KNIGHTLY_CORS_ORIGINS", "").split(",") if value.strip()]
    for origin in origins:
        url = urlsplit(origin)
        if (
            not url.hostname
            or url.username
            or url.password
            or url.path
            or url.query
            or url.fragment
            or url.scheme not in ("http", "https")
            or (url.scheme == "http" and url.hostname not in ("localhost", "127.0.0.1", "::1"))
            or "*" in origin
        ):
            raise ValueError("CORS origins must be exact HTTPS origins (HTTP only for localhost).")
        try:
            _ = url.port  # raises on an invalid port
        except ValueError as error:
            raise ValueError("Invalid CORS origin port.") from error
    return origins


def _authenticator(ctx: Context, clerk, local: User | None):
    """The dependency every signed-in route runs: who the request acts for (`local`
    without Clerk), or 401."""

    def signed_in(token: str) -> User:
        clerk_id = clerk.user(token)
        # Looked up every time (one indexed query), not cached: `knightly users link` and
        # account deletion change who a Clerk id is while the server runs. The first request
        # after signing up creates the user.
        with ctx.admin() as conn:
            return User(users.ensure(conn, clerk_id), clerk_id)

    async def authenticate(request: Request) -> None:
        if clerk is None:
            current_user.set(local)
            return
        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            raise HTTPException(401, "Sign in first.")
        try:  # a thread: the first token can mean fetching Clerk's public keys
            current_user.set(await run_in_threadpool(signed_in, header[7:]))
        except auth.Unauthorized as e:
            raise HTTPException(401, f"Sign in again ({e}).") from None

    return authenticate


def _public_routes(app: FastAPI, ctx: Context, clerk) -> None:
    """The routes that need no sign-in: config, health, your own sounds and the Clerk webhook."""

    @app.get("/api/config", response_model=PublicConfigOut)
    def app_config():
        """What the web app needs before it renders: whether to sign in with Clerk, and with
        which (public) key, and who to write to. Read at runtime, so one build serves staging and production."""
        return {
            "clerk_publishable_key": os.environ.get("CLERK_PUBLISHABLE_KEY") if clerk else None,
            "contact": os.environ.get("KNIGHTLY_CONTACT"),
        }  # the privacy page's "Questions"

    @app.get("/api/health", include_in_schema=False)
    def health():
        """For uptime checks and the container's health check: up, and the database answers."""
        try:
            with ctx.admin() as conn:
                conn.execute("SELECT 1")
        except Exception:
            raise HTTPException(503, "database unreachable") from None
        return {"ok": True}

    @app.get("/api/sounds", include_in_schema=False)
    def sounds():
        """Which of your own sound files are there, so the app only asks for those."""
        folder = config.data_dir() / "sounds"
        return [n for n in LOCAL_SOUNDS if (folder / n).is_file()]

    @app.get("/api/sounds/{name}", include_in_schema=False)
    def sound(name: str):
        """Your own sound files for moves and captures, from a `sounds/` folder beside the
        database. They stay out of git (they may be someone else's), so the app falls back to
        its built-in sounds when they're missing."""
        if name not in LOCAL_SOUNDS:
            raise HTTPException(404, "unknown sound")
        path = config.data_dir() / "sounds" / name
        if not path.is_file():
            raise HTTPException(404, "not there")
        return FileResponse(path, media_type="audio/mpeg")

    @app.post("/api/webhooks/clerk", include_in_schema=False)
    async def clerk_webhook(request: Request):
        """Clerk tells us when someone deletes their account: everything of theirs goes too.
        Set up in Clerk's dashboard (Webhooks, event user.deleted), with its signing secret
        in CLERK_WEBHOOK_SECRET."""
        secret = os.environ.get("CLERK_WEBHOOK_SECRET")
        if not secret:
            raise HTTPException(404, "webhooks aren't set up")
        try:
            event = auth.webhook(secret, request.headers, await request.body())
        except auth.Unauthorized as e:
            raise HTTPException(400, str(e)) from None
        clerk_id = (event.get("data") or {}).get("id")
        if event.get("type") == "user.deleted" and clerk_id:

            def forget():
                with ctx.admin() as conn:
                    users.delete(conn, clerk_id)

            await run_in_threadpool(forget)
        return {"ok": True}


def create_app(database_url: str = db.DEFAULT_URL) -> FastAPI:
    origins = cors_origins()
    monitoring.init("web")
    clerk = auth.from_env()
    with closing(db.connect(database_url)) as conn:  # applies any pending migrations
        local = None if clerk else User(users.ensure(conn, users.LOCAL), users.LOCAL)
    ctx = Context(database_url, clerk)

    authenticate = _authenticator(ctx, clerk, local)
    app = FastAPI(title="knightly")
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
        )
    # Every /api route but sounds and the Clerk webhook acts for the signed-in user.
    api = APIRouter(dependencies=[Depends(authenticate)])
    for area in (account, games, home, practice, progress, puzzles):
        api.include_router(area.router(ctx))

    _public_routes(app, ctx, clerk)
    app.include_router(api)

    return app
