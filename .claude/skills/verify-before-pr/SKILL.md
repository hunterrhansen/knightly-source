---
name: verify-before-pr
description: Run Knightly's full pre-PR gates (Expo verify, browser smoke, backend pytest). Use before opening or updating a pull request, before merging to main, or when asked whether a branch is ready. CI does not run on pull requests, so these local runs are the gate.
---

# Verify before a pull request

Quality CI runs only on pushes to `main` (see
`docs/runtime-verification.md#ci-and-pre-push` for its current state), so a pull
request is checked here. Run from the repository root and stop at the first failure.

1. Environment: `node --version` and `npm --version` must match `.nvmrc` and
   `package.json` `engines`. Then `npm run env:check`. Run `npm ci` only if
   dependencies changed or `node_modules` is missing.
2. `npm run verify` — preflight, docs, tooling tests, architecture, Knip, API
   contract, lint, typecheck and Jest. Logs stay in `.verification/`.
3. `npm run test:runtime` — the seven browser smoke tests (first time per
   machine: `npx playwright install chromium`).
4. If the branch changes `backend/` (`git diff --name-only origin/main...HEAD -- backend`):

   ```sh
   cd backend
   uv sync --locked
   KNIGHTLY_TEST_DATABASE_URL=postgresql://127.0.0.1:<test-port>/postgres uv run pytest -q
   ```

   Use a dedicated disposable local cluster; ask the user for its port if unknown.
   If routes or models changed, also follow the `update-api-contract` skill.
5. For dependency, configuration, platform or shared UI changes, also run
   `npm run verify:full`, and check affected native platforms by hand
   (`docs/runtime-verification.md`).

Report each command and its result in the PR description. Name any check you
could not run; never describe a skipped gate as passing.
