#!/usr/bin/env bash
# Moves one environment's database from its Supabase project into its Compose `db` service
# (docs/deploy.md, "Moving the database onto the VM"). Run on the VM, as knightly, after a
# deploy whose compose.yml has the `db` service and with KNIGHTLY_DB_PASSWORD in .env:
#
#   TARGET=staging bash move-database.sh
#
# The API and worker stop while the rows are copied (a minute or two), then start on the new
# database. Nothing is written to Supabase: until you delete the project, rolling back is
# putting KNIGHTLY_SUPABASE_URL back as KNIGHTLY_DATABASE_URL (rows written since are lost).
set -euo pipefail
[[ "${TARGET:?}" =~ ^(staging|production)$ ]]
cd "/opt/knightly/$TARGET"

old=$(sed -n 's/^KNIGHTLY_DATABASE_URL=//p' .env | tail -1)
[[ "$old" == *supabase.com* ]] || { echo "KNIGHTLY_DATABASE_URL is not a Supabase URL: already moved?" >&2; exit 1; }
password=$(sed -n 's/^KNIGHTLY_DB_PASSWORD=//p' .env | tail -1)
[[ "$password" =~ ^[0-9A-Za-z]{24,}$ ]] || { echo "Set KNIGHTLY_DB_PASSWORD (letters and digits, 24+) in .env" >&2; exit 1; }
new="postgresql://postgres:$password@db:5432/knightly"
stamp=$(date -u +%Y-%m-%dT%H%MZ)
dump="/data/backups/move-$stamp.dump"
run() { docker compose run --rm --no-deps -T "$@"; }

docker compose up -d --wait db
# Tables, the knightly_app role and its grants first: a dump can't carry a role.
run -e KNIGHTLY_DATABASE_URL="$new" worker knightly migrate
users=$(run -e KNIGHTLY_DATABASE_URL="$new" --entrypoint python worker -c \
  'import knightly.db as d; print(d.connect(migrate=False).execute("SELECT count(*) FROM users").fetchone()[0])')
[[ "$users" == 0 ]] || { echo "The new database already has users: refusing to copy over them." >&2; exit 1; }

restart_old() {
  echo "Move failed: starting the API and worker on Supabase again (.env unchanged)." >&2
  docker compose up -d --wait api worker
}
trap restart_old ERR
docker compose stop worker api

# The app's own tables only (Supabase keeps its own schemas beside them).
run worker pg_dump --format=custom --data-only --schema=public --exclude-table=public.schema_migrations \
  -d "$old" -f "$dump"
run worker pg_restore --data-only --no-owner --disable-triggers --single-transaction -d "$new" "$dump"

# Every table's row count must match before anything points at the new database.
run -e OLD="$old" -e NEW="$new" --entrypoint python worker - <<'PY'
import os
import psycopg

def counts(url):
    with psycopg.connect(url) as c:
        tables = [r[0] for r in c.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY 1")]
        return {t: c.execute(f'SELECT count(*) FROM public."{t}"').fetchone()[0] for t in tables}

old, new = counts(os.environ["OLD"]), counts(os.environ["NEW"])
for table in sorted(old):
    print(f"{table:32} {old[table]:>9} {new.get(table, '-'):>9}")
assert old == new, "row counts differ"
print(f"{len(old)} tables, {sum(old.values())} rows: identical")
PY

# Switch, keeping the Supabase URL for rollback.
sed -i '/^KNIGHTLY_SUPABASE_URL=/d' .env
sed -i "s|^KNIGHTLY_DATABASE_URL=.*|KNIGHTLY_DATABASE_URL=$new|" .env
printf 'KNIGHTLY_SUPABASE_URL=%s\n' "$old" >> .env
chmod 600 .env
trap - ERR
docker compose up -d --wait api worker
echo "Moved $TARGET onto its local database. Copy kept at data${dump#/data}; Supabase untouched."
