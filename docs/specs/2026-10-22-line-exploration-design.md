# Exploring lines in game review

Accepted 2026-10-22. Phase 1 (the tree and free moves) is deployed with
#324; phase 2 (the web engine) is implemented, not deployed; phases 3 and 4
are not built. During a review you can play any move on the
board and follow it as a side line, with a live engine evaluation, as Lichess's
analysis board and Chess.com's review allow. Side lines are evaluated by
Stockfish 19 Lite running on the device: a WASM worker in the browser and a
local Expo module on iOS and Android. The game's own moves keep the backend's
analysis, grades and lines. This spec extends the
[game review](2026-10-11-game-review-design.md); its lesson, grading and saving
rules are unchanged.

## What the references do

Read from source (lila `ui/lib/src/tree/` and `ui/analyse/src/`, Lichess mobile
`lib/src/model/common/node.dart`) and observed on chess.com/analysis on 2026-10-22.

- **Tree.** Each node is a move with its position and children; the game is the
  first child at every position. Playing a move that already exists from the
  current position steps into it; any other move becomes a new side line
  (Lichess `addNode`). A path from the start addresses each node.
- **One jump.** Moving to a node rebuilds the board, arrows and engine request
  from that node; an engine result for another path is dropped.
- **Engine.** Both evaluate explored positions in the browser. Lichess runs
  Stockfish per position and keeps server analysis for the game's moves only;
  Chess.com's board runs "Stockfish 19 Lite" and re-evaluates as each move lands.
- **Move list.** Chess.com splits the move table at the branch: `4. Nxe5 …`, the
  indented `4. Nxd4 exd4`, then `4. … Qg5`. Lichess shows short lines inline in
  parentheses and longer ones indented; long-press opens promote, make
  mainline, copy and delete. Lichess mobile shows a bar of the moves available
  wherever a position branches.
- **Persistence.** Lichess mobile keeps explored lines in memory; the web keeps
  them in the browser; only studies save them to the server.

Not copied: promote and make mainline (the game is what was played), comments
and annotation glyphs, studies, collapse state, threat mode and cloud eval.

## Line tree

A pure module, `src/chess/line-tree.ts`, using chess.js for legality, SAN and
positions. A node is `{ uci, san, fen, ply, children, source }` where `source` is
`game`, `engine` (a Best or Explain line) or `user`. Node ids are the move's UCI,
unique among siblings; a path is the list of UCIs from the start, and its key
(`e2e4/e7e5/…`) identifies the node for React keys, caches and stale guards.

- `addMove(path, uci)` returns the child's path, adding the node only when no
  child has that UCI. A new move appends after existing children, so the game
  move stays first.
- `deleteFrom(path)` removes a `user` or `engine` node and everything after it.
  Game nodes cannot be deleted or reordered.
- The tree is built from the game's SAN replay, so repetition and fifty-move
  state come from chess.js history along the path, not from the FEN alone.

The review session owns one tree per game. `cursor` (and All moves'
`replayIndex`) stay the game move you are on; a side line on the board is
`line: { path, start }`, its moves from the start and the branch point it
cannot step back past. **Back to game** clears it and shows the game move you
left from. Best and Explain insert their stored engine line as an `engine`
branch (Best before the move, Explain after it) and show its first move;
`useEngineLine` only loads and validates it. The branch stays in the tree after
Back to game, as Lichess keeps its computer lines. Steps, marks and saving
still read game plies only.

## Playing moves

The review board accepts moves for both sides wherever it shows a game or
side-line position: every-move, praise and their-mistake screens, and All moves.
A move calls `addMove` at the current path and jumps to the result, sliding the
piece as stepping does; promotion uses the board's picker.

- **Finds are unchanged.** On a find step the board's move is the answer, as
  today. In All moves the active unsolved find's ply stays read-only behind
  "Reveal it · counts as with help"; revealing allows exploring there too.
- **Never graded.** Explored moves never call `/api/deck/answer` or change
  steps, hints, attempts or marks.
- **On a side line** the bar shows ‹, › and **Back to game**, as engine lines
  did; ‹ › step along it (› follows the first continuation) and stepping back
  past its start returns to the game. ← → step it, Enter, Esc and Backspace go
  back to the game, F flips. The session's Next also leaves a line first.
- **The board never moves.** Side lines reuse the stepper's space and the
  existing `lineMode` frame. In All moves on phones a line you played takes
  the move card's place (its move and "Back to game returns"), so the board
  keeps its size; Best and Explain still show their coach above it.

## Move list

- **Phone strip.** The game's strip (`MoveStepper`) shows each side line as a
  dashed chip after the game move it replaces, so lines stay reachable after
  Back to game. On a side line the strip (`LineStrip`) shows the line's moves
  from its branch point to its end, the one on the board highlighted and
  other branches along it as chips.
- **Wide table** (`MoveTable`). As Chess.com's: the row splits at the branch,
  side lines are indented under it with their move numbers, and the game
  continues with `…` in the column already played. Lines more than one level
  deep indent once more and no further.
- **Delete.** Long-press a side-line move (a held click on web) and the strip,
  or the top of the wide panel, asks "Delete from 3. e4?" with Cancel and
  Delete. Game moves have no menu.
- **Accessibility.** Each side-line cell's label says "Side line" with its
  number and SAN and hints at long-press. Phase 2: the eval bar's value is
  announced when the search settles, not every update.

## Engine

`src/lib/engine/` holds one UCI controller (`uci.ts`, restored from the
removed bot-play engine) over a transport per platform, chosen by the resolver
(`stockfish-transport.ts` native, `.web.ts` browser). The controller keeps one
search in flight: a new search stops the old one, and the old promise rejects
with an `AbortError`, so a late `bestmove` never answers the newer position.
`getStockfish()` (`stockfish.ts`) starts the one engine on first use with
`Threads 1` and `Hash 16`. The review's `useLineEval`
(`src/features/review/line-eval.ts`) drives it.

- **Position.** The request is the position after the last capture or pawn
  move and the UCI moves since, as Lichess sends, so the engine sees
  repetitions.
- **When it runs.** Only while a side line is on the board (your moves or a
  Best/Explain line). Game positions keep the backend's eval and best move so
  the bar, arrows, grades and win graph agree. Each new position stops the
  previous search; a result for a position the board has left is dropped, and
  finished results are kept for the visit.
- **Limits.** MultiPV 1. Stop at depth 22 or 5 s on web and depth 20 or 3 s on
  phones (`go depth … movetime …`), whichever comes first. Leaving review
  stops the search.
- **Display.** Scores are turned to White's side and onto the backend's
  win% curve (Lichess's, ±1000 cp clamp). The eval bar and the coach's chip
  (the All moves card on phones) show the score as it deepens: "…" until the
  first result, `+0.35`, `−M3`. The best-move arrow (when the Best move
  preference is on) is the line's first move once depth reaches 12. Without
  an engine the bar stays level and empty and moves still play.
- **Web** (implemented). `stockfish` 19.0.1's `lite-single` build, ≈1.8 MB of
  JS and WASM with the small network inside, in a classic web worker. Unlike
  the threaded builds it needs no cross-origin isolation. Postinstall
  (`scripts/prepare-engine-web.mjs`) copies it to the ignored `public/stockfish/`
  as `stockfish.js`/`stockfish.wasm` with `COPYING.txt`; the worker loads from
  the app's origin on the first side-line search, outside the bundle.
- **iOS and Android** (implemented, not on a device yet). The local Expo
  module `modules/stockfish` (`knightly-stockfish`, linked as a `file:`
  dependency and autolinked; nothing is edited in the generated `ios/` or
  `android/`) compiles Stockfish 19's light flavour vendored from
  `lichess-org/dart-multistockfish`, with Lichess's 1.1 MB net embedded: the
  same engine the removed bot-play module (`52e5fde`) used, now without Nitro.
  `cpp/engine_runner.cpp` boots it once per process with a reader thread that
  hands on complete lines; an Objective-C++ bridge (iOS) and JNI (Android)
  expose `start()`, `send()` and `onLines` events to `stockfish-transport.ts`.
  A build without the module rejects `ready()`, and side lines then show no
  eval. Searches stop while the app is in the background (or the web tab is
  hidden) and restart on return. No maintained React Native library exists,
  and Hermes cannot run WASM. Checked: the iOS Simulator build links and
  launches, and the runner compiled for macOS gives the web build's result
  (depth 14, the same nodes and best move). Still to check: a side line's eval
  in the app on an iPhone, an Android build (no Android SDK on the Mac that
  built it), and the size it adds per ABI.

## Licence

Stockfish is GPL-3.0, and the Expo module links it into the iOS and Android
apps, which makes the apps' distributed builds subject to the GPL. Accepted by
the owner on 2026-10-22. The web build runs the unmodified `stockfish` package
as a separate worker and serves its `COPYING.txt` beside it; its source is the
package's tagged release, recorded in asset licenses. The **Privacy and
licences** page (`/privacy`, reachable signed out and from Account on every
platform) names Stockfish and its authors, states the GPL-3.0 terms and the
absence of warranty, and links the licence and the Stockfish.js 19.0.1 and
Stockfish sources. Before the first native build that ships the engine:

- Distribute each app release under GPL-3.0 terms and publish its complete
  corresponding source (a tagged public source release per build), and link
  it from that page.
- Note the App Store terms' long-standing tension with the GPL when submitting.

## Phases

1. **Tree and free moves** (merged). `line-tree.ts`, the session's side
   line, Best and Explain as engine branches, moves on the review board, the
   strip, table and delete confirmation. On a side line the eval bar holds
   its place, empty, and the coach has no eval.
2. **Web engine** (implemented). The worker transport and controller, the eval
   bar, coach chip and best arrow on side lines in the browser.
3. **Native engine** (implemented, unverified on devices). `modules/stockfish`
   for iOS and Android; then the licence work above and a TestFlight build.
4. **Graded side lines.** "Nxd4 is excellent" in the coach bubble for explored
   moves, as Chess.com's review does (to be observed in a signed-in review
   first). Needs the rating-matched grading curve from `analyze.py` on the
   client or an endpoint that classifies a pair of evals; decide when 3 lands.

Saving explored lines across reloads or to the server is not planned; they live
in the review session's memory and follow its continuity rules.

## Verification

- Logic tests: `addMove` steps into an existing child and never duplicates or
  reorders the game move; game nodes cannot be deleted; an engine result for an
  earlier path never reaches the board; explored moves never submit answers;
  the active unsolved find stays guarded in All moves.
- Engine adapters: a parsing test over recorded UCI output (scores, mates, PV);
  real search speed, memory and backgrounding are runtime checks on web, an
  iPhone and an Android device.
- No new browser e2e suite: exploring is not one of the smoke journeys. Review
  the move table and strip in Storybook and on narrow layouts with large text.
