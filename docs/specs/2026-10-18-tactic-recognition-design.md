# Tactic recognition

Proposed (October 18, 2026). The gate is implemented. The label and match pieces (the trained
classifier) were dropped on 2026-10-22 and `ml/` removed: curriculum-led practice needs a
tagger right on average, not per position, so a better tagger is not the bottleneck. This spec replaces the hand-written
motif tagger with three separate pieces, because it is currently one piece doing three jobs
badly.

Knightly's core loop is: your mistake becomes a card, and the card becomes a *family* of other
positions carrying the same idea ([weakness model](2026-10-17-weakness-model-design.md) step 5).
Everything rests on knowing what idea a mistake was about. Today that answer comes from about
a dozen hand-written board-geometry rules, scored against Lichess's labels at 77% precision,
and with a third of mistakes named nothing at all.

The rules were improved from 52% to 77% by measurement
([status](../status.md)), and the remaining errors are not a tuning problem. `hangingPiece`
sits at 0.17 because it is the catch-all for "no other rule fired"; `deflection` and
`intermezzo` were written, measured at 0.11 and 0.26, and thrown away. The ceiling is the
design, not the rules.

## Three jobs, not one

| Job | Question | What it needs |
| --- | --- | --- |
| **Gate** | Is there a tactic here at all? | Engine facts we already store |
| **Label** | Which tactics is it? | A classifier over a full taxonomy |
| **Match** | What should they practise next? | Similarity between positions |

Conflating them is why the tagger is stuck. The gate's absence is why `hangingPiece` became
a catch-all: with no way to say "nothing here", every unmatched mistake fell through to the
last rule. And using the label as the match key is why its precision felt load-bearing — a
single word like `fork` is a crude key for "the same idea", because it covers thousands of
genuinely different ones.

## Evidence

Two results decide the approach; neither is ours.

**A multi-label classifier over this exact corpus works.** The
[chess-puzzle-classifier](https://github.com/DeyonOba/chess-puzzle-classifier) project predicts
**69 Lichess themes** from the board and solution line with no engine, reporting 0.976
micro-F1 and **0.905 macro-F1**. Rare themes (under 0.5% of the data) still reach **0.865**,
using class weights and splits that place the rarest theme within one sample of its share in
every split. So a comprehensive taxonomy is reachable and rare tactics need not be lost — the
weighting is what stops losing them.

**Labels are the wrong key for matching.** Bizjak and Guid,
[*Automatic Recognition of Similar Chess Motifs*](https://link.springer.com/chapter/10.1007/978-3-031-11488-5_12)
(ACG 2021), address our exact use case: finding positions with the same motif as one a student
missed. They use no labels. They separate *static* similarity (the pieces are arranged alike)
from *dynamic* similarity (the solution works the same way) and find dynamic similarity is
what matters, and what chess experts agree with. Their worked example is three positions that
look unalike and are all won by the same corner rook sacrifice; remove one rook and they
become statically similar but dynamically unrelated. Their encoding deliberately drops exact
squares and keeps only piece *types* and the relationships between them, so the idea
generalises.

## 1. The gate

A mistake is a tactical chance when the engine says something was actually at stake.
Everything else is `positional` — a real category, not a tagging failure.

As built (`patterns.decisive`), asked **before** anything is named, in centipawns against
`TACTIC_CP` (200cp — Lichess's own floor, where their `advantage` theme begins, and so the
floor beneath which nothing in the training corpus was ever labelled):

- A **miss** is named for the move you did not play, so it asks how far that move beat the
  next one.
- A **mistake or blunder** is named for the reply it allowed, so it asks what the opponent
  won by it.
- A **forced mate** is always at stake, whatever the centipawns say.

### Why this replaced the first gate

The first version asked `only_move` for a miss and `layer in CONCRETE` for a mistake, and ran
*after* naming so it could never override a motif the rules found. That ordering was chosen
because gating first discarded 943 of 1,481 existing tags, which looked like damage.

It was not damage. The gate's **question** was wrong, not its placement. `only_move` asks
whether one move stood out — the shape of the choice — never how big the prize was, and a
move can be uniquely best by a wide win% margin while winning nothing at all. So the rules
went on naming tactics in positions that had none, and because nothing ran afterwards to
check, those labels stood.

Measured over 2,574 production mistakes against the trained classifier, which independently
names a tactic in 98% of positions with a forced mate:

| what the opponent gained | n | classifier names a tactic | rules named one |
| --- | ---: | ---: | ---: |
| 100–200cp | 429 | 6% | 41% |
| 200–400cp | 485 | 18% | 51% |
| 400–800cp | 426 | 34% | 71% |
| 800cp+ | 166 | 44% | 78% |

Misses separate the same way on how far the best move beat the second: 13% at under a pawn,
80% over eight. Both gradients are monotone; "how winning the opponent *landed*" is not, so
the gate reads the gain rather than the resulting eval.

### What it changes

`tag_chances` takes the same bar, and that is the half that matters. `weakness` counts
`chance_motif`, not `pattern`, so an ungated chance is what actually puts a tactic in front of
you. Naming one there without asking what was at stake is how the app came to prescribe drills
for tactics the learner never failed.

Measured on production, 2,626 rated mistakes, misses and blunders:

| | before the gate | after |
| --- | ---: | ---: |
| Named a tactic | 1,477 (56%) | 1,022 (39%) |
| Re-labelled `positional` | — | 455 (17%) |

Blunders lose nothing (564 → 564): a blunder costs material by definition, so it always clears
the bar. The losses are concentrated in mistakes (351 → 172) and misses (562 → 286), and in
the motifs whose geometry is commonest — a third of `hangingPiece`, `fork`, `pin`,
`discoveredAttack` and `trappedPiece` tags each.

`layers.settle` no longer needs to run before `patterns.deepen`: the gate reads evals the
analysis pass already stored, not layers.

## 2. The label

A small network reading the board as binary grids through the solution line, predicting all
69 Lichess themes at once. Trained from scratch on their 6.1M labelled puzzles.

### Two corpora, two jobs

`puzzles.KEEP_THEMES` stocks about 110,000 puzzles filtered for popularity, play count, a
500-2200 rating band and at most `PER_THEME` (3,000) each. That filter is about what is worth
*serving* a learner: clear, well-liked, at their level. **It is the wrong set to train on.**
Popularity measures whether people enjoyed solving a puzzle, not whether its labels are right,
and the per-theme cap actively distorts the class balance the weighting is computed from.

Training uses the whole file: **every one of the 6.16M puzzles, unfiltered and uncapped**, as
the reference run did. That is 56 times the data. It is streamed from
`lichess_db_puzzle.csv.zst` into a training artifact offline and never lands in Postgres.

### Labels

All 69 themes, in groups, because they are not all the same kind of thing:

| Group | Count | Decoding |
| --- | ---: | --- |
| Tactical motifs | ~28 | Sigmoid, independent |
| Named mate patterns | ~19 | Sigmoid, independent |
| Mate distance (`mateIn1`..`mateIn5`) | 5 | Grouped softmax, exclusive |
| Phase, endgame type, length, goal | ~17 | Grouped softmax per group |

Provenance tags (`master`, `superGM`, `playerGames`) are dropped: they describe where a puzzle
came from, which the model would learn from style and which says nothing about the tactic.

Only about 47 themes are tactical ideas; the rest is metadata. Predicting it anyway is
deliberate — the groups share a representation, and phase and endgame type are wanted for
[families](2026-10-17-weakness-model-design.md) regardless, since a rook-endgame fork is not
the same practice as an opening fork.

**Rarity weighting** by `clip((n / n_class) ** 0.5, 1, 20)` with stratified splits, which is
how the reference keeps themes under 0.5% of the data at 0.865 F1. Without it the model
predicts only common themes: the prototype did exactly this, naming `backRankMate` zero times
because every back-rank mate is also a `mate`, and `mate` is commoner.

### Input

A **sequence of positions**, not one board. The tactic is in how the line unfolds, and
`deflection` and `intermezzo` are defined by move order *within* it — which is precisely what
the hand-written rules, scanning only our own moves, could not see.

Per position: 12 piece planes, side to move, 4 castling, en passant, plus attack maps (26
planes; the reference reports the attack maps help). Line length is capped and padded.

Game history before the position is deliberately **not** included. A tactic is a property of
the position and its continuation, not of how the players arrived; the only history that
changes legality is castling rights and en passant, and both are already in the FEN. The clock
and the rating are excluded for the same reason: they explain why a learner *missed* a tactic,
which is the [mistake layers](2026-10-16-safety-habit-training-design.md) question, not what
the tactic *is*.

**What we add that the reference does not have:** the engine facts already stored on every
mistake — the evaluation either side of the move, the `only_move` gap, the refutation line and
its net material, the threat set. The reference project uses no engine at all. These matter
most for exactly the themes rules failed at: whether material *stays* won is the consequence
test our `hangingPiece` rule lacked, and it is why that rule scores 0.18.

### Keeping rules where a rule is the definition

`mate`, `promotion`, `enPassant` and `advancedPawn` score 1.00 as rules; the prototype scored
0.96, 0.85 and 0.78 on the last three. A definition cannot be improved on by learning it, and
a rule stays explainable. The classifier owns the judgement calls; the rules own the
definitions, and override the model on those labels.

### Serving

Inference in the worker, never in a request. Per mistake, the same representation is built
from the stored engine line and facts. Per-label thresholds are tuned on the held-out split;
the full multi-label result is stored, and the single label shown to a learner is the most
*specific* one above threshold — not the most probable. Plain argmax predicted `backRankMate`
zero times in the prototype, because `mate` is commoner and scores full marks on the metric
while losing the distinction.

Storage: `moves.themes jsonb` beside the existing single `pattern`, with the model version, so
a re-tag is detectable and the two can be compared before anything switches over.

### Where it trains

Kaggle's free GPU tier, which is what the reference run used. The alternatives rule themselves
out: the Oracle VM has no GPU and is ARM, and a laptop would hold a derived dataset of roughly
10 GB on a disk that is chronically near full. Kaggle also downloads the Lichess file directly,
so neither the 294 MB corpus nor the dataset built from it touches a personal machine.

Shape it as a dataset-build script and a training notebook, both in the repository, producing a
weights file. Training that is repeatable by anyone beats training that happened once on
someone's laptop. The build script was in `ml/` (removed 2026-10-22: a better tagger was measured not to be the bottleneck) and imported nothing from
`backend/`, so Kaggle runs it directly.

### Stack

PyTorch, because it is already in the production image for FSRS tuning. Anything else would be
a new dependency bought for nothing. The artifact is a plain state dict with the model class in
our source; keep it under about 50 MB against an image already at 1.82 GB, and fetch it from
the existing R2 bucket at image build rather than committing a binary that ages badly.

### Teaching it what "no tactic" looks like

The reference model has never seen a position without a tactic in it, because every puzzle is
one by construction. Shown a quiet mistake it has no choice but to guess, and that is the
largest single reason its accuracy will not survive contact with real games.

So **train on negatives**: positions mined from real games where no move stood out, carrying
every theme off. We have the learner's games and Lichess publishes a game database. This
attacks the problem at its root rather than patching around it, and it is cheap.

Two more defences, both about not trusting the benchmark:

- **Calibrate thresholds on real mistakes, not on puzzles.** Where each theme's confidence bar
  sits decides how often the model speaks at all. Tuning it on the puzzle split bakes the
  overconfidence in; tuning it on hand-checked mistakes does not.
- **Hand-label 200-300 real mistakes** as the honest test set, budgeted as real work rather
  than a footnote. It is the only measurement that says anything about live behaviour.

If the gap still looks large, a stretch option is to re-derive a *subset* of puzzle lines with
our own engine settings (depth 12, a 2 s cap) so that training input resembles inference input.
Too expensive for 6.16M, viable for a calibration slice.

### Rollout

Shadow first. Compute and store themes without serving them, compare against the rules on real
mistakes, and only then let families and the weakness model read them. The rules stay until
the comparison says otherwise.

## 3. The match

A card's family comes from *dynamic similarity* to the stored mistake, not from sharing a
label. Following the paper: encode each tactic by what happens in its solution — which piece
*types* move, capture, check and get sacrificed, which attack which, which take part in the
mate — with the squares left out so the idea generalises, plus static terms for piece
relationships and pawn structure. Retrieval is then nearest-neighbour over those encodings.

The label still narrows the candidate pool and still explains the choice to the learner
("same idea: a deflection"), but it stops being the thing that decides.

## The validity problem

Everything above is trained and measured on Lichess puzzles: positions that are tactics by
construction, filtered for popularity and play count. The input in production is a learner's
mistakes, many of which are not tactical at all and none of which were curated.

So every number here, including the 77% we already report, **overstates real accuracy**. The
gate is the main defence, since it keeps non-tactical positions away from a model that has
never seen one. The honest measure is a hand-checked sample of real mistakes, which no public
dataset can give us. Budget for labelling a few hundred by hand before trusting any figure.

## Costs

| Piece | Added cost |
| --- | --- |
| Gate | None; built, and the facts were already stored |
| Training data | A 294 MB download streamed to a training artifact; never in Postgres |
| Training | A GPU run over 6.16M puzzles on Kaggle's free tier |
| Negatives | Mining quiet positions from games; engine facts already decide which |
| Hand labels | 200-300 real mistakes read by someone who can judge a position |
| Inference | One forward pass per mistake, in the worker, never in a request |
| Artifact | A model file in the image, versioned so a re-tag is detectable |
| Retraining | When the corpus updates, or when the taxonomy changes |

PyTorch is **already in the production image** for FSRS tuning, so the runtime dependency this
would otherwise add is largely paid for. The honest new costs are the training job, the
artifact, and a retraining path that has to be run by someone.

## Verification

`patterns.evaluate` and `knightly tagging` already score the tagger against the stored corpus;
they become the regression harness. A change ships only if it improves the score, as the four
that got the rules to 77% did, and as `capturingDefender` (0.24), `deflection` (0.11) and
`intermezzo` (0.26) did not.

Additionally: a held-out split with the rarest theme represented, per-theme precision and
recall rather than one aggregate, and the hand-checked sample of real mistakes above. The
aggregate hides exactly the failure we care about — the prototype scored 0.86 overall while
predicting one theme zero times.

The bar to clear is the rules as they stand: **0.77 precision over 11 themes at 88.8%
coverage**, measured by `knightly tagging`. The reference reports 0.905 macro-F1 over 69, and
an hour's prototype on 27 hand-made features reached 0.86. A model that does not beat 0.77 on
the same harness does not ship.

## Open

- **Who reruns training** when the corpus or the taxonomy changes. Kaggle answers where it
  runs, not whose job it is.
- **Explainability.** A rule says "a fork, because the knight attacked two pieces". A model
  says "fork, 0.83". Acceptable while a tag only picks puzzles; not if it reaches coaching
  text. The rules kept for definitional motifs limit the exposure but do not remove it.
- **Our line is not their line.** Lichess solutions are engine-verified as uniquely winning,
  human-reviewed, then solved by millions. Ours is a depth-12 search with a 2 s cap, which can
  be ambiguous, unforced or truncated. The model will be more confident on our input than it
  should be. Negative examples, real-mistake calibration and the stored engine facts are the
  compensation; none is tested yet, and the hand-labelled set is what would tell us.
- **Whether the label is needed for matching at all**, once dynamic similarity exists. It is
  still wanted for the weakness model and for explaining a choice.
- **The taxonomy is Lichess's, not chess's.** It is the best public vocabulary and it is what
  6.1M labels are written in, but it misses ideas the literature names — windmill, Novotny,
  Plachutta, decoy as distinct from deflection, overloading as its own motif. Finer ideas than
  Lichess names would have to be labelled by us, which is where similarity becomes the better
  tool, since it finds "the same idea" without needing a name for it.
- `lichess-puzzler`'s tagger is AGPL-3.0 and is not used; its output, the CC0 puzzle database,
  is. The reference classifier publishes **no licence and no weights**, so only its described
  architecture is used, which is not copyrightable.
