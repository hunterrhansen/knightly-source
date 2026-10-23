---
name: update-api-contract
description: Regenerate the Expo API contract after a backend endpoint or response model changes. Use when backend/src/knightly/schemas.py models or backend/src/knightly/routes/*.py routes change, when `npm run api:check` reports drift, or when CI's "Backend OpenAPI differs from the Expo contract" check would fail.
---

# Update the API contract

The backend's OpenAPI schema is snapshotted in `contracts/knightly.openapi.json`;
`src/lib/api/schema.d.ts` is generated from it. Both are committed. Never edit
either by hand, and never export the schema against a hosted database.

1. Export the schema from an isolated local test database (see `backend/README.md#verify`).
   `KNIGHTLY_SCHEMA_OUTPUT` must be absolute; the test refuses non-local hosts.

   ```sh
   cd backend
   KNIGHTLY_TEST_DATABASE_URL=postgresql://127.0.0.1:<test-port>/postgres \
   KNIGHTLY_SCHEMA_OUTPUT="$PWD/../.verification/backend-openapi.json" \
     uv run pytest -q tests/test_openapi_snapshot.py
   ```

   If the test is skipped, `KNIGHTLY_SCHEMA_OUTPUT` was not set. If no local
   Postgres test cluster is running, ask the user for its port; do not guess.

2. Review the diff against the snapshot, then accept it. Only accept changes the
   backend change intended; unexpected drift is a bug to report, not to hide.

   ```sh
   diff <(jq -S . contracts/knightly.openapi.json) <(jq -S . .verification/backend-openapi.json)
   cp .verification/backend-openapi.json contracts/knightly.openapi.json
   ```

3. Regenerate and check the TypeScript types:

   ```sh
   npm run api:generate
   npm run api:check
   ```

4. Update the response decoders/clients in `src/lib/api/` that use the changed
   paths, then run `npm run typecheck` and the affected Jest tests.

Commit the backend change, `contracts/knightly.openapi.json` and
`src/lib/api/schema.d.ts` together.
