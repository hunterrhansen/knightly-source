# Progress page

Since 2026-10-19 Progress is one scrolling modal with All stats folded in
(no `/progress/stats`); its order is in
[the path home](2026-10-19-path-home-design.md#progress). The sections below
keep their data and rules; read "All stats" as that sheet.

Status: redesign approved Oct 17, 2026 and implemented from shared components;
static and browser checks pass. The skill shape scores (below) are implemented
in the backend; hosted Progress shows them once that backend is deployed. Phone
runtime verification remains a completion gate.
Its map of nights moved to the home path.
Sections 1 to 3 below now lead All stats, in that order, with the range chips;
Progress links to All stats from its blunders proof row.

## Goal and design

Progress answers two questions, in this order: **is my practice working?** and
**what should I train next?** It should read like Robinhood, not Fidelity: one
number per section, one chart per question, and one action. Detailed stats live
one tap away on All stats, never on the main page.

The approved design is the [Knightly Progress page canvas](https://claude.ai/artifact/6AnKSEpuJiXDtTCQatEhxP)
(Improving, Rating dip, New player and All stats boards, plus building blocks).
It uses the same cards, moons and type as Today. The rationale comes from
Lichess's puzzle dashboard, Aimchess, Chess.com Stats and Duolingo. All four put a
headline number, a picture of weak spots and one action first. Their users
complain about the alternatives: stats that link to nothing, radar axes that move
and small samples shown as facts. Duolingo found a low daily bar and quiet
missed days keep habits going.

## Sections

Phones and wide pages show the same sections, top to bottom (since the map of
nights, at the top of All stats). Each is its own
component in `src/features/progress/`, built from shared UI (see the
[foundation spec's design system](2026-10-10-app-foundation-design.md#shared-design-system)).

1. **Rating** (`RatingHero`): the eyebrow, the latest rating in the display
   size, its signed change over the period, one line of context and the rating
   line, with 30D / 90D / All pill chips (`ToggleGroup variant="pills"`). A rise is brand green; a
   fall is muted, never red ("Ratings swing week to week" when the habit card
   still improves). There are no axes or trailing average on the page. With
   fewer than five rated games it shows the count and a dotted line instead of a
   trend. The label stays "Rating" over the combined series (see Data).
2. **Last 4 weeks** (`HabitCard`): two stat tiles, nights practiced out of 28
   and blunders per game with its change (lower is better), then a 28-day moon
   grid made of the streak calendar's day cells (`StreakDay`), then one callout
   linking habit to outcome ("Blunders are down 25% from the 30 days before").
   Missed nights are plain muted cells: no red and no broken-streak message. The
   moons and blunders ignore the range; the card says "Last 4 weeks".
3. **Your game** (`SkillShape`): a five-axis radar in a fixed order (Safety,
   Tactics, Calculation, Converting, Defending, scored 0–100), with the
   previous period of the same length as a dashed outline (hidden on All time).
   The weakest axis gets a coral dot and the word "Weakest", never colour alone.
   Under it is one sentence from the player's own games ("6 of your last 10
   blunders missed what your opponent was threatening", or, once the
   [learning loop](2026-10-17-learning-loop-design.md#1-in-your-games) trend is
   available for Safety, Tactics or Calculation, that skill's recent rate against
   the games before) and one primary button
   that trains that axis. Until the scores qualify, the radar is locked with a
   progress count (a dashed empty pentagon reading "3/10" and a bar) and offers
   tonight's lesson instead.
   It never shows zeros. With ten analysed games but no scores from the server
   yet, it says the shape is on its way.
4. **All stats** (`/progress/stats`, `AllStatsScreen`), after sections 1 to 3: game skills as
   list rows with value and change (blunders per game, accuracy, converting,
   defending, punishing, opening and endgame accuracy); **In your games** (the
   learning loop trend per skill, ignoring the range); tactics as a sorted
   first-try bar list with its weakest marked and a Train button; clock
   diagnostics (10+0); openings linking to their games; and a deck row opening
   Today. A "Last 90 days" label under the title names the period. Bars, not a radar,
   because bar lengths compare more accurately and fit large text.

Removed from the main page: the focus card, the per-tactic pattern radar, weak
spots and strengths, game-skill goals, the layer breakdown, clock and opening
disclosures and patterns in memory. Their data either moves to All stats (game
skills, tactics, clock, openings) or already lives on Today (the deck).

## Components

`src/features/progress/`: `progress-screen.tsx` (both routes' data),
`progress-view.tsx`, `rating-hero.tsx`, `habit-card.tsx`, `skill-shape.tsx`,
`all-stats-view.tsx` and `section-state.tsx` (per-section loading and retry).
Pure rules live in `progress-model.ts` (four-week cells, current run, blunder
trend, axes, weakest axis and its advice) and `pattern-strength.ts`, tested
there. `use-progress.ts` holds the range queries and the habit queries.
Sections compose shared primitives only; anything a second feature could use
goes in shared UI first, with a story.

## Chart rendering

Use `victory-native` 42.0.1 and `@shopify/react-native-skia` 2.6.2, pinned in the
root package and lockfile. Skia 2.6.2 is Expo SDK 57's recommended version;
existing Gesture Handler 2.32.0 and Reanimated 4.5.1 satisfy Victory's declared
peers. Victory supplies scales and gesture selection; Skia's native integration
requires a rebuilt development client. Web requires CanvasKit initialization;
the platform adapter delays loading until browser mount so Expo's Node renderer
never initializes CanvasKit.

`npm ci` runs `scripts/prepare-chart-web.mjs`, which copies the WASM binary from
Skia's own CanvasKit dependency into ignored `public/canvaskit.wasm`. The runtime
loads this local asset rather than a CDN. Its license ships alongside it; see
[asset provenance](../../assets/licenses/README.md). Storybook serves the same
asset and adapts Skia's legacy asset-registry lookup to RN Web's registry.

The rating line is one sky line over a soft fill with no axes. Tap or scrub
selects a game; a one-line readout under it ("Latest · Oct 16 · 929 vs …") has
previous/next buttons for keyboard and screen readers. The skill radar is plain
`react-native-svg` (no CanvasKit), drawn only when all five axes are scored.

Sources: [Victory Cartesian chart](https://nearform.com/open-source/victory-native/docs/cartesian/cartesian-chart/),
[declared peers](https://raw.githubusercontent.com/FormidableLabs/victory-native-xl/main/lib/package.json),
and [Expo SDK 57 Skia guidance](https://docs.expo.dev/versions/v57.0.0/sdk/skia/).

## Metric definitions

- **Blunders per game** (Last 4 weeks): `/api/overview?range=30d`'s value
  against its `previous_kpis` (the 30 days before; each needs ten games).
- **Nights practiced**: practiced days among the last 28 from the streak-days
  endpoint Today's calendar uses; freezes show as freezes and count toward the
  run, not the nights. Unknown days stay blank, never missed.
- **Phase accuracy** is `/api/overview`'s optional `phase_accuracy`: the mean
  per-move accuracy of your moves in rated games by `moves.phase` (opening is
  the first ten moves unless already an endgame; endgame once both sides have
  at most 13 points of pieces), with move and game counts, for the selected
  period and the previous one. A previous phase needs ten games, like
  `previous_kpis`. It is descriptive accuracy, not an opening or endgame skill.
- Missing values show a dash or an unlock count, never zero.

### Pattern strength

Each tactic the backend tags (`patterns.THEMES`) gets a first-try rate from
`/api/patterns`' `strength`: review-deck answers count under the mistake's tag
(a card's first graded answer of the day, correct only without a hint) and
Knightly puzzles under their Lichess themes (a back-rank mate counts only as
Back rank). Retries and later fixes never count, as on Lichess. `previous` is
the period of equal length before (null for all time).

A tactic needs at least six tries for a rate (Lichess's clear-result minimum);
below that All stats shows its count ("4 tries · needs 6"). The weakest tactic
ranks by game mistakes, then by lower rate, among those failed at least three
times below the overall rate. Ranking lives in `pattern-strength.ts` and is
tested there. Per-tactic memory (`/api/patterns`' optional `memory`) is no longer
shown on Progress; the deck lives on Today.

### Training from Progress

The Your game button opens tonight's watch (`/practice?mode=lesson`); Converting
and Defending open the filtered games (thrown wins, comebacks). Train a tactic and
Replay missed were removed on 2026-10-22: extra watches already serve more of the
learner's ideas in the same mix ([path home](2026-10-19-path-home-design.md#what-an-extra-watch-holds)).

## Data and navigation

Consume `/api/overview?range=30d|90d|all` (with its optional `skill_shape`,
`layers`, `phase_accuracy` and `time_management`), `/api/patterns?range=...`
(with its optional `strength`) and the streak days for nights. Responses
are validated with Zod at consumed boundaries through typed clients on the
authenticated transport; backend response models follow backend instructions
and regenerate the committed OpenAPI contract and types.

Scope queries to the authenticated session and selected range, pass cancellation
signals and preserve account-switch guards. Loading, errors and retries belong to
each section; a failed secondary endpoint must not erase a successful rating
card. Refresh summaries after acknowledged practice/review saves and completed
import analysis, through intentional feature interfaces and the existing Query
cache; practice and review saves and a day change also refresh streak days.
One session observer invalidates summaries when live import data changes;
Progress reads run no polling timers of their own. Background refreshes keep
loaded content visible without transient updating messages.

The range drives Rating, Your game and All stats; Last 4 weeks ignores it and
says so. The default range is 90 days. Rating is labelled "Rating" over all
rated games, because overview collects rated games without a speed filter;
separating time controls needs a backend contract change first.

`/progress/stats` is a pushed screen inside the Progress tab with the shared
navigation header ("All stats") and the same range. Games consumes validated
`range`, `kpi`, `q` and `color` parameters from All stats rows; filtered lists are
rated games only. Progress stays in production navigation and protected routes.

## Layout

One column at every width, capped at the reading width (`layout.readingMax`), on
`page` with `Card` surfaces at the panel radius. Wide pages centre the column
rather than pairing cards. Text wraps; no fixed text heights; the dark theme
and large text are required. Progress uses `Card` like Today.

## Verification and remaining gates

Stories: **Progress / Page** in improving, rating dip, new player, many games,
loading and partial failure, narrow, wide and All stats; a story for
every shared primitive. Storybook data (`progress-samples.ts`) is illustrative.

Tests protect observable behavior: account isolation and range keys, section
recovery with retained sections, the weakest-axis and unlock thresholds, the
"lower is better" delta direction and the never-zero rule. No tests for exact
styles or fixture shapes. Native gestures and spoken accessibility need device
checks.

Run `npm run verify:full` and `npm run test:runtime` after changes. Inspect browser
narrow and wide layouts. Phone checks stay user-owned: real data, range
switching, All stats and filtered Games return navigation, chart scrub versus
page scroll, large text and spoken controls. Current evidence lives in
[status](../status.md).

## Skill shape scores

Approved and implemented in the backend (October 16, 2026; `skill_shape.py`). The Progress radar ("Your game") plots five 0–100
scores in this fixed order: **Safety, Tactics, Calculation, Converting,
Defending**. Each is a plain success rate × 100 over a counted sample; there are
no weights, normalisation curves or peer baselines. Clock is not an axis (see the
time-management rules below). Scores are descriptive of your own games and
practice, not ratings.

**Attribution.** A settled mistake, miss or blunder counts against at most one
axis: the one its [mistake layer](2026-10-16-safety-habit-training-design.md)
names (`theirThreat`/`theirReply` → Safety, `ownTactic` → Tactics, `calculation`
→ Calculation). "Other" mistakes count against none.

**Eligible games.** Rated, analysed games in the period, scoped to the account.
Safety, Tactics and Calculation also need the game *settled*: every one of your
mistakes, misses and blunders in it has a layer (not null, not `unknown`). Other
games are excluded from those three axes and counted as `excluded`, never treated
as clean. The layer backfill window grows from 90 to 180 days so the previous
90-day period can qualify (cost below).

| Axis | Successes / attempts | Minimum |
| --- | --- | --- |
| Safety | Eligible games with no `theirThreat` or `theirReply` move / eligible games | 10 games |
| Tactics | Tactics found + practice first tries solved / tactic chances + practice first tries | 10 games, 20 game chances |
| Calculation | Forcing starts that held / forcing starts | 10 games, 20 forcing starts |
| Converting | Wins / games where your win% reached 80 | 10 such games |
| Defending | Draws and wins / games where your win% fell to 20 | 10 such games |

- **Safety** answers "did you check their threats and replies this game?". Games,
  not moves, are the unit: per-move rates sit near 100 for everyone.
- **Tactics.** A *game chance* is one of your moves where the engine's best move
  carries a tactic (`patterns.motif`) and the second-best move is at least 10
  win% (`MISS_DROP`) worse, so the tactic mattered. *Found*: you played the best
  move. *Missed*: the move is tagged `ownTactic`. Chances missed into another
  layer leave the sample. Practice adds `/api/patterns` `strength` first tries
  summed over all tactics (review cards and Knightly puzzles, same first-try rule).
  Both pool into one rate; the response reports each part.
- **Calculation.** A *forcing start* is your capture or check that is not a
  recapture on the square the opponent just captured on. It *held* unless it is a
  mistake, miss or blunder; failures are those tagged `calculation`. Forcing
  starts that are mistakes of another layer, or "other", leave the sample.
- **Converting / Defending** reuse `kpis`' `conversion` and `comeback_rate`
  (win% extremes 80 / 20 on your own moves; a draw is a save, not a conversion).

**Unavailable, never zero.** Below its minimum an axis returns `score: null` with
a reason (`few_games`, `few_chances`) and its counts. The radar draws only axes
with a score; the page decides how to show missing ones.

**Previous period.** The period of the same length before the selected one
(none for all time). An axis's `previous` score is set only when that axis
qualifies in both periods; otherwise `previous` is null and its counts are still
returned. Both periods use the same version.

**Version.** `version: 1`. Bump it when a formula, threshold, minimum or the layer
rules change. Scores are computed at read time from stored tags, so both periods
always use the current rules; retagging after a layer-rule change is part of that
change.

**Contract.** `GET /api/overview` gains optional `skill_shape`:

```
{ version: 1,
  axes: [ { key: "safety" | "tactics" | "calculation" | "converting" | "defending",
            score: int 0–100 | null, reason: "few_games" | "few_chances" | null,
            successes, attempts, games, excluded,
            parts: { games: {found, chances}, practice: {solved, tries} } | null,  // tactics only
            previous: { score | null, reason, successes, attempts, games, excluded } | null } ] }
```

`axes` is always five entries in the order above. Older servers omit the field;
the page treats that as every axis unavailable.

**Costs.** Read time: board replay of the period's games for Tactics chances
(`positions.fens`, only moves with a ≥10 win% second-best gap call
`patterns.motif`). Engine: the 180-day layer backfill adds at most two searches
per older mistake, still capped by `LAYER_BATCH` per run.

**Verification.** Backend pytest: user isolation (another account's games and
answers never count); each axis's denominator from hand-built moves (recaptures
and other-layer mistakes excluded, unsettled games excluded and counted);
`null` with counts below each minimum; previous score only when both periods
qualify; all-time has no previous. No frontend radar fixture tests.

Clock diagnostics appear on All stats instead. The time-management definition
and metrics-first approach below stay approved. Initial 10+0 descriptive
thresholds are recorded below; composite weights and policies for other controls
remain calibration work.

### Time-management scoring specification

**Definition:** Allocate thinking time to consequential decisions while preserving
enough clock to maintain effective play throughout the game. Measure both overall
clock budgeting and allocation between decisions. Fast play, being ahead on the
clock, or a mistake after a long think alone does not establish good or bad time
management.

The backend owns calculation and eligibility. Use analyzed standard live games
in the selected date range, scoped to the authenticated user. Separate exact
base/increment controls before comparing periods; do not pool bullet, blitz and
rapid into one score. Daily, unknown or unsupported clock schemes are ineligible.
Only the user's decisions contribute; opponent clocks are contextual information.

Implement the following observable metrics before a composite score:

1. **Clock-pressure exposure:** user decisions beginning below the configured
   low-clock threshold divided by all user decisions with a valid starting clock.
   Show the numerator, denominator and threshold. Separately show recorded timeout
   losses divided by completed games with a known termination reason; unknown
   terminations do not count as confirmed non-timeouts. A timeout draw is not a loss.
2. **Rushed-error rate:** mistakes or blunders on quick decisions made with usable
   time remaining divided by all such quick decisions. Define quick/usable-clock
   boundaries per time control before releasing this metric. Use the existing
   engine loss thresholds rather than labels alone so a costly move classified
   as a miss is included. The denominator is quick decisions, not all errors.
3. **Allocation by decision type:** compare median time spent on candidate critical
   decisions with median time on routine decisions, within the same time control
   and starting-clock band. Show both times and sample counts. A single legal
   move is a forced decision; a large mover-perspective best/second-best evaluation
   gap identifies a candidate consequential decision, not human difficulty.
   Do not treat every non-critical position as routine. An initial routine set
   may use forced moves; label it explicitly and broaden only after validation.

Supporting diagnostics are mean move accuracy and error rate in each clock band,
errors after long thinks, and the percentage of decisions behind on the opponent's
clock. These are associations and review aids, not evidence that additional
thinking would have prevented an error. Do not penalize long thinks mechanically
or reward unused clock at game end. Each diagnostic must link to eligible games
or moves, using the same filters as its calculation.

### Clock and analysis validity

Existing move analysis stores `clock_left`, `time_spent`, phase, accuracy,
classification and second-best evaluations. `clock_left` comes from the PGN's
post-move clock; it is not the clock at the start of the decision. For supported
Fischer-increment games, recover the starting clock from the previous clock for
that same player (or the starting base for their first move); elapsed time is
`starting clock + increment - post-move clock`, according to the provider's
increment convention. Validate the first-move convention against source games.

Chess.com clock annotations are post-move and include the Fischer increment;
reconstruction from them is validated for that source. Too few increment games
exist to calibrate general timing thresholds. Unknown-control games remain
ineligible. Other providers require independent validation.

Missing clock annotations must break the adjacent timing sample. Do not attribute
several moves' elapsed time to the next annotated move. Reject inconsistent clock
increases, non-finite/negative values and unsupported delay/staged controls rather
than silently clamp them into quick moves. Zero/very short elapsed times can be
premove or clock precision artifacts and cannot establish deliberate rushing.
Report clock coverage and excluded sample counts. Missing data never means zero
time, perfect management, or a score of zero.

Engine best/second-best gaps must use the mover's perspective and a consistent
evaluation scale. Forced moves have no second-best gap; mate evaluations require
explicit handling. Do not claim that a narrow gap implies an easy position.
Assessments must identify the analysis/scoring version so reanalysis and changes
in engine settings do not silently appear as player improvement.

### Calibration and release gates

Review source-clock reconstruction and metric examples on actual imported games
before choosing low-clock, quick-move, long-think or critical-gap thresholds.
Include increment/no-increment, missing clocks, forced replies, premoves, timeout
losses, and both fast errors with ample time and justified long calculations.
Check precision for short controls and sample imbalance between games.

Choose and document per-metric minimum distinct-game and decision counts from that
review. The existing overview minimum of ten games is not automatically sufficient
for every timing metric. Return unavailable with a reason and counts until a metric
has enough eligible data; comparing periods requires both periods to qualify.

Do not publish a weighted 0–100 time-management score until its components,
normalization and weights have been reviewed against the underlying games and
shown to identify actionable behavior beyond general move accuracy. Any eventual
score must expose its components and version. A peer baseline requires an actual
compatible dataset; a previous-period outline requires matching control, scoring
version and eligibility. Neither baseline is implemented by this specification.

Backend verification must protect user isolation, eligible denominators, clock
reconstruction and exclusion of missing samples. Frontend checks must protect
unavailable/partial data and period-selection wiring. Do not add fixture/style
tests for the radar itself. Phone runtime review remains a separate release gate.

### 10+0 timing policy

A one-account calibration (about 100 analyzed 600+0 games) set this initial,
versioned descriptive policy for **600+0 only**. It is a within-account
diagnostic, not a population or peer benchmark; increment, blitz and bullet
policies stay unavailable until their own evidence is reviewed.

- Low clock: starting clock below 30 seconds. Report exposure separately from
  accuracy under pressure; do not call low-clock play a demonstrated weakness.
- Fast-move errors: elapsed time above 0.2 and at most two seconds, starting
  clock at least 120 seconds, outside the opening, more than one legal move.
  Name them **fast-move errors**, not rushing; quick play alone is not an error
  signal. Durations of 0.2 seconds or less are excluded (clock precision and
  premoves cannot establish thinking time).
- Long thinks: at least 30 seconds with the same filters. Show errors and
  successful decisions together; the long-think error rate is never a direct
  score penalty.

Clock pressure and timeout counts can describe all eligible decisions/games;
fast/long diagnostics use the narrower filters and must disclose them. The
opening phase is the first ten moves unless already classified as endgame. An
error is an engine win-percentage drop of at least 10, including costly misses.
Abandonment is not a timeout, and unknown/abandoned endings are excluded from the
timeout denominator. Do not combine these into a time-management score.

Fast/long conditional percentages require at least **50 distinct eligible games
and 100 eligible decisions** per exact control and selected period; below that,
show counts with an insufficient-sample reason, not a percentage or zero. These
are conservative display gates, not precision guarantees: ten games leave too
few decisions, and small percentage changes do not support strength, weakness
or improvement claims.

**Allocation scoring remains deferred.** Forced decisions are too rare to set a
routine-move baseline, and large best/second-best gaps often mark obvious moves,
so they must not mandate longer thought. No critical/routine ratio or composite
0–100 score is supported; the skill shape has no clock axis, and these
descriptive percentages are never mapped onto one.

The backend adds optional `time_management` data to `/api/overview`,
scoped by account, selected date range, rated standard Chess.com games and 10+0
control. The backend reconstructs clocks from PGN rather than trusting old
`time_spent` rows, correlates analyzed plies with replayed UCI moves, and returns
policy/analysis versions, counts, unavailable reasons and up to three review
examples per diagnostic. No backfill or engine reanalysis is needed for these
metrics.

All stats shows these diagnostics in its Clock card. Error/low-clock
examples link to game review with the move number in the label; they open the
game, not an automatic jump to that move. Older hosted servers without the new
field show a server-unavailable message without breaking other sections. No peer,
previous-period timing comparison, allocation score or radar score is published.

### Other aspects and source boundaries

Conversion and comeback rates already measure capitalization/resourcefulness:
the backend uses user-move win-percentage extremes of at least 80 / at most 20,
respectively. These are Knightly rules, not Aimchess thresholds. Opening/endgame/
tactics scores still need agreed definitions, phase scope and eligible samples;
do not equate phase accuracy with the complete skills described by the reference.

[Aimchess](https://aimchess.com/) publishes the six aspect meanings, similar-rating
comparisons and clock-deficit examples, but no current radar formula was found.
Its [founder's 2020 beta explanation](https://www.reddit.com/r/chess/comments/ga8nqo/)
describes errors after long thinks; it is historical evidence, not a current
formula. [Dan Heisman's definition](https://www.chess.com/article/view/how-to-think-critically-in-chess)
distinguishes overall budgeting from allocation to critical decisions.
[Russek et al. (2025)](https://cocosci.princeton.edu/papers/RussekThinking2025.pdf)
find that thinking time tracks the benefit of additional computation in online
chess. These support the approved definition, not specific score weights.
