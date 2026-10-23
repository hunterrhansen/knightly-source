#!/usr/bin/env bash
# Runs on the VM through SSH. Registry authentication is in a temporary Docker config.
set -euo pipefail
[[ "${TARGET:?}" =~ ^(staging|production)$ ]]
[[ "${TAG:?}" =~ ^sha-[0-9a-f]{7,40}$ ]]
[[ "${IMAGE:?}" == ghcr.io/hunterrhansen/knightly-backend ]]
[[ "${DEPLOY_RUN:?}" =~ ^[0-9]+$ ]]
[[ "${DEPLOY_ATTEMPT:?}" =~ ^[0-9]+$ ]]
upload="/tmp/knightly-deploy-$DEPLOY_RUN-$DEPLOY_ATTEMPT"
export DOCKER_CONFIG="$upload/registry"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
cd "/opt/knightly/$TARGET"
# Preflight does not alter the running deployment.
test -s expo-web/index.html
if [[ "$TARGET" == production ]]; then
  test -s "/opt/knightly/staging/deployments/$TAG"
fi
docker pull --quiet "$IMAGE:$TAG" >/dev/null
image_id=$(docker image inspect --format '{{.Id}}' "$IMAGE:$TAG")
docker run --rm -i --env-file .env -e EXPECTED_ENV="$TARGET" --entrypoint python "$IMAGE:$TAG" - <<'PY'
import os
from psycopg.conninfo import conninfo_to_dict
assert os.environ['KNIGHTLY_ENV']==os.environ['EXPECTED_ENV']
expected={'staging':'mwkkgxrkhhvvagouvtmo','production':'duvdkqvszkmljwwrhhfk'}[os.environ['EXPECTED_ENV']]
info=conninfo_to_dict(os.environ['KNIGHTLY_DATABASE_URL'])
# This environment's own database: its Compose `db` service (reachable only on its own
# network, so staging can never reach production's), or its Supabase project before the move.
assert info.get('host')=='db' or expected in (info.get('host','')+' '+info.get('user',''))
PY
if [[ "$TARGET" == production ]]; then
  [[ "$image_id" == "$(cat "/opt/knightly/staging/deployments/$TAG")" ]]
fi
docker pull --quiet nginx:1.28-alpine >/dev/null
docker pull --quiet postgres:17-alpine >/dev/null
if [[ "$TARGET" == production ]]; then
  legacy_reference=$(sed -n 's/^KNIGHTLY_LEGACY_WEB_IMAGE=//p' .env)
  if [[ -z "$legacy_reference" ]]; then
    original_web=$(docker compose ps -q web)
    legacy_id=$(docker inspect --format '{{.Image}}' "$original_web")
    legacy_reference=$(docker image inspect --format '{{index .RepoDigests 0}}' "$legacy_id")
  fi
  [[ "$legacy_reference" =~ ^ghcr.io/hunterrhansen/knightly@sha256:[0-9a-f]{64}$ ]]
  # The pinned original frontend stays cached and running for rollback; on a rebuilt
  # VM it must be recovered from its registry.
  if ! docker image inspect "$legacy_reference" >/dev/null 2>&1; then
    docker pull --quiet "$legacy_reference" >/dev/null
  fi
fi
# The existing tunnel image is already cached; retain it through the handoff.
rollback_dir="$PWD/rollback-$DEPLOY_RUN-$DEPLOY_ATTEMPT"
mkdir -m 700 "$rollback_dir"
cp compose.yml .env "$rollback_dir/"
[[ ! -f nginx.conf ]] || cp nginx.conf "$rollback_dir/nginx.conf"
had_nginx=false
[[ ! -f nginx.conf ]] || had_nginx=true
# Migrations the database has applied that the previous image does not ship. Restoring
# that image over a one-way migration would pass the health checks and then fail
# requests, so rollback keeps the new deployment running instead.
unknown_migrations() {
  local previous applied known
  previous="$(sed -n 's/^KNIGHTLY_IMAGE_REPOSITORY=//p' "$rollback_dir/.env" | tail -1):$(sed -n 's/^KNIGHTLY_IMAGE_TAG=//p' "$rollback_dir/.env" | tail -1)"
  # On this environment's Compose network, where its database (host `db`) resolves.
  applied=$(docker run --rm --network "${TARGET}_default" --env-file .env --entrypoint python "$IMAGE:$TAG" -c \
    'import knightly.db as d; c = d.connect(migrate=False); print("\n".join(r[0] for r in c.execute("SELECT version FROM schema_migrations")))') || return 0
  known=$(docker run --rm --entrypoint python "$previous" -c \
    'import knightly.db as d; print("\n".join(v for v, _ in d.migrations()))') || return 0
  comm -23 <(sort <<<"$applied") <(sort <<<"$known") | paste -sd ' ' -
}
rollback() {
  trap - ERR
  local unknown
  unknown=$(unknown_migrations)
  if [[ -n "$unknown" ]]; then
    echo "Deployment failed after migrations the previous image lacks ($unknown); the new image keeps running. See docs/deploy.md, One-way migrations." >&2
    return
  fi
  cp "$rollback_dir/compose.yml" compose.yml
  cp "$rollback_dir/.env" .env
  if $had_nginx; then cp "$rollback_dir/nginx.conf" nginx.conf; else rm -f nginx.conf; fi
  docker compose up -d --pull never --remove-orphans
  # A bind-mounted config can change without changing Compose's service hash.
  docker compose up -d --pull never --no-deps --force-recreate web
  echo 'Deployment failed; previous Compose, environment and gateway restored.' >&2
}
trap rollback ERR
# Preserve the exact original frontend image locally for rollback; no legacy source is copied.
if [[ "$TARGET" == production ]]; then
  sed -i '/^KNIGHTLY_LEGACY_WEB_IMAGE=/d; /^COMPOSE_PROFILES=/d' .env
  printf '\nKNIGHTLY_LEGACY_WEB_IMAGE=%s\nCOMPOSE_PROFILES=legacy\n' "$legacy_reference" >> .env
fi
sed -i '/^KNIGHTLY_IMAGE_REPOSITORY=/d; /^KNIGHTLY_IMAGE_TAG=/d' .env
printf '\nKNIGHTLY_IMAGE_REPOSITORY=%s\nKNIGHTLY_IMAGE_TAG=%s\n' "$IMAGE" "$TAG" >> .env
chmod 600 .env
cp "$upload/compose.yml" compose.yml
cp "$upload/nginx.$TARGET.conf" nginx.conf
if [[ "$TARGET" == production ]]; then docker compose up -d --pull never legacy-web; fi
docker compose up -d --pull never --remove-orphans
# Load the new gateway configuration even when the image/mount paths are unchanged.
docker compose up -d --pull never --no-deps --force-recreate web
healthy=false
for _ in $(seq 1 30); do
  api=$(docker compose ps -q api)
  web=$(docker compose ps -q web)
  worker=$(docker compose ps -q worker)
  if [[ -n "$api" && -n "$web" && -n "$worker" ]] &&
    [[ "$(docker inspect --format '{{.State.Health.Status}}' "$api")" == healthy ]] &&
    [[ "$(docker inspect --format '{{.State.Health.Status}}' "$web")" == healthy ]] &&
    [[ "$(docker inspect --format '{{.State.Running}}' "$worker")" == true ]]; then
    healthy=true; break
  fi
  sleep 5
done
$healthy
# Exercise both gateway routes and backend authentication, not just container liveness.
docker compose exec -T api python - <<'PY'
import os,urllib.request,urllib.error
from psycopg.conninfo import conninfo_to_dict
info=conninfo_to_dict(os.environ['KNIGHTLY_DATABASE_URL'])
expected={'staging':'mwkkgxrkhhvvagouvtmo','production':'duvdkqvszkmljwwrhhfk'}[os.environ['KNIGHTLY_ENV']]
# This environment's own Compose database, or its Supabase project before the move.
assert info.get('host')=='db' or expected in (info.get('host','')+' '+info.get('user',''))
for path in ('/','/api/health','/api/config'):
    with urllib.request.urlopen('http://web:8000'+path,timeout=15) as response:
        assert response.status==200
        if path=='/': assert b'<html' in response.read().lower()
try:
    urllib.request.urlopen('http://web:8000/api/me',timeout=15)
    raise AssertionError('Unauthenticated request unexpectedly succeeded')
except urllib.error.HTTPError as error:
    assert error.code==401
print('Gateway frontend/API and unauthenticated rejection passed.')
PY
mkdir -p deployments
printf '%s\n' "$image_id" > "deployments/$TAG"
trap - ERR
docker compose ps
echo "Deployed $TARGET $IMAGE:$TAG ($image_id); rollback retained at $rollback_dir"
