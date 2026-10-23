# Knightly universal frontend rebuild: requirements brief

Date: October 10, 2026

Status: agreed product requirements consolidated from the design-system discovery
conversation. Implementation planning and final technology selection follow
separately.

## 1. Product purpose and rebuild boundary

Knightly helps players improve by learning from their own games and recurring
weaknesses. The initial audience already knows the rules of chess. The first
release must allow other users to sign up and use the app, rather than serving
only its owner.

Practice must include both exact positions from a player's games and new
positions that reinforce the same underlying weaknesses. The intended outcome
is lasting pattern recognition that transfers into future games, rather than
memorization of individual puzzle answers. Detailed learning algorithms and
success metrics require further research.

The rebuild addresses the frontend foundation: maintainable, modular components,
clear boundaries, and sound conventions designed for mobile and web together.
It is a separate rebuild, not an incremental port of the existing web UI. Keep
the current app available until the replacement's core flows are ready.

Retain the existing backend for game import, analysis, practice grading, and
learning services. Targeted API and backend additions may be needed for the new
frontend; retaining the backend does not mean freezing its contracts. Preserve Clerk identity and server-side user isolation as required
by the existing Knightly repository's agent instructions.

The universal frontend lives at the root of `knightly`; the retained
backend now lives in `backend/`; the original web app stays in the original repo. Use one universal
Expo application with Expo Router and one initial application package; detailed
internal boundaries remain to be specified. Existing UI code is a reference for behavior and
identity, not the prescribed structure of the new implementation.

## 2. Platforms, experience, and switch-over scope

| Requirement | Agreed direction |
| --- | --- |
| Platform coverage | Build for iOS, Android, and web from the start. |
| Primary experiences | iPhone and desktop browser are used regularly and must both feel polished at switch-over. |
| Browser support | Support current Safari, Chrome, Firefox, and Edge from the first release. |
| Tablet priority | Tablet-specific polish can follow switch-over. |
| Cross-platform experience | Share Knightly branding and component appearance; adapt layout, navigation, and interaction to the device. |

Offer the same core tasks on mobile and desktop. A consistent experience does
not require identical screen arrangements or input behavior.

All four flows must be ready before switching from the current app:

1. Account setup and game import.
2. Game review.
3. Personalized spaced-repetition practice.
4. Progress tracking.

Playing against bots is not part of Knightly. Imports and new analysis are
handled by the backend.

Accessibility is part of the initial foundation, including full keyboard
operation of the chessboard and app, screen-reader support, larger text, and
reduced motion. Browser and native behavior must both be verified; visual
similarity alone does not establish accessibility or platform parity.

Retain Knightly's current visual identity: colors, typography, custom chess
pieces, and chunky buttons. Rebuild components and conventions from scratch.
Use docs/design.md and docs/screens/ in the original repository
(`hunterrhansen/knightly-legacy`) as the identity and behavior reference. Retaining the identity does not require
carrying over every platform's current dimension, component API, or layout.

## 3. Connectivity and cross-device progress

The first release is **online-only**. The user accepted deferring offline practice
and review to reduce initial complexity to keep the
initial architecture simple. This supersedes the earlier offline requirements.

| Activity | First-version behavior |
| --- | --- |
| Daily practice and game review | Require connectivity; no automatic downloads or offline completion. |
| Saving progress | Submit through the existing API; confirm saved status only after server acknowledgement. |
| Connection loss | Retain the current answer in memory while the screen remains open; show saving/failure status and offer appropriate recovery. |
| Cross-device progress | Read canonical saved progress from the backend; unfinished-session resume across devices is not required. |
| Imports and new analysis | Require connectivity and use the backend. |

Keep validated grading and canonical learning progress on the backend. Safe
retries must account for ambiguous network outcomes and avoid duplicate grading
or scheduling effects. Offline queues, durable recovery after app termination,
local practice databases, and a synchronization service are deferred.

If offline support is revisited, evaluate downloaded feedback, durable attempts,
late submissions, concurrent-device behavior, and browser persistence together.
PowerSync remains a candidate rather than an accepted dependency.

## 4. Design and development workflow

1. **Use code as the source of truth.** Tokens, components, examples, and design
   decisions should live with the implementation. Figma is not required.
2. **Use Storybook as the component gallery.** Review real components and their
   states, with browser and native previews appropriate to the component.
3. **Explore designs with Codex and live alternatives.** Prompt for alternatives
   rendered from actual components, review them, and refine the chosen result.
   Drag-and-drop visual editing is not required.
4. **Establish a repeatable design workflow.** Include a brief, exploration,
   review, documented decisions, and verification. Exact file conventions and
   tooling are still to be designed.
5. **Keep Expo-managed configuration and simple daily development.** Use
   development builds from the start, with native configuration expressed
   through Expo configuration and config plugins where supported.

Shared tokens and reusable components are required across mobile and web.
Component maintainability and sound conventions take priority over copying the
existing web implementation. An AI-specific integration must not become the
only way to access design decisions or component documentation.

## 5. Technology decisions

Styling is **React Native `StyleSheet` with an owned theme hook**, with a small
owned component layer based on RN Primitives and React Native Reusables
patterns. Do not introduce a second styling system. The comparison spike
has been removed; rationale and unresolved accessibility checks are recorded in
[technology decisions](technology-decisions.md). Installed dependency versions are pinned in `package.json`.

Use **one universal Expo application with Expo Router** and one initial
application package. Share feature logic and routes while adapting navigation
and layouts to desktop and native platforms.

Use **`src/chess/` for shared chess mechanics and board UI**. The board renders
feature-supplied positions and reports move attempts; review and practice
own their workflows and position progression. Selection, dragging,
promotion input, keyboard and screen-reader interaction belong inside the board
boundary. Use **chess.js** for standard-chess mechanics through focused shared
helpers. Preserve history where needed for repetition and own analysis branches
separately. Build the owned board with React Native views, react-native-svg,
Gesture Handler and Reanimated, using Lichess as an interaction/presentation
reference. The approved [board specification](specs/2026-10-10-universal-chessboard-design.md)
defines the contract, accessibility navigation and motion behavior. Visual tuning and platform verification remain implementation gates.

Author shared tokens in **TypeScript**, using base scales and one semantic dark
theme consumed through the owned theme (Knightly is dark only). Start without a token-generation pipeline.

Use **TanStack Query for server data** and **React state/reducers for temporary
interface/session state**, with no initial global client-state library.

Use the existing API for the **online-only first release**. PowerSync, local
practice databases, and durable offline queues are deferred. The earlier
expo-sqlite/Dexie choice is superseded by this scope decision.

## 6. Decisions intentionally left open

| Area | What needs evaluation |
| --- | --- |
| Component implementation | Exact primitive coverage, component APIs, platform adapters, and accessibility verification. Owned themed StyleSheet components with RN Primitives/RNR patterns are selected. Expo and Storybook are agreed workflow choices, not a complete stack selection. |
| Token details | Exact names, scales, values, component conventions and enforcement. TypeScript tokens with one semantic dark theme are selected; no initial DTCG/Style Dictionary pipeline. |
| Internal structure and data | Detailed folder conventions, domain boundaries, API contracts, safe mutation retries, and backward-compatible backend additions. One universal Expo app with Expo Router and one initial application package is selected; offline databases and synchronization are deferred. |
| Learning engine | Weakness identification, pattern representation, selection of reinforcing positions, grading and scheduling evolution, and measurement of transfer into real games. |
| Release and acceptance details | Distribution channels, minimum OS versions, numerical performance targets, automated/manual verification, and the exact readiness criteria for each core flow. |

Future research should compare candidates against this brief, with evidence from
iPhone and desktop behavior. The accepted technology decisions supersede earlier candidate suggestions. Research the personalized learning engine separately so UI and
storage choices do not prematurely determine the learning model.
