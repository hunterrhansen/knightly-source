# Working in Knightly

## Start here

Use [README](README.md) for setup/current state. Read the relevant ownership section
in [architecture](ARCHITECTURE.md) and use the [document index](docs/index.md) to find
the task's accepted specification; load only the context needed.
Consult [technology decisions](docs/technology-decisions.md) when a choice is relevant.
Keep only current instructions, accepted decisions and open work; remove completed plans,
research writeups and historical verification logs once their useful conclusions are captured.
Check source/configuration for what is actually implemented. Inspect `git status`
before editing and preserve unrelated work; do not stage or commit it incidentally.

## Agent tooling

`CLAUDE.md` imports this file. `.claude/settings.json` formats edited
TypeScript/JavaScript with Biome and warns at session start when the pre-push
hook is missing. Repeatable procedures are project skills in `.claude/skills/`:
`verify-before-pr`, `update-api-contract`, `deploy-backend` and `release-ios`.
They point to the owning docs; update the doc, not the skill, when a step changes.

Third-party references are vendored beside them: `expo-router`, `expo-ui`,
`expo-upgrade`, `expo-animation` and `expo-module` (expo/skills), `react-native-best-practices` (Callstack) and
`vercel-react-native-skills` (Vercel), trimmed of images, feedback commands and
unused files. They are general advice; this file, the architecture and the
technology decisions win on any conflict:
- Development builds only, never Expo Go.
- Style through `createStyles`/`useTheme` and `src/theme` tokens; no inline-style
  mandates, NativeWind, second colour files or react-navigation `ThemeProvider`.
- Server state goes through `src/lib/api` and TanStack Query; no raw fetch
  clients, SWR, extra retry loops, token storage, offline queues or new global stores.
- Check installed versions before using a skill's API (Expo SDK 57, Reanimated 4).
- Do not add a dependency a skill recommends (expo-image, FlashList, zeego,
  Zustand, React Compiler, OTA updates, keyboard-controller, Lottie) without an
  accepted decision; keep the pins and `patches/`.
- Never run a skill's `@latest` CLIs, `eas update`, `--submit`/`--auto-submit`,
  cache or `node_modules` deletion, or file removals without the user's go-ahead.

## Backend ownership

Read `backend/AGENTS.md` for Python/API work. Frontend work stays in the root
universal Expo app; access backend behavior through its HTTP contract.
Keep the independent Python lockfile; the one npm lockfile rule applies to Expo.
Deployment migration gates and rollback are in `docs/deploy.md`.

## Setup and checks

Use the Node version in `.nvmrc` and npm version in `package.json`; check
`node --version` and `npm --version` before `npm ci`. Keep one npm lockfile and
pin compatible direct dependencies. Do not change pins to match a local shell.
Run `npm run env:check` before installation or verification.
Run `npm ci` for fresh setup or changed/missing dependencies, not every session.

```sh
npm ci
npm run web
npm test -- --runInBand
npm test -- --runInBand src/chess/coordinates.test.ts # focused test example
npm run typecheck
npm run lint
npm run verify # preflight, docs, tooling, architecture, unused code, API, lint, types and Jest
```

Run affected tests and full typechecking/lint for code changes. For dependency,
configuration, platform or shared UI changes, also run the relevant checks:

```sh
npm run verify:full # verify plus Expo checks, Storybook build and platform exports
npm run test:runtime # seven focused board/app/production browser smoke tests
```

Use `npm run format` deliberately; review its diff. Documentation-only changes
need link and consistency checks, not an application rebuild.
Use `npm run docs:check` for local links and documentation index coverage
(not remote URLs/anchors).
Verification stops at the first failure and retains logs in ignored `.verification/`.
Quality CI is configured for pushes to `main` and manual runs only, to stay within
GitHub Free's private-repo minutes; do not add pull request or branch triggers.
Its current state is in [runtime checks](docs/runtime-verification.md#ci-and-pre-push). `npm run hooks:install` once per clone makes every
push run `npm run verify`; run `npm run test:runtime` yourself before opening a PR.
Keep these standard gates; do not reintroduce custom affected-test selection.
Native runtime checks remain required locally for affected platform changes.
`npm run unused:check` finds unused files, exports and dependencies with Knip.
Register real runtime entry points; keep exceptions narrow and explain them in
`knip.jsonc`. Remove unused code rather than add ignores to pass verification.

## Documentation strategy

- Keep docs only for current tasks, contracts, accepted decisions and open checks;
  put execution summaries in PRs or commits. Git holds the history.
- Update the owning document first. Add a file only for a distinct reader need
  and link it from `docs/index.md`.
- Replace stale content rather than append updates. Remove resolved checks and
  completed plans; retain concise rationale for decisions that still matter.
- Review what a reader can do differently after reading the doc. Use the existing
  `docs:check` for links and index coverage; do not add documentation frameworks.

## Browser e2e strategy

Keep browser e2e tests as a small smoke suite for vital core functionality:
board move entry/promotion, app startup/protected navigation, and production lab
route exclusion. Prefer existing unit/component tests for rules, state machines,
validation, account isolation, retry/error permutations and rendering metadata.
Do not add e2e suites for piece polish, exact animation frames/timings, grade or
hint galleries, exhaustive theme/orientation/layout matrices, or fixture demos.
Review those visually in Storybook and on affected devices. Preserve basic real
browser input/focus checks; mocks cannot prove them. Before adding a browser test,
identify the core journey it protects and why a unit/component test is insufficient.
Add a focused regression only when a vital journey needs it; do not recreate the
removed comprehensive suites. Use the three smoke files under `e2e/` and one
`playwright.config.ts`; `test:runtime` runs all seven tests, `test:board` runs five.

## Unit and component test strategy

Test behavior vital to current app logic: authenticated data isolation, safe API
requests/import confirmation, legal board input, cancellation and stale/duplicate
submission protection. Start from a specific user-visible failure, not a source
function or desired coverage percentage. Give each behavior one primary test owner;
use component tests only where wiring adds protection beyond logic tests.
Do not add tests for development fixtures, dormant future screens, exact styling,
internal object shapes, query-key layouts or trivial forwarding reducers. Preserve
meaningful accessibility semantics and geometry bounds, not pixel snapshots.
Assert observable outcomes; titles must describe what assertions actually prove.
Keep real browser/native focus, speech and gestures in their appropriate runtime
checks; mocked native calls cannot prove device behavior.

- Define expected outcomes from an accepted requirement or real failure,
  independently of the implementation; do not compute expectations with the code under test.
- For bug fixes, demonstrate that the regression test fails before the fix and
  passes afterward. If a critical test's effectiveness is unclear, check that it
  catches a plausible fault; avoid blanket mutation or coverage targets.
- Review assertions against the intended behavior. Explain deleted coverage,
  skips or weakened assertions; remove obsolete or duplicate tests when justified.
- Use the existing verification commands and CI gates. Do not add test frameworks,
  review infrastructure or research logs solely to enforce this policy.

## Ownership rules

- Keep `src/app/` for routes, layouts and composition; features own workflows.
- Shared `src/chess/`, UI and theme code must not import feature workflows.
  Pure chess mechanics stay independent of rendering, auth and network access.
- Features own canonical positions, submission and progression. The controlled
  board owns temporary input/focus/promotion state and emits correlated attempts.
  Preserve position/attempt identities and stale-result guards.
- Reuse intentional public interfaces; avoid private cross-feature imports and
  cycles. Register cross-feature API files in `architecture.config.json`;
  `npm run architecture:check` enforces boundaries and platform-specific cycles.
  Keep folders shallow; create layers only when needed.
- Use kebab-case owned filenames, named exports, and colocated tests/stories;
  preserve Expo Router/tool-required filenames and default exports.

## Project constraints and gotchas

One universal Expo app; online-only first release. The existing backend owns
saved grades and canonical learning progress; the app may judge practice moves
from served solutions for instant feedback, but the server re-grades what it saves. See the architecture for planned API,
auth and state ownership; selected dependencies are not necessarily installed.

Use a development build; Expo Go is not a supported workflow. Generated
`ios/` and `android/` projects are ignored; configure native behavior through
`app.config.ts`. Keep web/native adapters behind the same public contract.
Import platform adapters through their extensionless base path so the resolver
selects the variant; check behavior on the affected platforms.
Before using Expo, React Native or Router APIs, check installed package versions
and matching official documentation; do not rely on remembered APIs or latest
docs for a different version.
Board/gallery providers must work without Clerk or backend configuration.
The board lab and native Storybook are development surfaces; preserve production
exclusion. Record artwork/font provenance in [asset licenses](assets/licenses/README.md).

## Completion evidence

Verify observable behavior, including meaningful regression cases. Jest mocks
native bridges; passing tests or exports do not prove gestures, spoken
accessibility or native runtime behavior. For UI changes inspect affected
platforms, narrow layouts and large text as applicable (dark only; there is no light theme). Report exact
commands/results and unavailable checks; keep remaining gates visible in
[current status](docs/status.md).
Use the [runtime guide](docs/runtime-verification.md) for isolated browser runs,
selected-device native smoke and retained evidence. Spoken accessibility stays manual.
Update affected specs/docs when behavior changes. Distinguish implemented,
verified and released; never mark a feature complete from mock data or bundling.
Do not weaken assertions or suppress warnings merely to pass checks.
