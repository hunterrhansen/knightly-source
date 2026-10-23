# Daily practice integration

Implemented contract for the real practice journey, including
[multi-move solutions](#multi-move-solutions) that extend its single-move
answers. Runtime evidence and remaining checks live in
[current status](../status.md).

## Outcome and scope

Today opens a daily practice position from the signed-in user's own games.
The shared board previews a legal attempt immediately; the existing backend
grades it and saves scheduling/progress. The learner can retry a miss, request
a hint, reveal the solution, continue through today's cards and see actual
saved results. No fake lesson, local grading, offline queue or new backend
service is introduced. Game review, bot play, generated explanations and
distribution remain separate work.

The existing authenticated transport, account-scoped QueryClient and controlled
board are reused. A feature-owned controller is preferred over adding network
logic to the board or porting the old frontend's entire practice implementation.

## Backend contract

Read-only inspection of the integrated backend establishes these endpoints:

| Endpoint | Use |
| --- | --- |
| `GET /api/deck` | Server day, learning counts, today's saved results and next card, including its original FEN and source-game context. `mode=lesson` (the default) is tonight's watch, in [the watch's mix](2026-10-19-path-home-design.md#what-a-watch-holds-decided-2026-10-22); `mode=extra` continues tonight's extra watch ([path home](2026-10-19-path-home-design.md#backend-and-api)). |
| `POST /api/lesson/extra` | Start (or resume) tonight's extra watch once the lesson is finished; returns its deck, as `mode=extra` does. |
| `POST /api/deck/answer` | Submit `game_id`, `ply`, complete UCI, `expected_day`, hint flag, elapsed seconds and redo flag; return authoritative quality, rating, best move and scheduling result. |
| `POST /api/deck/hint` | Retrieve the best move for opt-in piece and arrow hints; client marks subsequent answers assisted. This endpoint itself does not save a grade. |
| `POST /api/deck/more` | Learn more: once today's queue is finished, raise today's new-position limit by one pace's worth for today only; returns `added` (0: nothing to add) and the server `day`. |

The backend's existing first-answer-per-card-per-day rule owns FSRS scheduling.

**Daily amount.** New positions and reviews have separate limits, as in Anki, so
due reviews never crowd out the mistakes from recent games. The pace in
Settings › Daily practice (`PUT /api/settings/practice`, `pace` in
`GET /api/settings`) sets new positions a day: Light 3, Standard 5 (default),
Intense 10. Every due card is served, most overdue first, up to 200 reviews a
day at every pace (Anki's default); the rest wait for the next day. That is
about twice the steady-state load at Intense (below), so reviews only wait after
a long break; the old cap of ten times the new limit sat at the steady state and
let overdue reviews pile up. Both limits count cards already answered today,
and a pace change applies at once. Once today's queue is finished, Today's Done
state offers "Learn N more new positions" (Anki's Custom Study, "increase
today's new card limit"): `POST /api/deck/more` raises today's new limit by one
pace's worth (fewer when the deck has fewer unanswered), for that user and day
only; `learn_more` in `/api/home`'s `today` is that N, and 0 until the queue is
finished. The pace setting is unchanged, and the extra positions are graded and
scheduled by FSRS like any other. There is no reviewing ahead of cards not yet
due. New
positions come weakest first: blunders, then the tactics missed most in rated
games of the last 90 days (also the puzzle theme), then the newest games. An
FSRS simulation (90% retention, half of new positions missed on first try) gives
about seven reviews a day per new position a day after three months and ten
after a year, so the presets come to about 10, 15 and 30 minutes a day once the
deck is a few months old. Desired retention stays at FSRS's 0.9 and is not a
setting. There is no controlled study of an optimal daily puzzle count; coaches
advise 10–30 minutes a day with accuracy over volume, which Standard targets.
Subsequent answers can mark a missed card solved without replacing the first
grade. The backend still accepts `redo: true` (judged, never graded), but the
app no longer has a redo round and always sends `redo: false`. `0000` requests a revealed answer and is submitted as assisted.

The live OpenAPI matched the committed snapshot during initial inspection.
Deck endpoints have generic response declarations, so generated types alone
cannot validate them. Add explicit Zod response schemas at the existing API
boundary; validate FEN, UCI, counts, quality/rating values and required server-day
fields. Do not invent response fields or silently accept invalid positions.
Positions carry their solution line and grade map, so the app judges moves and
gives hints instantly and saves in the background
([instant practice](2026-10-15-instant-practice-design.md)); the server's
acknowledgement still decides any saved grade.

## Ownership and presentation

- `src/features/practice/` owns session loading, active card, hints, submissions,
  retries and completion presentation. Expose only
  the intentional Today query/action contract through a registered public API.
- `src/lib/api/` validates deck/hint/answer payloads and extends the existing
  typed authenticated client. `session-scope` wraps every new operation in the
  same account-lifetime cancellation boundary.
- `src/app/practice.tsx` composes the real screen. Enable production `/practice`
  availability and preserve its protected-route sign-in return behavior.
- Today displays real due/done counts with Start practice, honest empty or
  processing states, and recoverable loading errors. Preserve import actions.

The focused practice screen follows Chess.com's puzzle layout in Game review's
lesson frame. The shared lesson header (native on iOS and Android) has ✕ (exit,
progress is saved) and the title, with segmented `done / total` progress beneath
it. The first load shows this same frame (✕, an empty progress track, the knight
thinking in the bubble, an empty board and a grey meta line) and the pieces drop
in row by row when the position lands; see the shared loading frame in
[app foundation](2026-10-10-app-foundation-design.md).
A two-line coach bubble shows the side to move with the card's prompt, then
**Solved** (with short praise) or the server's message. The board fills the room
left without scrolling (edge to edge on phones, bounded on wide screens),
oriented toward the card's player. On a card, the move played in the game is a
red arrow until the learner's first attempt. Under it, a meta line shows the opponent and
move number, and after an answer the card's tactic theme, when the backend named
one, above the solution's `‹` `›` steps. A bar pinned to the bottom holds
only Hint, then Show move, while solving, as on Chess.com: no Solution until a
wrong answer's sheet offers it, and no Next until there is something to move on
to, and Refresh with Continue or Done on the right on completion. A hint marks its piece (and Show move its
arrow) only while no answer is on the board: any move clears it and Try again
brings it back, as on Chess.com. An answer slides a verdict sheet over the bar
([answer feedback](2026-10-14-answer-feedback-design.md)): praise with Continue
(and the solution's steps and tactic tag), or **Not quite** with Solution and Try
again. A puzzle's rating is a label above the bubble, not on the meta line. Correct answers show the board's
Chess.com's answer marks: both squares tinted (green `#acce59` or salmon
`#ff7769`, 50%) and a check or cross badge on the destination's top-right
corner (0.40 of a square, overhanging by 0.14, tucked in on the top rank and
right file, 150 ms fade after the piece lands). Success and error haptics follow the answer. Empty deck and
done-for-today are distinct. Completion shows found/with help/to revisit
tiles and the day's results from a fresh deck response, rather than predicting
persistence locally. The `Practice/Daily practice` story runs the screen with three local sample cards.

The deck card carries `prev_uci` and `fen_prev` (the opponent's move into the
position and the position before it) and `pattern`. When the move replays from
`fen_prev` onto `fen_before`, the board first shows `fen_prev` and plays the move
in as an opponent transition after 350 ms; answers, hints and reveal wait for it.
A card whose setup does not replay is shown directly. Retry keeps the last-move
highlight without replaying the setup.

## Interaction and progression

1. Fetch the real deck. Retain the original FEN as the canonical exercise
   position, with a unique identity for each load/retry. Legal variants come
   from shared chess mechanics and include explicit promotion choices.
2. Install a synchronous submission guard before sending an answer. Preview the
   legal move with correlated position/attempt IDs and show checking/saving.
   Freeze further move, hint, reveal and progression actions while pending.
3. Accept a result only while account, active card, position revision and attempt
   still match. A wrong answer keeps its preview and offers explicit Retry;
   Retry restores the original FEN with a fresh identity. A correct or revealed
   result enables Continue. Never replay the preview animation as a new move.
4. A requested hint reveals the origin piece, then the move arrow. Hint/reveal
   marks the attempt assisted. Retry alone never reveals help. Missing reliable
   explanations use a plain fallback rather than fabricated chess commentary.
5. Continue loads the next server card. The watch (and an extra watch) ends
   when the server's deck has nothing left: a miss is not brought back within
   the session. Finally refresh saved results and show the completion screen.

Session continuity is in-memory only, scoped to the authenticated session.
Leaving and reopening within that scope preserves the active exercise.
Reload/relaunch reconstructs server progress without promising recovery
of unsaved local hints or exact attempt timing. Sign-out/account
switch clears session state and cancels requests; late callbacks cannot apply.

## Failure and reconciliation

Never automatically retry an answer write. Network failure, server failure,
malformed success data and cancellation after sending can leave the save outcome
unknown. Preserve the attempted move in memory, display uncertainty and block
new submissions. An explicit Check saved progress action reads `/api/deck`.

For a first answer without an acknowledged or previously visible result, a newly
observed result for that card on the same server day establishes a saved grade.
An existing result cannot establish the outcome of a lost retry response. Display the saved mark without inventing the
lost response's exact move quality. Continue may advance to the next card.

A GET that does not show the result cannot prove the POST will never commit.
Keep the uncertain state blocked and offer another status check or exit; never
automatically resend or unlock from a timer. The existing backend offers no
operation-status/idempotency key for proving an absent commit. Surface this
limit explicitly; adding such a backend contract would be separate work.

Known pre-submission failures and definite 4xx rejections have explicit recovery.
HTTP 409 for a changed server day requires refreshing the deck and invalidating
the old exercise. `expected_day` always comes from the backend, never
the device's UTC date. Request abort does not imply rollback.

## Acceptance and verification

Behavior tests protect actual outcomes: wrong-preview retention and explicit
retry, promotion submission, assisted grading, duplicate/stale attempt rejection,
day rollover, account disposal and ambiguous-save reconciliation without resends.
Use one primary test owner per behavior; component tests cover only additional
screen/board wiring. Validate malformed backend positions at the transport.

Run affected tests, full lint/types, standard `npm run verify` and all
`npm run test:runtime` tests on stable source. Shared UI changes also require
`npm run verify:full`. Preserve the small existing browser smoke suite; inspect
practice's visual states directly rather than adding an exhaustive e2e matrix.

Verify real Clerk sign-in, callback/cancel, session restoration, sign-out/account
switching and live import on the integrated bundle. Then run a real practice
position against the dedicated local authenticated database, confirm saved
results after reload and repeat affected iOS input/promotion/accessibility checks.
Mocked tests, fixture screenshots and exports cannot establish those results.
Keep unavailable gates visible in [current status](../status.md).

## Multi-move solutions

Practice matches Chess.com Puzzles for positions whose solution is a forcing
line: the learner moves, the opponent's reply plays in about 280 ms later, and
the learner continues until the line ends. A wrong move anywhere fails the
position. Show Solution replays the whole line from the start at about 800 ms
per move. Continue, Try again and Find your move sit over Hint, so
for one second after the position they open becomes playable it ignores
presses; a repeated press must not save a position as assisted unseen. After a solve or reveal, `‹` `›` buttons step through the line; on
web the Left/Right arrow keys do too, unless the board's square focus or a text
field already handled them. Native has no app-wide hardware key events without
a native module, so native hardware keyboards use the buttons.
Single-move cards remain the one-move case of the same contract. Ratings,
streaks, a daily puzzle and timed modes stay out of scope.

### Forcing lines for own-game cards

The practice worker computes a line next to the existing grade map, in a new
`practice_lines` step of the `practice` job, and stores it in a new
`moves.practice_line jsonb` column (one migration). Like `practice_grades`, its
fingerprint covers line version, FEN, `best_uci`, `eval_before`, engine binary
revision and search limits; re-analysis that changes those inputs invalidates
it, and the deck GET never runs Stockfish. The worker writes only if
`best_uci`/`eval_before` still match, as preparation does today.

From the card's position, starting with `best_uci`:

1. Play the learner's move. Stop at checkmate or another finished game.
2. The opponent's reply is the engine's first choice at `LINE_DEPTH` (initially 16).
3. Analyse the learner's next move with MultiPV 2 at `LINE_DEPTH`. Extend only
   when the best move beats the second by `CLEAR_GAP` win% from the learner's
   side (the "one move clearly better" bar, above the deck's card bar `CARD_GAP`), or mates while the
   second does not. Otherwise end the line on the previous learner move.
4. Stop at `MAX_LEARNER_MOVES` (3, so at most five plies).

A line is trustworthy only when every search reached `LINE_DEPTH` within its
time cap, its first move equals the card's `best_uci`, it ends on a learner
move and it replays legally. Any failure, capped search or missing engine stores
a one-move line: the card behaves exactly as it does today. A card is never
held back waiting for a line. Grade maps continue to cover the first move only.

Later learner moves accept the line's move or any checkmating move (the
Lichess/Chess.com rule). Because each later move cleared `CLEAR_GAP`, every
other move is wrong. On the first move, the existing `judge` still applies:
an alternative that passes ends the position as solved with its quality.
Every card's first move beats the second by `CARD_GAP`, at least `HARD_DROP`
(5), so that is effectively only an alternative mate.

### Lichess puzzles in the session

Lichess puzzles (CC0, `lichess_puzzles`) fill the session once today's
own-game cards are done or none exist. At most `puzzles.SESSION` (5) a day are
served, in the user's most common tactic over 90 days (Home's choice), with
the existing rating targeting. They are not FSRS cards and are never
rescheduled. `moves[0]` is the setup move, so `fen_prev` is the puzzle FEN,
`prev_uci` is `moves[0]` and the exercise starts after it. Learner moves are at
odd indexes. A puzzle is never shown without Lichess's stored line.

`GET /api/deck` adds `puzzle` (nullable, only when `card` is null),
`puzzles: {done, session, available}` and `puzzle_results` (the day's first
tries: `id`, `correct`, `rating`, `themes`). The pick is stable within a day, so
a reload serves the same puzzle. `puzzle` carries `id`, `fen_prev`,
`prev_uci`, `fen_before`, `color`, `themes`, `rating`, `line_key` and no
solution. `today` counts keep meaning own-game cards. Completion lists puzzle
results separately, from `puzzle_attempts` for the server day. Step-through is
the review for cards and puzzles alike; practice has no Analyse link.

The client-graded `POST /api/puzzles/answer {id, correct}` is replaced by a
server-graded step endpoint (below); no shipped frontend used the old one. A
puzzle's first terminal answer inserts its `puzzle_attempts` row (`success`
false after any wrong move, hint or reveal); its response adds `recorded` and
`done_today`. Retries and redos are judged and not recorded.
`POST /api/puzzles/hint` mirrors the deck hint.

### Server-graded step contract

The server re-grades every saved answer and owns the saved grade; the client
judges instantly from the served line ([instant practice](2026-10-15-instant-practice-design.md))
and posts finished answers. Each answer posts the **whole move list** played from
`fen_before`, so the server is stateless between moves:

| Field | Meaning |
| --- | --- |
| `game_id`+`ply` (deck) or `id` (puzzle) | The exercise. |
| `line_key` | The line the exercise was served with. A different stored line returns 409 "This position changed"; the client reloads. |
| `moves` | An odd number of UCI moves (at most five for own-game lines, up to 31 for puzzles): learner moves at even indexes, opponent replies at odd ones, ending with the new learner move or `0000` (Show Solution). |
| `expected_day`, `hinted`, `seconds`, `redo` | As today. `hinted` covers a hint at any step; `seconds` sums learner thinking time. |

The server rejects with 422, without writing, a prefix that diverges from the
stored line or that contains a move after the line's end. It then judges only
the last learner move and returns a `status`-discriminated response:

- `continue`: `{status, reply_uci, reply_san}`. Nothing is written.
- `solved`, `failed` or `shown`: the existing `correct`, `quality`, `rating`,
  `due` and `mastered` (deck; `null`/`false` for puzzles), plus `step` (the
  learner-move index), `best_uci`/`best_san` (the expected move at that step) and
  `line: {uci[], san[]}`, the full solution from `fen_before`.

Only terminal results write, and the existing first-answer-per-card-per-day rule
owns FSRS. The day's first terminal answer grades the card as follows:

- **Again**: any wrong move, a hint at any step, or Show Solution.
- **Hard**: the line completed with a passing first-move alternative rated `good`.
- **Easy**: every learner move was the line's move, with no hint, and
  `seconds <= EASY_SECONDS ×` the number of learner moves.
- **Good**: any other completed line.

A retry that later completes sets `solved` ("found with help") without
regrading. A redo is judged and never graded. Abandoning mid-line writes
nothing, so the card stays due and returns. `card_reviews` gains `moves` (the
submitted list) and `line_key`; `answer_uci` keeps the last learner move.
`/api/deck/hint` and `/api/puzzles/hint` take `line_key` and the `moves` prefix
and return the current step's move, with the same 422/409 checks.

The deck answer endpoint still accepts `uci` alone (exactly one of `uci` or
`moves`): it is graded against the line's first move only, as before lines
existed. Game review uses it, and clients from before lines keep working.
Responses are additive. Deploy the backend before the app: the app requires
`line_key` on deck cards.

### Client contract and state machine

`src/lib/api/practice-contract.ts` validates every new payload with Zod:

- `puzzle`: a legal `fen_prev`/`prev_uci` that replays to `fen_before`, and a
  side to move matching `color`.
- `line_key`: 16 lowercase hex characters, required on cards and puzzles.
- The answer: a discriminated union on `status`. Terminal lines have odd length,
  matching `uci`/`san` lengths and UCI format.

The session additionally rejects, as malformed, a terminal `line` that does not
replay legally from the card's `fen_before`, a solved line that does not start
with the accepted moves, and a `reply_uci` that is illegal in the current
position. These follow the existing `best_uci` check and are not treated as
grades.

`practice-session.ts` keeps one controller for cards and puzzles (an `item`
union): today's cards first, then puzzles. It
calls `answerLine`/`lineHint` for cards and `puzzleAnswer`/`puzzleHint` for
puzzles; the one-move `answer`/`hint` stay for game review. It adds:

- `played`, the server-accepted move list. Each step has a fresh position
  identity; attempts still correlate with the current position and attempt.
- The `replying` phase. After `continue`, the reply plays as an `opponent`
  transition at `max(0, 280 ms − elapsed since the learner's move)`, through the
  injected `schedule`; input reopens afterwards. The 280 ms runs from the move,
  so a slow response is not padded further.
- The `revealing` phase. `0000` submits the prefix, then the board resets to
  `fen_before` (after setup) and plays every line move at 800 ms intervals, with
  input frozen. Exit cancels the replay through the stale guard.
- After a terminal result, `view` over the precomputed line positions,
  bounded `0…line.length`. `‹` `›` and the web arrow keys move it; board input
  stays disabled.
- Retry after `failed`. It restores the position before the wrong move (the
  Chess.com behavior), keeps the accepted prefix and uses a fresh identity.
  Later steps post as ordinary retries. Show Solution after a miss replays the
  line it returned without another request; the miss is already saved.

Every delayed callback (setup, reply, replay frame) checks account, exercise,
position revision and attempt before applying. Sign-out, account switch, exit
and day rollover cancel it.

Failure handling is unchanged for every step. A mid-line move whose response is
lost is uncertain: a correct move wrote nothing, and a wrong one may have
written a failure. The client keeps it blocked, never resends it, and offers
Check saved progress. A newly observed result settles it; an absent one cannot,
which is the existing limit. A 422 prefix rejection is a definite client error
with explicit retry. Any 409 (new day or changed line) requires reloading.

### Verification plan

Backend pytest, with injected `analyse` fakes for line building:

- Lines extend only through clear-best learner moves, stop at mate, cap and
  non-unique moves, fall back to one move on capped or failed searches, and
  are invalidated by a changed `best_uci`.
- `continue` writes nothing.
- A wrong second move writes Again. A hint at a later step makes a clean solve
  Again. Easy and Good follow the stated rules.
- A retry completion sets `solved` without regrading. Redo writes no grade.
- Any mate is accepted on a later step.
- Divergent or overlong prefixes return 422 without writes. A changed line
  returns 409. The day guard runs before mutation.
- Legacy `uci` requests still work.
- Puzzles are served only after cards are done, at most `SESSION` per day.
- A puzzle's first terminal answer records once with `success` false after a
  wrong move, hint or reveal; a retry records nothing. Row isolation holds
  across users.

Jest (`practice-session.test.ts` primary, contract tests at the transport):

- No reply before the server's `continue`, and none before 280 ms.
- Late replies or replay frames after exit or account switch are ignored.
- A wrong second move fails. Retry restores the position before it with a
  fresh identity.
- Reveal replays the full line at 800 ms per move and blocks input.
- Step-through stays within bounds after a solve.
- An uncertain mid-line save stays blocked and never resends.
- Puzzles use the same controller.
- Malformed lines and replies are rejected.

One component test covers `‹` `›`/arrow-key wiring. No new browser e2e: the
existing board smoke already protects move entry, and replies and replay
timing are animation behavior that belongs in Storybook
(`Practice/Daily practice` sample lines) and device review. Run affected tests, full
lint and types, `npm run verify` and all `npm run test:runtime` tests;
`npm run verify:full` if shared board or UI code changes. Then, on the
integrated bundle against the local authenticated database:

- Solve a real multi-move own-game card and puzzle.
- Fail at a later step, then retry.
- Reveal.
- Reload to confirm saved marks.
- Repeat reply animation, step buttons and hardware-keyboard arrows on the iOS
  simulator.
