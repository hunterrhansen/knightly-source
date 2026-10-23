"""What every signed-in route shares: the current user and the app's connections, quotas and
admin check."""

import os
from contextlib import closing
from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import HTTPException

from . import auth, db, limits


@dataclass(frozen=True)
class User:
    id: int
    clerk_id: str


# Who the request in progress is for, set by `authenticate` before the route runs.
current_user: ContextVar[User] = ContextVar("current_user")


class Context:
    """One app's database, sign-in and limits, handed to each area's `router(ctx)`."""

    def __init__(self, database_url: str, clerk: auth.Clerk | None):
        self.database_url = database_url
        self.clerk = clerk
        self.admins = {a.strip() for a in os.environ.get("KNIGHTLY_ADMINS", "").split(",") if a.strip()}
        self.engine_calls = limits.RateLimit(limits.ENGINE_PER_MINUTE)

    def admin(self):
        """The owner's connection, for the users table itself."""
        return closing(db.connect(self.database_url, migrate=False))

    def connect(self):
        """A short-lived connection for the current user (it sees only their rows);
        `with connect() as conn, conn:` for a transaction."""
        return closing(db.connect(self.database_url, migrate=False, user_id=current_user.get().id))

    def is_admin(self) -> bool:
        """KNIGHTLY_ADMINS lists the Clerk ids that see the admin page; without sign-in
        (your own Mac) you're the admin."""
        return self.clerk is None or current_user.get().clerk_id in self.admins

    def require_admin(self) -> None:
        if not self.is_admin():
            raise HTTPException(403, "Admins only.")

    def engine_quota(self) -> None:
        """Shared by the routes that start Stockfish in the web process."""
        user = current_user.get().id
        if not self.engine_calls.allow(user):
            raise HTTPException(
                429,
                "That's a lot of engine work at once. Try again in a minute.",
                headers={"Retry-After": str(self.engine_calls.retry_after(user))},
            )
