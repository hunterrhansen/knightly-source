# The curriculum: wards, tracks and the practice modes

Proposed (2026-10-20). Replaces `curriculum.py`'s flat list of 33 ideas with a
two-dimensional curriculum anchored to the Steps Method's ordering: **seven tracks
running in parallel across about eighteen wards**, each ward served in five practice
modes. Adds endgame technique, which the curriculum has none of today, and a
checks-captures-threats thread that runs through every ward rather than sitting in one.

Nothing here changes the scheduler. FSRS still decides when a card returns, the nightly
watch is still the delivery, and the path is still the learner's own schedule.

## Why

Three findings from the same week, pointing the same way.

**1. The ordering we have is measured from the wrong thing.** `curriculum.py` derives each
idea's `reachable` and `typical` from the 10th-percentile and median Lichess rating of
puzzles carrying that theme. Its own docstring admits what that means: en passant lands at
1521 "because it is *rare*, not because it is hard", and the `AUTHORED` ideas are
"the ones to distrust". A puzzle-rating percentile measures where easy examples of a theme
live, not where a teacher should introduce it. The Steps Method is the latter, built in 1987
by Brunia and van Wijgerden and used across European chess education since.

**2. Defence is missing.** Of 33 ideas, exactly one (`defensiveMove`) is about what the
opponent is doing to you. The Steps Method teaches "defending against X" as a parallel track
revisited at Steps 2, 3 and 5. Measured against one learner's games (October 20, 2026,
gghansen, Chess.com rapid 913-919), two of the three decisive errors across two games were
failures to see what the opponent's move allowed, both with ten or more minutes on the clock:
`20...Ne6` occupied the learner's own bishop's only escape square (+262 to -235), and
`46...Rg8`/`47...Kf7` lined the king and rook up on one diagonal for `50. Bb3+`. Neither is a
tactic the learner failed to *find*; both are threats they failed to *notice*. One sample, so
treat it as a worked example rather than a rate -- but it agrees with the pedagogy.

**3. There are no endgames.** Pawn endings start at Step 2, and the square of the pawn, key
squares, rook against pawn and rook endings follow through Steps 3-5. `curriculum.py` has
none of them: the endgame tags live in `CONTEXTS`, explicitly classed as "the setting an idea
turns up in", not something to learn. The same learner lost the game above in a pawn endgame.

## The path is the curriculum

**This supersedes [the path home](2026-10-19-path-home-design.md)'s rule that the path is
"ordered by time and the schedule, never by topic"** (decided 2026-10-20).

That rule was right when it was written: with no course, a path of lesson nodes would have
invented one. There is a course now, so the premise has expired. Keeping the rule would mean
the home screen's nodes are FSRS due dates -- the engine's own bookkeeping, shown to the
learner. "Thursday - Qd4's last check" is a maintenance schedule. It carries no mental model,
where "this week you are working on pins" tells the learner where they are *and* primes them
to notice pins at the board.

The two are not competing axes. They resolve into one:

> **The curriculum is the map. Spaced repetition is how a ward is known to be cleared.**

A ward is not cleared by nights elapsed or puzzles finished. It is cleared when its ideas are
**held**: FSRS stability past the bar and a family member solved in a different position,
which is `deck.holds` as it already works. Progress through the course is therefore gated on
retention, not exposure, and the scheduler stops competing with the curriculum by becoming
the instrument that measures it.

What this fixes and what it keeps:

- **Home is the ward path.** Nodes are wards: cleared behind, the current one lit, the next
  few ahead. The renderer is the one already built; what changes is what a node means.
- **Tonight is one ritual with a fixed mix.** One tap; four of the watch's ten items are the
  current ward's new material, two look first, two are mixed review and two come from the
  learner's games ([the watch's mix](2026-10-19-path-home-design.md#what-a-watch-holds-decided-2026-10-22),
  decided 2026-10-22): a review that waits a night costs its schedule nothing, and a watch of
  reviews alone never moves the learner along. The engine still decides what is *in* a night.
  It no longer decides what the map *is*.
- **Nights move to the habit layer.** The map of nights, moon phases and kept-night history is
  consistency evidence, which is worth showing; it belongs beside the streak in Progress, not
  as the primary journey. It relocates rather than being deleted.
- **A ward never gates a review.** Forty cards due and no appetite for new material: the night
  serves the reviews and the ward does not advance. Wards advance when memory says so, which
  on a bad month is never.
- **No unlocking, no lesson gates, no "complete this to continue".** The learner can always
  do tonight's watch.

## The model

### Seven tracks

Read across the six Steps, seven threads run concurrently rather than in sequence. A ward
takes a slice of each track that is live at its level.

| Track | Runs from | Example progression |
| --- | --- | --- |
| `tactic` | Ward 1 | twofold attack -> pin -> discovered attack -> interference, luring, the magnet |
| `defence` | Ward 2 | defending against mate -> against the double attack -> against the pin |
| `mate` | Ward 1 | mate in one -> mate in two -> mating nets -> attack on the king |
| `endgame` | Ward 3 | simple pawn endings -> square of the pawn -> key squares -> rook against pawn -> rook endings |
| `calculation` | Ward 4 | visualisation ("thinking ahead", Steps 2-3's own workbook) |
| `opening` | Ward 2 | opening principles -> opening advantage |
| `positional` | Ward 12 | weak pawns -> strong square -> open file -> the seventh rank |

`positional` starts late and stays thin, honestly: Lichess publishes no positional themes, so
there is no corpus for it and `positional.ORDER` has only seven narrow rules. Until that is
fixed the track carries a handful of ideas and the wards above 1400 are correspondingly
weaker than the ones below. Say so in the ward rather than pretend otherwise.

### About eighteen wards

Six steps is not a path -- Step 2 alone spans roughly 600 rating points, which is a year in
one section. Wards subdivide the Steps ordering into units a learner clears in one to three
weeks. Step 1's rules content is dropped: every Knightly learner already plays online.

Each ward is a small ordered set of ideas drawn from the live tracks, plus the modes below.

### Difficulty is measured, never imported

**Do not copy the Steps rating bands.** The per-step ratings in circulation (Step 2 to ~1400,
Step 3 to ~1600, ...) come from a GM's blog rather than the Steps publishers, who publish
none; and Steps was calibrated in 1987 against Dutch national ratings, not a Chess.com rapid
pool full of beginners. Importing them would miscalibrate whatever the truth about players
getting stronger.

Instead: **Steps supplies the order, the corpus supplies the difficulty.** Each ward's band
is derived from the stored Lichess puzzles carrying its ideas, as `curriculum.py` already
does, and the learner is placed in a ward by `standing.rating()` -- their real rating from
their last 40 rated games. The Elo of a ward is an output of measurement, not an input.

This also means the ward boundaries move as the corpus is re-imported, which is correct and
should be visible in the derivation rather than frozen into constants.

## The five practice modes

The Steps Method's workbook variants are not reading levels -- they are five different things
to do with one topic, and four of the five map onto something Knightly already has or has
specced. Each mode is a way of serving a ward's ideas; the deck schedules all of them.

| Mode | Steps calls it | What it does | Status |
| --- | --- | --- | --- |
| `taught` | Basic / Plus | The idea, announced, at the ward's difficulty | Built (`puzzles.themed_puzzle`) |
| `volume` | Extra | More of the same idea at the same difficulty | Needs the corpus re-import |
| `unannounced` | **Mix** | A position with no topic given: *is there anything here?* | Specced, unbuilt (`unannounced.py`, learning loop part 4) |
| `review` | Mixed review | An earlier post's idea served unannounced | Puzzles of earlier posts' themes |
| `defend` | (within each step) | What does the opponent threaten; what does my move allow | Half-built (`drill.py`) |

Two notes worth keeping.

**Plus exists to hold difficulty down.** The publishers' stated reason for it is more material
at the same level "so the student can continue his/her development without losing motivation,
which often occurs when the difficulty level is too high". That is the desirable-difficulty
principle, arrived at by practitioners. It is the same argument as targeting ~85% success,
and it is the argument for fixing `puzzles.target_rating` before any of this ships.

**Mix is at every step, not at the end.** Unannounced practice is a standing parallel track in
the Steps Method, not a graduation exercise. Knightly should treat it the same way: a fixed
share of every watch from the first ward, because noticing is what the learner's games
actually test.

## The CCT thread

Checks, captures and threats is the one checklist worth teaching, because it is exhaustive
over forcing moves rather than derived from anyone's particular blunders. Run against the
three errors in the Why above, it catches all three: `g4` as the learner's own threat, `f3` as
the opponent's threat in reply, `Bb3+` as the opponent's check.

**CCT is not a tag.** Nearly every tactical puzzle contains checks, captures and threats, so
tagging for it selects everything. It is a set of question *formats*, applied to positions
from any ward:

1. **What does their last move do?** -- built (`drill.py`'s threat question).
2. **What does my move allow?** -- **missing.** The data exists: `layers.py` already tags
   `theirReply` as "your move allowed a short, forcing reply", and nothing serves it as a
   question. This is the format that catches both self-inflicted errors above.
3. **Is there anything here at all?** -- the `unannounced` mode above.

The thread is a share of every watch, heaviest in the early wards and tapering as the patterns
become automatic. That taper is the point: a checklist is a conscious scaffold for chunks the
learner does not have yet, and expertise research (de Groot; Chase and Simon; Gobet) is
consistent that strong players do not run procedures, they recognise. The scaffold should be
designed to become unnecessary.

## Storage

Additive. The curriculum itself stays source, not data -- it is a fixed list that changes with
a deploy.

- `curriculum.py` gains `TRACKS` and `WARDS`: each ward is `(key, name, track_ideas, step)`,
  where `step` records which Steps level it came from so the mapping stays auditable.
- `ward_progress (user_id, ward, entered_at, cleared_at, ideas_met jsonb)` -- one row per ward
  the learner has entered, so the path's banner and Progress can show where they are.
- `moves.layer` already carries `theirReply`; the "what does my move allow" drill reads it and
  stores answers in the existing `threat_reviews` shape with a new `kind`.

No migration is needed before the first build step, which is derivation and reporting only.

## Contract

Additive, as always.

| Endpoint | Change |
| --- | --- |
| `GET /api/home` | `journey`'s nodes become wards: `{key, name, state, ideas: [{key, held}]}`, plus `current`. Night history moves under `habit` |
| `GET /api/deck` | An item gains `mode` (`taught`/`volume`/`unannounced`/`review`/`defend`) and `ward` |
| `GET /api/progress` | Adds `wards: [{key, name, cleared_at, ideas: [{key, met}]}]` |

Older servers omit the fields and the app shows what it shows today.

## Build order

Each step is useful alone, and the first two change nothing a learner sees.

1. **Re-import the corpus.** Production still holds 19,828 puzzles from the old seven themes;
   `KEEP_THEMES`'s 49 have never landed. Every mode below draws on it, from Lichess's
   `lichess_db_puzzle.csv.zst`.
2. **Derive and report the wards.** Build `TRACKS`/`WARDS` from the Steps ordering, derive each
   ward's band from the corpus, and print the mapping. Read it before anything depends on it --
   the point is to see where the derivation disagrees with the pedagogy.
3. **Difficulty targeting.** `puzzles.target_rating` anchors to `standing.rating()`, counts
   failures, and moves per attempt; session accuracy is measured and held near 80-85%. This is
   the strongest-evidenced lever Knightly does not have, and `volume` and `taught` are both
   worthless without it.
4. **The "what does my move allow" drill**, from `theirReply`. Completes the CCT thread.
5. ~~**Endgame technique** as a curriculum source.~~ Built as far as the corpus allows
   (`endgames.py`). A lesson carries an optional **shape** beside its themes, because
   Lichess tags which pieces are left and not which technique: `simple` (at most one piece),
   `bare` (kings and at most two pawns a side -- where the opposition decides it) and
   `racing` (a passed pawn whose promotion race against the defending king is close).

   **What the corpus still cannot do, and this is a real limit rather than a to-do.** Over
   the stored puzzles there are 374 distinct material signatures among the pawn and rook
   endings, 429 positions with nothing but kings and at most two pawns, and effectively no
   bare king-and-pawn-against-king at all. That is structural: a Lichess puzzle is "find the
   winning move", and endgame technique is "know the method", so a position with one forced
   idea and no tactic never becomes a puzzle. **The Lucena position, Philidor and the
   opposition are not in there and never will be.** Teaching them means generating the
   positions and verifying them against a tablebase, which is its own piece of work.
   **Built 2026-10-23 for the basics** (`endgame_drills.py`, `knightly endgames`): king and
   pawn against king is solved exactly in Python (Stockfish misjudges it), and the queen and
   rook mates are proved by Stockfish's mate search. Each drill's every move is the only one
   that keeps the result or mates that fast. Themes `opposition`, `keySquares`,
   `squareOfPawn`, `queenMate` and `rookMate` now feed the pawn-endings, key-squares,
   square-of-the-pawn, creating-mate and mating-with-the-rook lessons, replacing the
   unvalidated `racing`/`bare` filters there. Lucena and Philidor (rook endings, 1400+) are
   still not built.

   The shapes are **selection filters with unmeasured precision, not labels**. `racing`
   alone fires on 33,027 of 100,215 puzzles, far too broad to call a detector; it earns its
   place only in conjunction with `simple`. Nothing shows a shape to a learner, and the bar
   that rejected `capturingDefender` at 0.24 applies to anything that would.
6. **The ward path in the app:** home's nodes become wards, the night map moves to Progress
   beside the streak. Reuses the path renderer; `/api/journey` changes shape.
7. ~~**`visualise`**~~: dropped on 2026-10-22 (the core-20% audit); mixed review (`review`)
   took its place in the watch.

## Open

- **Licensing: credit the method by name** (decided 2026-10-20). The Steps Method is a
  commercial product by Rob Brunia and Cor van Wijgerden. Knightly takes its *topic
  ordering*, which is not protectable, and draws every exercise from Lichess's CC0 corpus.
  Credit it as an influence wherever the curriculum is explained to a learner or a reader --
  "the order of ideas follows the Steps Method" -- and link stappenmethode.nl. Do not
  reproduce their exercises or their wording, do not imply endorsement or affiliation, and do
  not use their step numbers as a Knightly progress label (wards are ours).
- ~~**The ward list is unwritten.**~~ Written (2026-10-20): eighteen wards in
  `curriculum.WARDS`, from the publishers' own trainer manuals for Steps 1-6, covering
  Step 1-plus through Step 4. `knightly wards` prints them against the corpus. Three things
  the derivation exposed, none of them smoothed over:

  - **Ward 1 has no corpus at all.** Board vision, attacking and defending, the profitable
    exchange: Lichess has no theme for any of them, so the first ward -- the one a 600 needs
    most -- is entirely drills we have to build. That is the CCT thread, and it is now on the
    critical path rather than a nice-to-have. Since 2026-10-23 its idea slots serve the
    learner's own vision drill first, then easy `hangingPiece` puzzles as practice (a
    lesson's `practice` themes: volume, never evidence), so it is held only by the drill.
  - **Three wards are thin below 900**: removing the defender (198 puzzles), the in-between
    move (238) and trapping (154). Workable at five a night, but they will repeat for a
    learner who stays under 1150 for long.
  - ~~**Pawn endings and the square of the pawn draw the same drills.**~~ Fixed by
    `endgames.py` (build step 5, below): a lesson now carries a *shape* as well as a theme.
    The three endgame-technique lessons draw 5,568 / 2,954 / 1,471 distinct positions
    instead of one identical pool.

  The p10 sequence across the wards is deliberately **not** monotonic (601, 679, 843, 708,
  865, 958, 808, ...). That is the measurement agreeing with the premise rather than
  contradicting it: p10 says where a theme's easiest examples happen to live, which is not
  where a teacher introduces it. Mate in two has easier examples than the double attack and
  is still taught after it. Do not reorder the wards to make this line go up.
- **Evidence.** The Steps Method is convergent practitioner wisdom, not controlled evidence;
  no study shows it beats an alternative ordering. It is adopted because the alternative is
  percentile ranks over puzzle ratings, which is worse. The defence findings rest on one
  learner's two games.
- **Positional stays thin** until there is either a positional corpus or a tagger that can
  name positional ideas. The wards above 1400 are weaker than the ones below and should say so.

## Tests

- Backend: ward derivation from a fixed corpus fixture (bands, ordering, no idea orphaned
  from a track); placement by `standing.rating()` at band edges; account isolation on
  `ward_progress`; the `theirReply` drill's question, grading and schedule, including that a
  wrong answer schedules it again; `mode` present on every served item.
- A ward clears only when every idea in it is `held` (stability bar *and* a family member
  solved), never on nights elapsed or puzzles answered; and a due review is served on a night
  where the ward cannot advance, so the curriculum can never withhold a review.
- App: the section banner's ward wording at large text; Progress's ward list; contract parsing
  with the fields absent.
