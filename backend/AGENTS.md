# Backend ownership

Follow the root AGENTS.md and [backend setup](README.md).
Keep backend source, tests, migrations and Python dependencies in this directory.
Preserve Clerk JWT validation, per-user Postgres isolation and authoritative
server grading of saved answers (the app may judge from served solutions first).
Use the existing numbered migration process; do not rewrite applied migrations. Tests require a dedicated disposable local database.
Run `uv sync --locked`, `uv run ruff check`, `uv run ruff format --check` and
`uv run pytest -q` with the explicit test database URL.
Frontend workflows belong in the universal Expo app; this package serves the API only.
