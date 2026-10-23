"""Run the API for UI development without Clerk: every request acts for the one "local" user.

Pairs with `npm run web:local` (EXPO_PUBLIC_DEV_AUTH=local in a development build). This is
not sign-in evidence. It refuses anything but a loopback database whose name ends in
`_local_dev`, creates that database on first use, binds the API to loopback and allows only
the two web origins on port 8095.
"""

import os
import sys
from pathlib import Path

import psycopg
import uvicorn

DEFAULT_URL = "postgresql://127.0.0.1:55439/knightly_local_dev"
ORIGINS = "http://localhost:8095,http://127.0.0.1:8095"


def validate_environment(env) -> str:
    url = env.get("KNIGHTLY_DATABASE_URL") or DEFAULT_URL
    info = psycopg.conninfo.conninfo_to_dict(url)
    if (
        info.get("host") not in ("127.0.0.1", "localhost", "::1")
        or not str(info.get("dbname", "")).endswith("_local_dev")
        or info.get("service")
        or info.get("hostaddr")
        or env.get("PGSERVICE")
        or env.get("PGHOSTADDR")
    ):
        raise ValueError("Use a loopback database named *_local_dev, e.g. " + DEFAULT_URL)
    if env.get("CLERK_PUBLISHABLE_KEY"):
        raise ValueError("Unset CLERK_PUBLISHABLE_KEY: this runner serves the local user only.")
    return url


def ensure_database(url: str) -> None:
    name = psycopg.conninfo.conninfo_to_dict(url)["dbname"]
    with psycopg.connect(psycopg.conninfo.make_conninfo(url, dbname="postgres"), autocommit=True) as conn:
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone():
            conn.execute(f'CREATE DATABASE "{name}"')


if __name__ == "__main__":
    try:
        database_url = validate_environment(os.environ)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    if sys.argv[1:] not in ([], ["--worker"]):
        raise SystemExit("Usage: run-local-dev.py [--worker]")
    ensure_database(database_url)
    os.environ.update(
        {
            "KNIGHTLY_AUTH": "local",
            "KNIGHTLY_MODE": "server",
            "KNIGHTLY_DATABASE_URL": database_url,
            "KNIGHTLY_CORS_ORIGINS": ORIGINS,
            "KNIGHTLY_DATA_DIR": str(Path(__file__).resolve().parents[1] / ".local" / "local-dev-data"),
        }
    )
    from knightly.api import create_app  # after the environment is set

    if sys.argv[1:] == ["--worker"]:
        from knightly import jobs

        jobs.work(database_url, workers=1, scheduler=False)
        raise SystemExit(0)
    app = create_app(database_url=database_url)
    uvicorn.run(app, host="127.0.0.1", port=8005, access_log=False)
