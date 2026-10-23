# Safety-habit training

Approved (October 16, 2026). Both parts are implemented and deployed (part 1
inside daily practice, below). The
learner blunders a lot, and most of those blunders are lapses of attention
rather than missing knowledge: the fork was known, nobody looked for it. Coaches call the fix a blunder check (Heisman's
"checks, captures and threats" before every move). Expertise research finds that
weaker players' first instincts are not yet reliable, so a deliberate routine helps
them more than intuition does, and that a first idea pulls attention away from the
opponent's ideas without the player noticing (the Einstellung effect). This spec
trains that routine directly, with two pieces:

1. **Their threat** drill: positions from the learner's own games where they must
   first say what the opponent threatens, then play their move.
2. **Mistake layers**: every game mistake tagged by which habit or skill failed,
   so Progress shows which one to work on.

Explanations stay honest as in
[coaching explanations](2026-10-15-coaching-explanations-design.md): every claim is
a fixed template filled with a fact an engine search or board geometry established.

## The layer map

Five layers of chess skill, in the order coaches teach them. Only layers 0–2 and
time trouble are tagged now: those are the ones engine or clock facts can establish.

| Layer | Name | What fails | Tagged from |
| --- | --- | --- | --- |
| 0 | Safety habits | Not checking the opponent's threats now (`theirThreat`) or their reply to your move (`theirReply`) | Threat search, reply search, geometry (below) |
| 1 | Tactical patterns | Not seeing your own tactic | `miss` with a `patterns.motif` on the best move |
| 2 | Calculation | Starting a forcing line that fails later | Below |
| 3 | Positional play | Plans, structure, weak squares | Not tagged; a later spec |
| 4 | Practical | Time trouble, tilt | Time trouble only, from the clock |

Each learner `mistake`, `miss` or `blunder` gets at most one layer tag, the first
rule that holds, plus an independent `time_trouble` flag. Untagged mistakes count
as "Other" and never as a layer.

**Layer 0 – their threat (`theirThreat`).** The threat search (below) finds a
threat in the position before the learner's move, and the refutation of the
learner's move starts with the same move. The threat was already there; the move
ignored it.

**Layer 0 – their reply (`theirReply`).** No `theirThreat`, the learner's move
was a blunder or mistake, and the refutation (the engine's best reply,
`REFUTE_PLIES` = 6 plies counted with `explain._walk`) mates or nets the opponent
at least `threats.LOSS` (2 points: a piece for a pawn, or the exchange) within its
first three plies. The move created a short, forcing
problem that one look at the opponent's checks, captures and threats would show.

**Layer 2 – calculation (`calculation`).** Neither layer-0 rule holds, the
learner's move is a capture or a check, and the refutation's net loss reaches
`LOSS` only after its third ply. The learner started a forcing line and
misjudged where it ends.

**Layer 1 – own tactic (`ownTactic`).** The move is a `miss` (or any mistake
not tagged above) and `patterns.motif` names a tactic on `best_uci`.

**Time trouble.** `time_trouble` is set when the decision began with less than 10%
of the base time, or less than 30 seconds, on a supported clock (the
[progress](2026-10-11-progress-design.md) clock reconstruction). It is shown
beside the layer, not instead of it.

[Blunder causes](2026-10-16-blunder-causes-design.md) owns the explanation text for
the same events: `missedThreat` explains `theirThreat`; `loosePiece` and `backRank`
explain `theirReply`; its principles label each layer.

## Threat search

The `threats` module owns one search used by all three pieces and by blunder causes.

Given a position with the learner to move, not in check and not over: pass the
move (`chess.Move.null()`, clearing en passant) and search
for the opponent at `deck.JUDGE_DEPTH`, `multipv=5` (`threats.LINES`), `MOVE_TIME` per line.
Five lines, not three, so a smaller win is not crowded out by a bigger one: every
move that meets the definition is a right answer.
A line is a **threat** when it mates, or when its first `REFUTE_PLIES` net the
opponent at least `LOSS` (2) points counted with `explain._walk` (recaptures followed
to their end). Two points, not a minor piece's three, so a piece lost for a pawn after
the recapture (…dxc3 bxc3) counts; real games found this case. The result is the set of threat moves (first move of each threatening
line, with SAN, line and net), possibly empty. A capped search (depth below
`JUDGE_DEPTH`) returns `unknown`, never an empty set.

An empty set means **no threat**: nothing in the top five lines wins two points
or mates. Pawn threats and positional threats are not claimed either way.

## 1. Threat questions in daily practice

One flow, no separate screen: daily practice asks **"What do they threaten?"** as a
step of its own positions, Duolingo-style, so the habit is practised where moves are
found and counts toward the day (`drill.py`, the practice session).

### What is asked

Positions from the learner's analysed rated games, at a learner move, the learner
not in check:

- **A card's threat step.** A review card whose move is tagged `theirThreat` opens
  with the threat question before "find a better move", every time it is served
  (the card's own schedule spaces it). Not on its end-of-session redo.
- **Questions on their own** (`drill.queue`), served between positions:
  - `theirThreat` moves that are no review card (several moves defend, so no card
    was made), and
  - **calm** positions: sound moves (`best`, `excellent`, `good`) past the opening
    where the threat search finds nothing; "No threat" is right. One per
    `CALM_SHARE` (3) threat questions, so "there's always a threat" is never safe.

`drill.prepare` (after `layers.settle` in the daily update and `knightly patterns`)
adds at most `THREAT_BATCH` (50) items a run; calm candidates where a threat exists
after all are stored as `skip`. It then widens up to `WIDEN_BATCH` (100) items
made under an older answer set (`threat_cards.answer_set` below `drill.ANSWER_SET`,
migration 0030): it searches them again, keeps every answer accepted before, and a
calm item where a threat turns up becomes a threat item. A "what did your move
allow?" item accepts every reply that mates or wins two points
(`threats.replies`), not only the engine's refutation.

### Scheduling and counting

`threat_cards` / `threat_reviews` (migration 0014) mirror `cards` / `card_reviews`.
Questions on their own are FSRS-scheduled from their answer: all due (up to 30),
then `NEW_PER_DAY` (5) new, newest first. The deck serves one after every `EVERY`
(2) positions answered today, and the rest once the positions run out. They count
in `today.done/total`, so the day's positions and the daily lesson include them; the
lesson asks them between positions as daily practice does.

### Interaction

1. After the opponent's move plays in, the board shows the position "if you passed"
   and takes the opponent's moves. The bubble asks "What do they threaten?" and
   says what counts: "If you passed, what would they win?"; the bar has **No threat**.
   The other kinds served on their own differ only in the board and words
   (`threat-copy.ts`): an `allows` question plays your own move in, takes their
   reply on the real board and asks "What did your move allow?" with **Nothing**;
   a `vision` question takes your own capture ("Something is loose") with no
   nothing-there button, and shows the answer as a best-move arrow. The backend
   serves every kind's answers in full (SAN, net), described from the answered
   board where only the move was stored.
2. The answer is judged at once from the served set; the board resets with the
   threats drawn as arrows; the verdict sheet says **Spotted it** or **Missed it**,
   the bubble what the threat does ("dxc3 wins a piece", "Bxf7+ leads to mate in 2").
   A wrong move first says why it is not the threat, from a static exchange on the
   board (`threat-why.ts`): taken straight back, only a pawn, a check that wins
   nothing, nothing won yet, or a capture that wins on its square but fails to
   something else.
3. The answer saves in the background (`POST /api/threats/answer`, re-graded on the
   server); a failed save is reported and never resent, and the position comes back.
4. A card goes on with **Find your move** to its usual exercise; a question on its
   own ends with **Continue**.

## 2. Mistake layers in review and Progress

**Storage.** Migration `0013` adds `moves.layer text` (`theirThreat`,
`theirReply`, `calculation`, `ownTactic` or null) and `moves.time_trouble
boolean`. A `layers` step settles learner mistakes, misses and blunders after
`patterns.deepen`, at most `LAYER_BATCH` (200) per run, with at most two searches per
move (threat search before, refutation after) at `DEEP_DEPTH`. Capped searches
store `unknown` and are not retried. Backfill covers rated games of the last
`SETTLE_DAYS` (180), two Progress periods, so the
[skill shape](2026-10-11-progress-design.md#skill-shape-scores) can compare them.

**Game review.** Each key moment's coach bubble title row shows the layer's short
label: "Their threat", "Their reply", "Calculation", "Your tactic", plus a clock
icon for time trouble. No new sentences: explanation text stays with #88 and
PR #107.

**Progress.** The existing "Stop hanging pieces" unit (blunders per game) gains a
breakdown of the selected period's blunders and mistakes by layer, as a stacked
bar with counts, the largest named as the focus ("Most of your blunders: their
threat"). Each segment links to Games filtered to those moves. Spotted-threat
rates from the drill show beside it as the habit's training measure.
Lower blunders per game remains the outcome measure.

As built: the rate shows in the "Stop hanging pieces" unit as "Threats spotted: N
of M" with a meter, for the selected period. It counts each drill item's first
answer of a day (a same-day retry has seen the answer) by answer time.

**Selection.** `deck.queue`'s new-card order becomes (blunder first, then the
layer with most mistakes in recent rated games, then the missed-most pattern), so
practice leans toward the habit that is failing most.

## Contract

All additive.

| Endpoint | Change |
| --- | --- |
| `GET /api/deck` | Cards gain `threat` (`{threats}` when the move ignored a threat, else null); the deck gains `threat_item`, a question asked on its own (`kind` `threat` or `calm`, `color`, `fen_before`, `fen_prev`, `prev_uci`, `threats`), served instead of a card when it is its turn; `today` counts both. |
| `POST /api/threats/answer` | New. `{game_id, ply, answer, seconds, expected_day}` → `{correct, threats, rating, due}`. 409 on a new day, 422 for a move the opponent can't play, 404 for an unknown item. |
| `GET /api/games/{id}` | Learner moves gain `layer` and `time_trouble`. |
| `GET /api/overview` | Adds `layers: {kind: count}` for the period and `threats_spotted: {found, asked}`. |

Zod validates every threat move as legal from the null-move position, SANs, and
known layer strings; invalid entries are dropped.

## Costs

| Where | Added engine work | Cap |
| --- | --- | --- |
| Drill items | 1 threat search per candidate (threat items reuse the layer step's) | `MOVE_TIME` per line; `THREAT_BATCH` per run |
| Layers | ≤ 2 searches per learner mistake | `DEEP_DEPTH`; `LAYER_BATCH` per run |

## Verification

Backend pytest with real positions and injected `analyse` fakes; expected answers
come from the positions:

- Threat search: a hanging piece and a mate threat are found; a pawn-only threat and
  an even trade are not threats; a capped search is unknown, never "no threat"; in
  check returns nothing.
- Layers: one fixture each for `theirThreat`, `theirReply`, `calculation` and
  `ownTactic`, plus near misses (the refutation is a different move; the loss comes
  after ply 3 on a quiet move); time trouble at 10% and 30 s boundaries.
- Drill: calm items are about a quarter of new items; the server re-grades answers
  and rejects a stale day; threat items never appear while unknown.

Jest: the threat answer is judged from the served set; "No threat" on a calm item
is correct; Not quite plays the threat then resets; the second step appears only
for threat items; stale answers after exit or account switch are dropped.

Device checks: entering an opponent move on the board reads clearly as "their
move" (colours, VoiceOver label "Play their threat") and large text.

## Open

- Whether calm items at a quarter of new items is the right share; adjust after a
  few weeks of answers.
- Layer 3 (positional) tagging needs human-concept detection or a human-move model
  (Maia) and is a separate spec.
