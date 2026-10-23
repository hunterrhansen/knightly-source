# Session-end beats

Approved for implementation ([#86](https://github.com/hunterrhansen/knightly/issues/86)).
The end of a practice session, the end of a game review and the daily review's
between-steps screen become short full-screen beats, one idea per screen, in
place of a plain stats list. The model is Duolingo's lesson end (Android 6.101.2,
chess course): one dominant colour per beat, a short coach line, and a primary
button held back until the entrance lands. Knightly keeps its own mark, moon,
fonts and colours; no Duolingo art, fonts or sounds.

## Beats

A session ends on a sequence of a few beats. Each beat fills the screen
(no header or tabs), centres its content in the reading width, scrolls when large
text makes it taller than the screen, and pins one full-width primary button at
the bottom. Beats advance only on that button; nothing advances on a timer.

0. **The watch's end** (the daily lesson only, when a move held tonight): over
   the wall, before Results.
1. **Results** (always, when the session has results).
2. **Streak extended** (only when this session extended the streak).
   Proposed: when no watch is set and the ask is due, **Your watch** follows it
   ([Asking for the watch](2026-10-18-watch-time-anchor-design.md#asking-for-the-watch)).
3. **Rank up** (only when this session's stars reached a new rank; see
   [Stars and ranks](2026-10-18-watch-story-design.md#stars-and-ranks)). It
   replaces Long-term memory, which it already tells.
4. **Long-term memory** (only when this session moved positions into long-term
   memory and no rank was reached).

The last beat's button is the session's exit: **Done**.

### Results

- Title ("Practice complete", "Review complete") and a coach line beside the
  brand mark, chosen from the numbers (no praise for a session of misses).
- Up to three **stat cards** side by side. Each card has a coloured header band
  with a caps label, over a surface-coloured inner panel with an icon and the
  value, with a 2 dp border in the band colour:

  | Card | Colour | Value |
  | --- | --- | --- |
  | Found | brand green | answers found without help (found/good marks, solved puzzles) |
  | Accuracy | gold | found ÷ answered, whole percent |
  | Time | sky | this visit's session time, `m:ss` |

  Time is measured on the device from the first exercise shown in this visit to
  completion; it is not stored or sent. When it was not measured (the session was
  already complete when opened), the third card is **To revisit** (sky, missed
  count; **Missed** for a puzzles-only session, since missed puzzles do not return). Game review with no find steps shows **Moments** (reviewed steps) and
  Time only.
- **With points** (approved Oct 17, 2026, practice rewards canvas, "Session
  end"): when the session earned pattern points, the cards are **Points** (gold,
  counting up from 0 over 900 ms after the cards land, with a light tick every 10
  points), **First try** (brand green, the same found ÷ answered percent) and the
  third card as above. Under the cards a small breakdown fades in: "N first
  tries +N", "N with help +N", "Run bonus +N" and "Perfect session +20" (every
  answer of at least five a first try), leaving out empty rows. Sessions without
  points keep Found and Accuracy. Under reduced motion the number shows straight away.
- The per-position results list moves behind a **See details** control under the
  cards (it expands in place). Game review's **Review again** is a quiet link
  under the button.
- Cards pop in one after another (`pop` spring, 120 ms apart) and a shine
  sweeps each as it lands; the button fades in after the last card lands
  (~1.1 s). When the Points count finishes, its card sparkles gold and shines
  again with the `reward` cue; without a count, the last card's landing plays
  the `land` cue.
- Sessions that ended with nothing answered (nothing due, no puzzles) keep the
  existing quiet message, without beats.

### Streak extended

Shown only when the streak grew during this session, from the server's numbers:
`/api/home` `today.streak` read after the session screen mounted (before) and
again after the session's final save (after). The beat shows when both reads are
for the same `day`, before was not `safe_today`, after is, and `after.count >
before.count`. Unknown, failed or stale reads show no beat; the client never
infers or increments the count itself.

Knightly's streak symbol is the moon ("N nights in a row"), so Duolingo's flame
becomes the moon. Choreography (about 4.5 s, all from `tokens.motion`):

| At | Beat |
| --- | --- |
| 0 | The old count's moon phase, dimmed, and the old count |
| 0.5 s | The moon waxes to the new count's phase and pops (`celebrate` bounce), sparkling with the `reward` cue as it peaks; the number rolls N → N+1 (`settle` spring) |
| 1.4 s | Brand mark pops in beside "nights in a row" |
| 2.0 s | This week (`StreakCalendar`) fades in with today still an empty dashed socket |
| 2.6 s | Today's moon drops in with a bounce and lights with sparkles and the `land` cue as it touches down |
| 3.8 s | Share (native only) and the primary button fade in |

The moons are the phases from
[Today's moon phases](2026-10-13-today-daily-review-design.md#streaks-and-freezes):
night N's phase is `((N − 1) mod 7) + 1`, a count of 0 the new moon. Besides
the calendar's earned moons, the streak moon is the only gold on this view, per
Today's gold rule; the week's done days are the same moons as Today's. Milestone confetti (7, 30, 100, 365) stays
on Today's Done and is not repeated here. Share uses the system share sheet with
"I've kept my Knightly streak for N nights."; web shows no Share.

### Long-term memory

When `today.memory.mastered_today` grew between the same two reads, a sky beat:
a star badge drops in and sparkles with the `reward` cue, "N positions moved
to long-term memory" and "You won't see them for a while." No beat when the field is missing.

### Rank up

When `/api/home`'s `journey.rank` changed between the same two reads and
`journey.stars` grew (a rank reached without a new star, such as thresholds
lowered on the server, shows nothing): the rank's emblem
(`reward.rankEmblem.*`) drops onto a night-sky disc with gold sparkles and the
`reward` cue, "New rank", the rank name, "N moves from your own games have
stopped slipping since your first watch", the last three stars from
`/api/journey` (label, move and the day earned, read only when a rank was
reached) and "Next: {rank} at N stars". No confetti. Practice and game review
both show it.

### The watch's end

The daily lesson is the watch, so it ends over the wall
([kit stage 7](2026-10-18-watch-kit-design.md#build-plan-for-the-core-of-the-watch)):
the wall's `end` scene (`scene.wallHero`: raiders gone, gate shut, the knight on
lookout). His lantern brightens one step per move held tonight
(`fx.lanternBrighten`; from a low light to full at five held moves, so fewer
leave it partly lit), then "N raids turned back" lands over the gate
(`fx.turnedBack`, the `gateCaption` slot centred on the gate at any width) with
gold sparkles and the `reward` cue, and "Your lantern burns brighter for every
move you held." under the scene (`copy.watchEnd`). N is tonight's held moves
(`results` with `correct`, the count the Watch page's kept results show;
puzzles are not raids). Many held moves step faster so the beat stays near
three seconds. After 21:00 both recipes cross-fade without swelling or
bouncing; reduced motion shows the lit lantern and the caption at once. The
scene is labelled as a header with the caption and announced once. No beat
when nothing held. It plays on the session-end screen, after the lesson's
last answer, so it cannot move the board.

## Where beats appear

- **Practice** (`PracticeLayout`, the nightly and extra watches): replaces the
  complete state's Summary.
- **Game review** (`ReviewLayout` complete): replaces the Review complete page.
- Today's Done keeps its medal and confetti.

## Motion and accessibility

- The primary button (and secondary links) appear only once the beat's entrance
  has landed. Under reduced motion (`useSystemReducedMotion`) every beat shows
  its final frame at once and the button is available immediately.
- Each beat announces its title and values once when it appears (for example
  "Practice complete. Found 8, Accuracy 80%, Time 4:12"), and the title is a
  header. Decorative motion is hidden from assistive technology; the stat cards
  are single accessible elements ("Accuracy: 80%").
- Rolling numbers and the moon render their final value to assistive technology.

## Ownership

- Shared UI (`src/components/ui/`): `BeatFrame` (full-screen frame, gated button,
  one-time announcement), `ResultsBeat` with its `StatCard`s, the session-time
  and results helpers, the motion primitives (`PopIn`, `FadeIn`, `Ignite`,
  `RollingNumber`, `Beacon`), the reward effects kit
  (`reward-effects`), plus `StreakCalendar` (this week only, not navigable, for
  the beat) and `Moon`. Shared UI imports no feature.
- Today owns the before/after streak comparison (`sessionEnd`, pure),
  `useSessionEnd` and the `SessionBeats` sequence with its `StreakBeat` and
  `MemoryBeat`, `RankUpBeat` and `WatchEndBeat` (`session-end-beats.tsx`),
  exported through `today-api.ts`; the wall scene, its recipes and copy are
  the kit's (`WatchEndScene` in `src/components/kit/watch-end.tsx`);
  practice and review screens pass its result into their layouts. Previews and
  Storybook pass sample values.
- Practice and review own their stats and timing; grading and progress stay
  server-authoritative.

## Out of scope

Ads, upsells, chests, gems, energy, XP and quests; Duolingo art, fonts and sounds;
rating-change beats (no per-session rating data).

## Verification

- Logic tests: `sessionEnd` shows the streak beat only when extended on the same
  day; the beat frame withholds its button until the entrance lands and shows it
  at once under reduced motion; practice/review stats; raids turned back from
  held moves and the wall beat leading Results only when one held; the
  rank-up after a review only when it crossed a rank (`review-end.test.tsx`).
- Storybook: Results (three cards, fallback card), Streak extended, Long-term
  memory, Watch end (and narrow); 320 px, large text.
- Device checks (not covered by Jest or web): motion timing, reduced motion,
  VoiceOver announcements, large text and narrow phones on iOS; Android unrun.
