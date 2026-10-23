# App foundation: shell, authentication and backend connection

Date: October 10, 2026.
Status: approved and implemented; deployed to production. Today's current
behavior is in the [Today daily review](2026-10-13-today-daily-review-design.md) spec.

## Intent and first deliverable

Build the production foundation alongside the shared-board implementation. A user can sign up or sign in with the existing Knightly Clerk identity, enter an accessible responsive shell, load authenticated backend capabilities, and sign out without leaking data between sessions. This slice does not require the completed chessboard.

Keep the existing app and backend available. Preserve one universal Expo application, thin Expo Router routes, owned themed components, online-only operation, and server-authoritative user isolation.

## Approved navigation and delivery approach

Use the path (Watch) as the landing experience and the only screen: Games, Progress and Account open over it as modals, with no tab bar or sidebar (see [the path home](2026-10-19-path-home-design.md#one-screen-no-tab-bar)). Practice and review open as focused experiences outside the primary navigation. Keep route identity and logic shared; adapt navigation presentation to the available width.

The user approved the Today direction and requested structure/functionality first, with visual refinement afterward. Establish route ownership, working navigation, session states, account isolation, responsive layout, accessibility and error recovery before polishing illustration, motion, spacing or typography. Existing semantic tokens and owned controls remain the baseline. Accessibility, honest state and the primary-action hierarchy are functional requirements, not later polish.

Production capability registration exposes implemented destinations and suppresses
inactive learning CTAs. The integrated app now supports Today, Account, Games,
Progress, connect-games, daily practice and game review through their owning
feature slices. Bot play is not part of the app. Gallery/lab fixtures may exercise every
proposed destination; they never save learning data. An unavailable backend
summary is never interpreted as new-user or done-for-today data.

### Learning funnel refinement

The user approved prioritizing due personalized practice over new-game review on October 10, 2026. Game review remains a secondary action when practice is due. Today and its three core states were approved in the following review. Detailed visual tuning remains iterative.

The approved state-aware primary action prioritizes starting and completing useful personalized learning, with one prominent action rather than equally weighted practice/review cards.

Today should recommend a state-appropriate action: continue an in-memory session, start due practice, review an eligible analyzed game when no practice is due, or connect/import games when no content is usable. Loading and failures remain explicit; completed recommended work gets a natural stopping point. Games, Progress and Account provide deliberate alternatives. Review must not become a prerequisite before every practice session.

For ready returning users, target one activation from Today to the first actionable position. First-use setup should prioritize a useful analyzed result rather than optional goals/settings or a complete history import. Verify backend capability and actual latency before promising processing duration. Verify the first-use, returning and completed-work states during implementation; measure session readiness and completion, not just CTA clicks.

Adapt a shared destination model to mobile navigation and a desktop sidebar/header. Preserve meaningful URLs, browser back/forward, native Back, selected-state semantics, safe areas, visible keyboard focus and large-text layouts. Account includes signed-in identity, sign-out and the user settings described below; server administration remains separate.

Focused practice/review sessions will be separate from the primary shell. Their close/back behavior must be explicitly designed when those features are added, rather than copied from the old app's always-return-Home behavior.

## Approved Today states

| State                                    | Main content/action                                                                        | Secondary content                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| New user, signed in with no usable games | “Learn from your own games”; Connect your games. Explain Chess.com/Lichess support.        | PGN import when supported; explain that the first session appears after analysis. No fake counts or required optional setup. |
| Returning user with due practice         | Verified count of positions ready and Start practice, opening the session directly.        | Review latest eligible game with lower visual emphasis; actual import/status information when relevant.                      |
| Due practice complete                    | “Done for today”; verified practiced count and saved acknowledgement; “You can stop here.” | Optional game review and progress. No new urgent primary CTA or claim that all game review is complete.                      |

Fixture counts (six positions in the wireframe) are illustrative, never hard-coded product data. Announce saved completion only after backend acknowledgement. Zero due positions alone does not establish that the user completed practice; if an unreviewed game exists and no work was completed, recommend review instead. A user with a deck but nothing due and no completed work sees a truthful “No practice due” state, not “6 positions practiced.” Unknown/failed data renders an unavailable state with appropriate Retry. Missing content distinguishes not connected, importing, analyzing and failure; actions appear only when supported.

Preserve an active session only while it remains in memory; no durable or cross-device resume is implied. Continue takes precedence over starting another session. Large text and keyboard/screen-reader interaction must preserve the main-action hierarchy. The first layout pass uses a 768-logical-pixel breakpoint, then checks narrow desktop and large text before tuning it.

## Foundation scope and later feature adapters

The foundation owns public `/api/config` and authenticated `/api/me`; it does not infer learning counts from `/api/me`. Today, Games/import, practice, review and Progress each own their endpoints as feature slices through `src/lib/api` (see the [feature map](../../ARCHITECTURE.md#feature-map)). Storybook and a development-only shell lab demonstrate learning states and route actions using fixtures.

Features supply real data through typed view-models and explicit actions without changing navigation/auth infrastructure. A production-unavailable destination must not become a working-looking fake lesson.

## Foundation approaches

Recommend a small authenticated vertical slice: runtime bootstrap, Clerk session, guarded shell, typed `/api/me`, and account/sign-out. It provides real integration evidence before import/review work.

A shell-only prototype can settle visual navigation faster, but it does not verify account isolation or the backend. A full port of old navigation, authentication and API wrappers introduces more coupled code and carries forward hand-written response types. Use old code as read-only reference instead.

## Configuration and startup

Configure one API origin per environment. Validate it before requests; hosted environments require HTTPS, with an explicit development-only localhost HTTP exception if needed. Do not let users point a signed-in client at arbitrary servers. The public Clerk key comes from the configured server's `/api/config`, preserving the existing runtime bootstrap pattern. Never bundle a Clerk secret key or backend credential.

Startup has distinct states: invalid configuration, loading public configuration, configuration unavailable, authentication loading, signed out, and signed in. Missing/null Clerk configuration is an unavailable-account state, not permission to use the backend's local single-user fallback. Retry public bootstrap explicitly; do not mount account queries before an authenticated session exists.

Do not fetch public configuration during static web generation. Render a stable loading/sign-in frame without browser-only storage access, then bootstrap on the client. Keep public privacy/contact information accessible while signed out. An existing signed-in shell remains usable if a later data request fails; a backend outage is not automatically a signed-out session.

## Authentication boundary

Use Clerk's supported Expo SDK and token cache, backed by SecureStore on native. Clerk owns session persistence and token renewal; application code obtains the current token per request and never duplicates tokens into AsyncStorage or another store.

Accepted sign-in surface: Clerk-hosted authentication on native and Clerk's supported web components through a narrow platform adapter. This follows the current app's hosted-native/prebuilt-web direction. Custom password/verification forms add substantial auth-state and accessibility work; native prebuilt components are currently documented as beta and are not the default proposal.

The auth adapter exposes loading/signed-out/signed-in state, user identity, token acquisition and sign-out. Features do not import platform-specific Clerk sign-in UI. Native authentication cancellation stays on sign-in without treating cancellation as a failed account. Callback URLs, app identifiers, enabled sign-in methods and web origins must be verified against the existing Clerk environment before runtime checks.

Protected routes control client navigation, not backend authorization. Preserve an allowlisted internal return destination when signing in from a protected deep link; never accept an arbitrary external redirect. Clear it when signing out or changing account. Privacy and authentication callbacks remain public; the existing development-only board workshop stays independently accessible in development and excluded from production.

## Account-scoped data and transport

Use the accepted `openapi-typescript`/`openapi-fetch` foundation under TanStack Query. Commit a reproducible OpenAPI snapshot and generated types. Validate bootstrap and first consumed responses at the boundary with the accepted Zod tooling; verify any generation approach before expanding its coverage. Do not pretend generated TypeScript validates JSON at runtime.

The first authenticated request is `/api/me`. Its current payload contains `admin` and `limits`, not a user profile. Display the account name/email from Clerk; do not invent profile fields in the backend contract. Treat admin visibility as backend capabilities and leave admin UI outside this slice.

The shared transport handles current-token acquisition, abort signals, success decoding and normalized failures. Distinguish cancellation, missing/expired authentication, forbidden access, validation, rate limits, network failure, server error and malformed responses. Query hooks own query keys and presentation; they do not parse unrelated raw HTTP errors.

Scope queries to API environment and authenticated identity. Each active session has an epoch so requests from an old session cannot update the new one. On sign-out/account switch, immediately remove the previous account subtree, cancel requests, dispose/clear its query cache and invalidate late callbacks. Use an isolated QueryClient per active session, with teardown sequencing defined in the implementation plan.

Use one retry owner. Initially disable automatic retries; explicitly enable bounded retries only for proven-safe reads when needed. Never automatically resend writes. A backend 401 exposes authentication recovery without infinite refresh/retry loops; a network outage must not erase the Clerk session. No offline mutation queue is introduced.

Returning launches restore validated public sign-in configuration and selected
read-only account data from AsyncStorage, then refresh in the foreground without
replacing usable content with a loading screen. Public configuration is scoped to
API origin and expires after 24 hours; invalid configuration received from the
server removes the cached configuration and exposes recovery. Temporary refresh
failures keep an already opened shell usable. Clerk must establish the current
authenticated identity before private data is restored.

One shared TanStack persistence boundary owns restoration and storage. Existing
feature query hooks retain their keys, request functions and invalidation behavior.
Private snapshots are scoped to API origin, user and Clerk session, schema-checked
on restoration, versioned and limited to 50 recently updated queries and 2 MiB.
Capabilities, linked-game summaries, Games and Progress are eligible; settings,
lookups, import-run status, full game reviews, tokens, mutations and unfinished
practice/review state are excluded. Cached deck responses are display data only;
starting practice still obtains a fresh backend deck. Each query expires after
24 hours based on its last successful response. Queries remain stale by default
and refresh on mount and app foregrounding; errors retain the last usable data.
Explicit sign-out and account/session replacement stop persistence and remove the
previous disk snapshot, including writes already in flight. Storage failures fall
back to the ordinary in-memory/network behavior. This is a startup cache, not an
offline learning or saved-progress guarantee.

TanStack's standard AsyncStorage adapter throttles snapshots to one write per
second and coalesces bursts. Fetch-status and failed-refresh notifications with
unchanged response data do not schedule additional disk writes. Custom storage
guards serialize removal behind in-flight writes and reject delayed saves from
retired scopes; custom serialization keeps validation, size and expiry policy.
Persisted reads retain 24-hour in-memory lifetimes, while unrelated lookups,
settings and explanation reads retain the five-minute default. Restored queries
receive the persisted lifetime before observers mount. Keep the session boundary
mounted through Clerk's signed-out/loading states so session expiry and account
transitions clear retired snapshots without erasing them on an ordinary app
unmount. Late restoration of a disposed client is discarded.

One import-change subscriber per authenticated scope coordinates summary
invalidation across all consuming screens. Restored data provides its baseline;
only changed live import responses refresh Games/Progress/deck reads. Those reads
do not run separate import polling timers. Explicit import actions and confirmed
practice/review saves still invalidate the affected resources.

## Backend changes and environment prerequisites

Backend contract for the Expo client:

- `/api/config` is public and in the OpenAPI schema with a precise response model (`clerk_publishable_key`, `contact`).
- `/api/me` is authenticated and typed, including `admin` and `limits` (`history_months`, `max_analysed`, `max_accounts`) and its error contracts.
- App creation applies pending migrations, so generate OpenAPI against a disposable local test database, never a hosted one.
- The Expo web origin calls the API directly through an explicit CORS allowlist; CORS permission stays distinct from JWT `azp` validation.
- Browser token origins are validated through `KNIGHTLY_ALLOWED_ORIGINS`. Native tokens without `azp` require `KNIGHTLY_ALLOW_NATIVE_AUTH=1`; present origins must still satisfy the allowlist. Issuer/signature/expiry checks and user-scoped database access are preserved.

Contract/CORS changes are implemented in the retained `backend/` package. Keep
the original frontend in the original repository; frontend workflows belong in
the universal app. Deployment handoff follows the current deployment guide.

## Ownership

`src/lib/` owns config/auth/API/query infrastructure, `src/features/account/` owns account screens, and `src/features/shell/` owns navigation. Shared UI extensions stay small and driven by actual shell needs. Do not create empty feature layers. The board/gallery providers must not require Clerk, backend configuration or a QueryClient.

## Acceptance evidence

Demonstrate sign-in, protected navigation, authenticated `/api/me` and sign-out on web and iOS; Android runtime evidence remains a required gate if tooling is unavailable here. Document unavailable checks instead of treating exports as runtime verification.

Tests focus on configuration failure, absent Clerk key, auth loading without private requests, sign-in cancellation, callback/deep-link safety, 401 versus network outage, malformed JSON, and account A signing out while its request resolves after account B signs in. Backend tests pin contract schema, unauthenticated 401, existing user isolation, allowed/disallowed web origins, preflight and native-token policy. Use dedicated local test databases.

Shell stories cover narrow/wide layouts, large text, keyboard focus, loading and unavailable data. Required browser smoke checks offline protected navigation and workshop reload. Component/unit tests own detailed bootstrap, Today and session cases; real sign-in return, account display and sign-out remain manual integration checks. Native smoke covers hosted-auth callback, restored session after restart and sign-out. Run typecheck/lint/affected tests, dependency compatibility checks, and platform exports after implementation.

## Implementation notes

### Shared screen frame

`src/components/ui/screen.tsx` provides an Ignite-inspired `Screen` using existing
React Native, safe-area-context and the owned theme. `preset="scroll"`
is the default; `fixed` leaves scrolling to children such as a virtualized list;
`auto` enables scrolling when measured content exceeds the available viewport,
including after content changes or resizing. Unknown dimensions retain scrolling.
Titles, gutters, maximum widths and navigation remain composed by the consumer.
`style` controls the outer frame; `contentContainerStyle` controls its content.
Scrolling presets accept `scrollViewProps` for native scroll options and callbacks.

Safe-area edges default to `[]` because `AppShell` already supplies insets.
Standalone screens opt into the edges they own. Automatic scroll inset adjustment
defaults to disabled to avoid duplicate insets. Forms opt into `avoidKeyboard`
and can supply `keyboardOffset`; native uses `KeyboardAvoidingView`, while web
keeps browser behavior. This does not provide automatic focused-field scrolling.
System bars remain owned by the app rather than each screen.

Storybook's **Layout/Screen** examples cover fixed/scroll/auto, content expansion,
narrow dark/large headings, wide light and a keyboard form. Native system font
scaling and keyboard/safe-area behavior still require device review. `Page` now composes Screen, ScreenHeader and ScreenContent for all current app
routes. Standalone routes retain opt-in safe areas; connection forms opt into keyboard avoidance.
Reference: [Ignite Screen](https://docs.infinite.red/ignite-cli/boilerplate/app/components/Screen/).

### Shared screen content

`ScreenContent` composes inside `Screen` and owns content alignment, padding and
width limits. `width="reading"` defaults to the existing 760-point page limit;
`wide` uses the 1000-point content limit; `full` fills the available width.
Limits include padding, and all modes shrink to fit their parent.
Horizontal gutters are 16 points below 768 points of available container width
and 24 points at or above it; vertical padding stays 24 points. The wrapper
measures its parent allocation, not the device viewport, so sidebars, split views
and Storybook frames use the same rule. Before measurement it uses compact gutters.
Values live in theme tokens. `style` overrides the inner content container last;
children own their arrangement and spacing. Scrolling, safe areas and keyboard
behavior remain with `Screen`; avoid nesting padded `ScreenContent` wrappers.

**Layout/Screen content** previews reading, narrow dark, wide board/details,
full-width and interactive container resizing. Existing **Layout/Screen** stories
also compose the shared wrapper. Current production pages use this composition, with shared spacing between children.

### Shared screen header

`ScreenHeader` adapts [Ignite Header](https://docs.infinite.red/ignite-cli/boilerplate/app/components/Header/)
into an owned themed component. It requires a title and supports a subtitle,
`titleMode="center"` (default) or `flex`, and optional `startAction`/`endAction`.
Actions require an accessible `label` and `onPress`, accept `disabled`, and can
replace their visible text with `content` (for example an icon). Custom content
must be a visual, not another interactive control; the header owns the button.
Built-in actions use the shared 48-point minimum target and visible focus styling.

Centered mode reserves equal space on both sides using measured action widths;
flex mode uses the remaining space between actions. Side actions are capped at
30% of the row so the title retains space. Below 400 points of inner row width,
actions occupy a separate row above the full-width title to keep words readable. Text wraps and the row grows rather
than using an absolute title overlay or a fixed height. Start/end follow the
layout direction. Native system text scaling remains enabled.

The header internally uses `ScreenContent` for the same reading/wide/full limits
and responsive horizontal gutters, with 8-point vertical padding. Compose the
header and body wrapper as siblings, not nested padded wrappers; pass matching
`width` values. `style` overrides its inner container; `titleStyle` customizes the
title. Safe areas, system bars and navigation callbacks remain with the caller.
Inside a scrolling `Screen`, the header scrolls with the body. To keep it visible,
use `Screen preset="fixed"` with a header and a sibling scrolling body.

**Layout/Screen header** composes all three primitives: title-only, unequal
interactive actions, narrow dark/enlarged heading, flexible wide and fixed header
with an icon action. Device
large text, orientation and spoken accessibility still require manual review.

### Shared list item

`ListItem` adapts [Ignite ListItem](https://docs.infinite.red/ignite-cli/boilerplate/app/components/ListItem/)
as an owned themed row. Required `label` and optional `description` wrap without
line limits. `leading` and `trailing` accept custom visual accessories; leading
visuals are decorative and hidden from assistive technology. Slots must not contain
interactive controls. Their wrappers cap leading/trailing space at 20%/30% of the
row; custom visuals must respect their allocated bounds. The middle text shrinks
and wraps. Minimum row height is a shared 56-point token, with 8-point inner padding;
there is no fixed height. The parent owns list layout, width and outer gutters.

Without `onPress`, the row is a plain informational View. Supplying `onPress` opts
into one button target with press feedback, keyboard focus styling and `disabled`
semantics. Its accessible name defaults to label plus description. Include meaningful
trailing values/status in an explicit `accessibilityLabel`; decorative accessory
text must not become the button's name. `accessibilityHint` is optional. Static
trailing text remains readable as ordinary content. `disabled` applies only to
interactive rows. No navigation, data fetching, selection state or toggle behavior
is implied by this primitive.

`groupPosition` matches a card's outer corners: `first` rounds only the top,
`middle` stays square, `last` rounds only the bottom, and `only` rounds all four
using the panel radius. Omit it for a standalone row with the control radius.
The same geometry applies to press fill and keyboard focus; no clipping hides focus.
`topSeparator`/`bottomSeparator` default to false; separators wrap the row so focus
styling does not replace them. `style` customizes the row, and `labelStyle` and
`descriptionStyle` customize text. **UI/List item** composes Screen, ScreenHeader
and ScreenContent in static, interactive/disabled, accessory, narrow dark/enlarged
text and mixed-list examples.
Native system large text, spoken accessibility and orientation remain manual gates.

### Shared card

`Card` adapts [Ignite Card](https://docs.infinite.red/ignite-cli/boilerplate/app/components/Card/)
into an owned themed surface with optional title, description, custom children
and footer. String/number footers render themed text; other footer content is
composed directly. Default padding is 24 points and section spacing 16 points.
`padding="none"` supports grouped ListItems or custom full-width content. The
surface uses the panel radius and semantic surface/line colors; `tone="muted"`
uses the quieter surface token. It fills its allocation and grows with wrapping
text. Parents own column layout and width limits; no fixed card height or shadow
is imposed. `style`, `titleStyle` and `descriptionStyle` allow local customization.

`footerPlacement="flow"` is the default. `bottom` uses available vertical space
before the footer (for example with a caller-supplied minimum height), without
clipping longer content. Static cards are ordinary Views and may contain controls,
including independent footer buttons or grouped ListItem actions. Supplying
`onPress` makes the entire card one button with focus/press feedback and optional
`disabled`. This mode requires an explicit `accessibilityLabel`; all children and
footer content must be noninteractive visuals to avoid nested press targets.
A static title exposes heading semantics; a whole-card action exposes its supplied
button name. This is containment, not navigation or data loading.

**UI/Card** previews default content, whole-card/independent footer/disabled actions,
narrow dark/enlarged text, wrapping columns with bottom footers and grouped rows
with matching outer corners.
Native system text scaling, orientation and spoken accessibility remain manual checks.

Foundation is implemented locally; [status](../status.md) records integration and
release gaps. Preserve the existing backend, session boundaries and independent
board/gallery providers. Add features as reviewable slices driven by current needs.

### Current app adoption

`Page` is the shared route composition rather than a second screen implementation.
Notices use Card with independent action buttons. Today panels, game entries and
account details use Card; Today actions, connected accounts and practice/review
results use ListItem. Native Storybook uses its dedicated entry only when explicitly
started in development. Route links retain link semantics and destinations.
Navigation chrome, chessboard geometry and the result dialog retain their specialized
layouts and interaction ownership. Board workshop uses the shared screen composition.
Native visual review of this migration is user-owned and remains open.

## Shared design system

Accepted Oct 17, 2026: one coherent kit for every screen, following the
[Knightly design system](https://claude.ai/artifact/WJvLckgxzc4EJg9CJDP2CJ)
(the board is calm, the rewards are loud). Build screens from these pieces;
add a piece here, with a story, before a second feature needs it.

- **One entry point.** Features and routes import shared UI from `src/ui`;
  SwiftUI-only pieces (native settings, native avatar) from `src/ui/native-settings`
  in iOS adapters. Implementations live in `src/components/ui/`, which features
  never import directly; `npm run architecture:check` enforces it. A barrel export
  is added when a feature first uses it (Knip rejects unused exports).
- **Tokens** (`src/theme/tokens.ts`, semantic colours in `themes.ts`): type sizes
  `eyebrow` 13, `small` 14, `body` 16, `cardTitle` 20, `stat` 30, `title` 32,
  `hero` 48, `display` 56, with `lineHeight` small 20 / body 22; radii `inset` 12,
  `control` 16, `panel` 24. `brandTint` backs good-news rows; `weak` marks the one
  weakest item, always next to its word (`weakTint` behind its icon). Features do not hard-code sizes or colours.
- **Pieces.** `Card` (with `eyebrow`/`meta` for the compact header used on Today
  and Progress; card titles use `cardTitle`), `Eyebrow`, `Callout` and
  `CalloutStrong` (a tinted sentence saying what changed), `StatTile`, `Delta`
  (signed change; green only when it moved the good way, with `better="down"` for
  numbers like blunders; a worse number is muted, never red), `LegendItem`
  (dot, ring, line and dash swatches), `ProgressBar` (unlock counts and rates;
  lessons keep `LessonTopBar`), `ActionIcon` (the one stroke icon set, including
  up, down and board), `Moon` and `StreakCalendar`, `ToggleGroup` (a segmented
  track for settings and filters, `variant="pills"` for a page's period), `ListItem` rows, `Button` with its ledge. Every tappable surface shares
  one press feel from `usePressSquish`: on touch-down the face squashes
  (wider, shorter) and springs back past rest with one bounce on release.
  `Button` is the one labelled button: `primary` and `secondary` drop onto
  their ledge, `text` (quiet alternatives such as "Not now", "See details",
  "Done") has no ledge or fill, `ghost` is `text` in muted ink, and an optional
  `icon` leads the label, sits over it (`iconPlacement="top"`) or trails it
  (`"end"`, the forward arrow of Continue and Next). An `ActionBar` follows
  Chess.com: side actions (Hint, Explain, Refresh) are ghosts with the icon on
  top, and at most one wide primary sits on the right, shown only when it can
  be pressed, never as a disabled placeholder. `IconButton` is the one
  icon-only button (a lesson's ✕ and list toggle, ‹ › steppers, calendar
  arrows): the same haptic and `tokens.motion.squash.control` press, a
  48-point target (`compact` 44), the web focus ring, a required spoken
  label, and `tone`, `iconSize` and `backdrop="surface"` for each call
  site's look. Never hand-roll a pressable button. ToggleGroup options and the launch retry squash by
  `tokens.motion.squash.control`, while flat
  tappable `Card`s and `ListItem` rows use the gentler
  `tokens.motion.squash.surface` with no drop and keep their pressed tint.
  The Pressable keeps layout (a card's or row's `style`, flex sizing) and an
  inner animated face fills it, so the transform never moves neighbours.
  Touch springs come from `tokens.motion.springs`, not one-off configs.
  Reward moments share one effects kit (`reward-effects`): `FlyTo` (pop, then
  fly to a target), `Burst` (a fading disc), `Sparkles` (a ring of sparks),
  `CountUp` and `Shine` (a light band sweeping a clipped surface).
  A lesson's loading frame (`lesson-loading`) is the real layout, not a
  spinner card: the knight thinking in the coach bubble, a tip after 400 ms
  (so quick loads never flash text), an honest "taking longer than usual"
  after 3 s rather than invented progress, grey `SkeletonLine`s for text still
  to come, and no placeholder buttons. A board waiting for its first position
  is empty (`emptyBoard`); pieces arriving on an empty board drop a third of a
  square as they fade in, row by row from the top (`tokens.motion.enter*`),
  on both renderers, and not under reduced motion.
  `KnightMascot` is a code-drawn stand-in for the commissioned animated knight,
  with the same moods (idle, thinking, cheer, encourage, sleepy, celebrate):
  the coach bubble shows it, its tail pointing at the knight, cheering a right
  answer and nodding kindly after a wrong one. The lesson bar pops each segment as it fills and pops and
  flashes gold on completion; Today's earned medal hangs in a disc of night sky
  where one star at a time twinkles (2.5 s each, still under reduced motion),
  and catches a shine every few seconds. Each moment
  fires once per mount: `useRewardMoment` ignores later timing changes, a
  finished `CountUp` shows a new total without recounting, and the points
  counter schedules each award once by its id. Sounds preload on first use and
  start only once loaded and rewound. Each is
  hidden from assistive technology and shows its final frame under reduced
  motion. A reward beat pairs its motion with `useRewardCue` at the same
  moment: `land` (the points shard's crisp haptic and coin ting) when
  something arrives, `reward` (success haptic and the run bonus's coin
  cascade) when a reward completes; sounds follow the sounds setting, haptics
  stay under reduced motion. `PopIn` uses the `pop`
  spring and `RollingNumber` the `settle` spring.
  The session-end
  `ResultsBeat` keeps its celebratory stat cards. `StreakDay` is the
  calendar's day cell, shared with Progress's four-week grid. `Page` takes
  `onBack` for pushed pages on web (native stacks draw their own back).
  `Page` arrives whole: blocks there when it opens are shown at once (the
  screen's fade is the entrance), and a block that appears later, such as
  a section that loads, fades in place on `settle` (`PageEntrance`; skipped
  under reduced motion).
- Screen changes never move the page up or down: screens fade in where they
  stand (`screen-motion`). Root-stack pushes (Practice, Daily, Review,
  Connect games) use the native stack's `fade`, timed to `settle` on iOS;
  swipe-back keeps the native interactive pop. Account opens as the system
  sheet on iOS (its own spring) and with the same fade elsewhere. The web
  stack cuts, so `stackArrivalLayout` gives each pushed web screen (not a
  stack's first) the same fade on `settle`. Games and Progress open as
  Account does. App-drawn sheets (`SheetRise`: the verdict sheet) rise from the bottom edge on `pop`; the one
  overshoot stretches the sheet up from its bottom edge rather than opening a
  gap beneath it. The web games filter dialog pops in from 92% (`DialogPop`)
  and app-drawn modal backdrops fade in on `settle` (`BackdropFade`). Under
  reduced motion navigation fades instead of moving (`animation: 'fade'`)
  and every one of these app-drawn ones appears at rest. Transitions stay silent here; any transition sound is
  wired separately.
- Pages use `Card` on `page` at every width; the full-bleed `Section` and
  ScreenContent's `gutters="none"` were removed with the old Progress page.

### Sign-in and navigation presentation

Sign-in copies the original Knightly sign-in on web and native: the brand mark
and Nunito wordmark, the headline "Turn your games into practice", the line
"Knightly finds the moves you missed in your own games and brings them back
until you find them.", then a centered account card (440-point maximum) and a
muted Privacy link below it. The card preserves connection loading/error/retry.
On web it is Clerk's prebuilt combined sign-in/sign-up form, whose heading
"Continue to Knightly" is centered and subtitle hidden; new emails sign up in
the same flow. Native shows "Continue to Knightly" with hosted authentication:
Sign in (primary) and Create an account (secondary). Web Clerk controls follow
Knightly's active semantic theme, typography, 48-point controls and rounded
button ledge. Recovery/verification instructions remain owned by Clerk.

The shell adapts the original Knightly artwork into Expo primitives with one
screen, the path: its header (or, on the web, its own top bar) carries the
streak, the rank chip and Account as an avatar-only control, and side tiles
open Games and Progress ([navigation](2026-10-12-knightly-navigation-design.md)).
The avatar's accessible name retains the account identifier. Production
exposes only implemented destinations.

Avatar-only controls keep a 48-point hit target, with circular focus/press
feedback applied to the avatar itself. On iOS, the protected account route group
is presented as one native modal with its own stack. Close and swipe-down dismiss
the group, preserving the underlying screen and its state; detail Back stays
inside settings. Web/Android retain normal page navigation. Native Explore uses
a matching development-only modal group; old shell-lab account links restore
the lab in place before presenting it. Samples never perform authenticated settings mutations.

## Account settings conventions

Account is a compact grouped list outside the primary shell. Profile identity
uses a Knightly grouped surface; navigation rows open Appearance, Linked accounts, Daily
update, Analysis and Your data, at every width. On iOS, Privacy pushes inside the same modal;
public `/privacy` remains available separately. Session actions remain separate.
`/account` and `/account-settings` URLs are preserved. Layout anchors provide
an Account back destination for detail links and a main-screen dismissal fallback.
Explore mirrors the route hierarchy with labeled sample data and no authenticated
mutations.

SettingsPageFrame uses the Expo native stack header on iOS, with compact inline
titles and system title typography, platform back navigation and interactive
swipe-back. NavigationHeader
and shared header options configure the system navigation bar for app and settings
pages. iOS uses native Stack.Toolbar buttons for fallback Back, and a SwiftUI
NativeAvatarButton hosted in Stack.Toolbar.View for the account action. The avatar
has a 44-point hit region, native press feedback and no shared glass background.
The existing development preview uses the same control. The navigation bar remains
Apple-native UIKit, preserving Router history and native back behavior; no second
SwiftUI NavigationStack is introduced. Web keeps a fixed
Knightly header above scrolling content. Keyboard handling supports editable
settings; settings transitions respect Reduce Motion. Navigation colors follow
the active appearance through the router ThemeProvider.

Reusable SettingsSection provides a borderless rounded group, optional heading
and footer guidance, and hairline inset separators. SettingsNavigationRow supplies
icon/label/value/disclosure navigation; SettingsRow supplies static values and
embedded controls. SettingsChoiceList supplies checked single-selection rows;
SettingsActionRow supplies normal or red destructive full-row actions.
SettingsConfirmation supplies a cancellable sheet with keyboard support.
React Native navigation chevrons and checkmarks use fixed-size SVGs; native
header Back uses a system SF Symbol. Accessibility text scaling does not enlarge
decorative avatars or glyphs. Settings mount after stored
preferences load, avoiding an initial appearance mismatch. Decorative graphics
are hidden from accessibility; static value rows combine
label/value/help, and choices expose their checked state. Knightly typography,
colors and icon tiles are intentional differences from Apple system artwork.

Account and all account settings on iOS use Expo UI SwiftUI Form, Section, Button and inline Picker
controls through reusable NativeSettingsForm, NativeSettingsSection,
NativeSettingsNavigationRow and NativeSettingsChoiceList wrappers. The native Form
owns scrolling and grouped geometry; it is not nested in a React Native ScrollView.
Knightly supplies page/row/tint colors and body fonts that scale with Dynamic Type.
SwiftUI SF Symbols and native board swatches retain decorative previews. Web and
Android keep the existing React Native settings components. Account, Linked
accounts, Daily update, Analysis and Your data use the same native wrappers. NativeSettingsRow supplies static values and
NativeSettingsActionRow supplies normal and destructive native actions. Values
stack below labels at accessibility text sizes to avoid narrow columns. Linked
account entry uses SwiftUI TextField and Picker with a shared workflow controller.
Native loading/error and deletion-retry states use the grouped Form, including
a system progress indicator while loading. SettingsConfirmation presents a
SwiftUI sheet on iOS, reusing NativeSettingsFormContent without a nested Host.
Typed deletion and identity verification use shared workflow controllers and
platform form adapters before any backend purge. NativeSettingsTextFieldRow
provides native text/secure fields, password and one-time-code autofill, numeric
code keyboards, submit handling and interactive keyboard dismissal. Cancellation
is allowed during identity proof; sheet dismissal and Cancel are disabled during
backend deletion. Web/Android retain their existing dialog and form controls.
The sample Your data page previews confirmation and password/code entry without
sending credentials or deleting data.

On iOS, Appearance exposes Board colors and Week starts on (Sunday by
default, or Monday, for the streak calendar) as native menu picker rows,
using the reusable NativeSettingsPickerRow. Selection stays on the current page;
SwiftUI owns the popup, checkmarks and dismissal. Legacy choice links show
Appearance on iOS. Web/Android retain the choice pages. Device preferences persist
Sage/Brown/Green/Blue/Calm choices (Knightly is dark only, so there is no Theme); swatches and actual boards share
palette values. Analysis uses a native menu picker on iOS with Fast/Standard/Deep options, retaining a
custom value if the backend reports one. The two-site connection selector uses a
native segmented Picker on iOS and ToggleGroup on web/Android.

Linked accounts use validated public lookup and explicit import confirmation.
The backend owns updates, analysis depth, FSRS tuning and data usage. Concurrent
mutations are disabled and account scopes cancel stale requests. Remove opens a
native destructive alert on iOS or a confirmation sheet on web; imported games
remain. Native ZIP export opens the system share sheet from a temporary cache file
and removes that file after sharing. Web export retains browser download behavior.
Typed account deletion verifies identity before purging backend data, supports
Clerk first and second factors, and never repeats an acknowledged purge on retry.
Cancellation or account changes during verification prevent the purge. Real native
export and disposable-account deletion remain runtime verification gates.

The path uses a native stack with Knightly colors, a compact native header and
an account avatar in it; Games and Progress are modals with their own native
stacks. The avatar is a flat circular fallback inspired by React Native Reusables,
with no raised border or iOS shared glass background around its header item.
Press feedback stays on the avatar; the transparent control retains its tap target.

Only validated settings sections and appearance choices are restored after
sign-in. Back uses history with Account fallback. Server administration, Mac
scheduling, sounds, default Progress range and automatic best-move reveal remain
outside current supported settings.

Full parity verification still requires spoken VoiceOver, keyboard/focus,
reduced-motion, RTL and orientation checks on supported iOS devices,
plus real authenticated native settings actions. Android runtime remains deferred.
