# Knightly navigation design

Accepted: restore the navigation used immediately before commit `4269cd6`.
Keep the simplified [daily practice home](2026-10-19-path-home-design.md) and
[Knightly direction](../knightly-direction.md); no journey, ranks or characters
return with the navigation.

## Main destinations

Today, Games and Progress are peers. On iOS and Android, use Expo Router's
native bottom tabs with the original full-colour Knightly moon, board and bars
icons and labels. Each destination has its own stack, native title and Account
action; Today keeps the streak. Hidden positions is pushed within Progress.

Web uses the restored 240px sidebar from 768px, with Today, Games, Progress,
Settings and the account footer. Narrower layouts use the brand/account header
and three bottom links. Selected, hovered and keyboard-focused states remain
visually distinct. The shell uses theme tokens and does not load account data
in development previews. Existing root URLs remain valid.

## Focused screens and Account

Practice, review (including `/games/:id`) and lesson introductions open above the
tabs, keeping the whole screen for the board. Back returns to the originating
destination; direct game links fall back to Games. Games and Progress no longer
open as modals or offer a root Close button. Account retains its existing iOS
modal, native forms, detail Back, Close and swipe-down behavior. Old journey
links still return to Today.

## Verification

The development-only `/navigation-preview` uses the actual layouts and sample
content without auth or backend queries. Production redirects its routes home.
The existing app smoke checks protected navigation, then switches the real web
preview routes, including keyboard activation and reload. This protects the
restored main navigation; mocked components cannot prove browser route/focus
behavior. Keep the existing seven-test smoke suite.

Inspect narrow and wide web, keyboard focus and selected links. Native icon
rendering, tab restoration, full-screen lessons, large text and VoiceOver remain
selected-device checks. Platform exports establish bundling only.

API reference: [Expo Router SDK 57 native tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/).
