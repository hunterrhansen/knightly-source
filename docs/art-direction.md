# Art and motion direction

Proposed. The brief for commissioning or guiding Knightly's illustration,
animation and UI sound. The look is Duolingo's friendly, flat 2D UI. The motion
and reward feel come from Supercell's games (Clash of Clans, Clash Royale):
chunky, warm, tactile and celebratory. Everything is original Knightly
work. Never trace, paint over, sample or imitate Supercell characters,
icons, fonts, sounds, logos or screen layouts, and never use their
assets as references inside delivered files. The same rule applies to Chess.com
and Duolingo (see [asset licenses](../assets/licenses/README.md)).

What already exists and is kept: the cream/green identity, Fredoka 600 headings,
Nunito 600/800 body, the colour roles in `src/theme/themes.ts` (`brand`
`#6cc23a`, `gold` `#ffc233`, `sky` `#49a8f2`, `flame` `#ff9600`, each with a
darker `…Ledge`), the 4 dp ledge under pressable controls, the moon streak symbol,
the brand mark (knight and moon on a 2×2 green board), and the Knightly piece
set (geometry and side colours in `tokens.pieces`). The Classic cburnett pieces
stay the default board set and are not restyled (CC BY-SA 3.0).

## Purpose

Art, motion, sound and story serve the premise and filter in
[Knightly direction](knightly-direction.md): every idea must bring people back,
make feedback clearer or make progress visible. That document also holds the
story (the night watch, later relight the sky), the references and the night
theme's tone. This brief covers how the art and motion are made.

## Illustration style

- **Outline.** One dark, warm outline on every illustrated object (pieces use
  `tokens.pieces.outline` `#24211c`), thick enough to read at 24 pt: about 6–8%
  of the object's height, slightly heavier on the outer silhouette than inner
  detail lines. No hairlines.
- **Silhouette first.** Each object is recognisable as a solid black fill at
  24 pt. Big simple shapes, exaggerated proportions (heads, star shards and
  chest lids oversized), no thin protrusions that break at small sizes.
- **Palette.** Saturated, warm and limited: build every object from the theme
  roles above plus one shadow and one highlight step each. No neon, no
  desaturated greys on reward items, no gradients across more than two steps.
  Objects must read on the dark page (`#161513`); Knightly has no light theme
  ([dark-only theme](technology-decisions.md#dark-only-theme)).
- **Light.** Soft light from top-left: a broad highlight shape on the upper
  third, a cel-shaded core shadow on the lower right, a thin rim of reflected
  light on dark materials. Matches the ledge: things look like they sit on the
  surface and could be pressed.
- **Detail budget.** Detail lives in the top half of an object where the eye
  lands; the lower half stays simple. Texture is drawn shapes, not noise or
  photo textures.

Applied to:

| Subject | Direction |
| --- | --- |
| Knightly pieces | Keep current geometry and side colours; add the top-left highlight and lower-right shade as shapes, thicken outlines to the rule above. Each piece readable at a 40 pt square. Ships as one atlas (see the [layered board](specs/2026-10-15-layered-board-design.md)). |
| Icons (tabs, stats, controls) | Same outline and light as pieces, filled not line-art, on a 28 pt grid. Tab icons keep the existing glyph shapes. Locked for the moon, Games, Progress, the Progress tile's star and the Settings gear (`glyph-art.ts`, drawn by `KnightlyGlyph`; SVG masters from `npm run brand:generate`; no tab bar since the one screen). The line icons on buttons and stat cards (`ActionIcon`) keep their strokes over the same warm outline with a lower-right drop; dark ink draws without it. |
| Knight mascot | A friendly knight-horse character, original design, built from the brand-mark horse head. Large head, expressive eyes and brows, short body; reads at 64 pt. States: idle, thinking, cheer, encourage (after a miss, never mocking), sleepy (streak at risk), celebrate. |
| Star shard | Points award, one per solved move: a glint of the night sky the learner is relighting. Locked: a chunky four-point twinkle in lantern gold (`StarShard`, `assets/reward-art/star-shard.svg`). Four points keep it distinct from the five-point accuracy star, medal and constellations. |
| Shooting star | Run bonus, in place of a coin (it fits the night sky). Locked: the star shard streaking in with a tapered tail and two motion streaks, "+N" over its head (`ShootingStar`, `assets/reward-art/shooting-star.svg`). |
| Medal | Milestones (7, 30, 100, 365 nights). Locked: the full moon in a night-sky recess, set in a gold medal on brand-green ribbon tails (`MilestoneMedal`, `assets/reward-art/milestone-medal.png`). |
| Chest | Future reward container. Wood and gold banding, oversized lid, closed / shaking / open states with an interior glow. |

## Motion principles

All UI motion uses the shared tokens in `src/theme/tokens.ts`; animators match
them so drawn animation and code animation feel like one hand.

- **Anticipation.** A short wind-up opposite the action before it moves: a chest
  squats before it opens, a coin dips before it flies. 60–120 ms, never longer
  than the action.
- **Squash and stretch.** Volume is preserved. Presses squash by
  `squash.control` (3%) or `squash.surface` (1.2%); landings squash up to 15%
  for objects, then recover. Stretch along the direction of fast travel.
- **Overshoot.** Arrivals pass their rest and settle once (`springs.pop`,
  damping 0.55). Releases bounce once (`springs.release`). Calm movement such as
  repositioning uses `springs.settle` with no overshoot. One bounce, not three.
- **Follow-through.** Loose parts lag and settle after the body stops: ribbons,
  the mascot's mane and ears, sparkles drifting after a burst.
- **Timing.** `press` 80, `pop` 300, `sheet` 320, `fill` 400, `celebrate` 900 ms.
  Board travel is the exception: 180 ms linear (`move`), no squash, so moves
  stay crisp.
- **Never blocks.** Motion never delays a move, grade or the next exercise.
  Reduced motion shows the end state with colours, labels, haptics and sound
  intact; screens and sheets change with a fade rather than not at all.

## Reward juice checklist

Every reward moment (star shard, run bonus, streak, session end, milestone)
lands its layers on **one beat**: the frame the object hits its target.

- [ ] **Motion** — anticipation, travel, a squash on impact, overshoot settle.
- [ ] **Particles** — a short burst from the impact point in the reward's
      colour (gold for star shards and coins), 8–16 pieces, gone within 500 ms.
- [ ] **Flash** — a one-frame-to-150 ms bright bloom or white flash on the
      target, never full-screen white.
- [ ] **Sound** — the matching sound from the palette below, starting on the
      impact frame.
- [ ] **Haptic** — light for a single award, success for a bonus or milestone;
      never two haptics within 100 ms.
- [ ] **Count-up** — the counter starts on impact and rolls to the new value
      (900 ms for session totals), with a bump on the last digit.
- [ ] **Reduced motion** — instant value, no particles or flash; sound and
      haptic still fire.
- [ ] **Restraint** — at most one big moment on screen at a time; routine
      correct moves get the small version only.

## UI sound palette

Pop, count tick and fanfare are generated in code with the board sounds
(`npm run sounds:generate`) and wired in: session-end
cards pop and count with ticks, results
open on the full fanfare and a lit streak on the short one. A star shard landing
in the counter plays a recorded coin drop (CC0, see asset licenses); the run
bonus's coin cascade is still synthesized. A commissioned set
may replace them file for file; record its source and licence in
[asset licenses](../assets/licenses/README.md). Chest and a gentle-miss sound
remain to make. Button presses and app launch are silent for now (haptic
only); `launch.wav` is still generated but not played. Board sounds are built from CC0 recordings of real pieces (see asset
licenses): a move is a recorded piece landing, a capture a clack then the
landing, check a landing then a light tap, promotion three rising hits, and game
end pieces poured onto the board.

| Sound | Use | Character |
| --- | --- | --- |
| Whoosh (short, long) | Sheets, a flying star shard or coin | Airy, pitch rising with travel, under 300 ms |
| Pop (3 pitches) | Cards and badges arriving | Soft, rounded, woody; no click |
| Coin | Star shard or shooting star landing on the counter | Bright metallic ting, 2–3 variants to avoid repetition |
| Count tick | Count-up rolls | Tiny tick, pitch rising slightly over the roll |
| Fanfare (short, full) | Run bonus; session end, streak, milestone | Brass-and-mallet, 1 s and 2.5 s, ends on a resolved chord |
| Chest | Shake, open | Wood creak, then a sparkling open |
| Gentle miss | Wrong answer | Low, soft, encouraging; never a buzzer |

All sounds: 48 kHz WAV masters plus normalised mobile exports, peaks at −3 dBFS,
no tail longer than needed, one shared reverb so they sit together.

## Deliverables and acceptance

| Deliverable | Format |
| --- | --- |
| Knightly piece set, 12 pieces | Layered SVG, plus an atlas PNG at @1x/@2x/@3x |
| Icon set (tabs, stats, controls) | SVG on a 28 pt grid, plus native PNGs @1x/@2x/@3x |
| Reward items: star shard, shooting star, medal (drawn in code and locked), chest | SVG statics; chest states as layered SVG for code-driven motion |
| Knight mascot | Layered SVG per state (states above), separable for code-driven motion and an idle loop |
| Complex UI states (streak moon fill, chest open, milestone card) | Layered SVG per state for code-driven motion |
| Particle and flash sprites | SVG or PNG sprites for code-driven bursts |
| Sound palette | WAV masters and normalised exports, named by use |
| Source files | Editable vector originals |

Accepted when:

- Original work with full transfer or an exclusive licence for app, store and
  marketing use; the artist confirms no third-party assets or traced references.
- Every illustration meets the outline, silhouette, palette and light rules,
  reads at its smallest shipped size, and works on the dark page.
- Animated pieces arrive as separable SVG layers per state (for example each
  mascot mood), not baked timelines, so the app animates them in code on iOS,
  Android and web. Files stay small, idle loops are cleanly repeatable, and each
  has a final pose for reduced motion.
- Animation timings and springs match the motion tokens above; nothing loops
  in a way that distracts from the board.
- Sounds meet the loudness spec and align with their animation's impact frame.
- Files are named in kebab-case by subject and state, and the provenance entry
  in asset licenses is written before merge.

The app ships no animation runtime (Rive was trialled and removed); adopting
one for commissioned art is a separate dependency decision for
[technology decisions](technology-decisions.md), and it must run in the
development build on iOS, Android and web first.

## Remaining art

Locked so far (see the [lock record](art-style-lock.md#lock-record)): the
board-tile logo and splash, the star shard, the shooting-star run bonus and its
sparkle trail, the moon phases, the milestone medal and its landing swing, the
night-sky Done medal, the Today, Games, Progress and Settings glyphs, and the
line icons. What is left, in order:

1. **Phone check.** See the locked art on a device at its
   real sizes (open checks in [status](status.md)); fix anything that reads
   wrong on a real screen before adding more.
2. **Sounds.** The coin is now a recorded coin drop. Fanfare, the run-bonus
   cascade, pop and tick are still synthetic, and the shooting star and
   milestone medal have no sound of their own. A first round of CC0 Freesound
   options for each (trumpet and brass-band fanfares, mouth/cork/bubble pops,
   wood-block and click ticks, sparkle and chime runs, bell dings) had no
   clear winner; try another round, choose by ear, and align each with its impact
   frame (see the sound palette above).
3. **Chest.** Not drawn: it only earns its place if a reward system needs a
   container. Use the [art style lock](art-style-lock.md) workflow if it does.

Constellations and the knight mascot are under Later in
[Knightly direction](knightly-direction.md#later).
