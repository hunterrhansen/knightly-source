# Weakness model and variation practice

Proposed (October 17, 2026). Steps 1, 4 and 5 are implemented; the rest is not. This spec
replaces the constants that decide what the learner is weak at, and makes a review
card a *family* of related positions rather than one stored FEN.

It builds on the [learning loop](2026-10-17-learning-loop-design.md), which already
ships the measurement half: `game_trend` compares a skill's mistake rate in your
recent games against the games before, and the daily lesson's focus already leans
new positions toward the costliest skill. This spec is the *estimation* half —
replacing per-skill counts with ability estimates, and the one stored FEN with a
family.

Two findings drive it. First, chess expertise research from de Groot (1946)
through Chase and Simon's chunking theory (1973) to Gobet and Simon's template
theory holds that a master's advantage is recognition, not search: perhaps 50,000
stored patterns, the recurring ones grown into *templates* with slots that accept
varying piece placements. Templates form from repeated exposure to positions that
are related but not identical. Serving one stored FEN forever builds a chunk at
best and rote recall of that diagram at worst. Second, Southwick et al.
(*Psychological Science*, 2026; 44,213 Chess.com players, six months of
timestamped activity against real rating change) measured a 3.61x learning-efficiency
advantage for deliberate practice over gameplay — which is only worth capturing if
the practice is aimed at something real.

What exists today aims with three hardcoded constants and a histogram.

## What is there now

| Where | Constant | Job |
| --- | --- | --- |
| `analyze.py` | `THRESHOLDS = [(20, "blunder"), (10, "mistake"), (5, "inaccuracy"), (2, "good")]` | Labels a move by win% drop; Chess.com's expected-points bands |
| `deck.py` | `KINDS = ("mistake", "miss", "blunder")` | The only gate on making a card |
| `deck.py` | `CLEAR_GAP = GREAT_GAP` (10) | One move has to be clearly better |
| `deck.py` | `PACES = {"light": 3, "standard": 5, "intense": 10}` | New cards a day |
| `deck.py` | `WEAKEST = {"blunder": 0, "mistake": 1, "miss": 1}` | Two-rank ordering of new cards |
| `patterns.py` | `RECENT_DAYS = 90` | Flat window for "the tactics you miss most" |
| `units.py` | Four units, hand-written targets, `CHECK_SIZE = 10` | The Progress path |

The model itself is `deck.queue`'s sort key: `WEAKEST`, then
`layers.missed_most`, then `patterns.missed_most`, both of which are raw counts of
tagged mistakes in rated games of the last 90 days. Three problems, none of which
is the threshold:

1. **No base rate.** Hanging a piece outnumbers back-rank mate for every learner,
   because hanging pieces is more common in chess. A raw count measures exposure,
   not deficit.
2. **One direction, one source.** Moves where the learner *saw* the fork are never
   tagged, although `patterns.motif` would name them. `card_reviews`,
   `puzzle_attempts` and `threat_reviews` feed FSRS per item and nothing above it.
   Practice never changes what the system believes about the learner.
3. **No uncertainty.** A pattern observed forty times and one observed twice sort
   the same, and a pattern never observed is invisible rather than worth probing.

## Skills

The estimate is kept per **skill**, a key in one flat namespace so new axes can be
added without a schema change:

| Family | Keys | Source |
| --- | --- | --- |
| `motif` | `patterns.THEMES` (7) plus `other` | `moves.pattern` |
| `layer` | `layers.LAYERS` (4) | `moves.layer` |
| `phase` | `opening`, `middlegame`, `endgame` | `moves.phase` |

`time_trouble` stays a modifier on an observation, not a skill: it is a condition,
not something to practise. One move contributes an observation to each family it
has a tag for, so the three families are parallel views, never a product.

**The families are deliberately parallel because their coverage differs.** Measured
on production, rated mistakes of the last 90 days (n = 1,619, October 17, 2026):

| Family | Tagged | Coverage |
| --- | --- | --- |
| `motif` | 1,006 | 62% |
| `layer` | 534 | 33% |
| At least one of the two | 1,079 | 67% |
| Neither | 540 | 33% |

Layer coverage alone would not support a model. Motif coverage does, and half the
layer-untagged moves (545 of 1,085) still carry a motif, so parallel families give
the estimate evidence on two thirds of mistakes without waiting on layer 3.

The untagged third is a *rules* gap, not a search-budget gap: of 1,085 moves with
no layer, 1,084 are `other` (settled, no rule held) and one is `unknown` (capped),
and 612 of them have stored `cause_facts`. More engine time would not tag them.
They skew middlegame (650) and `miss` (472) — positional slips, which
[safety-habit training](2026-10-16-safety-habit-training-design.md) already defers
to a later spec. The model therefore carries an explicit unclassified mass it does
not reason over, rather than waiting for coverage it will not get soon.

`hangingPiece` alone is 694 of 1,619 tagged motifs (43%). The current histogram
cannot help but rank it first; whether the estimate still does after normalising
for exposure is the correctness test for this model. Measured on production once
step 1 shipped (after the symmetric gate), it does not: by clear chances taken it
is 437 of 543 (80%) and ranks last, while `discoveredAttack` (12 of 31, 39%; 55%
after shrinkage) is the weakest. Only `hangingPiece` (543), `fork` (77) and
`discoveredAttack` (31) clear 20 chances in 90 days, so an estimate over the rest
has to shrink toward the overall rate rather than trust a raw ratio.

## The estimate

For each skill the model keeps an ability `theta` and an uncertainty `sigma`,
updated by every observation with a Glicko-style step. An observation is
`(difficulty, outcome, weight, at)`:

- **difficulty** is on the learner's rating scale. A puzzle supplies its Lichess
  rating; a game mistake uses the learner's rating at the time plus a term for the
  move's win% drop (a bigger drop is an easier thing to have seen); a card review
  and a threat question inherit the source move's difficulty.
- **outcome** is `found`, `helped` (a hint or a retry) or `missed`. `helped`
  scores as a partial failure, matching `deck.mark`.
- **weight** discounts weaker evidence: a game success is weaker evidence than a
  puzzle answer because the learner may never have been tested.
- `sigma` **grows with games played** since the last observation, not with
  calendar time. An improving player's ability is non-stationary — a failure four
  months and 200 games ago is evidence about a weaker player — and widening
  `sigma` is the principled way to say so: it lets new evidence move `theta`
  faster instead of being outvoted by old evidence. Counting games rather than
  days matches [learning loop](2026-10-17-learning-loop-design.md) part 1, whose
  windows are 20 *games* precisely so that a fast week and a slow month compare
  the same amount of play. It also replaces `RECENT_DAYS`'s 90-day cliff with a
  gradient. The drift rate should be higher for a player whose rating is still
  climbing; deriving it from observed rating velocity is the obvious extension.

Sources, every one of which already exists:

| Source | Table | Outcome | Collected today |
| --- | --- | --- | --- |
| Puzzle attempts | `puzzle_attempts` | success/fail, with a real difficulty | yes |
| Card reviews | `card_reviews` | `rating`, `quality`, `seconds` | yes |
| Threat questions | `threat_reviews` | correct / No threat | yes |
| Bot-play spotting | `games.spotted_found/asked` | spotted/missed | yes |
| Game mistakes | `moves` where `classification` in `KINDS` | missed | yes |
| **Game successes** | `moves.chance_motif` with `uci = best_uci` | found | **yes, step 1** |

Game successes were the missing half. `skill_shape` recomputed them on every
Progress request and collapsed them into one Tactics number;
`patterns.tag_found` now stores the motif per move, so a motif's finds and misses
can be counted against each other and the base-rate problem above is answerable.

**Priority** for serving, per skill:

```
priority(s) = deficit(s) * confidence(s) + PROBE * sigma(s) * exposure(s)
```

`deficit = theta_overall - theta_s`, `confidence` falls with `sigma`, and
`exposure` is how often the skill arises in the learner's own games (so a skill
they never meet is not drilled on principle). The `PROBE` term is the explore
half: a skill the model is unsure about earns a slot to find out, instead of
staying invisible as it does now.

## Eligibility, separated from labelling

`THRESHOLDS` keeps doing exactly what it does now for **display**: Game Review's
badges and counts must keep matching Chess.com, which is the parity goal, and
`reclassify` must keep working from stored win%s with no engine.

**Card eligibility becomes its own function** and stops referencing a label:

```
eligible = severity * learnability * priority(skill) >= CARD_BAR
```

- `severity`: win% drop, scaled against the learner's rating rather than fixed
  bands, so a 10-point drop is not the same event at 900 and at 2000.
- `learnability`: today's `clear_best` (one move clearly better), kept, plus a
  penalty for positions whose answer is long or quiet.
- `priority`: the skill score above.

This is the change that lets the bar be rating-relative and weakness-aware at
once. It is additive: `KINDS` stays the filter that *finds* candidates; the score
decides which become cards.

## Variation: a card is a family

A card gains a **family** of positions carrying the same motif at a comparable
difficulty. The stored mistake stays the family's anchor and is always its first
serving; later servings draw from the family. Four sources, in the order they
should be built:

1. **Widened Lichess themes.** `puzzles.import_file` keeps `PER_THEME` (3000)
   puzzles across `patterns.THEMES` (7) — a few thousand rows out of a corpus of
   millions. Lichess tags far more finely (mate-in-N, `deflection`, `attraction`,
   `interference`, `oneMove`/`short`/`long`, phase). Keeping a wider, finer set is a
   config and import change and gives every family real depth. Highest value for
   the work.
2. **Symmetry transforms of the learner's own mistake.** Mirror on the file axis,
   swap colours, or both: up to four legal positions per card whose motif is
   unchanged, each verifiable with one existing-depth search. Nearly free, and the
   only source that directly defeats recognising the diagram rather than the idea.
3. **Motif-matched positions from the learner's own games.** Every FEN they have
   ever played is stored. Positions carrying the same motif — including ones they
   got right — are free and personally theirs.
4. **Engine-perturbed variants** (remove a defender, shift the tactic a file,
   re-verify the motif still wins). Real generation, real engine cost. Last.

**Mastery moves to the family.** `MASTERED_DAYS` currently reads one card's FSRS
stability. A family is mastered when its anchor is mastered *and* a variation has
been found without help; otherwise a learner who has memorised one diagram counts
as having learnt the pattern. `mastered_today` and Progress's counts follow the
family.

## Pace becomes time

`PACES` stops being a card count. `deck.py`'s own docstring already describes
Light, Standard and Intense as roughly 10, 15 and 30 minutes once the deck is a
few months old; the setting becomes those minutes, and the queue fills the budget
from measured answer times (`card_reviews.review_duration`, already stored). A
count silently means different things at month one and month twelve; a budget does
not, and it stops `REVIEWS_PER_NEW` from being a second guess at the same thing.

**Difficulty targets `TARGET_ACCURACY` (0.85).** The optimal-challenge literature
(and flow, and the zone of proximal development) puts learning near 85% success.
Measured session accuracy above the band pulls harder items from the family; below
it, easier ones. This is a control signal, not a cap.

**The deck stays mixed.** A queue that serves only the weakest skill produces a
session the learner fails half of. `WEAKNESS_SHARE` bounds how much of a day is
priority-selected; the rest is ordinary due review, which also keeps practice
interleaved rather than blocked (mixed items force the learner to decide *which*
pattern applies, which is the skill the game asks for).

## Storage

Migration `0017`:

- `skill_estimates (skill text, theta real, sigma real, observations int,
  updated_at text)`, one row per skill, per user.
- `skill_observations (skill, source, source_id, difficulty, outcome, weight,
  at)` — the evidence, so the estimate can be rebuilt after a parameter change
  exactly as `analyze.reclassify` rebuilds labels.
- `card_variations (game_id, ply, source, ref, fen, verified_at)` — a family
  member, `source` one of `puzzle`, `transform`, `corpus`, `perturbed`.
- `moves.chance_motif text` — the motif the *best* move carried, on every move where
  one move was clearly it (migrations `0021`/`0022`, built). Whether the chance was
  taken is `uci = best_uci`, so finds and misses share one definition.

Estimates are derived, never authoritative: dropping `skill_estimates` and
replaying `skill_observations` must reproduce them.

## Contract

All additive.

| Endpoint | Change |
| --- | --- |
| `GET /api/deck` | A card gains `variation` (null for the anchor, else `{source, fen}`) and `family: {size, mastered}`. `today` gains `budget_minutes` and `spent_minutes`. |
| `POST /api/answers` | Accepts `variation_ref`; the server grades the served position, not the anchor. |
| `GET /api/overview` | Adds `skills: [{skill, theta, sigma, observations, deficit}]` for the period. |
| `PUT /api/settings/review_pace` | Values become `light`/`standard`/`intense` mapped to minutes; the existing strings keep working. |

## Costs

| Where | Added engine work | Cap |
| --- | --- | --- |
| Success tagging | None — `patterns.motif` is board geometry on stored FENs | Batch per update run |
| Estimates | None | Pure arithmetic over existing rows |
| Widened themes | None at serve time; a larger one-off import | Rows kept per theme |
| Symmetry transforms | 1 verification search per variant, at `JUDGE_DEPTH` | Generated lazily, on a family's second serving |
| Perturbed variants | 1+ searches per candidate, most rejected | Out of the first build |

## Build order

Each step is useful alone and none of the first three change what a learner sees.

1. ~~**Tag successes.**~~ Built: `patterns.tag_chances` writes `moves.chance_motif`
   — the motif the engine's move carries, wherever one move was clearly it — and
   `patterns.chance_rates` returns `{motif: {found, chances}}`. Tagging from the
   *best* move rather than the played one is what makes the rate honest: a chance
   taken and a chance missed are then recognised by the same rule. Runs in the
   worker's pattern pass and `knightly patterns`, `CHANCE_BATCH` (200) games a run,
   newest first. Board geometry only, no engine, never in a request.

   `analyze.only_move` owns the "one move was clearly it" test for both sides, and
   is mate-aware: evals are clamped to `CLAMP_CP` before the win% curve, so a forced
   mate and a merely winning move both land near 98% and their gap reads as zero.
   The first version used the raw win% gap and so discarded 92% of mate finds and
   82% of discovered-attack finds. `deck.clear_best` still uses the saturating
   comparison for card eligibility; see Open.
2. **Estimates and observations**, fed from the six sources, surfaced on Progress
   so the numbers can be read before anything depends on them.
3. **Split eligibility from labelling** in `analyze.py` and `deck.py`.
4. ~~**Swap `deck.queue`'s sort**~~ Built as the cheap half: `patterns.weakness`
   returns each tactic's find rate shrunk toward the learner's overall rate
   (`PRIOR_CHANCES` = 25 pseudo-chances), and both `deck.queue`'s new-card order
   and `puzzles.session_puzzle`'s theme read it in place of raw mistake counts
   (`patterns.missed_most`, removed). A tactic with no chances yet sorts at the
   average, not as a weakness. Shrinkage is not a refinement here: only three
   motifs clear 20 chances, so an unshrunk rate would swing on one answer.

   Game chances only, never practice answers — the
   [learning loop](2026-10-17-learning-loop-design.md) part 1 rule, so drilling a
   tactic cannot retire it from practice without the games changing.
   `patterns.strength` keeps reporting practice first tries separately.

   The habit term ranked above it in the same sort had the identical flaw and now
   reads `game_trend`'s per-skill cost (win% lost a game), spread over that skill's
   layers by `game_trend.by_layer` and cached with the lesson focus in one day
   setting (`day_trend`), since `summarize` is too slow for the deck's request path.
   `layers.missed_most` is removed. Two consequences worth holding: layers of one
   skill (`theirThreat`, `theirReply`) now share a cost and cannot be ordered against
   each other, and cost is a raw 20-game mean with no shrinkage, so on production
   safety (20.5) leads tactics (20.3) by a margin far inside the noise.

   The full `priority` (uncertainty, probing, `WEAKNESS_SHARE`) is still step 2's
   work; this orders by deficit alone. Giving cost the shrinkage the tactic rate has
   belongs there too.
5. ~~**Variations**~~ Built as Lichess families. A card's family is puzzles carrying
   its tactic, preferring its phase, at the target rating (`puzzles.family_puzzle`),
   served immediately after the position it matches rather than only once the day's
   cards are done. New positions only (`puzzles.family_due`), so the day does not
   double in length, and the card's own grade and schedule are untouched.

   The corpus was stocked by `patterns.THEMES` (7) -- shaped to what our tagger can
   name on a mistake, not to what is worth practising. `puzzles.KEEP_THEMES` stocks
   by 49 of Lichess's own: motifs we cannot detect (deflection, interference, a
   trapped piece), mate in a named number of moves, and which endgame it is. Phase and
   length tags are not stocked by -- nearly every puzzle carries one, so they would
   fill the quota without broadening anything -- but are stored and narrowed on.

   Mastery moved to the family (`deck.is_mastered`): the schedule out past
   `MASTERED_DAYS` **and** a family member solved. Without that, a long interval is
   evidence the diagram is known, which is what families exist to stop counting. A
   card with no nameable tactic has no family and rests on its schedule alone --
   otherwise the untagged third could never be mastered. `mastered_today` fires from
   either side, since the family can be the part that completes it.

   No symmetry transforms. They were the first plan and are the weaker idea: a
   mirrored fork is the same fork, so it guards against recognising the diagram
   without giving the varied instances a template is built from.

   Migration `0023` records which card a puzzle was served for; the client is told
   through `puzzle.family` so it can say "Same idea" rather than appear to serve a
   random puzzle. `puzzles.answer` works the family out again rather than trusting
   the client, both ends being deterministic for the day.
6. **Minutes-based pace** and `TARGET_ACCURACY`.

## Verification

Backend pytest, with expectations derived from fixtures rather than from the code
under test:

- Estimates: a skill with 40 failures and 400 opportunities ranks below one with 8
  failures and 10 opportunities (the base-rate case the current histogram gets
  wrong); `sigma` grows with games played and shrinks with observations; replaying
  `skill_observations` reproduces `skill_estimates` exactly. On the production
  corpus, `hangingPiece` must not rank first purely on its 43% share.
- Eligibility: the same win% drop is eligible at one rating and not at another;
  `clear_best` still excludes positions with several good moves; `reclassify`
  output is unchanged by the split (a regression test that fails if labelling and
  eligibility are re-coupled).
- Variations: a mirrored position's motif is the one the anchor carried; a
  transform whose verification search disagrees is rejected and not stored; a
  family is not mastered on the anchor alone.
- Pace: a budget fills to within one item of the minutes and never exceeds the
  review room; accuracy above and below the band moves difficulty the right way.

Jest: a served variation grades against its own FEN; family progress and mastery
read correctly on the session-end beats; the pace setting migrates from a count.

Device checks are the existing practice ones; no new screen.

## Open

- `deck.clear_best` decides card eligibility with the same saturating win% gap that
  `analyze.only_move` now replaces, so a position where you could have mated but had
  another winning move may never have become a card. Not measured, and not changed
  here: it would add cards to a live deck. Measure before touching it.
- `calculation` is a dead axis. It fired 5 times in 1,619 (below). Leave it out of
  the skill namespace until its rule is re-derived, or it will carry an estimate
  fitted to nothing.
- `WEAKNESS_SHARE`, `PROBE` and the severity-vs-rating scale have no defensible
  starting values; pick something, then fit from answers once there are enough.
- Whether `motif`, `layer` and `phase` are the right axes, or whether opening
  families belong in the namespace too.
- Whether perturbed variants (source 4) are worth their engine cost at all, or
  whether a widened Lichess corpus covers the same ground for free.
- FSRS was fitted to one item per card. Family-level scheduling may need its own
  parameters; `tune` currently optimises over `card_reviews` alone.
