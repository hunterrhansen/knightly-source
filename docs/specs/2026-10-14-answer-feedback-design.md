# Answer feedback and momentum

Approved. Practice (positions and puzzles) and game review answer the same
way: a verdict sheet slides over the bottom bar, and the lesson's progress bar
carries a run of clean answers. The model is Duolingo's chess lessons, observed
on Android 6.101.2. Follow-ups are tracked separately:
[session-end beats](https://github.com/hunterrhansen/knightly/issues/86),
[board feel](https://github.com/hunterrhansen/knightly/issues/87) and
[engine explanations](https://github.com/hunterrhansen/knightly/issues/88). The
opponent's punishing reply to a wrong move needs that last one's backend
refutation and is not part of this slice.

## Verdict sheet

The shared `VerdictSheet` replaces the action bar while an answer's outcome is
on screen. It never resizes the board.

| Outcome | Sheet | Primary | Secondary |
| --- | --- | --- | --- |
| Solved without help | Green, ✓ and rotating praise | Continue (next position) | Why? (review only) |
| Solved with help or redo | Green, ✓ and "Solved with help" / "Found it" | Continue | as above |
| Solution shown | Green, no badge, "Here's the line" | Continue | as above |
| Wrong | Red, ✕ and "Not quite" | Try again | Solution / Show me |

- Every verdict reserves the same height (title, two body lines, the ‹ ›
  steps and the actions, buttons pinned to the bottom), so the sheet never
  changes size between answers; only Why?'s move list may extend it. On phones
  it already fills from the board's edge to the screen's.
- Every right answer sounds and looks the same: a practice puzzle, a review
  find and a spotted threat each play the correct sound, tint the move's
  squares and badge its destination with ✓. A right "No threat" has no square,
  so it only sounds.
- Praise rotates by attempt, not at random, so a render never changes it:
  Great find!, That's it!, Well played!, Excellent!, Nicely done!, Spot on!
- The coach bubble above the board keeps the explanation (the server's
  message, best move and saved state); the sheet carries only the verdict and
  the two actions, as on Duolingo, where the bubble explains and the sheet judges.
- Practice still steps through a finished line with ‹ ›: the steps move into
  the green sheet, above its buttons.
- When the sheet fills the space under the board on a phone, its buttons sit
  at the bottom, where the action bar keeps its primary button, as Duolingo
  keeps CONTINUE in one place on every screen.
- Every saved answer (server-graded, locally graded or a threat question)
  prefetches the next deck; once it has arrived, Continue opens the next
  position with no loading frame.
- While the next position still loads, the board holds the answered position
  read-only with its label, meta line, progress and a disabled action bar, so
  nothing shifts; then it morphs into the new one (nearby pieces slide, the
  rest fade). The sheet rises from the bottom edge and fades as the next
  position arrives; the coach bubble's words cross-fade and its border eases
  between tones; the session summary fades in.
- Saving, uncertain-save, error and complete states keep their existing
  action bars. The sheet is announced politely once.

## Progress bar and combo

Approved Oct 17, 2026 ([practice rewards canvas](https://claude.ai/artifact/25f2TkgVmeWy2pFaBuscC9),
"The progress bar" and "Motion" boards). Practice, puzzles, tactic training,
replay, the daily lesson's steps and game review all use the shared
`LessonTopBar`, one segment per item:

- **One row, as on Duolingo.** The bar carries ✕ (and review's list) with the
  points beside it; the screen's header bar is hidden (`LessonHeader hidden`
  keeps the title for assistive tech), so the board gets the header's room.

- **Fixed total.** The total is set when the session opens and the bar only
  moves forward. Regular practice counts today's positions and the session's
  puzzles as one run (positions, then puzzles), so the bar never switches
  totals between them. The lesson, a tactic session and replay keep their own
  counts.
- **Always segments.** Above 20 items the gap shrinks to 2 pt; above 40 the
  bar shows 20 segments that each fill in steps. The single continuous fill is gone.
- **Fill.** A newly done segment's fill eases from 0 to full over 300 ms
  (0.22, 1, 0.36, 1), then a light sweep crosses it (520 ms, 180 ms later).
  The answer's own success haptic covers it; the fill adds none. A run of
  clean answers colours its own segments together, easing over 400 ms: brand,
  gold from 5, flame from 7. A miss starts a new run, so earlier runs keep the
  colour they earned and a segment that broke a run stays brand.
- **Run label.** From 3 clean answers in a row, "N IN A ROW" pops (300 ms) above
  the start of the bar and stays while the run lasts; at 7 it adds "ON FIRE".
  A light haptic marks reaching 5 and 7.
- **Miss.** The current segment shakes once (360 ms, ±5 pt) and the run label
  leaves. Nothing moves back or changes colour; a missed item comes back as
  before.
- **Almost there.** With two items or fewer left, the current segment's
  outline turns gold and glows softly (1.4 s loop).
- **Complete.** The last fill lands and one sweep runs across the whole bar,
  with a success haptic.
- **Reduced motion** fills instantly and keeps colours, labels and haptics: no
  sweep, shake, pop or glow.

A **combo** counts consecutive clean answers in this session: correct on the
first try, without a hint or the solution. A redo answered without help also
counts. A wrong answer, hint, shown solution or assisted correct answer resets it
to 0. Review's look and praise steps leave it unchanged, and so does an answer
confirmed only through Check saved progress. Multi-move lines count once, when
the line is finished.

| Combo | Fill |
| --- | --- |
| 0–4 | Brand green |
| 5–6 | Gold |
| 7+ | Flame orange (`colors.flame`) |

The progress bar's accessible name is "N of M done", adding "N in a row" from 2
upward, announced once per change. This is the only gold on the practice view,
consistent with Today's gold rule. The combo is session state only: it is not
saved, sent or shown after the session. Review plays the same success and error
haptics as practice. Pattern points follow below; the session-end tally is the next step.

## Pattern points

Approved Oct 17, 2026 (practice rewards canvas, "Pattern points" and "Motion"),
after Chess.com's puzzle points (their guest-loaded puzzle code: the move
icon flies 500 ms from the square's corner to the bar, then bursts there).
Points are earned, predictable and session-only: not saved, sent or shown after
the session. One award per position (`PointsLedger`), so a re-judged answer
replaces its points rather than adding more.

| Answer | Points |
| --- | --- |
| First try, no hint or solution | 10 |
| With a hint, on a retry or in a redo | 5 |
| Missed or solution shown | 0 (never negative) |
| Run bonus: reaching 5 / 10 clean in a row | +10 / +20 |

- **Counter.** Practice and review show a star shard and the session total at
  the right of the lesson bar. A new award counts in when its shard lands,
  with a bump and a gold burst (500 ms), a two-note coin "ting" and a crisp
  (rigid) haptic tick.
- **Shard flight.** A star shard pops onto the solving move's square at its
  top-right corner (300 ms), then flies to the counter (500 ms from 350 ms,
  ease-in 0.5, 0, 0.8, 0), turning 90° and fading to 20%.
- **Run bonus.** After the shard lands, the board dims, a gold bloom grows past
  its edges (600 ms), and a shooting star showing "+10" over its head
  (`ShootingStar`) slams in from 2× (350 ms ease-in, at 700 ms, with a success
  haptic). "Run bonus" rises under it, then the star flies to the counter
  tilting 45° (500 ms from 1350 ms). The bonus counts in when it lands, with a
  brighter coin cascade and a medium haptic.
- **Verdict sheet.** A gold "+10" chip beside the title, and "+10 run bonus"
  when a run pays out. The chips pop in on the `pop` spring (the bonus 120 ms
  later) with gold sparkles and a shine, on the answer's own success haptic
  and correct sound, so they add no cue of their own.
- **Reduced motion.** No flight, slam, burst, sparkles or shine; the counter just
  updates, with its sound and haptic, and the chips show at once. Sounds follow the device's sound setting; both are
  original audio from `npm run sounds:generate`.
- Timings above are measured and fixed; the effects come from the shared
  reward kit ([foundation](2026-10-10-app-foundation-design.md)).
- Our own art (the star shard, `StarShard`); no Chess.com assets or sounds. The results beat
  shows the points, the breakdown and the perfect-session bonus
  ([session-end beats](2026-10-14-session-end-beats-design.md)).

## Header and lesson label

Practice titles its header **Puzzle**, **Practice** or **Daily lesson**.
Every pushed screen uses one header: the native navigation bar on iOS and
Android, and on web (and Android settings) `ScreenHeader`'s `bar` variant, a
single row with the title inline at the native 20 pt between icon buttons. Tab
root pages keep their large titles.

Above the coach bubble, a puzzle shows its rating as a lesson label (icon
disc plus caps text, sky blue: "RATED 1200"), as Duolingo marks "HARD PUZZLE".
A redo shows "ONE MORE GO" in gold instead. The rating no longer appears in the
meta line under the board.

## Ownership

`PracticeSession` and `ReviewSession` own `combo` beside their other
progression state; screens only read it. `VerdictSheet`, `LessonTopBar` and
`praiseFor` stay in shared UI with no feature imports. Session tests own the
counting rules; the components are reviewed in Storybook and on devices.
