# Learning loop

Proposed (October 17, 2026). Parts 1–4 are implemented and in production
(backend `sha-b6aadec`); the app's parts reach the phone with the next
TestFlight beta.

Knightly's premise is that you improve by learning from your own games. Today the
loop is open: games become cards and [mistake layers](2026-10-16-safety-habit-training-design.md),
the [daily lesson](2026-10-13-today-daily-review-design.md#the-daily-lesson)
drills them, and Progress shows outcomes, but nothing connects what you
practiced to whether that mistake shows up less often in later games. The
[skill shape](2026-10-11-progress-design.md#skill-shape-scores) Tactics score
even mixes practice first tries with in-game finds, so practicing can raise it
without your games changing. Every later feature needs to know whether it helps,
so this spec closes the loop first.

## Parts

In order; each part ships on its own.

1. [In your games](#1-in-your-games): each skill's mistake rate in your recent
   games compared with the games before, next to how much you practiced it.
2. [Lesson follows your games](#2-lesson-follows-your-games): new positions and
   threat questions lean toward the skill that costs you most in games.
3. [Enough of your own positions](#3-enough-of-your-own-positions): the deck's
   [more cards](2026-10-16-review-deck-quality-design.md#1-more-cards) rule,
   needed before part 2 can weight anything.
4. [Unannounced positions](#4-unannounced-positions): practice where you don't
   know whether there is anything to find, and a noticing rate to compare with
   your announced first tries.

## 1. In your games

Measured only from your games, never from practice answers. The comparison is
descriptive: it says whether a mistake became rarer, not that practice caused it.

**Sample.** Rated, analysed games whose mistakes are all settled (the skill
shape's eligible games), within the layer window (`layers.SETTLE_DAYS`, 180
days), newest first. The window is `n = min(WINDOW, settled // 2)` games, with
`WINDOW` 20; below `MIN_GAMES` (10, as the skill shape) there is no comparison
and the reason is `few_games`. *Recent* is the newest `n` games, *earlier* the
`n` before them. Windows count games, not days, so they compare the same amount
of play whatever your pace, and they ignore the Progress range.

**Skills.** Fixed order, each from its layers as the skill shape attributes them:

| Key | Layers | Practice that trains it |
| --- | --- | --- |
| `safety` | `theirThreat`, `theirReply` | Threat questions (graded answers) and first answers of cards whose move has a safety layer |
| `tactics` | `ownTactic` | First answers of `ownTactic` cards and Knightly puzzle first tries |
| `calculation` | `calculation` | First answers of `calculation` cards |

**Per skill.**

- `recent`, `earlier`: your mistakes, misses and blunders with those layers in
  each window. The app shows them per game (`count / n`).
- `cost`: mean win% lost per recent game on those moves
  (`win_pct_before − win_pct_after`, at least 0). Part 2 ranks skills by it.
- `change`: `fewer`, `more` or `same`; null when the two windows hold fewer
  than `MIN_MISTAKES` (6) of them, since a few mistakes cannot show a trend.
  With equal windows and no real change, `recent` is binomial over
  `recent + earlier` at one half. `fewer`/`more` need a two-sided exact p below
  `P_TREND` (0.1); otherwise `same`. This keeps a run of good luck from reading
  as progress.
- `practice`: `{recent, earlier}`, items of that skill you answered from the
  first recent game to now, and from the first earlier game to the first
  recent one. Graded items only (the day's first answer), as the deck counts them.

**Contract.** `GET /api/overview` gains optional `game_trend`, the same for every range:

```
{ version: 1,
  window: int,              // n; 0 when reason is set
  games: int,               // eligible games in the layer window
  reason: "few_games" | null,
  since: ISO | null,        // the first recent game's played_at
  skills: [ { key: "safety" | "tactics" | "calculation",
              recent: int, earlier: int, cost: number | null,
              change: "fewer" | "same" | "more" | null,
              practice: { recent: int, earlier: int } } ] }
```

`skills` always has three entries in that order; with `reason` set, the counts
are 0 and `change` and `cost` are null. Older servers omit the field and the app
shows nothing new. Bump `version` with any rule or threshold change.

**Progress.** Two places, keeping the page's one-number-per-section rule:

- *Your game*'s evidence line, when the weakest axis is Safety, Tactics or
  Calculation and the trend is available, becomes one sentence from it: "In your
  last 20 games: 0.8 missed threats a game, down from 1.4, with 64 threat
  positions practiced." `same` says "about the same as the 20 before"; `more`
  says "up from". Without a trend it keeps today's share-of-mistakes sentence.
- *All stats* gains an **In your games** card after Game skills: one row per
  skill with its recent per-game rate, the change against the earlier window
  (lower is better, shown only when `change` is `fewer` or `more`), and the
  practice count beneath. Below the minimum it shows how many eligible games
  there are of the 20 needed.

**Verification.** Backend pytest: account isolation; windows from hand-built
games (unsettled games excluded, layer attribution, odd counts); `few_games`
below the minimum; `change` thresholds for a clear drop, a small change and too
few mistakes; practice counts per window per skill. App: contract parsing and
the focus sentence's three wordings in the progress model tests; Storybook
stories for the All stats card's available and locked states.

## 2. Lesson follows your games

The daily lesson leans toward the skill that costs you the most in your games
right now. It changes only the order of new positions and how often threat
questions come up. The lesson's size, the pace's new-position limit, the
review cap and FSRS's order for due reviews stay as they are, so the weighting
never delays a review and never trades retention for focus.

**Focus.** Picked from part 1's trend (games only): the skill with the highest
`cost` (win% lost per recent game), counting a skill only with at least
`MIN_COST` (1.0) win% a game and `MIN_RECENT` (3) mistakes in the recent
window. Ties keep the fixed order (safety, tactics, calculation). There is no
focus when the trend has `few_games` or no skill qualifies, and the lesson then
behaves as before. `change` plays no part: as a skill's mistakes fall, its cost
falls with them and the focus moves on by itself. Ignoring `change` also keeps
the lesson from dropping a skill the moment it starts improving.

The focus is chosen once per user day, at the first deck or Today request,
and kept for that day (setting `lesson_focus`), so the lesson doesn't shift
when a game is analysed mid-session. The setting also keeps the last
`FOCUS_HISTORY` (365) days' focus, so later analysis can compare a skill's
cost in the weeks it had the focus against the weeks it didn't.

**What the focus changes.**

| Focus | New positions | Threat questions | Puzzles |
| --- | --- | --- | --- |
| `safety` | `theirThreat` and `theirReply` positions first | As before: two a watch, in its look-first slots ([the watch's mix](2026-10-19-path-home-design.md#what-a-watch-holds-decided-2026-10-22)) | As before |
| `tactics` | `ownTactic` positions first | As before | As before (already the most-missed tactic) |
| `calculation` | `calculation` positions first | As before | As before |

"First" puts the focus skill's positions ahead of the usual order (blunders,
then the habit and tactic missed most, then newest games), which still ranks
them among themselves and ranks everything after them. The pace still caps new
positions a day, and Learn more adds more in the same order.

**Contract.** `/api/deck` and `/api/home`'s `today` gain optional `focus`:
`{key: "safety" | "tactics" | "calculation", cost, window} | null`. Older apps
ignore it.

**Today.** The lesson hero says what the focus is, in place of "your past
mistakes first": "7 to go, focused on missed threats." (missed tactics, failed
forcing lines). Without a focus the sentence is unchanged.

**Verification.** Backend pytest: the focus is the costliest qualifying skill,
none below the minimums or with `few_games`, and fixed for the day after a new
game; the focus skill's new position comes before another skill's blunder; with
a safety focus a threat question follows every position, without it every two;
the history keeps one entry per day. App: the hero sentence with and without a
focus.

**Cost.** Choosing the focus takes one aggregate over your mistakes once a day;
other requests read the setting. The part 1 trend runs as one aggregate plus
one practice query (it took about 1 s on 122 games, mostly from loading every
move).

## 3. Enough of your own positions

[Review deck quality part 1](2026-10-16-review-deck-quality-design.md#1-more-cards),
with its release gate. About one position per game qualifies today, so most
practice volume is generic puzzles and part 2 has little to reweight.

## 4. Unannounced positions

Every deck card and puzzle has a solution, so you always know there is
something to find. In games the hard part is noticing it. The first production
numbers show the gap: in-game the costliest skill is safety (20.5 win% lost a
game), while reviews are found on the first try only 54% of the time against
FSRS's 90% target. The threat drill's calm items already teach "sometimes
nothing is there" for threats; this part does the same for your own move.

**Item.** "Your move": a position from your own rated games, right after the
opponent's move, with only "Your move." in the coach bubble. No tactic tag, no
"find a better move", no red arrow showing what you played, and no Hint (it would
say there is something to find). No Solution while solving either: you play
one move and the verdict tells you which kind of position it was.

**Two kinds, mixed so guessing doesn't pay** (`unannounced.py`):

| Kind | Source | Right answer | Verdict |
| --- | --- | --- | --- |
| `critical` | Your review cards in long-term memory (stability at least `MASTERED_DAYS`), then positions from your rated games of the last 90 days where you played a clear best move (`best`/`great`/`brilliant`, gap at least `CARD_GAP`) | Within `HARD_DROP` of the best move, as a card's first move is judged | "Found it. There was something here, and you found it." or "Not quite. There was something here." with the line |
| `calm` | Sound moves of yours (`best`, `excellent`, `good`) from the last 90 days, past the opening and not a card, where the engine's top two are within `HARD_DROP` (from `moves.eval_second`, no new search) | Within `HARD_DROP` of the best move | "Safe move. Quiet position: any safe move was fine." or "Not quite. Quiet position, but that move gives something away." |

The kind comes from the position's stored engine facts (`kind_of`), at serving
and again when judging. Two critical for every calm one; the other kind when one
runs out. A position isn't asked again for `REST_DAYS` (30). On the production
account (October 17, 2026) the last 90 days held 5,799 calm and 1,324 critical
positions, and no cards in long-term memory yet.

**In practice.** Daily practice and the lesson serve `PER_DAY` (2) items a day,
one after every `EVERY` (4) positions, or at once when no positions are left,
and they count toward the lesson's items like threat questions (`deck.stats`).
A threat question due at the same moment comes first. Not served in tactic
training or replays. Grade maps come from the worker's practice grading
(`practice_grades`, queued when an item is served without one), so answers are
judged instantly as cards are; without a map the server judges the move.

**No schedule.** The day's first answer to a position is logged in
`unannounced_answers` (migration 0019: position, kind, move, correct, time);
retries aren't, and nothing touches FSRS or the card's schedule. Misses don't come
back in the end-of-session redo round. Account deletion removes the log.

**What it measures.** The *noticing rate*: the share of `critical` items found
(each day's first answer) over the last 30 days, null under 20. All stats' **Your
reviews** adds it after the first-try rate: "Unannounced, you found 61% of
positions with something to find." The gap between the two is how much of your
accuracy depends on being told there is something to find. With part 1's trend,
it tells whether the habit transfers: a rising noticing rate should come before
fewer safety and tactics mistakes in games.

**Contract.** `/api/deck` serves `unannounced_item`, shaped like a review card
(so practice reuses its judging, verdict and recovery) with `unannounced:
"critical" | "calm"` and the best move alone as its line. The app never shows the
kind before the answer. `POST /api/unannounced/answer {game_id, ply, moves: [one
move], expected_day, hinted, seconds}` returns a card's finished-answer shape
(`rating` and `due` null) plus `unannounced`; 404 for a position that isn't yours
or isn't either kind, 409 on a new day, 422 for more than one move.
`/api/patterns`' `deck_health` adds `noticing: {rate, answers} | null`.

**Verification.** Backend pytest: each kind's selection (opening and mistakes
left out), the 2:1 mix and the rest period; judging within `HARD_DROP`, one log
row a day and no card review; the noticing rate's minimum; serving in practice
and the lesson count, not in tactic training; another account's position is 404.
App: the prompt, no played-move arrow and no hint, answers going to the
"Your move" endpoint, and the verdict's wordings.
