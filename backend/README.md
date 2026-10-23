# Knightly backend

The retained Python package owns FastAPI, CLI imports, Stockfish analysis, jobs,
practice grading and canonical learning progress. Clerk identity and Postgres
user isolation remain unchanged. The Expo app consumes this API over HTTP.

## Run

From `backend/`, with Python 3.11 or newer and uv:

```sh
uv sync --locked
cp .env.example .env
uv run --env-file .env knightly serve --no-worker
uv run --env-file .env knightly worker
```

Set `KNIGHTLY_DATABASE_URL` explicitly. CLI commands apply existing numbered SQL
migrations when connecting; never point development/tests at a hosted database.
Install Stockfish and PostgreSQL client tools for analysis and backups.
`serve` runs the API only; no frontend bundle is included or served.
Production uses the root Dockerfile. The original web app stays in the original repo.

For isolated real-auth API/worker commands, use the
[development setup](../docs/foundation-development-environment.md).
For hosting, backups and rollback, use the [deployment guide](../docs/deploy.md).

## Verify

```sh
uv sync --locked
uv run ruff check && uv run ruff format --check
KNIGHTLY_TEST_DATABASE_URL=postgresql://127.0.0.1:<test-port>/postgres uv run pytest -q
```

Use a dedicated disposable local Postgres cluster. The fixtures create and remove
`knightly_test_template` and a separate database per test. Stockfish must be on
PATH; PostgreSQL client tools must match the test server for backup tests.
No new migrations or data transfers are needed for repository consolidation.

To compare the public contract with the Expo snapshot, export on that same local
cluster using an absolute `KNIGHTLY_SCHEMA_OUTPUT`:

```sh
KNIGHTLY_SCHEMA_OUTPUT=/absolute/path/schema.json uv run pytest -q tests/test_openapi_snapshot.py
```

Compare the output with `../contracts/knightly.openapi.json`; do not overwrite the
accepted snapshot to hide drift.
