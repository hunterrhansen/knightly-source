# Knightly API, worker and Stockfish. The universal Expo app is distributed separately.
FROM python:3.11-slim-trixie
# Debian's Stockfish lands in /usr/games; zstd unpacks the Lichess puzzle database;
# postgresql-client brings pg_dump for the daily backup.
RUN apt-get update && apt-get install --yes --no-install-recommends stockfish zstd postgresql-client \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /app
# No uv cache: downloaded wheels (PyTorch's alone are hundreds of MB) would stay in the image.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_NO_CACHE=1
# Dependencies first, so a code change doesn't reinstall them.
COPY backend/pyproject.toml backend/uv.lock backend/README.md backend/LICENSE ./
# The optimizer extra: CPU-only PyTorch, so the worker can tune each user's FSRS (deck.maybe_tune).
RUN uv sync --locked --no-dev --extra optimizer --no-install-project
COPY backend/src/ src/
RUN uv sync --locked --no-dev --extra optimizer

RUN useradd --create-home --uid 1000 knightly && mkdir /data && chown knightly /data
USER knightly
# KNIGHTLY_DATABASE_URL comes from the environment it runs in (docker-compose.yml).
ENV PATH="/app/.venv/bin:/usr/games:$PATH" KNIGHTLY_MODE=server KNIGHTLY_DATA_DIR=/data
EXPOSE 8000
CMD ["knightly", "serve", "--host", "0.0.0.0", "--port", "8000"]
