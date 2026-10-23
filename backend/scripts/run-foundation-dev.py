"""Run the isolated foundation API; refuse production keys, databases and local auth."""

import os
import sys
from pathlib import Path

import psycopg
import uvicorn

from knightly import auth
from knightly.api import create_app


def validate_environment(env):
    key = env.get("CLERK_PUBLISHABLE_KEY", "")
    if not key.startswith("pk_test_"):
        raise ValueError("Set CLERK_PUBLISHABLE_KEY to the Clerk development publishable key (pk_test_).")
    issuer = auth.frontend_api(key)
    from urllib.parse import urlsplit

    host = urlsplit(issuer).hostname
    if not host or not host.endswith(".clerk.accounts.dev"):
        raise ValueError("Use a Clerk development instance hosted at *.clerk.accounts.dev.")
    if env.get("KNIGHTLY_AUTH") != "clerk":
        raise ValueError("This development API requires KNIGHTLY_AUTH=clerk.")
    info = psycopg.conninfo.conninfo_to_dict(env.get("KNIGHTLY_DATABASE_URL", ""))
    if (
        info.get("host") != "127.0.0.1"
        or info.get("port") != "55439"
        or info.get("dbname") != "knightly_foundation_dev"
        or info.get("service")
        or info.get("hostaddr")
        or env.get("PGSERVICE")
        or env.get("PGHOSTADDR")
    ):
        raise ValueError("Use only postgresql://127.0.0.1:55439/knightly_foundation_dev.")
    expected = {"http://localhost:8095", "http://127.0.0.1:8095"}
    for setting in ("KNIGHTLY_ALLOWED_ORIGINS", "KNIGHTLY_CORS_ORIGINS"):
        if set(env.get(setting, "").split(",")) != expected:
            raise ValueError(f"{setting} must contain only the two foundation origins on port 8095.")
    return env["KNIGHTLY_DATABASE_URL"]


if __name__ == "__main__":
    try:
        database_url = validate_environment(os.environ)
    except (ValueError, SystemExit) as error:
        raise SystemExit(str(error)) from None
    # App construction applies migrations only to the validated local database.
    os.environ["KNIGHTLY_MODE"] = "server"
    os.environ["KNIGHTLY_DATA_DIR"] = str(Path(__file__).resolve().parents[1] / ".local" / "foundation-data")
    if sys.argv[1:] == ["--worker"]:
        from knightly import jobs

        jobs.work(database_url, workers=1, scheduler=False)
        raise SystemExit(0)
    if sys.argv[1:]:
        raise SystemExit("Usage: run-foundation-dev.py [--worker]")
    app = create_app(database_url=database_url)
    uvicorn.run(app, host="127.0.0.1", port=8005, access_log=False)
