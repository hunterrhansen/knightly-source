# Review deck quality

Proposed (October 16, 2026). Parts 1–6 are implemented and in production
(backend `sha-4029b03`); the app's parts reach the phone with the next
TestFlight beta. Part 1's gate passed with `CARD_GAP` 5. Follows the
[review deck research](https://claude.ai/code/artifact/c3a71c9e-2d2f-4ecf-af88-83420fa44ed5),
which compared Anki, Chessable, Lichess, Chess.com, Aimchess and Duolingo with
Knightly's deck.

The deck of positions from your own games, scheduled by FSRS, is the heart of
Knightly. Its scheduling already matches what the research recommends:
automatic Again/Hard/Good/Easy from the first try of the day, separate new and
review limits, a 200-review cap, most-likely-forgotten first, the end-of-session
redo and ungraded replays. The weak points sit on either side of the scheduler:
too few positions get into the deck, and the learner can't see the schedule.
This spec fixes both and adds one deck control. It changes no FSRS behaviour.

## Parts

In order of impact; each part ships on its own.

1. [More cards](#1-more-cards): lower the card bar for the first move.
2. [Honest empty deck](#2-honest-empty-deck): say why the deck is empty or small.
3. [When it comes back](#3-when-it-comes-back): the next review date after each answer.
4. [Positions you keep missing](#4-positions-you-keep-missing): leeches get context first.
5. [Don't show this again](#5-dont-show-this-again): a reversible suspend with a reason.
6. [Schedule health](#6-schedule-health): a week's forecast and first-try retention.

Out of scope: a deck browser (see [Later](#later)), and every control under
[Not added](#not-added).

## 1. More cards

A move of yours becomes a card when it is a mistake, miss or blunder **and**
the engine's best move beats its second choice by `CLEAR_GAP` (10 win%). About
half of real mistakes fail that second test, about one card per game; a local
account's three analysed games gave none. (Estimate from weak-engine self-play
judged with Knightly's thresholds; confirm on real games, below.)

- New constant `deck.CARD_GAP = HARD_DROP` (5) replaces `CLEAR_GAP` in
  `deck.clear_best` for card creation (`_qualifying`, so also `game_plies`).
  It stays fair: `judge` accepts any first move within `HARD_DROP` as Hard and
  marks anything worse wrong, so a second-best move under the bar is graded
  correctly rather than being a hidden right answer.
- `practice_lines` keeps `CLEAR_GAP` (10) for extending lines: later learner
  moves accept only the line's move, so they still need one clearly best move.
- Existing cards are untouched. The new rule needs a deck refresh on every
  account: `deck.refresh` keys its "already synced" setting on the analysis
  version **and** a `DECK_RULES` version, bumped by this change. New cards are
  new positions, so the pace still limits them; nobody wakes up to a pile.
- Game review's find steps come from `game_plies`, so they grow too. That is
  intended: they are the same positions the deck will ask.

**Gate before release.** Pull 40 positions from real accounts whose gap is
between 5 and 10 and review them on the board. Ship at 5 if no more than about
1 in 10 feels ambiguous (two moves a coach would call equally right);
otherwise try 7 and repeat. Record the chosen value and the sample size here.
**Result (October 17, 2026):** 40 positions from the one production account
(5–10 win% gap, newest first) reviewed on the board by its owner; ambiguous
cases stayed within 1 in 10, so `CARD_GAP` stays 5.
`knightly --user <clerk id> card-gap-sample` lists an account's newest such
positions (`--low`, `--high`, `--limit`; default 5, 10, 40) with the move played,
the engine's move, the gap and a Lichess analysis link to the position
(`deck.near_bar`). Run it against the deployed database for each account in the
sample. Changing `CARD_GAP` also bumps `DECK_RULES` so every deck refreshes;
raising it leaves existing cards in place.

## 2. Honest empty deck

The Practice summary says "Practice becomes available as your imported games
are analyzed" whenever the deck is empty, even after analysis has finished and
found nothing. Lichess and Chess.com always give a new user something to do;
Aimchess doesn't, and gets complaints.

The deck response (`/api/deck`) and Today's summary (`/api/home` `today`) add
`games: {analyzed, pending}` (`deck.game_counts`): the user's standard games
with finished analysis, and those still waiting, the same games the deck draws
on. Practice and Today pick the state from it (`src/lib/deck-growth.ts`):

| State | When | Copy (Practice summary; Today's rest/done note) |
| --- | --- | --- |
| No games | No connected account and no games | Existing `new` state: connect an account |
| Analyzing | `pending > 0`, no cards | "Analyzing your games: {analyzed} of {analyzed + pending} done. Positions to practice appear as each one finishes." |
| Clean games | `pending == 0`, `analyzed > 0`, no cards | "No clear-cut mistakes in your {analyzed} games. Nice. Play or import more games to grow your deck. Meanwhile, practice puzzles in your weakest tactic." with the puzzles session as the action |
| Small deck | Fewer than `SMALL_DECK` (20) cards | Done adds: "Your deck grows as you play: {total} positions from {analyzed} games." |

The daily lesson already fills with Lichess puzzles; no change to what is served.
Practice's action for clean games is **Train a tactic** (Progress, where a
tactic is chosen), shown only when puzzles are available; Today's rest card,
which has no puzzles left to offer, leaves that sentence out. With no games,
Practice offers **Connect games**. An empty deck hides the deck counts line.

## 3. When it comes back

After an answer, the verdict sheet says "Progress saved." The server already
returns `due` and `mastered` from `/api/deck/answer`, and the client ignores
them. Anki shows the next interval on every answer button; it is how users see
that the scheduler is working and that a fast find earns a longer gap.

**Contract.** Each served card carries `next`: the local date FSRS would set for
each rating if the card were answered now, from a dry run of
`scheduler(conn).review_card` per rating (no write):
`{"again": {"due": "2026-10-17", "mastered": false}, "hard": …, "good": …, "easy": …}`,
with the card's own `mastered` beside it (`deck.preview`). FSRS's interval fuzz is
seeded by the card and its review count, as Anki seeds it, so the date shown is
the date the answer saves. Instant
practice needs it up front because local grading answers before the save
returns (`local-grade.ts` sets `due: null`); the client picks Easy's date for
an exact find within `EASY_SECONDS` a move, as the server decides, and the saved
answer's date replaces the line if the two ever differ. `mastered` is predicted the same
way per rating (`stability >= MASTERED_DAYS`). Cards served before this change
have no `next`; the line is then filled from the save response when it arrives,
or left out.

**Copy.** One quiet line under the verdict message, part of the sheet's spoken
announcement, on the day's graded answer only (never on a retry, redo, replay,
puzzle or threat question):

| Result | Line |
| --- | --- |
| Again, in a session with the redo | "Back at the end of this session, then tomorrow." |
| Again, otherwise | "Back tomorrow." |
| 1 day | "Back tomorrow." |
| 2–29 days | "Back in {n} days." |
| 30 days or more | "Back in about {n} weeks/months." (rounded) |
| Crossed `MASTERED_DAYS` on this answer | "In long-term memory. Back in about {n} months." |

The days are counted from the user's review day (`db.today`), as `due` is stored. From 30 days, under 60 reads in weeks (days ÷ 7) and longer in months (days ÷ 30), both rounded.

## 4. Positions you keep missing

`cards.lapses` is counted and never read. A position missed again and again
returns every day or two as the same cold puzzle. Anki marks a card a leech at
8 lapses and suspends it; its manual says reworking the card helps most.

- `LEECH_LAPSES = 4` (positions are fewer and costlier than vocabulary cards).
  The served card carries `leech: true` from that point on.
- A leech opens in **context first**: the lead-up plays from `fen_prev` (the
  opponent's last move, as today), and the coach bubble says "You've missed this
  {lapses} times. Look at what they threaten first." When the card has a
  threat question ([safety-habit training](2026-10-16-safety-habit-training-design.md)),
  it is asked as usual. The solution is never shown before the answer, so the
  first try stays a fair grade.
- After a leech's miss, the verdict sheet shows **Don't show this again**
  (part 5) as a button rather than the plain link other cards get.
- The card response carries `lapses` and `leech`; the opening line is the
  only other change, so a leech is graded and scheduled like any card.
- Leeches are never suspended automatically: they are the user's own
  weaknesses, and keeping them is the point.

## 5. Don't show this again

Some cards are bad: a shaky engine verdict, a move from a time scramble, a
position the user will never face again. Before this, the only way out was to
keep failing it. Suspending is the one control every comparable product's users
rely on (Anki's suspend and leech default, Chessable's pause a line).

- **Where:** inside the verdict sheet after any answer to one of your
  positions, right or wrong, as a **Don't show this again** link (a button
  after a leech's miss). It opens three reasons in place: *The engine is
  wrong*, *Not useful to me*, *I already know this*. Once saved the sheet says
  "Hidden. It won't come back unless you show it again." with **Undo** until
  the learner moves on. The app has no overflow menu or toast, and an in-place
  Undo with no timer is easier to reach with a screen reader or large text. The
  signed-in practice screen offers it; the Storybook preview doesn't.
- **Storage:** migration 0018 adds `cards.suspended_at` (ISO text, like the
  table's other times) and `cards.suspend_reason` (checked against the three
  reasons). Nothing is deleted: `sync()` would re-create a deleted card, and
  the review history feeds FSRS tuning. FSRS state is kept, so showing it again
  resumes where it was (overdue cards sort first as usual).
- **API:** `POST /api/deck/suspend {game_id, ply, reason}`,
  `POST /api/deck/unsuspend {game_id, ply}` (both idempotent, account-scoped,
  404 for a position not in your deck) and `GET /api/deck/suspended`, the
  hidden list, most recent first.
- **Effects:** `deck.queue` (so the lesson and tactic training),
  `stats`, `by_pattern`, `more_available`, `game_plies` and replays skip
  suspended cards, and the session drops it from its end-of-session redo round.
  `stats` (so `/api/deck`) adds a `suspended` count. All stats' More card shows
  "{n} hidden" when there are any; it opens `/progress/hidden`, which lists
  them with their reason and **Show again**. That list is the only browsing
  this spec adds.
- **No grade.** "I already know this" suspends; it doesn't record an Easy
  answer, which would feed the optimizer a review that never happened.
- The reasons are kept to tune part 1: a high share of *The engine is wrong*
  among cards near the bar is a reason to raise `CARD_GAP`.

## 6. Schedule health

Users can't check that reviewing works, or what tuning to their memory changed.
Anki users check its Future Due forecast and True Retention table; Chessable's
pile-ups are the failure to avoid.

`/api/patterns` adds `deck_health` (`deck.health`), whatever the range, since
All stats already loads it; `/api/deck` is fetched after every answer and stays
lean:

- `forecast`: seven entries `{date, due}` from the user's today: review cards
  (answered before, not hidden) by `due`; overdue ones count today. Learn more
  and new cards are left out.
- `retention`: over the last 30 days, the share of graded review answers (a
  card's first answer of the day, excluding its first-ever answer) that were not
  Again, with the count and `target: 0.9`. `null` below 20 such answers.
- `tuned`: `deck.tuning(conn)["personal"]`.

All stats shows a **Your reviews** card above More: the week as seven bars
with the count on each ("Today", then weekday names), and "You found {p}% of
reviews on the first try in the last 30 days (target 90%)", plus "Tuned to your
memory" once tuned. No FSRS terms (stability, difficulty, retrievability). The
practice Results beat ([session-end beats](2026-10-14-session-end-beats-design.md))
adds "{n} positions due tomorrow" under the stat cards when `n > 0`, from
Today's `tomorrow_due` read after the session.

## Not added

These fight FSRS or the automatic grading, or carry little value for a deck the
app generates:

| Control | Why not |
| --- | --- |
| Editing a card's answer or position | The answer is the engine's move: grading, prepared grade maps, lines and coaching depend on it, and the server re-grades every save against it. A wrong engine verdict is a suspend reason. |
| Set due date, forget/reset, graded review-ahead | FSRS's developers want every schedule change to carry a grade; ungraded changes corrupt the history tuning learns from. Learn more and replays cover the wish to do more. |
| Self-graded Again/Hard/Good/Easy buttons | Automatic grading is a strength; the Anki manual warns users press Hard when they forgot. |
| Hard delete | `sync()` re-creates cards and deletes lose review history; suspend covers it. |
| Retention target, FSRS parameters, user tags | Tuning is automatic and tactics are tagged automatically. |
| Hearts, energy, reset to level 1 | The most complained-about mechanics in the research; FSRS already handles a lapse. |

## Later

- **Deck list:** a read-only list under Progress (filter by tactic, state,
  hidden) with each position's game, next date and answer history, replayable
  ungraded. Build only if the hidden list from part 5 shows people want more.
- **Time-trouble cards:** moves already carry `moves.time_trouble`
  ([safety-habit training](2026-10-16-safety-habit-training-design.md)). Check
  whether those cards fail or get suspended more than others before excluding
  them from the deck.

## Testing and verification

Following the [unit and component test strategy](../../AGENTS.md#unit-and-component-test-strategy),
one primary owner per behavior:

- Backend (`backend/tests`): a move with a 7-point gap becomes a card and a
  3-point one does not; a line still stops at a 7-point gap; the rules-version
  bump re-syncs an already-synced account; `next` per rating matches the
  `due` the answer then saves; a suspended card leaves the queue, stats and
  Learn more and returns unchanged after unsuspend; suspend of another
  account's card is a 404; `leech` appears at the fourth lapse; forecast and
  retention on a fixed review history; `games.analyzed/pending` by account.
- Frontend: the next-review line per row of the copy table, and absent on a
  retry; Practice and Today empty states from `games` and deck size; the suspend
  action with Undo removing the card from the session.
- Manual: the part 1 gate above; the verdict sheet with the extra line and the
  suspend menu on iOS and web, in large text and VoiceOver.

Update this spec's status as parts ship, and [current status](../status.md)
when they are deployed.
