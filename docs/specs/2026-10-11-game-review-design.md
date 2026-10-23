# Real game review

Game review consumes the existing backend. Games links each imported game to
`/review/[gameId]`, a protected focused screen. There is no sample fallback for
failed account requests and no new backend service or package.

## Contract and ownership

`src/features/review/` owns canonical replay positions, lesson selection, hints,
correlated attempts, step marks, session continuity and completion. Routes only
compose the screen. Shared board mechanics remain independent of auth/network.
The shared API client validates game detail, answer, hint, engine-line and finish
responses; every operation belongs to the existing account/session lifetime.

| Endpoint | Use |
| --- | --- |
| `GET /api/games/{game_id}` | Recording, analysis, deck-eligible plies and saved review timestamp/marks. Reject a different game ID. |
| `POST /api/deck/answer` | Authoritative grading/scheduling, including complete promotion UCI, `expected_day`, assistance and elapsed time. |
| `POST /api/deck/hint` | Opt-in piece hint, then move arrow. A failed hint does not mark the answer assisted. |
| `GET /api/games/{game_id}/lines` | Every move's Best/Why lines at once, built from the lines the game's analysis stored (`moves.best_line`/`reply_line`, at most 12 plies per position, as Lichess keeps `Info.variation`). Fetched in the background when review opens, so Best and Why open with no loading step. An entry that fails validation is dropped, not the whole response. |
| `GET /api/games/{game_id}/lines/{ply}` | One move's lines, for a move the bulk response lacks (a game analysed before lines were stored): served from stored lines when present, else Stockfish at depth 18 under the engine quota, cached in `engine_lines`. Validate legal continuation and matching start position. Failure never blocks the lesson. |
| `POST /api/games/{game_id}/review` | Explicit Finish review saves the exact ordered `{ply, mark}` list and returns `reviewed_at`. |

## Replay and lesson

Replay rebuilds SAN from the custom starting FEN or standard starting position.
First/previous/next/last controls clamp to recorded positions; Flip changes the
orientation. Invalid SAN stops at the last valid position with an explanation.
Unanalyzed games, unknown player side or inconsistent SAN/analysis remain
read-only and cannot be graded or completed as a lesson.

The two-pass selection stops on the player's brilliant/great moves and
mistakes/misses/blunders. An opponent's at least 20-point winning-chance drop
creates one step at the player's reply, deduplicated against those moves.
Sound replies are praise; other moves are find steps only when the backend
includes the ply in `deck_plies`, otherwise look steps. Find uses the original
position before the move; praise/look use the played position. Missing or illegal
find answers block the lesson and retain replay access. At most 200 steps can save.

Find previews legal input immediately and judges it at once, as practice does,
when the answer is already known: the stored best move, Show me, or a move the
find's prepared grade map (`/api/deck/feedback`) grades, with today's deck (loaded
as review opens) saying whether this ply was answered earlier. The verdict shows
straight away and `POST /api/deck/answer` saves it in the background; the
server's verdict replaces a different one (a stale map), a failed save takes the
verdict back with the usual recovery, and Continue and Finish wait for the save
to land. Any other move waits for the server, freezing submission while it grades.
Wrong answers retain the preview until explicit Retry restores a new position ID.
Hint/reveal, viewing the active unsolved find answer in All moves, and earlier attempts
cannot become first-try success. Show me sends
`0000` as assisted and records missed. Accepted grades produce found/good/helped;
only Continue records praise/seen. All moves returns to the same lesson step,
without progressing or losing local hints/attempts. Quiet games explicitly
finish with an empty marks list.

## Saving and recovery

Answer writes and Finish review never retry automatically. A first lost answer
can reconcile only a newly observed result on the same server day, with no prior
or acknowledged answer. Existing results cannot establish a lost retry's outcome.
An absent result cannot prove rollback; uncertainty stays blocked with explicit
Check saved progress or Exit. New-day rejection requires restoring the position.

Only Finish review saves completion. An ambiguous finish retains the exact marks
and baseline timestamp in memory. Check saved review confirms only identical
ordered marks and a changed non-null timestamp. Otherwise it stays blocked;
no automatic resend or timer unlock. Known 4xx rejections allow explicit retry.
Successful saves invalidate Games and daily-deck queries. Completion displays
actual saved marks; reload reads the backend's prior saved review, without writing.
Review again starts a new explicit lesson.

Session continuity is in-memory, isolated by API/user/session and game. Exit and
reopen preserve unfinished work within that scope. Reload/relaunch reconstruct
backend progress and saved completion but do not restore an unfinished lesson,
hints, exact timing or ambiguous operation identity. A previous daily result
prevents a replayed answer from receiving a first-try lesson mark. Sign-out cancels
requests and prevents late responses from applying. Durable interrupted lessons
remain separate work; free variations are specified in
[line exploration](2026-10-22-line-exploration-design.md). The redesign below adds the win graph,
clocks and summary tiles.

## Lesson and All moves redesign

Implemented (merged in #79). The review opens on a summary like Chess.com's, then steps through
every move of the game, Chess.com style, stopping at each key moment as a
Duolingo-like lesson step. The rules above are unchanged:
this section changes only presentation and navigation, and delivers the win
graph and summary tiles. Mockups and components: the
[Knightly Game Review Flow canvas](https://claude.ai/artifact/Ek74vLXCH3ZDurinBVmNKv)
(pages Review lesson, All moves, Components).

### Lesson screens

While the game loads, the summary's own layout stands in (`ReviewSummaryLoading`):
the knight thinking ("Opening your game", then a tip), and grey blocks where the
graph, players, accuracy and move tally land, so nothing shifts when they do.

Full screen with no tabs ("lessons are not places"). The native header carries
the title "Game review" with ✕ (exit, progress saved) and the All moves list
button (iOS toolbar buttons, Android header buttons, the web ScreenHeader); All
moves shows "All moves" with ‹ back. Every move screen then uses the same layout
from top to bottom: progress segments (one per key moment), a horizontal
`EvalBar` with the eval, `CoachBubble`, the board between two player bands,
`MoveStepper` (‹, the moves
around the current ply, ›) and `ReviewBar` (two icon actions and **Next**). The
coach bubble keeps one height (one title line and two body lines, scaled with the
text size, longer text truncated), so the board never moves between moves. Beside
the All moves board the eval bar's white share sits on White's side of the board.
The player bands follow Chess.com: the player at the bottom under the board, the
opponent above, each with name, rating and clock. A clock is the time that side
had left after its latest move at the shown position (the game's starting time
before its first move), from `clock_left` per ply; there are no clocks when the game
recorded none (daily games, unanalysed games). The clock box is the player's piece
colour (white, or `#262421`), 3 px corners, tabular digits, tenths under 20 s;
the side to move is full strength with a clock icon, the other at half.
Stepping one move (‹ ›, Next to the next ply, All moves, engine lines) slides the
piece as on Chess.com: forward plays the move, back slides it home and restores a
capture. A jump with ‹ › or a tapped move cuts straight to the position; Next
instead plays every move up to the next key moment as a quick run of slides
(about 120 ms a move, a long gap squeezed into about 1.2 s), as Chess.com does,
with the coach bubble holding still until it lands. Next during the run skips to
its end; ‹ › or tapping a move stops it.
The lesson screen never scrolls: the board takes the largest square that fits
between the coach bubble and the move strip, pinned at its top edge, with no
input status text under it (screen readers still hear it). Verdict sheets slide
over the bottom bar, edge to edge and through the bottom safe area, so the board
never resizes for them. On phones (edge-to-edge board) the sheet is square and
fills from the board's bottom edge to the bottom of the screen; wider layouts keep
the rounded sheet over the bottom bar.

**Next** jumps to the next notable move of either side, as Chess.com's
review does (observed 2026-10-14 on a signed-in web review): the last book
move, then every brilliant, great, best-or-excellent turning point, inaccuracy,
mistake, miss and blunder, then the final position and a short closing note.
Your own find steps stop there as lessons and do not pass until answered,
shown, or skipped through All moves. ‹ › step one ply at a time, and tapping a
move in the stepper jumps to it, without grading anything; plies that are not
notable show the "every move" screen. Next carries on from wherever ‹ › left
you: moments you stepped past count as seen and never replay. A find you
stepped past is the exception: Next cuts straight back to it, and once it is
answered Next cuts back to where you had stepped. The board faces the user's colour. The
coach title is the grade's name ("Book", "Mistake") with the eval.

Action sets: your mistake, miss or blunder: **Explain**, **Best**, **Next**;
the opponent's: **Best**, **Next**; a brilliant or great move: **Explain**,
**Share**, **Next**. **Best** plays the best move as a one-move side line in
the move list with its grade and eval, then **Resume** returns to the game
move. **Explain** plays the engine line as an indented variation in the move
list with ‹ › and Back to game; both stay in the list as side lines
([line exploration](2026-10-22-line-exploration-design.md)). Arrows: `danger` for the threat a
mistake allows, `best` for the move a miss overlooked, `line` for the best
reply.

| Screen | Session state | Content |
| --- | --- | --- |
| Summary | loaded, review not begun | Coach line about the game, `WinGraph` in a card (opens All moves), players (avatar, name, rating), accuracy tiles (yours light, theirs dark), `MoveTally` listing all ten move kinds with both sides' counts, never collapsed, in Chess.com's order (Brilliant, Great, Best, Book, Excellent, Good, Inaccuracy, Mistake, Miss, Blunder); a row opens All moves on the first such move; sticky **Start review**. Scrolls; no Skills, Game Rating or Advanced Stats (premium upsells on Chess.com). |
| Every move | a ply that is not a key moment | Coach title "Nxd4 is best" with the grade badge and eval, one line of explanation when the engine has one, the board with `lastMove` and grade; **Explain**, **Best** (disabled when the move was best), **Next**. |
| Find | `find`, phase `ready` | Prompt "Find a better move" with the played move and its grade; the board can be moved; **Hint** (piece, then arrow) only; Show me waits for the Not quite sheet; no Next ("Move a piece to answer"). |
| Right | `find`, `answered` with an accepted grade | `VerdictSheet` tone right: title, eval change, the engine explanation (from `/lines`, else no body), **Why?** (the best line) and **Continue**. The progress segment fills. |
| Not quite | `find`, `wrong` | `VerdictSheet` tone wrong: the punishing reply as a `danger` arrow when the line provides it, **Show me** and **Try again** (Retry). Progress does not advance. |
| Praise | `praise` | Grade badge on the board, eval in the coach title; **Explain** (the idea as a line), **Share**, **Next**. |
| Their mistake | `look` | Board in `lineMode` on the best line, `LineStepper` (back and forward) in place of `MoveStepper`, **Back to the game**. |
| Complete | `complete` | Gold check (the one gold moment on the screen), tiles Found / With help / Good moves from the saved marks, one row per moment with its mark, a deck note for missed or helped finds, **Continue** (daily) or **Done**, quiet **Review again**. |

Verdict copy comes from existing data: grades from `/api/deck/answer`,
explanations and lines from `/lines/{ply}`. Without an explanation the sheet
shows only its title and eval. Saving and uncertain states keep the existing
Check saved progress / Check saved review actions in place of the sheet's buttons.

### All moves

Opened from the lesson's list button or from Start's "Browse all moves"; it
replaces the inline replay buttons. Leaving returns to the same lesson step
without changing hints, attempts or progress.

- **Browse** (`Moves`): ‹ back to the lesson (✕ when the lesson is blocked).
  Like the lesson it never scrolls: the largest board that fits with the
  vertical `EvalBar` at its height, `WinGraph` with a cursor (tap jumps to the
  nearest ply), a compact move card (badge, "15. Be2 is a miss", eval, "Best was
  d6 · See best line"), the `MoveStepper` strip (every move, tap to jump) and
  `MoveControls` (first, previous, next, last, flip). The board shows the
  position after the selected move with its grade and `lastMove`.
- **Full move list:** the wide layout's panel (below) lists every move in
  numbered White/Black rows (`MoveTable`). On phones the strip covers every
  move; a two-column sheet (canvas `MovesList`) is open work.
- **The moment you're solving** (`MovesGuard`): at the active unsolved find ply,
  the best arrow, best move and line are hidden behind "Reveal it · counts as
  with help". Revealing marks the step assisted, as Show me does; every other
  ply stays open. **Back to the puzzle** returns.
- **Best line** (`MovesLine`): `lineMode` frame and highlights, `LineStepper`,
  ← Game back to the same ply. Lines are read-only.
- **Replay only** (`MovesReplay`): when the lesson is blocked (not analysed,
  unknown side, mismatched analysis), the same screen without eval bar, graph,
  badges or move card, plus the blocking reason. This is the only review screen
  such games get.

### Wide layout

Desktop browsers and landscape tablets (`useWideLesson`: at least 960 × 560)
follow Chess.com's desktop review: the board fills the window's height on the
left, the vertical `EvalBar` beside it (28 px, the eval printed at the leading
side's end) and the player bands above and below,
and a side panel (36% of the width, 380–560 px) on the right. The lesson's
panel stacks the top bar, the coach bubble (with the eval in its chip), every
move (`MoveTable`, kept scrolled to the shown move, tap to jump), the win graph,
‹ › and the action bar; a verdict sheet rises over the panel's foot. All moves
uses the same frame with its header, move card, list, graph and controls. A
best or explained line replaces the list with its own moves. The rules,
steps and saving are unchanged; narrower windows keep the phone layout. The
summary opens in the same frame: the starting position and eval bar on the
left, the coach, graph, players, accuracy, tally and slipped moves scrolling in
the panel, and its buttons at the panel's foot, so starting the review never
moves the board. Phones keep the summary as a column. On every layout the tally
shows Brilliant, Great, Best, Mistake, Miss and Blunder, with a chevron that
unfolds Excellent, Good, Book and Inaccuracy, as Chess.com's does.

### Keyboard

On the web (`review-keys.ts`), as Chess.com's and Lichess's desktop reviews:
← → one move, ↑ / Home the start, ↓ / End the last move, Enter or Space what
Next does (Try again or Continue on a verdict, Start on the summary, nothing
while a find waits for its answer), F flips the board and Esc or Backspace
leaves a best or explained line (Back to game), or All moves for the lesson.
B opens the best line and E the explanation wherever their buttons would (B
also answers a verdict's Why?); on a find H hints, and after a miss S shows the
move and R tries again; L opens All moves from the lesson and returns from it.
Inside a line ← → step the line. Each button names its key on hover ("Best
(B)") and in `aria-keyshortcuts`. Keys do nothing while typing, inside the board (its arrows move between
squares), with Ctrl, Cmd or Alt held, or for Enter and Space on a focused
control, which presses it instead.

### Components

Implemented with these owners; names in the canvas map as noted.

| Component | Owner | Notes |
| --- | --- | --- |
| Board (`KnBoard`) | `Chessboard` (`src/chess/board`) | `Presentation`: `lastMove`, `grade`, `lineMode`, `arrows`, `highlights`. Nothing new. |
| `MoveBadge` | `GradeBadge` (`src/chess/board`, now exported) | Colors and glyphs from `move-grade.ts`. |
| `KnButton`, `ReviewBar`, `MoveControls` | `Button`, `ActionBar`/`ActionButton` (`components/ui`) | New icons in `action-icon.tsx`: `best`, `share`, `list`, `close`, `first`, `last`, `flip`. |
| `LessonTopBar` | `components/ui/lesson-top-bar.tsx` | ✕, one segment per step, optional list button. |
| `CoachBubble` | `components/ui/coach-bubble.tsx` | Title with grade badge and eval chip, body; tone plain/right/wrong. |
| `VerdictSheet` | `components/ui/verdict-sheet.tsx` | Right/wrong sheet with secondary and primary buttons. |
| `EvalBar` | `features/review/eval-bar.tsx` | Horizontal with the eval printed (lesson), vertical (All moves). |
| `WinGraph` | `features/review/win-graph.tsx` | SVG; notable moves as dots; tap to jump. |
| `PlayerBand` | `features/review/player-band.tsx` | Name, rating and Chess.com-style clock above/below the board (`FittedBoard` bands). |
| `MoveStepper` | `features/review/move-list.tsx` | ‹ strip ›, the lesson's and All moves' way through every move. |
| `MoveTally` | `features/review/move-tally.tsx` | All ten kinds, both sides. |
| `LineStepper` | `features/review/review-screen.tsx` | Engine lines play on the main board (`useEngineLine` in `review-lines.tsx`) with Back/Forward/Back to game. |

Today's `/daily` interstitial uses `LessonTopBar` (✕ and one segment per step).
Practice keeps its own header and fixed-height prompt bubble, which hold the
board still while answers change; adopting the shared pieces there is a separate
change. Summary rows and graph points open All moves on that move (a row: your
first move of that kind, else theirs). All moves keeps the board fixed and scrolls
only the move list, following the current move. Share (your brilliant and great
moves) uses the system share sheet and falls back to Best where a browser has none.
Storybook **Review / Game review** runs the
whole review on a sample game with local grading.

Accessibility: the top bar's progress is a `progressbar` ("Key moment N of M");
verdicts are announced politely; each move cell's label has its SAN and grade;
the graph is an image with a summary, and the move list is the accessible way
to jump to a move.

Open: whether browsing All
moves before starting counts as assistance
(currently no: no step is active); a landscape/tablet layout with the board and
move panel side by side.

## Verification

Logic tests protect replay/analysis agreement, lesson deduplication, guarded
attempts, assistance, account disposal and exact completion recovery. Transport
tests reject unrelated games, malformed timestamps and illegal engine lines.
The existing seven browser smoke tests remain the suite; inspect the real guided,
replay, engine and saved-result flow directly. Native gestures, spoken feedback
and real native auth remain runtime checks. Current evidence and open gates live
in [current status](../status.md).
