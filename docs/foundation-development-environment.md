# Local development environment

Two local modes run the app against a dedicated local database, never a hosted
one: Clerk sign-in with the foundation scripts (below), and the no-auth `*:local`
scripts for UI work ([UI development without Clerk](#ui-development-without-clerk)).

The app configuration pins iOS 17.0, required by the installed Clerk native SDK.
Regenerate stale native projects with `npx expo prebuild --platform ios` before
building; an older 16.4 target skips Clerk and fails its Swift package
post-install hook. Rebuild before native checks.

## Local endpoints

| Component | Setting |
| --- | --- |
| Frontend/Metro | `http://localhost:8095` (also `http://127.0.0.1:8095`) |
| API | `http://127.0.0.1:8005` |
| Postgres | `127.0.0.1:55439`, database `knightly_foundation_dev` |
| Native app ID | `app.knightlychess` |
| App scheme | `knightlydev` |
| Dev-client scheme | `exp+knightly-rebuild` |
| iOS hosted-auth callback | `app.knightlychess://callback` |
| Android hosted-auth callback | `clerk://app.knightlychess.hosted-callback` |

The callback values follow the installed Clerk Expo SDK and its config plugin;
`knightlydev` is the application/deep-link scheme, not the hosted-auth
callback. Rebuild after changing native identifiers.

## Clerk instance

Sign in to the Clerk dashboard and select Knightly's **Development** instance,
or create a development application if Knightly does not exist. Record only its
public `pk_test_` publishable key in the backend's ignored
`.env.foundation.local`. No Clerk secret key is needed for session JWT validation;
the API fetches the instance's public JWKS. Do not put secret keys, passwords,
OTP codes or session tokens in source files or chat.

For hosted native authentication, inspect the dashboard's Native applications
configuration and confirm Native API access. Development hosted callbacks do not
require production registration; leave the shared development settings intact.
Production registration is a separate release gate. Browser authentication can be verified
first without a native callback. Backend JWT origins and browser CORS are both
limited to the two frontend origins on port 8095. Native JWTs without `azp` are
explicitly enabled only for this local API; signed tokens with browser origins
still have to match the origin allowlist.

## Start

Backend, from `backend/` in this checkout (requires its task-local PostgreSQL cluster
already running on port 55439):

```sh
uv run --env-file .env.foundation.local python scripts/run-foundation-dev.py
```

The runner refuses a production Clerk key, local-auth mode, a remote/shared
database or unexpected browser origins **before** constructing the application.
It applies migrations only to the dedicated local database, disables worker
startup, binds the API to loopback and avoids access logging. Keep
`.env.foundation.local` ignored and uncommitted. The database is
persistent between restarts; do not drop/reset it during session-restoration tests.
If the publishable key is still blank, the runner exits with an actionable error.

Frontend, using Node 24.21.0 / npm 11.21.0 (run `npm run env:check` first):

```sh
npm run web:foundation
# Or use the same port for the development client:
NODE_OPTIONS=--dns-result-order=ipv4first npm run dev:foundation
```

The ignored frontend `.env.local` contains only
`EXPO_PUBLIC_API_URL=http://127.0.0.1:8005`. Web and simulator use loopback. A
physical phone is intentionally not configured to reach this loopback API.
Build/install on the dedicated simulator with `npm run ios:foundation` and select the intended rebuild simulator by explicit UUID. Do not run a second Metro instance on port 8095.

## UI development without Clerk

For exercising the real app UI against a real local API without signing in:

```sh
npm run api:local     # API on 127.0.0.1:8005 as the single "local" user
npm run worker:local  # imports and analysis, in another terminal
npm run web:local     # web on port 8095 with EXPO_PUBLIC_DEV_AUTH=local
```

The runner uses `knightly_local_dev` on the existing 55439 cluster (created on
first use), refuses non-loopback or non-`*_local_dev` databases and any Clerk key,
and allows only the port 8095 web origins. The app honors `EXPO_PUBLIC_DEV_AUTH`
only when `__DEV__` is true, so production bundles always use Clerk. Sign out
starts a fresh local session for the same user. Clerk-only flows (sign-in screen,
account-deletion reverification) are unavailable in this mode. This is not
sign-in evidence; use the real identity checks below for auth work.

## Real identity verification

1. Confirm `/api/config` returns the development publishable key, `/api/me`
   rejects a missing token with 401, and CORS accepts only the foundation origins.
2. Open `/account` while signed out, finish actual Clerk authentication using a
   dedicated test account, and confirm Account's backend capabilities load.
3. Reload/relaunch; confirm the same identity/session can still fetch capabilities.
4. Sign out; confirm private content disappears and `/account` returns to sign-in.
5. On the native build, cancel hosted authentication, retry, finish sign-in,
   relaunch, then sign out. Observe callback return and secure-store restoration.

No bypass, synthetic JWT or fake auth adapter counts as real sign-in evidence.

## Import worker

Run the import worker alongside the API from `backend/` in this checkout:

```sh
PYTHONUNBUFFERED=1 uv run --env-file .env.foundation.local python scripts/run-foundation-dev.py --worker
```

The development environment guards also apply to the worker. It processes the
isolated local database with one worker and no scheduler. Use
[current status](status.md) for integration limits.

For simulator builds, keep signing enabled for Clerk Keychain initialization.
Local ad-hoc simulator signing uses `CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`.
Use `.verification/ios-derived` for disposable build output.
