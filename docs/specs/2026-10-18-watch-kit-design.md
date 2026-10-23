# The watch kit: swappable art, motion and sound, and the build plan

Proposed (2026-10-18); stages 1 to 4, 6 and 7 are built (see the build plan). Builds the core of [the watch story](2026-10-18-watch-story-design.md)
on a kit where every sprite, scene, effect and sound is addressed by its role,
not its file, so any of them can be swapped by editing one manifest. Art and
motion are what will change most (the knight is a stand-in until it is
commissioned, piece characters and the wall will be redrawn, timings will be
tuned on devices), and today each lives inside the component that draws it.

Prototypes this follows: the board lab's Watch wall mode
(`src/features/board-lab/`: the wall scene, the side-profile knight, board
juice) and the [wireframes canvas](https://claude.ai/artifact/Rsk54ip1jvUBAkpsWV7iHi).

## Principles

- **Callers name a role, never a file.** A screen asks for
  `character.knight` in the `cheer` state or the `fx.capturePop` effect; the
  kit decides which art and timing that means. Swapping art never touches a
  screen.
- **One manifest per kit.** The `nightWatch` kit maps every role to an
  implementation. A change of art is a one-line manifest change plus the new
  asset file.
- **Art is data, motion is data.** Sprites are layered vector data with named
  anchors (as `star-shard-art.ts` and `moon-phase-art.ts` already are); motion
  is named recipes built from the motion tokens; sounds are cues. Components
  only render and play them.
- **Every asset answers the same questions.** Its sizes, its reduced-motion
  end frame, its night variant (after 21:00) and its provenance. A missing answer fails a test, not a review.
- **Effects attach to anchors, not coordinates.** The lantern's glow attaches
  to the knight's `lantern` anchor; a redrawn knight with the lantern elsewhere
  keeps working.
- **Calm rules are enforced by the kit.** Board effects end within 600 ms,
  never move squares and never move the board
  ([the board never moves](2026-10-18-watch-story-design.md#the-board));
  at most one loop per scene; reduced motion shows end frames.
- **No new runtime yet.** Sprites render with react-native-svg (and Skia where
  the board already uses it); motion with Reanimated on the UI thread. A Rive
  or Spine character is a later implementation of the same role (below).

## Where it lives

Shared UI, under the existing boundaries (`npm run architecture:check`):

```
src/components/kit/
  types.ts           roles, Sprite, Character, Scene, Recipe, Cue, Beat
  manifest.ts        the nightWatch kit: role → implementation
  registry.tsx       KitProvider, useSprite, useSpriteFamily, useCharacter, useScene
  sprite.tsx         SpriteView: renders a Sprite (layers, clips, groups)
  scene.tsx          SceneView: renders a Scene (sky, tiled and fixed layers, actor slots)
  art/               *-art.ts sprite data and the sprites built from it
  recipe.ts          frameAt (keyframes → value), landingCurve, isNight, praiseFor
  beats.tsx          BoardEffects: capture pop, line light and praise beats by square
  wall-view.tsx      the lesson's wall view: far band, fringe, battlements
  raiders.tsx        the raid at the treeline and the captain's health
  recipes/           motion recipes and story copy (board-juice.ts, raid.ts)
  kit-gallery.stories.tsx   every role, every state, candidates side by side
  manifest.test.ts   the contract tests (below)
```

Features import the kit only through `src/ui/index.ts`. Existing art files
(`star-shard-art.ts`, `moon-phase-art.ts`, `milestone-medal-art.ts`,
`shooting-star-art.ts`, `knight-mascot.tsx`) move under `kit/art/` as the
first step, with no visual change.

## The kit's types

**Sprite:** layered vector art.

```ts
type Sprite = {
  id: string;                      // 'knight.profile.idle'
  viewBox: [number, number];       // drawing box, e.g. [100, 120]
  layers: Layer[];                 // back to front; colours are tokens or art colours
  anchors: Record<string, Point>;  // 'lantern', 'feet', 'head', 'hand' …
  variants?: { light?: Layer[]; night?: Partial<Layer>[] };
  sizes: { min: number; max: number };   // smallest and largest shipped heights
};
```

**Character:** states, each a sprite plus an optional idle recipe.
`character.knight` has the six moods from [art direction](../art-direction.md)
(idle, thinking, cheer, encourage, sleepy, celebrate) plus poses the watch
needs (lookout, dozing, arriving). `character.raider.{p,n,b,r,q,k}` has
lurk, flinch, knockedOut and flee, and a captain marker.

**Scene:** ordered layers, each a tiled sprite with a parallax factor, and
actor slots with a depth (behind or in front of a layer). The knight is an
actor behind `wall` so the battlements pass over his body. Scenes:
`scene.wallHero` (tonight's node card on the home path, and its sky behind the path; states before, kept, firstNight) and
`scene.wallView` (the lesson; far, middle, near).

**Recipe:** a named animation built only from motion tokens: a duration, an
easing and keyframes per property (`scale`, `scaleY`, `translateY`,
`opacity`, `rotate`), with a required `end` frame for reduced motion and an
optional `night` variant. Recipes are pure data, so a test can check their
limits and the gallery can replay them.

**Cue:** a sound (with variants, as `sounds.ts` has) and a haptic, played
together.

**Beat:** a moment that combines them: "capture pop" = the captured piece's
sprite running `recipe.pop.swell`, sparks in its colour, `+N` running
`recipe.score.rise`, `cue.coin` at 0 ms. Screens play beats by name.

## The nightWatch manifest

Roles the watch uses, grouped by where they appear. Each row is one manifest
entry; "now" is what fills it today.

| Role | States or parts | Now |
| --- | --- | --- |
| `character.knight` | moods + lookout, dozing, arriving | Lab side-profile sprite (`knight-sprite.tsx`); `KnightMascot` front stand-in |
| `character.raider.*` | lurk, flinch, knockedOut, flee; captain crown (`character.raider.captain`) | Piece silhouettes with eyes and a moonlit edge (`raider-art.ts`) |
| `scene.wallHero` | sky, stars, moon, hills, treeline, wall, gate; before, kept, firstNight, end (the session end: gate shut, a `gateCaption` slot centred on the gate) | Lab `wall-scene.tsx` |
| `scene.wallView` | far (sky, moon, treeline, a `raiders` slot), the fringe (no longer drawn over the board: its top edge is straight), near battlements with the knight and his light | `wall-view-art.ts` |
| `reward.starShard`, `reward.shootingStar`, `reward.medal`, `reward.moon` | as today | Locked art in `src/components/ui/*-art.ts` |
| `reward.rankEmblem.*` | one per rank tier (`page`, `squire`, `knight`), drawn at the rank's level (one pip per level) | Placeholder shields in `rank-art.ts`; `useRankEmblem` picks the tier from the server's rank key or name, Page's for an unknown tier |
| `map.castle` | reached (green flag, lit window), ahead | Placeholder castle in `rank-art.ts`, beside the home path |
| `ui.parchment`, `ui.stoneButton`, `ui.plaque` | the lesson's coach bubble, buttons and name plaques | Surfaces in `wall-view-art.ts`; `CoachBubble` and `ActionButton` take them inside the watch frame |
| `fx.settleIn`, `fx.land`, `fx.capturePop`, `fx.lineLight`, `fx.praise`, `fx.lanternFlare` | the parked board juice; prototype only (see [The board](2026-10-18-watch-story-design.md#the-board)) | Kit recipes and `BoardEffects`, played only in the board lab |
| `fx.raidersFallBack`, `fx.raidersEdgeIn`, `fx.raiderOut` (and its word), `fx.captainHit` | the raiders' reactions, in the wall view's far scene only | Kit recipes (`recipes/raid.ts`); reversed, fall back is the raiders arriving and edge in their reset |
| `fx.lanternBrighten`, `fx.turnedBack`, `copy.watchEnd` | the watch's end: a lantern step per held move, "N raids turned back" over the gate | Kit recipes and copy (`recipes/session-end.ts`), drawn by `WatchEndScene` |
| `cue.*` | correct, coin, coin-bonus, pop, tick, fanfare, gentle miss, capture | `sounds.ts` (cue names stay) |
| `copy.praise` | Sharp!, Spotted!, Brilliant!, Unbreakable! and their run thresholds | Kit copy, board lab only |

Copy that carries the story (praise words, raid wording) is a kit role too,
so tone can be tuned without touching screens.

## Swapping something

1. Add the new file under `kit/art/` (or `recipes/`), with anchors and sizes.
2. Point the role at it in `manifest.ts`. To compare, register it as a
   candidate instead: `{ use: 'knight.profile.v2', candidates: ['knight.profile.v1'] }`.
3. Check it in the kit gallery (Storybook, every state on the dark page, at
   min and max size, with reduced motion) and in the board lab on a phone.
   In development builds the gallery and lab can switch any role to a
   candidate at runtime; production uses `use` only.
4. Record provenance in [asset licenses](../../assets/licenses/README.md).
5. `npm run verify`: the manifest tests below must pass.

Commissioned art arrives in the same shape: layered SVG per state (the
[deliverables](../art-direction.md#deliverables-and-acceptance) already ask
for this), converted to `*-art.ts` data by the existing brand script pattern
(`scripts/generate-brand.mjs`), so no screen changes.

**A runtime-animated knight later.** If a commissioned mascot needs bones or a
state machine, `character.knight` gets a second implementation behind the
same interface (states, anchors, end frames). Adopting Rive or Spine is a
[technology decision](../technology-decisions.md) taken then, not now.

## Contract tests

Pure Jest tests over the manifest (`manifest.test.ts`), so a swap that breaks a
rule fails `npm run verify`:

- Every role the watch uses resolves, and every character has all its states.
- Sprites have the anchors their beats attach to (`knight` needs `lantern` and
  `feet`; raiders need `head`, `crown` and `feet`), a viewBox and sizes.
- Every recipe has an `end` frame; board recipes (`fx.land`, `fx.capturePop`,
  `fx.lineLight`, `fx.praise`, `fx.settleIn`) finish within 600 ms and never
  animate square layout; scene recipes (the raid) never play over the board,
  end within 1.2 s and have a calmer night version; at most one looping
  recipe per scene.
- Every sprite with a dark-page version has a light one, and every beat has a
  night variant or declares that it needs none.
- Every file the manifest references exists and has a provenance entry.

Visual review stays in the gallery and on devices, per the
[test strategy](../../AGENTS.md#unit-and-component-test-strategy): no pixel
snapshots.

## Build plan for the core of the watch

Each stage is shippable alone and leaves the app working. Backend work is in
[the watch story](2026-10-18-watch-story-design.md#backend-and-api).

| Stage | Builds | Done when |
| --- | --- | --- |
| 1. Kit foundation (built) | Types, manifest, registry, `SpriteView`, `SceneView`, the Kit/Gallery story and contract tests. The locked reward art moved into the kit (its components keep their APIs), and the lab's side-profile knight and wall scene are kit data. Recipes, cues and beats move to stage 2, where the board first uses them. | Reward SVGs matched the old components' markup (ids aside) and `brand:generate` reproduced every asset unchanged; the gallery shows every role; `npm run verify` passes. The `KnightMascot` front stand-in in lessons is not yet a kit role |
| 2. Board hooks (built) | The board's `landing` takes a scale curve (`LandingCurve`, default unchanged); the kit's `fx.land` recipe supplies it through `useLandingCurve` (halved squash after 21:00). Recipes for the capture pop, line light and praise word, the praise copy, and `BoardEffects`, an overlay that places beats by square. The board lab plays them from the kit. Cues stay in `sounds.ts` and the reward cues until a sound is chosen by ear | Board tests unchanged (113); recipe contract tests (600 ms, end frames, night landing, praise order); in the browser each beat plays and the board's top and size stayed constant through the raid |
| 3. Watch page (built) | `scene.wallHero` in its three states (`useScene('scene.wallHero', state)`) with the knight's `lookout`, `dozing` and `arriving` poses, on Today (renamed Watch), now the header of tonight's node card on the [path home](2026-10-19-path-home-design.md); the tonight card and the move rows. Until `today.tonight` exists the rows come from the lesson's next card (`/api/deck?mode=lesson`), so at most one move is named; the kept results come from that deck's `results`. Scenes are night (Knightly is dark only) | Checked on web and at phone width against the canvas; the contract tests cover every pose and wall state. Still open: the moon tab glyph and the phone check |
| 4. Lesson from the wall (built) | `scene.wallView`, full-width board, parchment coach, stone buttons, verdict over the wall; the board keeps the learner's pieces and colours. `LessonFrame`'s `watch` opt-in; the daily lesson uses it, other practice and Game review keep today's frame | Measured in Storybook web through a whole practice session: the board's top and size never changed (390 × 844: top 87, 390 square; 320 × 568: top 87, 231 square; including the loading frame). Still to check on a phone, with large text and against the frame rate budget below |
| 5. Board juice (parked) | Not built in lessons: the board keeps the app's current feedback (decided 2026-10-18). The recipes and `BoardEffects` stay for the lab prototype | Revisit when it can be judged in motion |
| 6. Raiders and the captain (built) | `character.raider.*` at the treeline, each over its board file: knocked out on capture, fall back or edge in; captain crown and health on multi-move lines. Practice builds the raid from its position (`practice-raid.ts`); the captain needs a card's known threat and a line of two or more learner moves, else none. The board is untouched (no crown on its piece) | Correct reactions per answer type and capture; no learner penalty. Measured headless in Storybook web through the Watch stories' raid line, a miss and a retry: the board's top and size never changed (390 × 844: top 87, 390 square; 320 × 568: top 87, 231; with 1.6× text reservations: top 99, 390 and 162). Still to check on a phone: native large text and the frame rate with up to 16 raiders |
| 7. Session end and ranks (built) | The rank-up beat after practice and game review, the map of nights (now the home path) and the rank emblem and castle roles, with contract tests (one pip per level, anchors, every server rank resolves) and the gallery's Ranks section. The watch's end over the wall: the `end` wall state, `fx.lanternBrighten` and `fx.turnedBack`, before the daily lesson's Results; contract tests (caption centred on the gate, raiders gone, recipes end shown and only fade at night) and the gallery's Session end section | Ranks never drop and a lapse never lowers the star count (tests). Checked in Storybook web; still to check on a phone, with large text and reduced motion |

Stages 1 and 2 come first because every later stage is built from them; 3 can
run alongside 4 once 1 lands.

## Performance budgets

- A scene renders in one pass with at most 8 layers and 12 actors; tiles reuse
  one drawing per layer.
- Board effects run on the UI thread (Reanimated or the layered board's Skia
  clock) and add no React work per frame.
- Measure on the phone with the board lab's benchmark before stage 4 ships;
  if react-native-svg scenes drop frames, render scene layers as recorded Skia
  pictures behind the same `Scene` interface.

## Open decisions

1. **Folder:** the shared-UI kit folder above, or a top-level kit folder
   under src registered as its own boundary.
2. **Candidate switching in development:** a device preference (kept across
   reloads) or session-only.
