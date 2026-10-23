# Instant practice answers and hints

Approved (requested by the user on the iPhone beta, October 15, 2026). Practice
moves and hints respond instantly, as Lichess puzzles do: each position arrives
with its precomputed solution, the app judges moves and gives hints from it, and
the finished answer is saved in the background. The server still re-grades every
saved answer and owns scheduling, puzzle records and streaks.

## Why

Every grade and hint was already precomputed: puzzles keep their Lichess line,
and own-game cards keep their solution line and a grade for each legal first move
(`practice_grades`, built by the worker). Yet each move and each hint waited on a
network round trip, and every move of a line was a separate request. Lichess
sends a puzzle's solution with the puzzle, validates moves in the browser and
posts the result when it ends. Hiding the solution bought little: `line_key`
already identified it, and Knightly has one user training for themself.

## Contract

`GET /api/deck` adds, without changing existing fields:

| Field | Meaning |
| --- | --- |
| `card.line` | The solution line from `fen_before` (UCI, learner moves at even indexes), the same one `line_key` names. |
| `card.feedback` | Already sent: the first-move grade map `{grades: {uci: quality}, complete}`, or null while the worker prepares it. |
| `puzzle.line` | The puzzle's solution from `fen_before`, the same one `line_key` names. |

The client validates each line (legal from `fen_before`, odd length, matching the
key it is served with is the server's job) and ignores a malformed one.

The app reads `GET /api/deck` after every saved answer to prefetch the next
position, so it stays cheap: it adds cards and tags tactics only when game analysis
has written moves since its last scan (the per-user `analysis_version` setting), and
works out today's queue once. It and `POST /api/deck/answer` send a `Server-Timing`
header of stage durations (no moves or ids) for measuring Continue latency.

## Behaviour

The client mirrors `practice_lines.step` exactly:

- The line's move continues: the opponent's reply plays in after the usual 280 ms,
  with no request.
- Any checkmate, or the last move of the line, solves it.
- On an own-game card, a first move that isn't the line's takes its grade from the
  map: best, excellent or good solves; wrong fails.
- Anything else fails.
- When the grade map is missing or incomplete and the move isn't in it, the app
  falls back to the server-graded path (the move shows as checking until the
  answer returns). The worker keeps preparing maps as today, so this is rare.

A finished answer (solved, failed or shown) shows its verdict at once and is posted
to the existing answer endpoint with the whole move list, `hinted`, `redo` and
thinking time. Intermediate moves are not posted; the server saved nothing for
them before either. Saves run one at a time in answer order, so a retry never
reaches the server before the first attempt it follows.

- **Server agrees:** nothing changes on screen; the save is acknowledged.
- **Server disagrees** (a stale map or line): the server's verdict replaces the
  provisional one.
- **Save fails or is uncertain:** Continue waits for it, then shows the existing
  uncertain-save recovery; no answer is resent.

Hints come from the line: the piece of the current step's move, then its arrow,
with no request. Asking still marks the answer assisted, sent with the answer.

When a save completes, the next deck is fetched in the background, so Continue
opens the next position without waiting.

Game review's find steps keep their server-graded flow for now.
