# Universal chessboard specification

Status: approved October 10, 2026; shared implementation available under
`src/chess/board/`. See [current status](../status.md) for verification and open
platform gates.
Date: October 10, 2026.

## Purpose and success criteria

Provide Knightly with one reusable standard-chess board for practice and game
review across iOS, Android and web. Preserve Knightly's existing artwork
and playful visual identity while keeping the board readable, responsive and
usable without dragging. Features remain responsible for confirmed positions,
grading, history and progression. This document consolidates the accepted
directions in [technology decisions](../technology-decisions.md) and makes
their interaction requirements concrete.

Success means the same move can be entered by tap/click, drag, web keyboard or
native screen-reader activation; an attempt is emitted exactly once; stale
work cannot alter a new exercise; rejected previews and Retry behave consistently;
and special moves are rendered correctly. Accessibility and performance require
real verification on the implementation, not inference from reference libraries.

## Scope

Includes standard-chess rendering, legal-move input, promotion,
controlled attempt feedback, annotations, navigation/reset, two piece sets,
device board preferences, move sounds, reduced motion, and the
input/accessibility adapters required by the supported platforms.

Excludes grading, learning schedules, backend submission protocols, engines,
offline queues, feature screen layouts, editor/spare-piece modes, variants,
voice recognition and a separate typed-notation input flow. Haptics are separate
work. Sound is an enhancement and is never required to understand feedback.

## Architecture and ownership

The board lives under `src/chess/board/`. Standard-chess helpers live elsewhere
within `src/chess/`; feature consumers live under `src/features/`. Imports flow
from features into shared chess/UI/theme code, never back into feature workflows.
Create files only when an implementation responsibility warrants them.

| Owner | Responsibility |
| --- | --- |
| Shared chess helpers | Parse positions, coordinates, notation and legal move variants using chess.js; produce plain data for rendering and attempts. |
| Board | Geometry, square activation, selection, drag, focus, promotion chooser, duplicate-emission guard, rendering and motion. |
| Practice | Requests, grading, confirmed position, attempted preview, verdict, hints, Retry and progression. |
| Review | History/branch navigation, displayed positions and analysis annotations. |

Use React Native views and react-native-svg for rendering, Gesture Handler for
gestures, Reanimated for continuous motion, and themed React Native styles for
static theme styles.
Use a small typed React reducer for discrete interaction, not a new state-machine
dependency. Do not update React state for every pointer frame. Native worklets
and web animation execution have different performance characteristics; native
UI-thread behavior is not a claim about web.

Mutable chess.js instances stay in helpers or their owning feature session.
Do not pass them to the board. Preserve history in sessions that need repetition
checks; FEN alone does not carry that history. Board rendering does not require
the backend, Query client, Clerk or feature-specific hooks.

## Public contract

Use named, typed plain-data props and event callbacks. The field names below
are the specification vocabulary; implementation may refine names without
changing ownership or behavior. Use chess.js square/color/promotion types where
appropriate, readonly collections, and discriminated unions for mutually
exclusive policies/outcomes. Do not replace this with boolean combinations
that permit contradictory states.

| Input/event | Required meaning |
| --- | --- |
| Confirmed position | FEN plus a position identity. Identity changes on every confirmed logical position and navigation/reset, including identical-FEN resets. |
| Interaction policy | Read-only or movable with allowed side(s), eligible complete move variants, and a feature-controlled submission-enabled flag. Orientation is separate from side to move. |
| Presentation | Orientation, last move, highlights/arrows, hint visibility, optional correlated attempted-position preview, and explicit transition metadata. |
| Attempt feedback | Attempt ID, originating position identity, and a discriminated pending/rejected/resolved/failed/uncertain outcome. Rejection/uncertainty can keep submissions disabled through policy even after local settlement. |
| Events | Complete move attempt; presentation-transition completion when a feature sequences an opponent reply. Both carry identities for ignoring stale notifications. |

A complete attempt contains `from`, `to`, optional `promotion`, unique local
`attemptId`, originating position identity and input source. No grading promise
is returned to or awaited by the board. Local IDs correlate UI; they do not
establish server idempotency. Consumers handle each emitted attempt, even when
they can settle it synchronously without a network request.

Eligible variants describe legal attempts, not just correct practice answers.
Practice must accept a legal wrong move as an attempt. Destination-dot/ring
visibility is independent of eligibility. The feature derives a preview FEN
using shared chess helpers and supplies it with the attempt's identity; previews
never modify confirmed history. Invalid positions or mismatched previews disable
submission and expose an understandable error rather than guessing a board state.

The shared board intersects supplied variants with chess.js legal moves and
allowed sides. Visible destination hints and all input routes use that same
validated set; a stale or malformed consumer move cannot appear as a legal hint.

### Reuse the implemented component

Import `Chessboard`, `BoardProps`, and `MoveAttempt` from `src/chess/board`.
Keep the feature's position, feedback and transition in one state update;
derive eligible variants with `legalMoves` from `src/chess/move`.

```tsx
<Chessboard
  position={position}
  orientation="w"
  policy={{
    mode: 'movable',
    sides: ['w', 'b'],
    moves: legalMoves(position.fen),
    submissionEnabled: !saving,
  }}
  presentation={{
    showDestinations: true,
    lastMove,
    transition,
    highlights: [],
    arrows: [],
  }}
  feedback={feedback}
  onAttempt={submitAttempt}
/>
```

The board supplies tap/drag/keyboard input, dots/rings and the promotion chooser.
`submitAttempt` receives the complete chosen promotion and correlated IDs. The
feature validates the originating ID, uses `applyMove` for a local commit or
its own backend workflow, and settles the attempt with feedback. Every committed
position and reset needs a new ID, including when FEN is unchanged. Do not wrap
the board in another competing gesture detector or duplicate its promotion UI.
The existing [local consumer](../../src/features/board-lab/board-input-demo.tsx)
and [state owner](../../src/features/board-lab/use-board-demo.ts) demonstrate
local commits without backend/auth dependencies.

Publish acceptance, the new confirmed position and corresponding transition as
one feature state update. Feedback that settles the previous position's attempt
must still release its local lock; it must not be reinterpreted as feedback for
the new position. Retained settled feedback must not clear later selections on
every render: consume each settlement once per attempt.

An accepted move need not change FEN to settle an attempt. Explicit resolution
releases the local guard even in that case. Position identity protects stale
selection; the feature's session identity additionally protects navigation to
another exercise/account and its late requests.

## Input lifecycle

| State | Entry and behavior | Exit |
| --- | --- | --- |
| Idle | Confirmed or feature-controlled preview is visible. Exploration/focus remains available even when submissions are disabled. | Eligible origin activation selects; eligible drag begins dragging. |
| Selected | Highlight origin; optional legal dots/rings. Activating another eligible own piece switches selection. | Origin activation/Escape/Cancel deselects; eligible destination proceeds. |
| Dragging | Piece follows pointer/finger; one active move gesture. No frame-by-frame React updates. | Valid drop proceeds; outside/illegal drop restores origin without emitting. |
| Choosing promotion | Hold provisional pawn presentation at destination; chooser offers eligible variants. Other move input is blocked. | Choice emits one complete attempt; dismissal emits none and restores origin. |
| Awaiting resolution | Install local duplicate guard before invoking callback; clear selection. Feature preview and pending feedback take over presentation. | Correlated settlement or position reset clears local guard; feature policy decides whether another attempt is allowed. |

All input routes use the same square/variant validation and attempt emission.
Desktop mouse-down picks up eligible pieces immediately at their normal size.
The mouse shows an open hand (`grab`) over every piece, either side's, and a
closed hand (`grabbing`) while dragging, as on Chess.com; empty squares keep
the arrow. The hand shows only while the board accepts moves.
Releasing without more than 8px of movement follows the existing tap selection/
deselection path; a moved pointer submits through the drag path. Escape, pointer cancel,
lost capture, blur and position/layout/orientation changes cancel safely. Native
and web touch keep the 8px drag threshold, current held-piece scale and drawing
hold gesture. Keyboard activation remains separate from mouse pickup.

While dragging, the square under the pointer shows a light outline derived on
the UI thread; leaving the board hides it.

Dropping a dragged king on its own home-rank rook castles toward that rook
when castling is eligible; clicking the rook with the king selected selects the
rook instead. Promotions always use the chooser, so underpromotion answers stay
possible.

Illegal tap/click destinations clear selection and explain the failure;
keyboard destinations retain selection so the user can correct the target;
an illegal drag restores the origin and emits nothing. A gesture finishing after
its position was replaced cannot emit. Read-only boards retain exploration and
annotations while rejecting move input.

User drawings are temporary board-owned state, separate from feature annotations.
Right-click toggles a square; right-drag toggles an arrow. Arrows between squares
with a two-by-one offset use an L-shaped path, following the longer axis first.
This depends only on square geometry, including empty squares, in either
orientation; other arrows remain straight. The same renderer serves user drafts,
completed drawings and feature-supplied arrows.

Arrows follow Chess.com's measured shape, in squares: one closed outline whose
shaft starts 0.36 from the origin's centre (clear of the piece) and is 0.22
wide, ending in a 0.36-long, 0.52-wide head with its tip on the destination's
centre; a knight's L has square mitred corners. They are translucent (0.8 fill
× 0.8 opacity), and being one outline, never darken where shaft and head meet.

Desktop drawing colors are captured at pointer-down: default yellow arrows/red
squares; Ctrl red arrows/yellow squares; Alt (Option) blue; Shift green. Ctrl
takes precedence over Alt, then Shift when combined. Redrawing an existing
mark with another color replaces it; repeating its current color removes it.

On native devices,
hold for 350 ms before dragging to draw; releasing on the same square toggles
its highlight. A cancelled/off-board gesture adds nothing. Drawings clear on
primary move input or a new position identity; flipping preserves completed
marks and cancels drafts. There is no clear button, as on Chess.com and
Lichess: moving a piece is how drawings go. Drawing cannot
submit moves, dismiss promotion, or release a pending submission. Consumers may
disable drawing with `annotationsEnabled={false}`.

Turning the board cancels an active drag but preserves pending submission and
confirmed square identity. Navigation/reset cancels selection, drag and promotion,
clears old preview/feedback in the feature and invalidates old transition callbacks.
Do not unlock a request on an arbitrary board timer. A consumer error requires
explicit recovery; a missing settlement cannot silently allow another answer.

## Practice feedback and recovery

Display a legal attempted move immediately as a correlated preview, including
captures and promotion. While grading/saving is pending, prevent another attempt
and show clear pending status. Do not label progress saved before server
acknowledgement.

On rejection, retain the attempted position with incorrect-answer text/mark and
Retry. Rejecting is not a canonical move commit. Retry is a feature action:
clear preview/feedback and restore confirmed position, using a fresh position
identity even if FEN is unchanged. Offer hints only under explicit feature
policy, rather than revealing one automatically as part of the shared board.

On acceptance, commit the feature-supplied position without repeating a slide
already performed by the preview/drag. If an opponent continuation is needed,
show the accepted position first, then the feature-supplied reply. Keep new
attempts disabled until the continuation is displayed. A keyed presentation
completion event can advance this visual sequence; it does not acknowledge a
server save. Reduced motion completes the sequence without artificial delays.

Network failure is not an incorrect chess answer. Preserve the in-memory answer
and feature-owned recovery options. When outcome is uncertain, keep new
submissions blocked until the feature reconciles it; do not automatically replay
the mutation. Cancellation/aborting fetch does not undo a server commit. Check
session, originating position and attempt before applying any late result.
The API's safe reconciliation/idempotency mechanism belongs in its own design;
the board must work with these states regardless of that implementation.

## Learning feedback policy

Practice optimizes for understanding and continued learning. Mistakes do not
exhaust lives or end practice: retain explicit Retry and provide deliberate
solution/skip options so the learner cannot become trapped. A skipped/revealed
position is not recorded as independent success. These actions and their
availability belong to the feature, not the shared board.

Offer a concise "Why doesn't this work?" explanation for a rejected move when
reliable content or backend evidence supports it. Explain one useful concept
at a time. If an explanation/refutation reveals the solution, indicate that
before the learner opens it. Do not fabricate position-specific explanations
or introduce an AI service implicitly. Missing explanatory content has a clear
generic fallback and does not block Retry or solution access.

Hints are graduated and opt-in: a conceptual clue when supported, the origin
piece, then an explicit solution. Retry alone does not reveal a hint. Existing
hint content can provide the supported levels; this specification does not
require generating missing conceptual clues to ship the board.

Feedback celebrates independent success, successful retry and completion with
accurate wording. Use a specific achievement when verified, and supportive
generic wording otherwise. Retain original miss/help metadata after a successful
retry. Assisted completion can count as practice without implying mastery;
precise rewards, scheduling and later review remain backend learning-policy work.

Technical recovery remains separate from chess feedback: a connectivity/save
failure is never a wrong answer. Preserve immediate visual input response,
pending status and in-memory attempt recovery without promising local/offline
grading.

## Accessibility and keyboard

### Web

Provide a labeled 8-by-8 grid with meaningful rows/cells and one square in the
page Tab sequence. Arrow keys move within displayed rows/columns without edge
wrapping; Home/End reach row ends and Control-Home/End reach board ends.
Coordinates retain chess meaning when orientation changes. All 64 squares,
including empty and opponent squares, remain reachable.

Enter/Space activate origin/destination; Escape deselects. Tab/Shift-Tab leave
the board. Handle these keys only inside the board, without capturing other
form/replay controls. Visible focus is distinct from selected-piece highlighting and,
like `:focus-visible`, appears for keyboard focus but not after a click or tap.
Provide concise discoverable instructions.

### Native

Expose individually discoverable squares labeled with coordinate and contents,
for example "e2, white pawn" and "e4, empty." Support swipe exploration and
direct touch exploration followed by standard activation to select and move.
Traverse in displayed row order. A selected square's accessible Cancel selection
action (and Escape) gives a reliable escape without requiring dragging; nothing is
drawn under the board for it, and the selection status is announced, not shown. Avoid grouping all squares behind
one accessible parent or exposing duplicate decorative SVG elements.

Use narrow platform adapters for semantics, announcements and focus rather
than duplicating complete renderers. Native external-keyboard support needs a
separate compatibility probe; web handlers do not prove native support.

### Feedback and promotion

Announce selection, side to move, pending submission, rejection, confirmed moves,
opponent replies and completion once at meaningful transitions. Describe moves
in readable words, not only raw SAN. Synchronize spoken descriptions with the
displayed preview or confirmed position and identify rejected previews as attempts.
Do not leak the expected answer through labels; spoken legal-target hints obey
the same visibility setting as visual hints.

Pending/rejected boards remain explorable even while attempts are blocked.
User-invoked Retry restores origin focus. Request completion alone must not steal
focus. Keep square element identities stable across motion. On navigation,
announce the new exercise and only restore focus when the old focused element
was removed or explicit user action requires it.

Promotion uses the original Knightly board-anchored vertical piece stack, with
eligible Queen/Knight/Rook/Bishop controls. The first piece sits on the destination;
the stack extends inward and reverses with orientation. An × or outside press
cancels. Controls retain accessible labels
and Cancel. Focus enters it and cannot escape to controls behind it. Escape,
native dismissal and accessibility cancellation emit no move, restore origin
focus and clear provisional presentation. Choice emits exactly once and returns
focus to destination. No automatic queen promotion in practice initially.
Ensure usable targets on small boards; the chooser may use an adaptive panel
rather than overlapping inaccessible targets.

## Artwork and theme

Reuse Knightly's existing custom SVG geometry for twelve side/kind piece
variants, cream-and-green board, knight-and-moon mark and two-tone icons.
White/black piece colors do not invert with app theme. One shared geometry and
palette representation replaces separate DOM/native artwork components.

Device appearance preferences choose Classic (default; Lichess's cburnett set by
Colin M.L. Burnett, CC BY-SA 3.0) or Knightly pieces, four board colors, coordinates inside the
squares, outside the board or hidden, piece animation, legal-move hints,
last-move highlight and move sounds. Hints and the
last-move highlight show only when both the feature and the preference allow.
A stored choice that is no longer offered (such as the removed `chesscom` set)
falls back to the default.
Each stored field falls back independently, so new options keep older choices.
Further sets/themes extend the same preference enums and must record provenance.

Migrate source values into TypeScript semantic dark-theme tokens consumed through
the owned theme. Preserve applicable artwork/font provenance and license notices.
Decorative piece art does not own the accessible label; square controls do.
Keep full-width phone board outer corners square;
rounded framed surfaces can retain the existing web identity. Screen placement
and responsive layout remain feature responsibilities.

Carry forward Fredoka/Nunito font families and solid-ledged controls. The current
bundled weights are Fredoka 600 and Nunito 600/800. Preserve source attribution
in [asset licenses](../../assets/licenses/README.md).

## Motion

Use shared motion tokens/patterns for press, reveal, feedback and transitions.
Everyday interactions are quick; milestone celebrations can be richer but never
delay the next action. Errors are calm and encouraging. Board mechanics favor
clear trajectories over decorative bounce.

- Tapped moves/automatic replies follow the animation preference: 180 ms
  medium (default), 120 ms fast, 300 ms slow, all at an even pace from the
  first frame like Chess.com's board (an ease-in reads as a pause after the
  tap), none, or three styles that
  approximate Chess.com's names (not frame-matched): Natural (eased, 180–300 ms
  by distance), Arcade (220 ms with slight overshoot) and Dynamic (70 ms plus
  35 ms per square, capped at 360 ms). Drag follows input and settles once.
- Captures disappear cleanly, including en passant's separate captured square.
- Castling animates king and rook as one coordinated transition.
- Promotion replaces the pawn with the chosen piece at the correct square.
- Acceptance of an already-displayed preview does not replay its movement.
- The board shows the player's move from its own state the moment it is made,
  as chessground does for Lichess, and hands the attempt to the owner once the
  board shows it (a slide, once it has landed). The owner's confirmation or
  preview of that position keeps any running travel; a rejection reverts it.
  The board is memoized, so owner re-renders that leave its props unchanged
  never redraw it.
- On iOS and Android, selection, destination dots and the player's tapped
  move (castling's rook and en passant's capture
  included) are drawn by a Skia overlay on the display thread, predicted from
  the tap before JavaScript runs, like chessground's painted layers. The
  JavaScript input state stays authoritative: it handles every tap, re-syncs
  the overlay once it has caught up, and the real pieces under a slide stay
  hidden until it hands over. A promotion that needs the chooser, drags and
  keyboard or screen-reader input go through JavaScript. Web draws the same
  states with the React board (Skia on web would need CanvasKit first).

Transitions carry an explicit ID and reason: attempted move, confirmed move,
opponent reply, Retry, navigation or reset. Piece identity/move metadata, not
unrestricted FEN differences, determine moving/captured/promoted pieces.
Navigation/reset and rapid history scrubbing replace positions without inferring
unrelated piece travel. The one exception is an explicit **morph**, which a
feature sends when a new position replaces the board (practice's next puzzle, as
Lichess does): pieces left on their square stay, each other piece slides to the
nearest square its kind and colour holds next (closest pairs first) if it is
within two squares, and the rest fade in or out where they stand, so unrelated
positions never tangle pieces across the board. A morph carries no moves, so it plays no sound. When a
position changes without trusted move metadata (navigation, reset, stale or
contradictory metadata), nothing travels, but pieces keep their identity by the
same nearest-same-kind pairing, so the board redraws them in place instead of
remounting every piece. Replacing a transition cancels its motion and any stale
completion event; the latest supplied position wins.

System reduced motion and the None preference both remove travel, bounce and
decorative effects while retaining status/highlights. State progression must work with animation disabled and must
not depend on elapsed animation timers. No focus/announcement per frame.
The existing Knightly timings are prototype inputs, not fixed commitments.
Tune timings/easing and verify interruptibility in the design-system prototype
and representative release builds before shipping.

## Sound

When enabled (default), each attempted, confirmed or opponent move plays one
original Knightly sound: a finished game (mate, stalemate or draw position)
outranks check, then promotion, castling, capture and an ordinary move, which
sounds different for the player and the opponent. Confirming an attempt already
heard, navigation and reset stay silent. A refused destination, rejected
feedback and a feature's `correct` event each play their own sound once; state
present when the board mounts is not replayed. Players are shared across boards, mix with other audio and respect the
iOS silent switch. Unavailable audio never blocks input or progression.

## Board feel

Built ([#87](https://github.com/hunterrhansen/knightly/issues/87)); the phone check below is open.
Interaction details from Duolingo's chess course that make solving feel lighter.
They extend the existing preferences and board states; no feature or board
contract change. The elbowed knight hint arrow from #87 already exists.

### Calm board colours

A fifth board colour, **Calm**, beside Sage, Brown, Green and Blue. Unlike the
fixed palettes it is drawn for the dark app, so it is not a white slab. Calm
is mid-grey, not near-black: on near-black squares black pieces fall to about
1.7:1.

| Token | Value |
| --- | --- |
| Light square | `#6F777E` |
| Dark square | `#636A71` |
| Destination dot, capture ring | `#E6EAED` |
| Capture tint | `#7E868D` |
| Inside coordinates | `#FFFFFF` |

- The squares are deliberately close (about 1.1–1.2:1); Calm is an opt-in look,
  not the default. Classic pieces measure 4.6–5.5:1 (white) and 3.8–4.6:1 (black);
  Knightly's black pieces are lower (2.3–2.8:1) and need the phone check.
- The legal-move markers need their own colours on Calm. The default markers
  (`onBrand`, near-black, at 45% and 60% opacity) vanish on Calm (1.2–1.4:1),
  and Duolingo's `#B2BFC8` is only 1.7–1.9:1. Calm draws its markers solid in
  the values above, which meet the 3:1 non-text contrast minimum on both
  squares (3.8 and 4.5:1). The theme carries the marker colour, its opacity, the capture
  tint and the coordinate colours, and the other palettes keep their defaults.
- Selection, last-move, hint, answer and check tints keep their current colours;
  check each on Calm.
- Inside coordinates reach 4.6–5.5:1 on Calm.
- A softer grey-white piece shade is out of scope.

### Capture tint

On the Calm board, with legal-move hints on, a capturable square gets a soft
square tint as well as its ring. Other palettes keep the ring alone. A tint
alone measures 1.1–1.4:1 against the squares, too faint to be the only marker,
so the ring stays and becomes the thin, high-contrast part (on Calm it keeps
3:1 over the tint: 3.3:1 light, 3.1:1 dark). The square view draws the tint
under the piece on both platforms, from the board's JavaScript state, so on
native it can appear a frame after the display thread's dots (the overlay draws
above the pieces, so a solid tint there would hide them).

### Lift on selection

A selected or dragged piece scales to 1.08 today (`tokens.motion.pieceScale`).
Arcade and Dynamic animation styles lift to 1.18; Medium, Fast, Slow and Natural
keep 1.08; None and reduced motion lift without animating, as now. The lift
comes from `useBoardMotionSettings`, so the classic web pieces, the layered
native atlas and the dragged piece read one value.

At 1.18 a piece is about 13% wider than its square. The board clips at its edge
(`overflow: hidden`), so a lifted piece on the edge files and ranks loses about
7% of a square on that side. Check it on a phone before deciding whether edge
lifts need an inward offset.

### Sound variations

- An ordinary move, the opponent's move and a capture each get variants: three
  for each move sound, two for captures. `scripts/generate-board-sounds.mjs`
  synthesizes them from the same knock with small pitch and body changes, so
  they stay original Knightly audio.
- A variant is picked at random, never the same one twice in a row.
- Selecting and deselecting stay silent.
- Check, castling, promotion, game end and the feedback sounds stay single.
- Each transition is heard once, even if the board shows it again later.
- A player's attempt never plays the game-end chime: a mating answer sounds
  as check, and the feedback sound judges it.

### Verification

- Jest: a stored `calm` board colour parses and older choices are kept; variant
  picking stays within the set and never repeats.
- Storybook: Calm, both piece sets, hints with captures,
  lift at both sizes on edge squares.
- Phone: contrast and glare, lift clipping at the edges, sound
  variety and volume, VoiceOver labels unchanged.

## Verification and release criteria

Follow the accepted test pyramid and affected-change selection. Keep fast checks
focused on owned behavior; do not duplicate chess.js's exhaustive rules suite.

| Layer | Required evidence |
| --- | --- |
| Fast owned logic | Coordinates/orientation; move-variant conversion; exactly-once attempts; promotion cancellation; rejected preview/Retry; same-FEN reset; stale attempt/transition protection. |
| Component/integration | Tap/keyboard/accessibility activation convergence; pending guards; focus/chooser behavior; atomic acceptance; uncertain outcome recovery in a feature harness. |
| Stories/art review | Both orientations; all twelve pieces; smallest supported squares; selection/focus/hints; pending/rejected previews; special moves; read-only; reduced motion. |
| Browser smoke | Vital move entry and promotion/cancel/focus; app navigation and production lab redirects. Detailed state/error cases stay in Jest; visual and spoken-reader checks stay manual. |
| Targeted native checks | iOS/Android move-entry smoke; actual VoiceOver/TalkBack promotion/cancel/Retry; representative-device release-build gesture/motion checks. |

Native device/simulator checks run for affected board/native/config changes and
release gates, not every unrelated PR. Include dependencies and theme/asset changes
in impact analysis. Broaden when impact is uncertain. A browser pass or bundle
export is not a native accessibility/performance pass.

Before release, demonstrate legal wrong answers are selectable without exposing
correct-answer targets, a rejected preview never commits history, reset protects
against late results, reduced motion preserves progression, and feature consumers
do not require duplicated board logic. Fix rendering/focus/performance defects
found during these checks before declaring the board ready.

## Implementation notes

The specification is approved and the shared board is implemented locally.
Keep old-board source as a reference rather than porting it wholesale. Current
integration gaps and platform/release checks live in [status](../status.md).
