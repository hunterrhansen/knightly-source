# Chess.com import

Implemented October 10, 2026; now integrated with the board in the primary
frontend checkout. Current limits are in
[foundation status](status.md).

## Flow

Today directs a signed-in user without linked accounts to Connect games. Enter a
public Chess.com username, look up its profile, and explicitly confirm the account
before importing. Knightly needs no Chess.com password. Confirmation calls the
existing authenticated backend account endpoint, which queues import and analysis.

Today, Connect games and Games show persisted import progress. Games displays real
imported records with pagination. An import continues in the backend after leaving
the screen or restarting the app. Sync games queues another update. Request errors
offer retry; failed background runs retain already imported games. Practice remains
unavailable until its actual backend contracts and session UI are implemented.

## Backend and state

Reuse `/api/lookup`, `/api/accounts`, `/api/onboarding`, `/api/status`,
`/api/update/run` and `/api/games`. Backend response models document existing
responses in OpenAPI while preserving legacy game fields. No database migration or
import algorithm change is required.

Use the existing session-scoped TanStack Query client for profile lookup, progress,
status and paginated games. Mutations do not automatically retry. Successful writes
invalidate affected queries; one shared observer per session refreshes Games,
Progress and deck summaries when live import data changes. Hydration and unchanged
poll responses do not refresh summaries. Active imports poll
every three seconds. Polling stops on request failure and resumes through explicit
retry. Fresh Clerk tokens authenticate requests; disposal aborts outstanding reads
and writes, drops late responses and clears identity-scoped caches. Zod validates
consumed responses against the checked-in generated API contract.

## Local worker

Run alongside the isolated API from this repository’s `backend/` directory:

```sh
PYTHONUNBUFFERED=1 uv run --env-file .env.foundation.local python scripts/run-foundation-dev.py --worker
```

The same development key, database and origin guards apply. One worker processes
existing per-user jobs; the scheduler is disabled. Keep the API on port 8005 and
Metro on port 8095. This setup uses the dedicated local database; the integrated frontend also
contains the board workshop.

## Current limits

Games pagination and background progress are implemented. Completed analysis and
real practice sessions are separate capabilities; do not infer them from import
success. Profile statistics and imported totals can differ because the backend
imports games beyond the profile's rated-game count. Use [status](status.md) for
remaining live identity/backend checks.
