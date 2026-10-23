# Blunder causes, candidate moves and principles

Approved (October 15, 2026). Implemented for practice and the review's Every move
screen; review find steps and tapping a candidate are not (see As built). Builds on
[safety-habit training](2026-10-16-safety-habit-training-design.md), which owns the
threat search, the mistake layers, their counts and practice selection.
[Coaching explanations](2026-10-15-coaching-explanations-design.md) (#88) say
*what* a wrong move allows ("That drops your rook to Bxf7"); this spec adds the
sentence that says *why the learner missed it* ("They were already threatening
Bxf7") for each layer-0 mistake, the top two or three moves with a reason each,
and principle labels that name the habit or idea behind each layer.

The honesty rule of #88 holds unchanged: every sentence is a fixed template filled
with facts that an engine search or board geometry established and that replaying
the stored line can check. When no fact holds, nothing is said. Nothing is
generated freely; a later LLM layer may only rephrase the same fields.

## Scope

- **Practice** (own-game cards): wrong first moves gain a cause; the served map
  gains the top candidates. Lichess puzzles keep #88's feedback: their wrong tries
  are rarely real blunders and a cause search per puzzle is not worth its cost.
- **Game review**: find steps get #88's explanations (reply played first, reason,
  why) from the same card map practice uses, plus causes and candidates. The
  played mistake or blunder itself gets a cause on its Every move screen.
- Out of scope: counting and practice selection (owned by safety-habit training), Lichess
  themes not already stored, later moves of a multi-move practice line (as in #88).

## Causes

A cause explains a move graded `wrong` in practice, or a game move classified
`mistake` or `blunder`, from the learner's side. Causes refine the mistake
layers: `missedThreat` is the sentence for layer `theirThreat`; `backRank` and
`loosePiece` are sentences for layer `theirReply`. Facts are checked in this order;
the first that holds is the cause. `{reply}` is the engine's punishing reply in
SAN, `{piece}` and `{sq}` name a learner piece and its square.

### 1. Missed their threat (`missedThreat`)

**Search.** The shared threat search of safety-habit training, in the position
*before* the learner's move: a set of threat moves, empty, or unknown when capped
(uncertainty is not evidence, as in #88).

**Holds when** the move's layer is `theirThreat`, that is all of:

1. The threat set is not empty.
2. The learner's move left it standing: the refutation's first move (the PV of the
   search that graded the move, as in #88) is in the threat set. `{reply}` is that
   move and `{piece}` comes from its threat line.
3. The refutation itself mates or nets them at least `threats.LOSS` (2).

All three are engine facts about the stored lines. If the engine punishes with a
different move, the move created a new problem and this cause is not claimed.

| Variant | Text |
| --- | --- |
| Threat is mate | "They were threatening mate with {reply}, and your move didn't stop it." |
| Threat wins a piece | "They were already threatening {reply} to win your {piece}. Your move didn't stop it." (`{piece}` is the most valuable learner piece the threat line takes within its net, as #88's `_won`.) |
| Threat wins material | "They were already threatening {reply}. Your move didn't stop it." |

### 2. Back rank (`backRank`)

**Holds when** the refutation scores mate for the opponent, the PV replays to
checkmate, and `patterns._back_rank` holds in the final position (the learner's
king on its home rank, mated along it).

Text: "Your king had no escape square off the back rank, so {reply} leads to mate."
For mate in 1: "Your king had no escape square off the back rank: {reply} is mate."

### 3. Loose piece (`loosePiece`)

Geometry only, confirmed by the engine's line: the piece is claimed only when the
refutation's prefix actually takes it.

**Loose** (in the position after the learner's move, opponent to move): a learner
piece worth at least a minor piece (`patterns.TARGET`), not the king, that the
opponent attacks and that is

- **undefended**: no learner piece attacks its square; or
- **attacked by a cheaper piece**: the cheapest attacker is worth less than it; or
- **outnumbered**: more attackers than defenders (`board.attackers` counts;
  x-rays and pins are ignored, so the count is stated, not a full exchange
  evaluation).

**Holds when** a piece is loose after the move, was not loose by the same test
before it (the move made it loose: the piece moved there, or its defender left),
and the refutation's prefix (`REFUTE_PLIES`, recaptures followed) captures it with
the opponent netting at least `threats.LOSS`. The most valuable such piece is named.

| Variant | Text |
| --- | --- |
| The moved piece went to an undefended square | "Your {piece} on {sq} has no defender there, so {reply} takes it." |
| The moved piece was its only defender | "Moving your {mover} left your {piece} on {sq} undefended, so {reply} takes it." |
| Cheaper attacker | "Your {piece} on {sq} can be taken by a {attacker}, so {reply} wins it." |
| Outnumbered | "Your {piece} on {sq} is attacked {a} times and defended {d} times, so {reply} wins it." |

Otherwise there is no cause; #88's reason (fork, pin, material, eval) stands alone.

### Misses

A game move classified `miss` has no punishing reply, so it gets no cause
sentence. Its layer (`ownTactic`, or none) comes from safety-habit training.

## Candidate moves

**Search.** The practice worker's grade map (`practice_grades.compute`) begins with
one root search from the card position at `JUDGE_DEPTH`, `multipv=3`, capped at
`MOVE_TIME` per line. It costs about one more search per card; the per-move
grading loop is unchanged. A capped line (depth below `JUDGE_DEPTH`) is dropped,
and with fewer than two lines left there is no comparison. Game analysis keeps
`multipv=2`: raising it would slow every analysed position, and candidates are
only shown where a card exists.

**Reasons.** Each candidate's line (first `REFUTE_PLIES`) is explained in order:

| `reason_kind` | Holds when | Text |
| --- | --- | --- |
| `mate`, tactic themes, `material` | #88's `explain.why` holds for the candidate's line. | #88's why text ("Fork: the knight hits king and queen.", "This wins a knight."). |
| `defends` | A threat exists (cause 1's search, rule 1) and the candidate's line nets the opponent less than `threats.LOSS` and no mate. | "Stops their threat {threat_san}." |
| `trade` | The learner is at least `AHEAD` (2) points up in material on the board, and the line's first two plies are a capture and a recapture of equal value. | "Trades {piece}s while you're ahead." |
| `eval` | Nothing above. | "Keeps you ahead ({eval})." / "Keeps it level ({eval})." / "Holds on best ({eval})." by the score's band (≥ +1.0, within ±1.0, below −1.0). |

**About equal.** Candidate 2 or 3 is *about equal* to the best when neither scores
mate and their centipawn scores differ by at most `EQUAL_CP` (30), or, when both are
beyond ±500, their win chances differ by at most `deck.GOOD_DROP`. Its row then
reads "About as good as {best_san}." in place of its `eval` text. When every shown
candidate is about equal the heading is "Several moves work here" instead of "Top
moves". These scores also already grade such moves `good` or better, so the
comparison never contradicts the verdict.

Candidates are hidden until the step is answered or shown, as All moves'
`MovesGuard` hides the best move: they appear on the Right and Not quite sheets'
**Why?** view and on Every move / Best screens for the ply.

## Principles

Principles are fixed labels that name what to do differently, shown with the
cause. Each belongs to a layer of the safety-habit map; counts and practice
selection are per layer and live there, so this spec stores no principle column.

| `principle` | Label | Shown for | Layer |
| --- | --- | --- | --- |
| `blunderCheck` | Before you move: what does their move threaten? | cause `missedThreat` | 0 `theirThreat` |
| `checkReplies` | After your move: what are their checks, captures and threats? | layer `theirReply` without a cause below | 0 `theirReply` |
| `backRank` | Give your king an escape square | cause `backRank` | 0 `theirReply` |
| `loosePieces` | Loose pieces drop off | cause `loosePiece`, or #88 reason `hangingPiece` | 0 `theirReply` |
| `forcingFirst` | Look at checks and captures first | layer `ownTactic` | 1 |
| `checkTheEnd` | Look at the final position of your line for their reply | layer `calculation` | 2 |
| `tradeWhenAhead` | Trade pieces when you're ahead | the best candidate's reason is `trade` and the played move is not the best | 3 (label only) |

The label shows as a tag on the Not quite sheet and in the review's coach bubble
title row, beside #88's tactic tag and the layer label. Labels are fixed strings in
the app keyed by `principle`; the server sends only the key, derived from the
cause and layer when the move is served. More positional labels come with the
layer-3 spec.

## Where it is computed

Only workers search; GETs read caches, as in #88.

**Practice maps.** `practice_grades.compute` adds the threat search and the
MultiPV root search before the per-move loop, attaches a `cause` to each wrong
move's explanation, and stores `threat` and `candidates`. `VERSION` becomes 3 (every
map rebuilds once; meanwhile the app falls back as for a missing map) and the
fingerprint adds `EQUAL_CP` and `AHEAD`. The root searches run first so they are
present even when `CARD_TIME` cuts the per-move loop short.

**Game moves.** The safety-habit `layers` step already runs the threat search and
the refutation for each learner mistake and blunder. It also stores the threat set
and the refutation line in `moves.cause_facts`, and this spec's `causes` module
writes `moves.cause` from those stored lines with geometry only: no extra search.
Rows whose layer is unknown (capped) get no cause.

**Cost limits.**

| Where | Added engine work | Cap |
| --- | --- | --- |
| Practice map | 2 searches per card (threat, MultiPV=3 root) | `MOVE_TIME` (2 s) each, inside `CARD_TIME` (30 s); `BATCH` unchanged |
| Game moves | none beyond the `layers` step's | — |
| Cause and candidate templates | none (geometry and replay of stored lines) | — |

## Contract

All additive; clients that ignore the fields keep working. The next migration adds
`moves.cause jsonb` and `moves.cause_facts jsonb` (the layer step's threat set and
refutation line).

**`card.feedback`** (version 3, also `GET /api/deck/feedback/{game_id}/{ply}`):

| Field | Meaning |
| --- | --- |
| `explanations[uci].cause` | `{cause_kind, cause_text, principle}` or absent. `cause_kind` ∈ `missedThreat`, `backRank`, `loosePiece`. |
| `explanations[uci].principle` | Principle key when one holds without a cause (`loosePieces` from `hangingPiece`), else absent. |
| `threat` | `{uci, san, line}` from the null-move search, or null. |
| `candidates` | Up to 3 `{uci, san, line, score_cp, mate, reason_kind, reason_text, about_equal}`, best first, or absent. |

**`GET /api/games/{game_id}`** adds, per learner move row, `cause` (`{cause_kind,
cause_text, reply_uci, reply_san}` or null) and `principle` (key or null).

**`POST /api/deck/answer`** adds `cause` and `candidates` from the cached map
alongside #88's `explanation` and `why`, so the server-graded path matches.

The Zod contract validates every `uci` and `line` as legal from its start position
(`fen_before`, the null-move position for `threat`), every SAN as that move's SAN,
kinds and principles as known strings, `about_equal` only on candidates 2–3, and
texts at most 120 characters. An invalid entry is dropped, not shown.

## App behaviour

- **Practice wrong first move:** as #88 (move stays, reply plays in after 280 ms,
  sheet opens). The coach bubble shows `cause_text` when present, else
  `reason_text`; cause texts name the reply, so nothing is lost. The sheet shows
  the principle tag.
- **Game review find steps** adopt #88's practice behaviour: the review fetches
  the card's map with `GET /api/deck/feedback/{game_id}/{ply}` when the step opens
  (stale guards as for `/lines`), plays the reply on a wrong first move, and shows
  the cause or reason in the coach bubble. Without a map, today's behaviour.
- **Every move screen of the played mistake or blunder:** the coach body is the move's
  `cause_text` when present, else today's `/lines` explanation, with the principle
  tag.
- **Why?** (Right, or after Show me) lists the candidates under "Top moves" or
  "Several moves work here": SAN, eval chip, reason. Tapping a row plays its line
  as Best does.
- The coach bubble keeps its fixed height (one title line, two body lines); a cause
  text is at most 120 characters to fit.

## Verification

Backend pytest with injected `analyse` fakes and real positions; expectations come
from the positions, not the code under test:

- `missedThreat` fires when a loose piece was already attacked and the learner
  played elsewhere; not when the refutation is a different move, the threat is
  capped, the learner was in check, or the threat wins less than two points.
- `backRank` fires on a real back-rank mate and not on a mate off the home rank.
- `loosePiece` fires for each variant; not when the piece was already loose before
  the move (that is `missedThreat` or nothing), not when the line recaptures evenly,
  and not when the line never takes the piece.
- Candidates: capped lines are dropped; `about_equal` at 30 cp and not at 31;
  `trade` only when ahead; texts never exceed 120 characters.
- Each principle key follows from its cause or layer, and none is sent for an
  untagged move.
- Version 3 and constant changes invalidate maps; a game row with an unknown layer
  gets no cause; the `causes` module runs no search; no GET runs a search.

Jest: contract drops illegal threats, candidates and unknown kinds; the bubble shows
the cause in place of the reason; review find steps play the reply from the served
map and ignore a late map after exit or account switch; candidates stay hidden
before the step is answered. No new browser e2e (presentation is reviewed in
Storybook (**Review / Game review**) and on device).

## As built

- `causes.py` holds causes, principles and candidates. A game move's cause is built
  when `GET /api/games/{id}` is read, from `moves.cause_facts` (the layer step's
  stored threat set and refutation) with geometry only, instead of a stored
  `moves.cause` column: no migration, and wording changes apply at once.
- Practice: the bubble shows `cause_text`; the Not quite sheet shows the principle
  label as its tag. After an answer (or with the solution after a miss) the answer
  sheet has **Why?**, which swaps the line's ‹ › steps for the candidates and puts
  "Top moves" or "Several moves work here" in the sheet's title, so the sheet keeps
  its height on a phone. Tapping a row plays its line from the position, 800 ms a
  move as the solution does, and marks the row; **Line** puts the solution back.
- Review: the played mistake's coach bubble shows `cause_text` on look steps and
  Every move. A find step fetches the card's map (`GET /api/deck/feedback/{game_id}/{ply}`)
  when it opens; a wrong move with an explanation plays their reply about 280 ms
  later, the bubble shows the cause (or the reason) and Not quite the habit. A map
  arriving after the step closed or the account changed is dropped; without one
  the find keeps its plain "Not quite".
- "Attacked twice and defended once": counts read as words, not "1 times".

## Positional reasons

A candidate with no tactic and no material in it used to fall through to `"eval"`, which
prints the engine's number -- the one thing a learner can already read for themselves. That
was most of them.

Measured against the [Steps Method](https://www.stappenmethode.nl/en)'s 62 base lessons
(steps 2-5, beginner to 2000), the reason vocabulary expressed 13, and nearly all of those
sit in step 2. Coverage by step: 58% at step 2 (to 1400), then 12%, 6% and 19%. The coach
could talk to a beginner and went quiet from about 1400 up, exactly where the curriculum
turns from tactics toward position.

`positional.py` adds the missing words, in `ORDER`, most specific first: `kingSafety`,
`seventhRank`, `outpost`, `openFile`, `space`, `development`, `connectedRooks`. Every one is
*measured* from the board -- whether a knight left the back rank, whether a file has pawns on
it, whether any pawn can ever attack a square again. No model, so no hallucinated reason; a
wrong explanation teaches a wrong idea and the learner cannot tell.

Soundness comes from the caller: these run only on moves the engine already placed in its top
three, so the module never recommends, it only says what kind of good a move is. Where it has
no word it returns None and the old fallback stands.

On the engine's best move across 2,592 production mistakes it names an idea in 22% (space 6.7%,
open file 5.3%, development 3.4%, seventh rank 3.0%, connected rooks 2.3%, king safety 1.0%,
outpost 0.4%). In the live path tactics are still tried first, so this overlaps the tactical
share rather than adding to it cleanly.

## Open

- The ~78% with no positional word yet: the preparatory tactics the Steps Method teaches
  across three separate steps (eliminating the defence, luring, interference, clearance,
  blocking, the magnet) and the endgame ideas (pawn race, breakthrough, rook endings, key
  squares). Those are the next vocabulary, and the harder half.
- Weak and backward pawns, mobility and prophylaxis are measurable but not yet measured.

- Whether a missed threat that the refutation answers with a move outside the
  threat set but equally winning should still count (currently not claimed).
- Storing `defensiveMove` puzzles so `blunderCheck` has a theme.
- Wording review with the learner once real causes appear in their games.
