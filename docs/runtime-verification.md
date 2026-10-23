# Runtime checks

Use pinned Node/npm and `npm run env:check` first. See [README](../README.md#checks)
for static/unit/build gates and [status](status.md) for open checks. This guide is
the reference for the CI and pre-push policy.

## Browser smoke

```sh
npx playwright install chromium # once per machine
npm run test:runtime            # all seven smoke tests
npm run test:board              # five board tests only
```

The runner builds fresh Storybook/production outputs, chooses loopback ports and
starts an owned Expo development server for app navigation. One Playwright config
covers board input/promotion, offline protected navigation/reload and production
startup/lab redirects. Existing listeners are never adopted or terminated.
Explicit preview ports are available with `--port 6010 --production-port 6011`.

These fixture/offline tests do not establish live Clerk/backend integration,
comprehensive visual/accessibility coverage or native runtime behavior. Use
Storybook/device inspection for affected visuals and spoken feedback; detailed
logic/error cases belong in Jest. See the [e2e rule](../AGENTS.md#browser-e2e-strategy).

## CI and pre-push

The [Quality workflow](../.github/workflows/quality.yml) runs `npm run verify`,
`npm run test:runtime`, backend `uv run pytest` with the OpenAPI contract
comparison, and the server image build. Its **Required checks** job fails if any
of them fails, is cancelled or is skipped; successful runs on `main` trigger
staging deployment. To stay within GitHub Free's private-repository minutes it
runs only on pushes to `main` and manual dispatch, not on pull requests.

**Current state (October 18, 2026): GitHub Actions is blocked by account billing,
so neither Quality nor Deploy runs.** Run every gate below locally on the exact
commit before merging or deploying, and deploy by hand
([Deploying by hand](deploy.md#9-deploying)). This is the one place that records
CI state; update it when Actions runs again.

Pushes are checked locally instead. Enable the pre-push hook once per clone with
`npm run hooks:install` (it sets `core.hooksPath` to `.githooks`). Every push then
runs `npm run verify`, plus backend `uv run pytest` when the pushed commits change
`backend/`. Skip it once with `git push --no-verify`. The hook does not run the
browser smoke, so run `npm run test:runtime` before opening a pull request.

Branch protection and required reviewers are unavailable on this private Free
repository. The accepted policy is manual: run these gates before merging.

## Selected-device native smoke

Install a development build first, boot the intended simulator/emulator explicitly,
and ensure Maestro and platform tools are available. Use a native
development build; Expo Go is not a supported workflow. Use the configured development
bundle `app.knightlychess` and the [local setup](foundation-development-environment.md).

```sh
npm run test:native -- --platform ios --device <simulator-UUID>
# Android runtime is deferred; use this when that scope resumes:
npm run test:native -- --platform android --device emulator-5554
```

The runner validates the selected device/build, starts its own Metro server and
runs `.maestro/board-smoke.yaml`, including the current practice fixture flow.
It does not choose another device or reuse another Metro process. Native gestures
require device execution; exports and Jest bridge mocks cannot establish them.

Drag needs e2/e4 centers measured from the current device screenshot:

```sh
npm run test:native -- --platform ios --device <simulator-UUID> \
  --drag-start <x,y> --drag-end <x,y>
```

The runner materializes `.maestro/board-drag.yaml` because Maestro parses swipe
coordinates before variable evaluation. Do not assume another device's coordinates.
After actual Clerk sign-in, `.maestro/app-foundation-smoke.yaml` checks app-owned
Account/sign-out controls; set `APP_ID` to the installed bundle. External identity
completion and callback/session restoration remain manual integration checks.

Run affected iOS smoke for board input, native adapters, shared UI/themes and
native configuration/dependency changes. Rebuild when native configuration changes.
Check real spoken feedback/focus, large text, reduced motion and native hardware
keyboards separately. The native app is portrait only (`orientation: 'portrait'`;
iPad opts out of multitasking with `ios.requireFullScreen` so it stays portrait);
confirm rotation is ignored rather than checking landscape layouts. Repeat release performance checks on real hardware.
Android runtime is deferred; report it as unrun.

## Temporary output

Runners create ignored `.verification/` directories with logs, run metadata,
reports, build copies and failure screenshots/traces. Timeouts/interruptions clean
up owned processes. Do not edit source during a run: current runners reject changed
source fingerprints. CI retains diagnostic artifacts for 14 days.

Local output is disposable once results/blockers are summarized in [status](status.md).
Delete old runs rather than keeping an evidence archive. Do not remove a directory
while its verification process is running. A fresh run regenerates needed output.

For native header interaction checks in a development client, disable the floating
**Tools button** using its switch in Expo’s developer menu. Its overlay can
intercept the account avatar’s tap target. Standalone internal previews do not
show this overlay. Check avatar navigation and removal on Account, swipe-back
restoration, the dark theme with the phone in Light appearance and accessibility
text sizes. Spoken VoiceOver remains
a manual device check.
