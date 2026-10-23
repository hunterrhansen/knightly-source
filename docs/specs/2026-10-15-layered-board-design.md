# Layered board renderer

Stages 1–3 shipped in TestFlight builds. Stage 4 makes the layered renderer the
only native renderer (merged; release check on a phone open); moving the tapped-move
slide into the atlas is the remaining step. Step 2 of [board performance #96](https://github.com/hunterrhansen/knightly/issues/96).
A second native renderer for the shared `Chessboard`. Like Lichess's mobile board
(`lichess-org/flutter-chessground`, read from source), it draws the board in a
few canvas layers instead of one React Native view and SVG tree per piece. The
board's public contract does not change: `BoardProps`, events, the input
lifecycle and accessibility all stay the same, and features cannot tell
which renderer is drawing.

## Why

The board-lab benchmark (Benchmark mode, dev build, iPhone simulator) shows the
animations already run smoothly on the UI thread. The cost is React rendering
the board on every tap, move and position change.

- Step 1 (#98) cut board commits to 25–34 ms and removed the UI-thread stalls
  when jumping between positions.
- What remains is mostly the 32 piece SVG trees: about 250 SVG nodes
  reconciled per render.
- Lichess has no widget per piece. A move repaints one small layer, and the
  static pieces stay in a cached raster.

## Lichess → Knightly

| Lichess (flutter-chessground) | Knightly layered renderer |
| --- | --- |
| Background `CustomPainter`, `shouldRepaint` false | Not adopted: squares and coordinates stay memoized React Native views (stage 2b measured recorded pictures about 1 ms slower). |
| `HighlightsPainter` on a highlight notifier | Not adopted: highlights stay on the squares; selection, dots and capture rings come from the existing fast-board shared values (already Skia). |
| `PiecesPainter` in a `RepaintBoundary` (raster cached) and `TranslatingPiecesPainter` driven by one `AnimationController` | **One `<Atlas>` for every piece**: one texture of the 12 piece images, one draw call, a per-piece transform computed on the UI thread from one shared `progress`. Static pieces just keep their square; there is no repaint per piece. |
| `FadingPiecesPainter` (paint alpha 1−t) | The same atlas, with per-sprite alpha from `useColorBuffer` (`colorBlendMode` modulate). No opacity layers. |
| Drag piece in an `OverlayEntry` driven by a `ValueNotifier<Offset>` | The dragged piece's atlas slot follows the existing `dragX`/`dragY` shared values through `grabCenter`, grown, tilted and raised clear of the fingertip. |
| WebP pieces decoded once into a `ui.Image` cache | Piece art rasterized once per set, size, pixel ratio and variant into an atlas `SkImage`, kept in a module cache. |
| `preparePieceAnimations` (nearest same-kind pairing) | The existing `reconcilePieces` (moves, morphs, snaps), unchanged. |

One deliberate difference: Lichess repaints moving pieces on the UI thread
through `CustomPainter`, while the atlas recomputes only transform and colour
buffers. Neither repaints the static pieces.

## Architecture

The renderer lives in `src/chess/board/layered/`, native only, and is selected
inside `Chessboard`. Each file has one job:

| File | Job |
| --- | --- |
| `piece-atlas.ts` | Builds and caches the atlas `SkImage`: 12 cells (kinds across, white then black down), each `squareSize × pixelRatio`, drawn from the piece art (Knightly and cburnett SVG; personal PNG sets). The cache key is set, cell size, pixel ratio and variant. It returns the sprite rect per `color+kind`. |
| `piece-layer.tsx` | The `<Canvas>` and `<Atlas>`, sized by the parent like the classic board. It owns the slot table, the transform and colour buffers, and the dragged-piece sprite. |
| `piece-layer.web.tsx` | Web placeholder: the layered renderer is native only, so web keeps the classic board. |
| `layer-run.ts` | What the layer drew last, and whether a redraw restarts piece travel (a new position or transition) or keeps the clock (a selection change). |
| `easing.ts` | CSS-style cubic bezier easing evaluated on the UI thread for the motion preferences. |

**Slot table** (`piece-layer.tsx`): a fixed 34-slot buffer, for 32 pieces plus
two in flight (a capture fading while a piece lands, or a promotion).

- JS writes one shared array of slots whenever the reconciled pieces change, at
  most once per position or transition. Each slot holds:
  - the sprite cell;
  - `from` and `to` square centres;
  - `fade` (none, out);
  - `lift` (selected, landing);
  - `visible`.
- The transform worklet (`useRSXformBuffer(34, …)`) reads the slots plus
  `progress`, `dragX`/`dragY`/the dragged slot, and the fast-board `travel`. It
  writes `scos = scale`, `tx`/`ty` = the interpolated top-left. Hidden slots get
  scale 0.
- The colour worklet (`useColorBuffer`) writes alpha 1, or `1 − progress²` for
  fading slots (ease-in-quad, as Lichess).

**Motion:**

- A transition starts by writing the slots, then
  `progress.value = withTiming(1, { duration, easing })`. Duration and curve come
  from `useBoardMotionSettings` (Natural, Arcade, Dynamic or None).
- On completion one `scheduleOnRN` call fires `onTransitionComplete`; fading
  slots then clear.
- Reduced motion or None sets `progress` to 1 immediately.
- The landing bounce and the selection lift are scales on the slot, also on the
  UI thread.
- The fast board's tapped-move slide uses the same slots (from `fast.travel`),
  so the 80 ms Skia→React handover in `board-overlay.tsx` goes away.

**Stays React Native:** the 64 memoized squares remain as transparent views on
top, carrying accessible names, actions, focus and hit areas, and drawing
nothing. Gestures (Gesture Handler on the UI thread), hit-testing,
promotion chooser, arrows, answer/grade/mate badges and result overlays are
unchanged. They render rarely and can move into Skia later.

## Rollout

Native always draws pieces with the layered renderer; the internal renderer
preference and the benchmark's renderer switch were removed in stage 4.

| Stage | Builds | Done when |
| --- | --- | --- |
| 1. Static pieces (built) | Piece atlas and static piece slots in one `<Atlas>`; transitions snap. Squares keep drawing background and highlights: after #98 memoized them they cost little, so moving them into pictures waits until the benchmark shows it is worth it. | Positions, piece sets, orientations and lift look the same as classic. Benchmark: board commit mean replay 25→12 ms, morph 34→22 ms, jump 32→24 ms; JS worst stall about halved for morph and jump; no late UI frames. |
| 2. Motion (built) | One clock per transition drives moving pieces (each with the motion preference's duration and curve), capture fades (per-sprite alpha, ease-in quad), promotion travel and the landing bounce, all on the UI thread; arrivals report to the board's motion hook. The fast board's tapped-move slide still uses its overlay. | Animation adds no JS cost (board commits equal stage 1's snaps) and no late UI frames. Board commit mean: replay 11.8 ms, morph 22.8 ms, jump 21.5 ms. The 10 ms target holds only for replay: the rest is squares re-rendering when many change at once, which stage 2b reduces. |
| 2b. Squares (built) | Profiling put about 65% of a board commit in the square grid, but the cost was reconciling it, not drawing: one wrapper view per square sent fresh style props to all 64 on every commit. The grid now renders squares directly under constant row styles. Squares stay views: drawing them as recorded Skia pictures was measured and added about 1 ms. | Board commit mean (layered): replay 11.8→7.3 ms, morph 22.8→13.8 ms, jump 21.5→13.8 ms; no late UI frames. Morph and jump stay above 10 ms because every square's piece (its accessible name) changes; that cost is in the accessible squares themselves. |
| 3. Drag (built) | A last atlas sprite draws the dragged piece under the finger, lifted, and its slot hides in place; the slot table doesn't change. The gesture lifts the piece on its first UI-thread frame for squares with a legal move (synced from JavaScript), before `beginDrag` commits; a drop clears the lift in the same commit as the move, so the piece never flashes at its origin. | Simulator: drop, cancel back to the origin and a refused lift (side not to move) behave as classic, with the target outline. Still to check on a phone: that drag feels immediate. |
| 4. Default (built) | Layered is the only native renderer. `MotionPiece` remains for web and the provisional promotion pawn, without the overlay handover. | One full release check on a phone, including VoiceOver, all piece sets and large text. |
| 5. Tapped slide | Draw the fast board's tapped-move slide from the atlas slots and delete `SlidingPiece` in `board-overlay.tsx` with its 80 ms handover. | Same phone check; taps feel as immediate as today. |

Web keeps the classic renderer. Skia on web needs CanvasKit (about 3 MB), which
the web app doesn't load; revisit after native.

## Acceptance

- **Benchmark** (dev build, same device): board commit under 10 ms mean for
  replay, morph and jump; no late UI frames; the worst JS stall halved from #98.
- **Phone:** moves, drags and jumps feel immediate, with no visual difference
  from classic.
- **Unchanged:** VoiceOver names, actions and focus; the board runtime smoke tests
  pass.
- **Risks to check per stage:**
  - pixel-ratio blur on piece art (rasterize at `PixelRatio.get()`);
  - atlas rebuild cost on size or theme change (cache it, rebuild off the
    interaction path);
  - drag clipping at the board edge. Lichess draws the drag in an overlay; a
    Skia canvas clips to its own bounds either way, so `grabCenter` holds the
    carried piece inside the board on both renderers instead.
