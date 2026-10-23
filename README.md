# Knightly

One universal Expo app for Knightly on iOS, Android and web, with the retained
Python backend in `backend/`. The first release is online-only. The original
web app stays in the original repository.

## Current state

`main` is the default integration branch. Open feature pull requests against it.
CI and deployment state is in the [runtime guide](docs/runtime-verification.md#ci-and-pre-push).

- Released to production and TestFlight: Clerk sign-in, Chess.com import and the
  Games library, Today daily review with streaks, daily practice, game review,
  Progress and settings. The backend owns
  grading and saved progress. [Current status](docs/status.md) lists what is
  deployed, unreleased and still unchecked.
- The shared board supports tap/drag/keyboard input, promotion, correlated
  feedback, motion and accessibility adapters. Board Lab contains simulated
  practice/review and visual previews; demos never save learning progress.
- Current runtime scope is iOS and web; Android runtime is deferred. Native
  hardware keyboards, release-device tuning, spoken accessibility and release
  setup remain open.

Read the [requirements](docs/universal-rebuild-requirements.md),
[architecture](ARCHITECTURE.md) and [technology decisions](docs/technology-decisions.md)
for scope and ownership. The [document index](docs/index.md) links accepted specs,
current status and remaining checks. Repository contributors
should read [AGENTS.md](AGENTS.md).

## Backend

Use [backend setup](backend/README.md) for the API/worker and isolated tests, and
[deployment](docs/deploy.md) for hosting and the migration handoff.
This repository (`hunterrhansen/knightly`) owns backend source and deployment.
The original repository (`hunterrhansen/knightly-legacy`) stays unarchived. Original history is
retained through the consolidation merge's second parent (`d9289ff`); use
`git log e3cbdd7^2 -- src/knightly` for original backend paths. Root npm checks
cover Expo; the Quality workflow adds Python and Docker gates.

## Run locally

Select Node **24.21.0** and npm **11.21.0**, pinned in `.nvmrc` and `package.json`.
With nvm, use `nvm install && nvm use`; install the declared npm version if needed.

```sh
npm run env:check
npm ci                     # fresh checkout or changed/missing dependencies
npm run hooks:install      # once per clone: pushes run verify (+ backend pytest if changed)
npm run web
```

Open the printed URL. Without API configuration, sign-in shows a recoverable
connection error; **Explore board workshop** still opens `/board-lab`.
For actual sign-in/import, follow [local backend/auth setup](docs/foundation-development-environment.md).
The board workshop supports orientation, narrow/large-text layouts and
move previews. **Explore Today states** opens `/shell-lab`: the one screen
(the path, its top bar and the Games and Progress tiles) over sample data,
with no sign-in or backend. Development labs are excluded from production implementations;
production lab routes redirect home.

```sh
npm run ios                # local build; requires Xcode/CocoaPods
npm run android            # local build; requires Android SDK
npm run start              # connect an installed development client
```

Use a development build; Expo Go is not a supported workflow.
Generated `ios/` and `android/` projects are ignored; configure native behavior
through `app.config.ts`. These commands do not publish or deploy.

## Phone builds

Both EAS profiles install over the air: open the finished build's install link
(or scan its QR code) on a registered iPhone; no cable is needed.

`development` is the development client with `__DEV__` screens such as
`/board-lab`. It loads JavaScript from Metro on the Mac over the local
network, so start Metro with `npm run start`, keep the phone on the same
Wi-Fi, and pick the server in the app. Rebuild it only when native code
or native dependencies change.

```sh
npx eas-cli@24.12.1 build --platform ios --profile development
```

Away from the Mac's Wi-Fi, start Metro with `npm run start -- --tunnel` so the
development build reaches it over the internet.

`testflight` is the same development client signed for the App Store and
installed through TestFlight. Builds run on the Mac by default (`eas build
--local`, as Ignite's template does): no EAS cloud build quota or queue, while
EAS still provides signing and the upload. They need Xcode and use the Mac's
toolchain; the scripts set a UTF-8 locale, which CocoaPods needs under Ruby 4.

```sh
npm run release:ios:testflight   # build on this Mac, then upload to TestFlight
npm run build:ios:cloud          # TestFlight build on EAS's servers instead
```

`beta` is a standalone TestFlight build: the JavaScript is built in, so it runs
without Metro or the Mac. It uses production (`https://knightlychess.app`), the
one database for real use while Knightly has a single user; staging is for
testing changes. Development surfaces such as the labs stay development-only.

```sh
npm run release:ios:beta         # standalone build on this Mac, then TestFlight
```

The first `eas credentials`/`eas submit` for a new bundle ID asks for the Apple
ID; afterwards builds and uploads run without it.

Every build that reaches TestFlight or a store links Stockfish (GPL-3.0), so its
source must be public. This repository stays private; after uploading, publish
the build's commit to the public
[knightly-source](https://github.com/hunterrhansen/knightly-source) repository
as one snapshot commit tagged with the build, authored by the GitHub noreply
address:

```sh
npm run source:publish -- <commit> ios-build-<number>
```

Build numbers are kept by EAS (`appVersionSource: remote`) and increase on
each `testflight` build.

`eas.json` also defines a standalone internal `preview` build on EAS project
`@hunterhansen/knightly-rebuild`. It uses `https://knightlychess.app`, so sign in
with your hosted Knightly account. The Mac/local development backend is not needed.

```sh
npx eas-cli@24.12.1 build --platform ios --profile preview
```

iPhone installation requires Apple signing and the phone registered in the
provisioning profile. Open the finished build's EAS install link on that phone.
Preview builds do not publish to the App Store or configure OTA updates.
Production Clerk's Native applications settings must allow the iOS callback
`app.knightlychess://callback`; the older preview uses a different callback.

## Shared component gallery

```sh
npm run storybook:web      # web gallery at localhost:6006
npm run storybook:native   # separate entry; open in the dev client
npm run storybook:build    # static gallery in storybook-static/
```

Both galleries use the same colocated stories, fonts, themes and providers.
**UI / Appearance pickers** previews the universal Theme/Board menus with device
preference persistence. **UI / Text field** previews universal input, validation,
busy, password and enlarged-text states. Expo UI's pinned accessibility patch
is applied by npm ci/postinstall; use the normal setup commands.
Native Storybook is a development entry, not a production route.

**Games / Library** previews the library and its recovery states without account
data. It never saves reviews. **Practice / Daily practice** and **Review / Game
review** run those screens on local sample cards and a sample game.

## Progress previews

**Progress / Sheet** in Storybook previews the one Progress sheet in
first-nights, climbing, rating-dip, new-player, many-games, loading and
failure states, from sample data only. Tap or drag the rating line to pick a game; the previous/next buttons
do the same for keyboard and screen readers. Use native Storybook
(`npm run storybook:native`) to check the Skia chart on a device.

Skia requires rebuilding the native development client after installation.
`npm ci` prepares a version-matched local CanvasKit asset for web/Storybook;
rerun `node scripts/prepare-chart-web.mjs` if that ignored asset is missing.
It also copies review's side-line engine (Stockfish 19 Lite) to `public/stockfish/`;
rerun `node scripts/prepare-engine-web.mjs` if that is missing.
The chart prototype exists only in Storybook. See the
[Progress specification](docs/specs/2026-10-11-progress-design.md) for data/range semantics
and remaining phone checks.

## Checks

Run `npm run env:check` before verification. Use the smallest appropriate gate:

```sh
npm run docs:check         # documentation-only changes: local links and index coverage
npm run verify             # docs, tooling, architecture, unused code, API, lint, types, Jest
npm run verify:full        # adds Expo compatibility/Doctor, Storybook and exports
npm run test:runtime       # seven board/app/production browser smoke tests
```

Quality CI never checks pull requests, so run `npm run test:runtime` before opening
a PR; the pre-push hook covers `verify`, and backend tests when `backend/` changed.
The [runtime guide](docs/runtime-verification.md#ci-and-pre-push) describes what CI
runs, its current state and the hook policy.
Install browser support once with `npx playwright install chromium`.
`npm run test:board` runs only the five board input/promotion smoke tests.
Detailed logic/error cases stay in Jest; visual polish stays in Storybook review.
See the [agent testing rule](AGENTS.md#browser-e2e-strategy).
For selected-device native smoke, runtime evidence and individual checks, use the
[runtime guide](docs/runtime-verification.md). Current outstanding gates live in
[current status](docs/status.md).

Verification stops at
its first failure. Ignored `.verification/` holds local logs/builds/reports; it
is disposable after results/blockers are captured in current status. Delete old runs
when no verification process is using them. `npm run format` changes files; review its diff deliberately.

## Licence

Knightly is free software under the GNU General Public License, version 3 or
(at your option) any later version; see [LICENSE](LICENSE). The iOS and Android
apps link Stockfish (GPL-3.0), so every distributed build's corresponding source
is that commit's snapshot in the public
[knightly-source](https://github.com/hunterrhansen/knightly-source) repository,
tagged with the build (see [phone builds](#phone-builds)). Third-party artwork, fonts
and engines keep their own licences, recorded in
[asset licenses](assets/licenses/README.md).

