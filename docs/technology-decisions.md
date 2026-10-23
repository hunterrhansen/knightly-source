# Technology decisions

Accepted direction; source/configuration establishes what is installed.
Current implementation gaps and release checks live in [status](status.md).

## Application and ownership

One universal Expo/Expo Router application and npm package; retain the existing
FastAPI backend. Adapt desktop/native layouts without duplicating feature logic.
Use shallow feature folders, thin routes, deliberate public APIs and colocated
tests/stories. Named exports and kebab-case filenames are preferred; preserve
framework-required names/exports. [Architecture](../ARCHITECTURE.md) defines the
boundaries; the architecture checker enforces them.

The controlled board owns temporary selection, dragging, focus and promotion.
Features own canonical positions, grading, history and progression. Preserve
position/attempt/transition identities and stale-result guards, including same-FEN
resets. Local correlation IDs do not establish server idempotency. chess.js owns
standard chess mechanics; preserve history for repetition and own analysis branches.

Game analysis, grading and the game's engine lines come from the backend's
Stockfish. Side lines explored in review are evaluated on the device by
Stockfish 19 Lite, as Lichess and Chess.com do: `stockfish` 19.0.1's
single-threaded lite WASM build in a web worker (no cross-origin isolation
needed) and a local Expo module compiling the same release with the small
network on iOS and Android. The server alternative was rejected for its
1–1.5 s per move against instant, deepening evals. Stockfish is GPL-3.0 and the
module links it into the apps, so shipped app builds carry GPL obligations,
accepted on 2026-10-22. See [line exploration](specs/2026-10-22-line-exploration-design.md).

## UI, artwork and interaction

Style with React Native `StyleSheet` and an owned theme in `src/theme/theme.tsx`:
`createStyles((theme) => …)` at module level, `useStyles()` in the component,
`useTheme()` for theme values. `ThemeRoot` provides the one dark theme with the
Board preference's colours. Styles are plain RN styles cached per
theme, so they apply identically to Reanimated, Expo Router `Link` and wrapped
components on every platform; a theme change re-renders its readers, which is
negligible at this app's scale. No native module, Babel plugin or Expo Go blocker.

Unistyles 3 was used first and removed: on web its styles repeatedly failed to
reach Reanimated views, `Link asChild` children and `withUnistyles` children
(board resizing, unstyled links, stretched pages), Storybook needed a custom
plugin to replicate its Babel import swap, and its Nitro native module required
development builds. The app used only its themes and style functions, not its
breakpoints or variants. Tamagui was rejected earlier for more conventions and
integration surface than this project needs. Shared components follow RN
Primitives/React Native Reusables patterns as references, not an installed
component base, and use universal Expo UI for standard pickers and text inputs.
Add controls for actual product needs. TypeScript tokens own
the semantic dark theme, typography, geometry and motion; no token generator.
The internal design system's public entry is `src/ui/index.ts` (for example,
`import { Button, Card, TextField } from '@/ui'`). Existing implementations stay
in `src/components/ui`; theme ownership stays in `src/theme`, which features and
shared UI import directly (`createStyles`/`useTheme` and `tokens`), without a
second configuration, re-export or package.
Use the shared TextField for visible labels, accessible names, keyboard focus,
editable/busy state and optional help/validation feedback. It wraps universal
Expo UI TextInput, synchronizing feature-owned strings with `useNativeState`.
Secure entry and autofill map through the universal API. Its ref is Expo UI's
TextInputRef; callbacks use Expo's string/no-argument contracts. `textStyle`
styles text; the existing `style` font-size override remains supported.

Keep Expo SDK 57; Expo's installed
compatibility map recommends the installed `@expo/ui` 57.0.26. Prefer root
`@expo/ui` imports for controls it covers. SettingsPicker supplies universal menu
pickers for Board colors and Week starts on; existing web detail URLs/navigation and iOS
inline menus remain intact. Preference loading, persistence and errors stay in
the existing PreferencesProvider. Native settings text/password/code rows and
native Games search use the same controlled universal input adapter. Games
search/connection fields use the shared TextField on web/Android, retaining
their search limits and callbacks. Hosted native Form rows reuse their parent Host; standalone branded fields own a themed universal Host. ControlHost
pins controls to the dark scheme and scopes Knightly semantic colors on web, so
a light operating system never lends controls its palette. Universal controls
render SwiftUI on iOS, Compose on Android and web controls in the browser.

The pinned [Expo UI patch](../patches/@expo+ui+57.0.26.patch) forwards accessible
picker names, text-field names/hints and web help/error/disabled attributes omitted
by 57.0.26. `patch-package` applies it during npm ci/postinstall and fails if it
cannot apply. It changes no selection or input state logic. Reassess/remove it
when upgrading Expo UI; an unpatched upgrade is not behaviorally equivalent.
Branded fields use a thin border and a soft 3px outer focus ring inspired by
React Native Reusables. Focused errors retain their red border/ring. On iOS,
the rounded border is painted outside Expo UI to avoid its clipped rectangular
stroke; the native input and accessibility behavior stay intact.
Browser/runtime review must check the actual controls, since Jest mocks their
native bridges. Android and spoken accessibility remain release gates.

Direct SwiftUI remains for native grouped Forms, decorative artwork and
confirmation sheets not migrated here. Their public content entry is
`src/ui/native-settings.ts`, imported only by iOS adapters inside a native
Form/Host; do not export SwiftUI content from the platform-neutral barrel.
Import platform adapters through extensionless paths. Branded buttons/cards and
chess rendering use themed RN styles. The design system owns no game rules,
account mutations, routes or feature state. Shared ownership boundaries include
`src/ui` and are enforced by the existing architecture checker.

The board uses React Native views/SVG, Gesture Handler and Reanimated. Lichess and
Chess.com are behavior references; never copy their code, artwork or sounds
(see asset licenses).
Knightly's cream/green identity, Fredoka and Nunito stay the default. Pieces
default to the Classic set (Colin M.L. Burnett's CC BY-SA 3.0 cburnett pieces, as
on Lichess), with Knightly artwork as an option; move sounds are
Knightly-generated and played with `expo-audio` (playback only, no config plugin).
Daily reminders use `expo-notifications` local scheduling only (no push); web has
none. Expo auto-applies its plugin, which adds the iOS push entitlement, so
`app.config.ts` strips `aps-environment` to keep the App Store profile signing.
Preserve [asset licenses](../assets/licenses/README.md).

The streak calendar builds its Sunday- or Monday-first month grids with Flash Calendar
(`buildCalendar`; its required FlashList peer is pinned directly at the Expo-recommended
version, JavaScript-only in v2) and owns its
rendering, week-to-month gesture and motion with Gesture Handler and Reanimated.
Wix's react-native-calendars `ExpandableCalendar` was the behavior reference; it
was not adopted because it brings its own legacy animation, date and list stack
and is harder to theme with the owned theme.

Victory Native with Expo-compatible Skia is the accepted chart choice for
Progress. The isolated chart prototype has web interaction verification; native
interaction remains a user-owned phone check with the final build. CanvasKit is
served locally with matching package versions and deferred browser loading;
Storybook uses the same renderer. Static charts without gestures (the Progress
skill radar) use `react-native-svg` and need no CanvasKit. See the
[Progress specification](specs/2026-10-11-progress-design.md).

Rive is not used. It was trialled only in the board lab and removed before any
product screen adopted it; its runtimes cost about 5 MB of native library per
iOS/Android ABI, a 2 MB web WASM and a Nitro module. The mascot and animated UI
states stay code-drawn (SVG with Reanimated and the motion tokens). A future
animation runtime for commissioned art is a new dependency decision.

Tap, drag, keyboard and accessibility activation converge on one attempt pathway.
Promotion cancellation emits no move; choice emits once and restores focus.
Incorrect practice attempts remain previews until explicit Retry; they never
commit canonical state. No lives, automatic hints or fabricated explanations.
Help is opt-in; assisted/retry success must not claim independent mastery.
Technical save failures are recovery states, not incorrect chess answers.

Motion never commits/grades a move or delays progression. Reduced motion preserves
status and immediate completion. Keep kings upright in the approved result dialog.
Actual keyboard, spoken feedback, modal isolation/focus and large-text reachability
need affected-platform checks. See the [board spec](specs/2026-10-10-universal-chessboard-design.md).

### Dark-only theme

Knightly is dark only (decided 2026-10-18). The watch is a night story and its
scenes stay dark, so a light page fought the art and doubled every visual check.
There is no Theme preference and no light palette: `darkTheme` in
`src/theme/themes.ts` is the only theme, `app.config.ts` sets
`userInterfaceStyle: 'dark'` so native controls and system UI ignore the device's
light setting, and `src/app/+html.tsx` fixes the web page to `color-scheme: dark`
on the theme's page colour. A `theme` value saved by older builds is dropped when
preferences load. Do not reintroduce light-mode branches, `useColorScheme` reads
or a scoped light theme; review screens and art on the dark page only.

## Data, authentication and forms

TanStack Query owns server state; React state/reducers own temporary UI/session
state. No additional global store. openapi-typescript generates types from the
committed FastAPI OpenAPI snapshot; openapi-fetch handles transport. CI checks type
regeneration drift. Zod validates consumed responses before caching; generated
validator tooling remains unevaluated. Do not describe the current validators as
a generated pipeline or add a generator without a concrete need.

Clerk owns identity/token refresh. Use current tokens, session-scoped query keys
and cancellation; clear/dispose caches on identity changes and ignore late responses.
SecureStore is for native auth tokens; AsyncStorage holds display preferences,
validated public configuration and bounded read-only account snapshots. Query
persistence is shared infrastructure, scoped to API/user/Clerk session and cleared
on explicit sign-out or identity replacement. Snapshots expire after 24 hours;
restored reads refresh in the foreground while cached content stays visible.
Use TanStack's standard AsyncStorage persister for throttling, with guarded
storage and schema/size/expiry serialization policy. Only persisted reads keep
the 24-hour memory lifetime; unrelated reads retain five-minute collection.
Import changes have one summary-refresh owner per authenticated scope.
Do not persist tokens, mutations, settings or unfinished learning sessions. See
the [foundation contract](specs/2026-10-10-app-foundation-design.md).
Never store secrets in public client configuration. Keep one retry owner; mutations
must not automatically replay without backend deduplication/reconciliation.
Only server acknowledgement establishes saved progress.

React Hook Form with Zod is accepted for forms that need coordinated field state;
install it when such a form exists. Ordinary React state suffices for simple inputs.

The review deck's FSRS is tuned per user on the server, as Anki's Optimize does
(decided Oct 16, 2026). The server image installs the backend's `optimizer` extra
with PyTorch's CPU-only Linux build: on arm64 the image grows from about 0.7 GB
to 1.8 GB (built on the VM, Oct 16), in a dependency layer that changes only with
the lockfile. The image is built with `UV_NO_CACHE=1`; uv's download cache would
otherwise add another 0.8 GB.
That's acceptable on the free 24 GB / 100 GB Oracle VM, and tuning takes seconds of
CPU a month per user. PyPI's Linux torch is not: it brings 2–4 GB of CUDA packages,
so `pyproject.toml` pins torch on Linux to the CPU index; keep that pin. After a
daily update the worker tunes a user once they have 512 graded reviews, then again
every 30 days if they have new reviews (`deck.maybe_tune`). Unusable parameters, a
failed fit or a missing optimizer keep the parameters in use and retry a week later.
Tuning does not reschedule existing cards (Anki's default). If the image ever has
to shrink, the fallback is tuning offline with `knightly fsrs-optimize` and storing
the result in the user's `fsrs_parameters` setting, which `deck.scheduler` already reads.

### The database lives on the VM

Accepted 2026-10-20. Each environment's Postgres 17 runs on the Oracle VM as its
Compose `db` service (`deploy/compose.yml`), beside the API and worker, not in
Supabase. Measured on production before the move: every query was a ~44 ms round
trip from the VM (Oracle us-phoenix-1) to Supabase (AWS us-west-2), and `/api/home`
made 107 of them, 6.4 s for a 740-game account. Knightly used Supabase only as plain
Postgres (sign-in is Clerk, the Data API is off), the database is under 100 MB, and
the VM has the memory and disk to spare. Staying on Supabase fast would mean moving
the API and worker into AWS beside it at a monthly cost; Supabase in N. California
was measured at ~21 ms per query, still remote. We run Postgres ourselves: nightly
`pg_dump` to R2 (`deploy/backup.sh`) is the only off-machine copy, so it must keep
working, and Postgres major upgrades are a planned dump-and-restore. The Supabase
projects stay untouched as the rollback until deleted on purpose. Fewer round trips
per request (`db.Connection.remember_reads`) stays the rule wherever the database is.

## Scope and testing

First release is online-only. No PowerSync, practice database, durable offline
queue or cross-device unfinished-session resume. Revisit these only for actual
product needs. Canonical grading/learning progress remains on the backend.

Jest owns detailed logic/component cases; Storybook supports visual review.
Browser e2e remains a small core smoke suite under the [agent policy](../AGENTS.md#browser-e2e-strategy).
CI runs `verify` and the seven browser smoke tests on pushes to `main` and manual
runs only (GitHub Free's private-repo minutes); see [runtime checks](runtime-verification.md#ci-and-pre-push)
for the pre-push hook. Native smoke and spoken/accessibility/performance checks are
affected-platform/release gates.
Biome owns lint/formatting; TypeScript owns types; do not introduce overlapping tools.
Knip owns unused-file/export/dependency checks in `verify`; its configuration
records runtime entry points and narrowly explained exceptions.

## Build and release

Use pinned Node/npm and one lockfile. Native projects are generated from Expo
configuration; development builds are the supported workflow, not Expo Go. Native
Storybook's safe-area-compatible version and the TypeScript Expo-check exclusion
are deliberate; do not change pins or suppress peer checks to fit a local shell.

GitHub Actions owns quality gates. EAS Build/Submit, TestFlight/Google Play internal
testing and EAS Hosting are accepted release directions; retain the existing API host.
Sentry is accepted for production reporting with filtering of credentials, identity
and sensitive user/game data; configuration is deferred. EAS profiles are described in the [README](../README.md#phone-builds);
release setup gaps are tracked in [status](status.md). Keep separate development/staging/production
identities/data, compatible backend contracts and a recovery path. OTA/EAS Update
is deferred. Release channels, minimum OS versions and performance budgets remain
product/release decisions; no automatic publishing is implied.
