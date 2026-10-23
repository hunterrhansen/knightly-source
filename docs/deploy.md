# Backend deployment

The root Dockerfile packages only the retained API, worker and Stockfish.
The original web app remains in the original repository. Expo distribution is
separate; iPhone build profiles are documented in [README Phone builds](../README.md#phone-builds).
Existing Oracle VM environments, Supabase databases, Clerk identities, Cloudflare
tunnels and R2 backups remain in place; repository consolidation moves no data.

## Migration handoff

This repository owns backend deployments. The original repository remains
unarchived as `hunterrhansen/knightly-legacy`, and its original Deploy workflow is disabled
to keep one deployment owner.
The new image serves `/api/*` and does not serve a website; nginx serves the
Expo web export beside it.
The canonical repository is `hunterrhansen/knightly`. Its workflow builds
`ghcr.io/hunterrhansen/knightly-backend`; deployment is
enabled by `BACKEND_MIGRATION_VERIFIED=true` after backend tests, Expo verification,
server image builds and live staging API/worker/backup checks passed.
`DEPLOY_HOST`, a dedicated `DEPLOY_SSH_KEY` and staging/production environments
are configured here.
Quality includes Expo, browser, backend and image gates. Branch protection is
unavailable on the current GitHub plan, so the gates are run before merging; see
[runtime checks](runtime-verification.md#ci-and-pre-push).
These remote settings are not copied by Git; retain them when rebuilding hosting.

Once enabled, the workflow uploads the versioned Compose file and writes both
`KNIGHTLY_IMAGE_REPOSITORY` and `KNIGHTLY_IMAGE_TAG` to the server env file before
pull/restart. A gateway sends `/api/*` to the migrated API and serves each environment's
separately exported Expo web files for everything else (production since
October 20, 2026). The API and worker use the new image. Production still pins
and runs the original web image (`legacy-web`) with no route to it, so the web
cutover can be undone (see [Rolling back the web cutover](#rolling-back-the-web-cutover)).
Retire it, and archive the original repo, once the Expo web app has held up in production.

Repository names and registry package names are independent. The legacy frontend
keeps its existing `ghcr.io/hunterrhansen/knightly@sha256:…` image; the backend uses
`ghcr.io/hunterrhansen/knightly-backend` to avoid overwriting that package. Existing
`knightly-rebuild` backend images and rollback snapshots remain retained. To roll
back across the package change, restore the corresponding snapshot below. Expo
project, bundle IDs and auth callbacks retain their existing identities.

Deploy runs only after Quality succeeds on the default branch. Manual deployment
also checks that commit's Quality result. Production requires an explicit image
tag recorded by a successful staging deployment. On the current GitHub plan,
required production reviewers and private branch protection are unavailable;
manual production dispatch of staging-verified images is the accepted policy.
Staging and production environments remain separate. The VM pulls private images
with the deploy job's short-lived, read-only `GITHUB_TOKEN` in a temporary Docker
config; no permanent registry credential or public package is required. Cached
images support restarts after the token expires.

Every deployment retains its previous Compose, nginx configuration and private
env file in an environment-local rollback directory. Failed readiness checks
restore them automatically. Deployment records contain only image identities;
they establish which image was successfully exercised on staging.

Rollback to a migrated image uses Deploy with its staging-tested `sha-<commit>`
tag. To restore the complete original deployment, restore Compose and the private
env file from the retained environment-local `rollback-<run>-<attempt>` directory,
restore its nginx file if one existed (otherwise remove the current one), then run
`docker compose up -d --pull never --remove-orphans`. This restores frontend routing
as well as the previous image pair. Keep these snapshots and cached images.
No schema change is introduced by consolidation, so both image families use the
same migrations. Keep existing backup credentials, schedules and state files.

Current deployment identifiers retained from the original setup:

| Resource | Identity |
| --- | --- |
| Hosts | `knightlychess.app`, `staging.knightlychess.app` |
| Supabase staging | `mwkkgxrkhhvvagouvtmo` |
| Supabase production | `duvdkqvszkmljwwrhhfk` |
| Oracle state | `~/.knightly/oracle.tfstate` |
| Cloudflare state | `~/.knightly/cloudflare.tfstate` |

The following procedures describe retained hosting and recovery. The backend
handoff is verified; Expo production distribution remains a separate release.
Initial provisioning is unnecessary on the existing VM.

## 1. Accounts and values

Collect these first. The **Where it goes** column says which file or setting gets each one.

| What | Where to get it | Where it goes |
|---|---|---|
| Oracle Cloud account | cloud.oracle.com (needs a card; Always Free resources aren't charged) | — |
| A domain on Cloudflare | Cloudflare › Add a site (or buy one through Cloudflare Registrar) | — |
| Two Supabase projects: `knightly-staging`, `knightly` | supabase.com › New project | `KNIGHTLY_DATABASE_URL` in each `.env` |
| Clerk: development instance for staging, production instance for production | dashboard.clerk.com | `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET` |
| Two Cloudflare Tunnels | Cloudflare › Zero Trust › Networks › Tunnels | `TUNNEL_TOKEN` |
| An R2 bucket and API token | Cloudflare › R2 | `/opt/knightly/backup.env` |
| A deploy SSH key | `ssh-keygen` (below) | GitHub secret `DEPLOY_SSH_KEY`, plus the VM |
| Sentry (optional) | sentry.io › a Python project | `SENTRY_DSN` |
| Better Stack (optional) | betterstack.com › Uptime › Heartbeats | `KNIGHTLY_HEARTBEAT_URL` |

## 2. The machine

1. Make an Oracle Cloud account with **US West (Phoenix)** as its home region. The home
   region can't change later, and Always Free ARM machines only run there.
2. Make your own SSH key (`~/.ssh/id_ed25519`), if you don't have one, and a key for GitHub
   Actions to deploy with. The deploy key is used only for that:

   ```bash
   ssh-keygen -t ed25519 -N "" -C github-actions -f ~/.ssh/knightly-deploy
   ```

3. Make the machine with OpenTofu ([`infra/oracle/README.md`](../infra/oracle/README.md)). It
   creates a `knightly` compartment, a network whose only way in is SSH (22), and the Always
   Free ARM VM (Ubuntu 24.04, 4 OCPUs, 24 GB, 100 GB). Its `apply.sh` retries across
   availability domains while Oracle is out of ARM capacity. Running it again changes nothing.
4. Run the bootstrap with the deploy key's **public** half:

   ```bash
   ssh ubuntu@$(cd infra/oracle && tofu output -raw public_ip) \
     "curl -fsSL https://raw.githubusercontent.com/hunterrhansen/knightly/main/deploy/bootstrap.sh | sudo DEPLOY_KEY='$(cat ~/.ssh/knightly-deploy.pub)' bash"
   ```

   The bootstrap is safe to run again. It sets up:
   - Docker, rclone, and automatic security updates (with a reboot at 04:00 when one needs it)
   - a `knightly` user that deploys log in as
   - `/opt/knightly/{staging,production}`, each with `compose.yml`, `.env` and `data/`
   - a nightly backup timer

## 3. The database

Each environment's database is Postgres 17 in its Compose `db` service on the VM
(the decision is in [technology decisions](technology-decisions.md#the-database-lives-on-the-vm)).
Put a long random `KNIGHTLY_DB_PASSWORD` (`openssl rand -hex 24`) in the `.env` and set
`KNIGHTLY_DATABASE_URL=postgresql://postgres:<that password>@db:5432/knightly`; the app
creates its tables on first start. Data lives in `/opt/knightly/<env>/pgdata`.

### Moving the database onto the VM

Staging first, then production, each after a deploy whose `compose.yml` has the `db`
service:

1. Add `KNIGHTLY_DB_PASSWORD=<openssl rand -hex 24>` to `/opt/knightly/<env>/.env` (as
   `knightly`; keep `KNIGHTLY_DATABASE_URL` on Supabase for now) and deploy (§9).
2. Upload [`deploy/move-database.sh`](../deploy/move-database.sh) and run
   `TARGET=<env> bash move-database.sh`. It migrates the empty local database, stops the
   API and worker, copies the app's rows (`pg_dump --data-only --schema=public`), refuses
   to continue unless every table's row count matches, then switches
   `KNIGHTLY_DATABASE_URL` and starts them again. The Supabase URL stays in `.env` as
   `KNIGHTLY_SUPABASE_URL`, and the copy as `data/backups/move-<time>.dump`.
3. Check health, sign in, and run `sudo /opt/knightly/backup.sh <env>` once to see a dump
   of the new database reach R2.

Rollback: set `KNIGHTLY_DATABASE_URL` back to `KNIGHTLY_SUPABASE_URL` and
`docker compose up -d api worker`; rows written since the move are lost. The Supabase
projects are deleted only on purpose, once the VM's database has run a while.

### Before the move: Supabase

The environments ran on Supabase until the move; kept for the rollback above.

1. Create the project. Pick the region nearest the VM (West US (North California) for
   Phoenix), and keep the database password.
2. Turn off **Project Settings › Data API**. Only the server talks to the database, and the
   Data API would expose tables that have no row-level security (`users`, `jobs`) to anyone with
   the project's anon key.
3. Go to **Connect › Session pooler** and copy that URI, with the password filled in. That's
   `KNIGHTLY_DATABASE_URL`. Use port **5432**, not the transaction pooler on 6543: each
   connection sets which user it acts for, and that has to stay with the connection. The
   direct connection (`db.<ref>.supabase.co`) is IPv6-only, and the Oracle VM's network is IPv4.
4. Nothing else is needed. The app creates its tables on its first start, as migrations. To
   check a new project from your Mac: `KNIGHTLY_DATABASE_URL=... uv run --directory backend knightly migrate`,
   then `psql "$URL" -c "set role knightly_app"`.

To bring your existing Mac data into production, run this once, before anyone signs up. Run
the migrations first, so the tables, the `knightly_app` role and its grants exist. A dump can't
carry a role, and restoring with `--no-acl` drops the grants. Then restore your rows alone:

```bash
KNIGHTLY_DATABASE_URL="<production KNIGHTLY_DATABASE_URL>" uv run --directory backend knightly migrate
pg_dump --format=custom --data-only --exclude-table=schema_migrations -d knightly -f knightly-data.dump
pg_restore --data-only --no-owner -d "<production KNIGHTLY_DATABASE_URL>" knightly-data.dump
```

Rehearsed on a local copy: every table matched, new ids carried on from the old ones, and
`knightly_app` could read the rows.

Then sign in to production with the same Clerk account. If it's a different Clerk instance,
run `knightly users link <old clerk id> <new clerk id>` against production (see the README), so
your user row matches the new Clerk id.

## 4. Sign-in (Clerk)

- **Staging** can use the development instance you already have (`pk_test_…`).
- **Production** needs a production instance. In the Clerk dashboard, go to **Configure ›
  Production**, set your domain, and add the DNS records it lists in Cloudflare. Its key
  starts `pk_live_`.
- For each instance, go to **Webhooks › Add endpoint**:
  - Endpoint: `https://<that environment's host>/api/webhooks/clerk`
  - Event: `user.deleted`
  - Copy its **Signing secret** (`whsec_…`) into `CLERK_WEBHOOK_SECRET`.
- Set `KNIGHTLY_ALLOWED_ORIGINS` to the environment's address (`https://knightly.example.com`).
- When serving the native app, also set `KNIGHTLY_ALLOW_NATIVE_AUTH=1` and recreate the web
  container. This accepts signed tokens from that Clerk instance that omit the browser
  origin (`azp`); tokens with an origin still must match `KNIGHTLY_ALLOWED_ORIGINS`.
  Signature, issuer and expiry checks apply to both. Keep the flag off for web-only servers.
  See [Clerk's JWT verification guide](https://clerk.com/docs/guides/sessions/manual-jwt-verification).
- Register the rebuild's production native identifiers and callbacks before native
  release. Existing legacy native registrations do not certify the Expo rebuild.
  Use [current identifiers](foundation-development-environment.md).

The API exposes the publishable key through `/api/config`. Configure each Expo
release for its backend and Clerk instance; no frontend is baked into the server image.

## 5. The tunnels (Cloudflare)

These are OpenTofu ([`infra/cloudflare/README.md`](../infra/cloudflare/README.md)): the
tunnels, their DNS records and the backup bucket, with `push-tokens.sh` to put each tunnel's
token on the machine. By hand in the dashboard, it's this:

Do this once per environment.

1. Go to **Zero Trust › Networks › Tunnels › Create a tunnel**, choose **Cloudflared**, and name it
   `knightly-staging` or `knightly`.
2. Copy the token from the install command (the long string after `--token`) into `TUNNEL_TOKEN`.
   Skip the install itself: the `cloudflared` container is the connector.
3. Add a **Public hostname**:
   - Hostname: `staging.<domain>` for staging, or `<domain>` for production
   - Service: `HTTP`, URL: `web:8000`

Cloudflare makes the DNS record and the HTTPS certificate.

## 6. Fill in the `.env` files

On the VM:

```bash
sudo -u knightly nano /opt/knightly/staging/.env
sudo -u knightly nano /opt/knightly/production/.env
```

Each comment in [`deploy/env.example`](../deploy/env.example) says what goes there.
`KNIGHTLY_CONTACT` is your email: Chess.com asks API clients to identify themselves. Leave
`KNIGHTLY_IMAGE_TAG` and `KNIGHTLY_IMAGE_REPOSITORY` out, because deploys set them.

## 7. Backups (Cloudflare R2)

The backup script skips bucket checks/creation with `RCLONE_S3_NO_CHECK_BUCKET=true`:
object-scoped R2 credentials can upload/download objects but cannot perform those
bucket operations. Keep the pre-provisioned bucket and narrow token permissions.
See [Cloudflare's rclone configuration](https://developers.cloudflare.com/r2/examples/rclone/).

1. Go to **R2 › Create bucket** and name it `knightly-backups`.
2. Go to **R2 › Manage API tokens › Create**, with **Object Read & Write** on that bucket only.
3. On the VM, run `sudo nano /opt/knightly/backup.env` and fill in:
   - the access key id
   - the secret
   - the endpoint (`https://<account id>.r2.cloudflarestorage.com`)

Every night at 03:30 the backup timer runs [`deploy/backup.sh`](../deploy/backup.sh):

- It writes a `pg_dump` of production to `production/data/backups/knightly-YYYY-MM-DDTHHMMZ.dump`
  (UTC), keeping every dump from the last 7 days there.
- It copies new dumps to the bucket, which keeps 30 days. A dump's name is never reused, so a
  later one can't replace it there either.

To take a dump now (before a one-way migration, or to test that `pg_dump` works through the
pooler), start the service, which loads `backup.env` and sends the dump off the machine:

```bash
sudo systemctl start knightly-backup.service && sudo journalctl -u knightly-backup -n 20
```

`sudo /opt/knightly/backup.sh production` does the same. Run without `sudo` (as `knightly`),
it can't read `backup.env`: the dump stays on the machine and the script exits 1.

Supabase's free tier keeps no backups of its own that you can download. This bucket is what
you'd restore from.

## 8. GitHub

Under **Settings** in the repository:

- **Secrets and variables › Actions**:
  - variable `DEPLOY_HOST` = the VM's public IP
  - secret `DEPLOY_SSH_KEY` = the **private** half (`cat knightly-deploy`)
- **Environments**: create `staging` and `production`. Enable required production
  reviewers when the GitHub plan supports them; current production deployment uses
  manual dispatch of staging-verified images.

Keep the image private. Deploy authenticates the VM with the job's temporary
read-only `GITHUB_TOKEN`, pulls the image and deletes that Docker login configuration.
Do not put a permanent personal access token in the server environment.

Until `DEPLOY_HOST` is set, the Deploy workflow builds and pushes the image and skips deploying.

## 9. Deploying

- **Staging** deploys after Quality passes for a push to `main` (when Actions runs:
  see [CI state](runtime-verification.md#ci-and-pre-push)). In GitHub's Actions tab, **Deploy** builds
  `sha-<commit>` and restarts staging on it. The run fails if the new web container doesn't
  come up healthy within about 2½ minutes.
- **Production**: manually deploy a staging-verified image; required reviewers are
  unavailable on the current plan. Go to **Actions › Deploy › Run workflow** and pick
  `production`, with the `sha-<commit>` tag from the staging run. Production gets the exact
  image staging ran, with nothing rebuilt.
- **Rolling back** is the same thing with an older tag, unless a one-way migration lies
  between them (below).

Migrations run as the web container starts, under an advisory lock. Keep them additive: a
column that new code stops using is dropped in a later release, so the old image still works
during a rollback.

**One-way migrations.** 0024 (flag columns to `boolean`) is not additive: an older image
passes `/api/health` against it and then fails requests and worker writes. Before deploying
it, take a fresh production dump (§7: `sudo systemctl start knightly-backup.service`), check
it reached the bucket, and deploy staging first to time the rewrite of `moves`
(it holds an exclusive lock until it commits; expect a short 502 window). If a deploy fails
after such a migration, `deploy.sh` leaves the new image running rather than restore the old
one. To roll back across it: `docker compose stop api worker` (the new image re-applies the
migration whenever it connects), run the reverse statements in the migration's comment, then
deploy the older tag.

**Deploying by hand** (when GitHub Actions can't run): as the `knightly` user on the VM,
build the image from the commit (`git archive <sha> | ssh … tar -x`, then
`docker build -t ghcr.io/hunterrhansen/knightly-backend:sha-<sha7> .`; the VM is arm64
like the CI build). Upload `deploy/compose.yml`, `deploy/nginx.*.conf` and
`deploy/deploy.sh` to `/tmp/knightly-deploy-<run>-1/`, changing only the image `docker
pull` line to `docker image inspect "$IMAGE:$TAG" >/dev/null || docker pull …`, and run
it with `TARGET=staging TAG=sha-<sha7> IMAGE=ghcr.io/hunterrhansen/knightly-backend
DEPLOY_RUN=<epoch seconds> DEPLOY_ATTEMPT=1`, then the same with `TARGET=production`.
All other checks, the staging-first rule and rollback still apply. New layers and
threat questions otherwise backfill 200 mistakes a night; run
`docker compose exec worker knightly --user <clerk_id> patterns` until it tags 0 to
finish sooner (the `clerk_id` must exist, or the CLI creates a user).

**Web export.** Deploy never exports Expo web, and refuses to deploy an environment
whose `expo-web/index.html` is missing. nginx serves the static files bind-mounted
read-only from `/opt/knightly/<target>/expo-web`. Export each environment with its
own host; never upload one environment's export to the other:

```bash
EXPO_PUBLIC_API_URL=https://staging.knightlychess.app npx expo export --platform web --clear --output-dir <scratch>/expo-web
EXPO_PUBLIC_API_URL=https://knightlychess.app npx expo export --platform web --clear --output-dir <scratch>/expo-web-production
```

The API URL is the only build input (the Clerk key comes from `/api/config`).
Update staging first and check it before production.
Always pass `--clear`: Metro otherwise reuses transforms from `npm run test:runtime`
and bakes `http://127.0.0.1:0` into the bundle. Upload with
`COPYFILE_DISABLE=1 tar --no-xattrs -C <export> -czf - .` over SSH as `knightly`
into a `mkdir -m 700` temporary directory, keep the old files with
`cp -a expo-web expo-web.before-<epoch>`, then empty `expo-web` in place and
`cp -a` the new files in. Do not replace or `mv` the directory: the bind mount holds it.

### Rolling back the web cutover

Every production deploy keeps the previous `nginx.conf` in its `rollback-<run>-<attempt>`
directory, and `legacy-web` keeps running. To put the original frontend back without
a deploy, restore the `nginx.conf` from the last rollback directory whose file has
`server legacy-web:8000`, then
`docker compose up -d --pull never --no-deps --force-recreate web`. The next deploy
switches it back to the Expo export.

To check on things from the VM:

```bash
cd /opt/knightly/production
docker compose ps
docker compose logs -f --tail 100 worker
curl -s https://<domain>/api/health
```

## 10. Monitoring (optional)

- **Sentry**: errors from the web and the worker, tagged with the environment. Set `SENTRY_DSN`
  to the DSN of a Python project. Both environments can share one project.
- **Better Stack**: tells you if the worker stops.
  1. Create a **Heartbeat** with a 1-hour period and a 30-minute grace.
  2. Put its URL in production's `KNIGHTLY_HEARTBEAT_URL`. The worker pings it every time it
     checks the schedule.
  3. Add an **Uptime monitor** on `https://<domain>/api/health`, to watch the site itself.

## Restoring from a backup

```bash
sudo -s                                                  # backup.env is root's
set -a; . /opt/knightly/backup.env; set +a
export RCLONE_S3_NO_HEAD=true RCLONE_S3_NO_CHECK_BUCKET=true
rclone lsl offsite:knightly-backups/production          # or the R2 dashboard
rclone copy offsite:knightly-backups/production/knightly-2026-10-19T0330Z.dump .
pg_restore --clean --if-exists --no-owner -d "$KNIGHTLY_DATABASE_URL" knightly-2026-10-19T0330Z.dump
```

Dumps made before backups had a time in their name are `knightly-YYYY-MM-DD.dump` and hold
that day's last dump. The new names need both an image with the change (the dump is named by
`knightly backup`) and the current `deploy/backup.sh` installed as `/opt/knightly/backup.sh`.

`$KNIGHTLY_DATABASE_URL` names the host `db`, which only resolves on the environment's
Compose network: run `pg_restore` there, e.g. `docker compose run --rm --no-deps -T -v
"$PWD:/restore" worker pg_restore --clean --if-exists --no-owner -d "$KNIGHTLY_DATABASE_URL"
/restore/<file>.dump` from `/opt/knightly/<env>`.

## Rebuilding the machine

1. Make a new VM (§2) and run the bootstrap with the same `DEPLOY_KEY`.
2. Copy the three env files over from your password manager, or from the old VM if it still runs.
3. Restore each environment's Expo export to `<target>/expo-web` from a fresh
   export with that environment's host (Deploy refuses an environment without one). Keep `KNIGHTLY_LEGACY_WEB_IMAGE`'s original registry
   digest in the restored production env file; Deploy recovers that image if needed.
4. Set `DEPLOY_HOST` to the new IP and install the dedicated deploy public key.
5. Deploy staging first to recreate its tested-image record, then manually deploy
   that same image to production.

The tunnels reconnect from the new machine by themselves, and no DNS changes.

Keep a copy of `staging/.env`, `production/.env` and `backup.env` somewhere safe. They are
the only things on the machine that aren't in this repository.

### Rebuild browser API access

For a separately hosted Expo web app, set `KNIGHTLY_CORS_ORIGINS` to the exact
comma-separated browser origins allowed to call the API, without trailing slashes.
HTTPS is required except HTTP localhost origins in development. No wildcard or
cookie credentials are enabled. Include the same browser origins in
`KNIGHTLY_ALLOWED_ORIGINS` for JWT validation; these are separate checks.
Native auth retains the existing `KNIGHTLY_ALLOW_NATIVE_AUTH=1` opt-in.
`/api/config` is public and documented in OpenAPI; `/api/me` remains protected.

Export contracts using `tests/test_openapi_snapshot.py` with an explicit absolute
`KNIGHTLY_SCHEMA_OUTPUT` and a dedicated local `KNIGHTLY_TEST_DATABASE_URL`.
The pytest fixture creates isolated test databases and applies migrations there.
Never generate schemas by initializing the app against a hosted database.
