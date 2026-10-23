# Knightly navigation design

Status: approved 2026-10-12; revised 2026-10-19 for the one screen (no tab
bar). Knightly has one screen, the path, with everything else over it; see
[the path home](2026-10-19-path-home-design.md#one-screen-no-tab-bar) for what
opens where. This spec holds how navigation looks: tokens, glyphs, the native
header, the modals and the web. Account isolation and the 768-pixel
breakpoint from the [foundation specification](2026-10-10-app-foundation-design.md)
stay the same.

Reference (read-only): `knightly-old/web/src/components/kn-icon.tsx`,
`logo.tsx` and `styles/tokens.css`.

## Shared foundations

**Tokens.** The old palette is in the theme ([themes.ts](../../src/theme/themes.ts)):
`sky` #49a8f2, `skyLedge` #2577bb, `onSky` #08192a, `gold` #ffc233,
`goldLedge` #c28c00. Glyphs and navigation selection use these tokens, not
`boardAnnotations`, so board colours can change without changing navigation.

**Glyphs.** `KnightlyGlyph` (`src/components/ui/knightly-glyph.tsx`, shapes in
`glyph-art.ts`) draws `today` (the moon), `games` (the board), `progress`
(bars), `star` (Progress's tile) and `settings` (gear). Knightly glyphs are
only for navigation and big moments; inline controls keep plain utility
icons. `npm run brand:generate` writes their SVG masters to
`assets/navigation/`; there are no native tab PNGs.

**Labels.** Nunito ExtraBold, uppercase by style (not by changing the
string, so VoiceOver doesn't spell words out), 0.6 letter spacing.
Accessible names stay in title case.

## The path's header (iOS and Android)

Shared in [navigation-header-options.ts](../../src/components/ui/navigation-header-options.ts):
`headerTitleStyle` is `typography.heading` (Fredoka) about 20 pt in `ink`;
the background is `page` with no shadow (it works with Liquid Glass); back
tint `brandText`.

The path's stack ([home-stack](../../src/features/shell/home-stack.ios.tsx))
has a transparent header over the path: the streak pill at the top left
(once the daily review has loaded; no placeholder), the rank chip as its
title view (opens Progress) and the account avatar at the top right (opens
Account), with the `Avatar`'s 3 px `brandLedge` ledge. iOS draws the pill and
avatar as `Stack.Toolbar` views; Android as header views. The pinned section
banner and the Games and Progress side tiles sit under the header, over the
path.

## Modals: Account, Games, Progress

The root stack presents `(account)` and `progress` the same way:
`presentation: 'modal'` on iOS (the system's full-height sheet with its own
spring, swipe down to close; no animation with reduced motion), `card` on
Android and the web. Games holds a board, so on iOS it is a
`fullScreenModal` instead: the sheet's inset made the board smaller, and only
its ✕ closes it. Each has its own stack: iOS puts the native toolbar ✕
(`xmark`, "Close Games") at the top right of its root; Android a close
`IconButton` in the header's right; the web page's header Back closes it.
`useCloseModal` closes to the path (or replaces with it when a link opened
the modal with nothing under it); `useLeaveModal` closes first, then opens a
route outside the modal over the path. A game's review inside Games turns the
swipe-down off while it shows (`useLockModalDismiss`; a no-op full screen).

## Web

No sidebar and no bottom tabs. The path draws its own top bar (streak pill,
rank chip, avatar) and the same side tiles; Games, Progress and Account are
pages with Back. The Account page lists its settings at every width, since
there is no Settings gear any more. The daily update's status shows in
Settings → Daily update (the sidebar's account row and its status line are
gone).

## Ownership and files

- `src/theme/themes.ts`: tokens.
- `src/components/ui/knightly-glyph.tsx`, `glyph-art.ts`, `avatar.tsx`,
  `navigation-header-options.ts`.
- `src/features/shell/root-navigator.tsx` (modal presentation),
  `home-stack*.tsx`, `modal-stack*.tsx`, `node-sheet-options.ts`,
  `shell-lab-screen.tsx`.
- `src/features/today/home-tiles.tsx`, `today-screen.tsx`.

## Verification

The shell lab (`/shell-lab`, development only, on every platform) shows the
home with sample data: the top bar, banner and tiles; the avatar opens the
Account preview. No pixel snapshots.

- Existing browser smoke for protected navigation stays unchanged; the
  production smoke still checks that the development labs redirect.
- Devices (needs a native rebuild: the native tab navigator is gone): iOS
  for the modal sheet, its ✕ and swipe down (and that a game's board drags
  never close Games), the header's pill, chip and avatar, the tiles with
  large text and their VoiceOver names; Android for the pushed pages and
  their close button.
