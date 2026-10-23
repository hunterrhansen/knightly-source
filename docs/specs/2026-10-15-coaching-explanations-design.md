# Coaching explanations

Approved and implemented (issue #88, October 15, 2026). Practice answers explain themselves, as
Duolingo's chess lessons do: a wrong move first gets the opponent's punishing reply
on the board, then a short reason ("That drops your rook to Bxf7", "This walks into
mate in 2"); a correct answer gets a one-line why ("Fork: the knight hits king and
queen"). Every sentence is filled from a fixed template with facts the engine
search or board geometry already established. Nothing is generated freely.

## Why

Duolingo hand-writes one explanation per anticipated wrong move. Knightly already
runs the search that would write them: the worker grades every legal first move of
a card (`practice_grades`) at `JUDGE_DEPTH`, and each of those searches has a
principal variation whose first move is the punishing reply. `patterns.motif`
already names the tactic a move carries out. Today both are thrown away and a miss
says only "Not quite".

## Scope

- Own-game cards and Lichess puzzles in practice, **first learner move only**:
  the grade map covers only that move. A wrong later move in a multi-move line
  keeps today's plain verdict.
- A correct answer's why covers the whole line, own-game card or puzzle.
- Game review's find steps, bot play and LLM phrasing are out of scope. A later
  LLM layer may rephrase the same facts behind the same fields.

## Where it is computed

Only the worker searches; the deck GET and answer endpoints read the cache.

**Wrong first moves (cards).** `practice_grades.compute` keeps, for each move it
grades `wrong`, the first `REFUTE_PLIES` (6) of the search's PV and its score, and
turns them into an explanation (below). No extra search: the same `analyse` call.
`VERSION` becomes 2, so every map is rebuilt once by the worker; until then the
app falls back to server grading exactly as it does for a missing map. Moves graded
good or better, mates and moves whose search was capped get no explanation.

**Correct answer (cards).** After the line is built, `practice_grades` derives the
why from the line, `best_uci` and the stored `mate_before`/`eval_before` with board
geometry only (no search) and stores it in the same map. The map's fingerprint adds
the line's moves, so a changed line rebuilds it.

**Puzzles.** The why comes from Lichess's stored line, with no engine. Wrong-move
explanations need a search per legal move, so the `practice` job also prepares the
day's served puzzle (the deck GET enqueues the job while its feedback is missing,
as it does for cards) into a new
`puzzle_feedback (puzzle_id text primary key, value jsonb)` table in migration
`0012`, with the same fingerprint rules (version, FEN, line, engine revision,
depth, time caps). It carries only `explanations`, not grades: puzzles still
accept only the line or a mate.

The worker's existing caps apply: `MOVE_TIME` per move and `CARD_TIME` per
position. Captures and checks are searched first, so the likeliest wrong tries are
explained when the cap cuts a map short. A partial set is useful; a move without an
explanation shows the plain verdict.

## Templates

Facts are checked in order; the first that holds writes the reason. `{reply}` is
the reply in SAN; pieces are named in words ("rook", "knight"). The learner is
"you"/"your".

| `reason_kind` | Holds when | Text |
| --- | --- | --- |
| `mate` | The search's score after your move is mate for them in N (the same score that graded it). | "This walks into mate in N." (N = 1: "This allows mate: {reply}.") |
| `fork`, `pin`, `skewer`, `discoveredAttack` | `patterns.motif` names the reply's tactic **and** the PV prefix nets them at least a minor piece (below). | "{reply} forks your king and queen." / "{reply} pins your knight to your queen." / "{reply} skewers your king and rook." / "{reply} uncovers an attack on your queen." Targets come from the same geometry `motif` used. |
| `hangingPiece` / `material` | The PV prefix (your move included) nets them material. | "That drops your rook to {reply}." (the most valuable piece of yours they take that the net covers), else "That loses the exchange to {reply}." or "That loses material to {reply}." |
| `missed` | Nothing above, you stay within a pawn, and the solution has a why. | "Safe, but there’s a stronger move here. Look for a way to give mate." / "…to win material." / "Look for a tactic." Never names the move before the answer is shown. |
| `eval` | Nothing above and they are at least a pawn better afterwards. | "That lets them take over after {reply}." |

Otherwise there is no reason and the verdict stays plain.

**Material in the PV prefix.** Play your move and the first `REFUTE_PLIES` moves of
the PV and sum piece values (`patterns.VALUES`, promotions as the piece gained)
captured by each side. A capture sequence running past the prefix is followed to
its end, so a trade plus recapture is not counted as a loss. The net is a fact of
the engine's own line, checkable by replaying it.

**Correct answer why.**

| `why_kind` | Holds when | Text |
| --- | --- | --- |
| `mate` | The line ends in checkmate, or `mate_before` says you mate in N. | "Mate in N." / "Checkmate." |
| tactic theme | `patterns.in_line` finds your tactic in the line. | "Fork: the knight hits king and queen." / "Pin: the bishop pins the knight to the queen." / "Skewer: …" / "Discovered attack: …" / "The rook was loose." |
| `material` | Your line nets material, and its last capture can't be retaken. | "This wins a knight." / "…the queen." / "…the exchange." / "…a pawn." |
| none | Nothing above holds. | No why; the verdict's praise stands alone. |

Puzzles use the same geometry; Lichess's theme tag already shows on the verdict, and
a theme the geometry can't confirm is not claimed.

## Contract

All additive. Clients that ignore the fields keep working.

`card.feedback` (version 2) and the new `puzzle.feedback` add:

| Field | Meaning |
| --- | --- |
| `explanations` | `{uci: {reply_uci, reply_san, reason_kind, reason_text}}` for first moves graded wrong. Present keys only; missing means plain verdict. |
| `why` | `{why_kind, why_text}` for the solution, or null. |

`puzzle.feedback` is null until the worker prepares it and carries no `grades`.
`POST /api/deck/answer` and `POST /api/puzzles/answer` add `explanation` (the
cached one for the failed first move, else null) and `why` on solved/shown
results, so the server-graded fallback path shows the same text.

The Zod contract validates every `reply_uci` as legal after the wrong move from
`fen_before`, `reply_san` as its SAN, and the kinds as known strings; an invalid
entry is dropped, not shown. Texts are at most 120 characters.

## App behaviour

- **Wrong first move with an explanation:** the move stays on the board
  (`refuting`, input frozen), the reply plays in as an `opponent` transition after
  the usual 280 ms (stale guards as for `continue`), then the "Not quite" sheet
  opens and the coach bubble shows `reason_text`. The wrong move's squares stay
  red. Try again restores the position before your move. Without one, or with a
  reply that isn't legal there, today's behaviour. The **Practice / Daily practice** story's third
  sample (…Nf6) shows it.
- **Correct answer or reveal:** the coach bubble shows `why_text` under the
  praise; the verdict sheet is unchanged (its tactic tag stays).
- Instant grading ([instant practice](2026-10-15-instant-practice-design.md))
  takes the explanation from the served map, so reply and reason show without a
  request; the answer response's copy is used only on the server-graded path.

## Verification

Backend pytest with injected `analyse` fakes and real positions: each template
fires on a position where it holds and not on near misses (a trade with recapture
is not "drops"; a fork that wins nothing is not claimed); mate-in-N matches the
score; `missed` never contains the best move's SAN; capped searches give no
explanation; the version bump and line change invalidate maps; puzzle feedback is
per user and never computed on a GET.

Jest: the reply plays after 280 ms then the sheet opens; exit or account switch
during the reply discards it; an illegal served reply is dropped; text appears in
the bubble for wrong and correct answers; a later-step miss stays plain. No new
browser e2e: reply timing is animation behaviour reviewed in Storybook
(**Practice / Daily practice** samples) and on device.
