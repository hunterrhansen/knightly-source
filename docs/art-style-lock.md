# Art style lock

How to pick one illustration style with AI image tools before making any more
art, so every asset looks like the same game. The premise and story come from
[Knightly direction](knightly-direction.md) and the rules from
[art and motion direction](art-direction.md). This page turns them into prompts
and a decision process for art that matches the locked style.

**The reward kit is locked and drawn in code** (see the
[lock record](#lock-record)): the star shard (a chunky four-point twinkle in
glossy cel), the shooting-star run bonus (which replaced the coin), the moon
phases, the milestone medal and the tab and settings glyphs, exported by
`npm run brand:generate`, and the line icons. The shard is the style anchor. The AI workflow below
stays for art that code handles poorly: the chest, constellation art and
exploring the mascot (see [Knightly direction](knightly-direction.md#later)).

## Workflow

1. **Anchor.** In Recraft, upload the [reference images](#reference-images) of
   Knightly's own art, including the locked star shard, as style references.
2. **Generate.** Make the object with the [Recraft prompt](#recraft-prompts),
   swapping in its subject. Make 4–8 images and keep the best one or two.
3. **Export.** Use a transparent PNG, square, at least 1024 px, with the object
   filling about 85% of the frame. Name it `<item>-<direction>-<n>.png`, for
   example `coin-bc-1.png`. Export the SVG too.
4. **Drop in.** Put the files in `assets/reward-art/candidates/` and register
   them in `src/components/ui/reward-art-candidates.ts`, or ask Claude to.
5. **Judge.** Open Storybook (`npm run storybook:web`), then **UI/Reward art
   gallery**. _Style lock_ puts every direction side by side on the light and
   dark pages. _Sizes_ shows each candidate at the sizes it ships at, plus the
   24 pt silhouette and the 18 pt counter. Score it against the checklist below,
   dark page first, next to the star shard and the reference pieces.
6. **Lock.** Pick the winner and add it to [the lock record](#lock-record).
   Then make the medal and chest the same way. Once three or four objects are
   locked, build the Recraft custom style from that *set*, so the style carries
   the rendering rather than one object's shape.
7. **Prune.** Delete the losing candidates. Move the chosen assets out of
   `candidates/` only when they are wired into the app, and record them in
   [asset licenses](../assets/licenses/README.md) at that point.

## Tools

| Tool | Use it for | How to keep it consistent |
| --- | --- | --- |
| Recraft | The style lock and reward kit now: vector output, transparent backgrounds, SVG export | Style references from Knightly's own art; then a custom style built from the locked set |
| Scenario | Volume after the lock (icons, constellations, more items) | Train a style model on 10–20 approved images you made or own |
| ChatGPT image | Quick edits ("same coin, thicker outline") | Attach the winning image as the reference on every request |
| Midjourney | Optional exploration only | `--sref <winning image URL>`, a fixed `--seed`, `--style raw --ar 1:1`, the negative list in `--no` |

Never name a game, studio or app in a prompt ("Clash of Clans style",
"Supercell", "Duolingo", "Chess.com"). Never upload their art as a reference.
Describe the qualities instead.

## Reference images

`assets/reward-art/references/` holds Knightly's own art exported for upload:

| File | Use |
| --- | --- |
| `knightly-pieces.png` | Style reference: the piece set the rewards must sit beside |
| `knightly-knight-white.png`, `knightly-knight-black.png` | Style reference: outline, shading and proportions at their clearest |
| `brand-mark.png` | Style reference: the knight-and-moon mark and brand palette |
| `streak-moon.png` | Style reference: the moon streak symbol |
| `../star-shard.png` | Style reference: the locked star shard, the rendering every reward must match |
| `app-dark.png` | Not a style reference. Judge candidates against it: Knightly on the dark page |

Use the pieces, knight, mark, moon and star shard as style references. Don't upload the
screenshot as a style reference, or the output drifts toward UI chrome.

## Story context

Image tools don't follow a backstory, but one short context phrase sets the
mood. Every prompt opens with the object and this phrase:

```text
for a cosy chess-learning mobile game about a young knight keeping a short
watch under the night sky each evening
```

Then translate the story into visual words, not plot: lantern-warm gold,
starlight blue rim light, friendly storybook-game feel. Always exclude a sky or
scene, or the tool paints one behind the object.

## Shared style block

Every prompt carries this after the subject:

```text
single object centred on a transparent background, chunky exaggerated
proportions, bold warm dark-brown outline (#24211c) about 7% of the object's
height, heavier on the outer silhouette, cel shading with one shadow step and
one highlight step, light from the top left, broad highlight on the upper
third, core shadow on the lower right, saturated warm palette, detail
concentrated in the top half, simple lower half, readable as a solid silhouette
at small size, crisp clean edges
```

Palette words to add when the object uses them: lantern gold `#ffc233` with
shade `#d39a00` and highlight `#ffe48a`, starlight blue `#49a8f2` (rim light
only), brand green `#6cc23a` with shade `#4a9620`, flame orange `#ff9600`.

Exclusions (`--no` in Midjourney, a closing "No …" sentence elsewhere):

```text
text, letters, watermark, signature, sky, stars background, scene, floor
shadow, photo, realistic, 3d render, noise texture, grain, hairline strokes,
thin outline, neon, desaturated grey, multi-step gradient, glow halo, cropped
edges
```

## Directions

Each direction changes only the rendering. The outline, light and palette rules
above hold for all of them.

Recommended: **b, glossy cel**, tried on c's chunkier shapes as **bc**. Its
highlight and edge light give rewards a game-like shine, while its outline keeps
it readable at 18 pt and on the dark page. It stays 2D, so it animates as
layered SVG. Flat cel (a) reads as an app icon rather than a reward, and enamel
(d) turns to mush at small sizes. Pre-rendered 3D was considered and left out:
it has no outline, blurs at small sizes on dark pages, and AI drifts in its lighting from image to
image. Because sessions often happen at night, judge every candidate on the
dark page first. The starlight-blue rim light in b is what keeps dark outlines
from vanishing there.

| ID | Name | Add to the style block |
| --- | --- | --- |
| a | Flat cel | `flat vector look, exactly two tones per material, no gloss, matte, sticker-like, very clean shapes` |
| b | Glossy cel | `one sharp white specular highlight shape, a thin starlight-blue rim light along the lower right edge, glossy candy-like surface` |
| c | Chunky toy | `squat toy-like proportions, rounded bevelled edges, soft-cornered forms, vinyl toy feel, playful and squishy` |
| d | Enamel badge | `enamel pin look, raised gold metal borders between flat coloured enamel fills, embossed details, small polished highlight on the metal` |

## Recraft prompts

Use a vector illustration style, a 1:1 canvas, the reference images, and 4
variations. If Recraft rejects a prompt as too long, shorten the closing "No …"
sentence first.

**Template (bc, matching the locked star shard), shown for a coin**

```text
A coin reward icon for a cosy chess-learning mobile game about a young knight keeping a short watch under the night sky each evening. A thick, chunky gold coin seen slightly from the front, with a rounded toy-like rim and an embossed knight-horse head in the centre, a little squat and squishy. Single object centred on a transparent background. Same rendering as the reference star: very thick warm dark-brown outline (#24211c) with soft rounded corners, a darker gold shade band (#d39a00) inside the outline, a lighter gold face (#ffc233), a pale gold highlight shape (#ffe48a) on the upper left, one small white specular highlight, and a thin starlight-blue rim light (#49a8f2) along the lower right edge. Light from the top left, glossy candy-like surface, friendly storybook-game feel, crisp clean edges, readable as a silhouette at small size. No text, no numbers, no sky, no scene, no floor shadow, no glow halo, no gradients, no noise, no thin lines.
```

For the medal and chest, keep everything except the second sentence and swap
in a subject below. The star shard itself is drawn in code; regenerate AI
variants of it only to explore, with its subject below.

## Subjects

| Item | Subject sentence |
| --- | --- |
| Star shard (locked; for exploration only) | `A chunky four-point star twinkle in lantern gold with fat, rounded points, a lighter gold core and a pale gold highlight star inside, as if a glint of starlight were solid.` |
| Coin | `A thick gold coin seen slightly from the front, wide raised rim, an embossed knight-horse head in the centre, flat space for a number.` |
| Medal | `A gold medal disc hanging from a short brand-green ribbon, an embossed crescent moon and star in the centre, ribbon ends cut in a V.` |
| Chest (closed) | `A small treasure chest, warm brown wood planks with thick gold bands and corners, oversized rounded lid, closed, a front gold lock plate shaped like a crescent moon.` |
| Chest (open) | Same as closed, plus `lid swung open, warm lantern-gold light rising from inside, a few star shards visible at the rim.` |

Use a seed or reference image so the chest's closed and open states are clearly
the same object. If the tool can't keep them identical, generate only the closed
state and animate the open state in code from layered SVG.

## Checklist

Score each candidate in the gallery. It wins only if it passes every line:

- [ ] **Silhouette.** It is recognisable as a solid shape at 24 pt (the
      gallery's silhouette swatch).
- [ ] **Dark page.** It reads on the dark page (Knightly has no light theme).
- [ ] **Outline.** The outline is one warm dark weight, thick at 18 pt, with
      no hairlines.
- [ ] **Light direction.** The highlight is top-left and the shade lower-right,
      matching the board pieces and the 4 dp ledge.
- [ ] **Palette.** Every colour is a theme role plus one shade and one
      highlight; there's no neon or grey.
- [ ] **Smallest size.** At 18 pt in the points counter it reads as a star, not
      a blob.
- [ ] **Belongs with the pieces.** Next to `knightly-pieces.png` it looks like
      the same game.
- [ ] **Clean.** No stray text, watermark, sky, ground shadow or cropped edges.

Then check the kit as a set. Lined up in _Style lock_, star shard, coin, medal
and chest should look like one game.

## Rights

Images made purely by AI generally can't be copyrighted in the US, so others
could copy them. That is fine for shipping, but it falls short of the
exclusive-licence rule in [art direction](art-direction.md#deliverables-and-acceptance).
Treat locked AI assets as production stand-ins. The commissioned artist redraws
or substantially reworks them, and their version becomes the owned asset. When
an AI asset ships, record its tool and terms in
[asset licenses](../assets/licenses/README.md).

## Lock record

Add a row per locked object.

| Object | Direction | Made with | Prompt or source | Files | Date |
| --- | --- | --- | --- | --- | --- |
| Star shard | bc on four points: "chunky twinkle" (glossy cel, chunky toy shapes) | Drawn in code from the drafts, no AI | `src/components/kit/art/star-shard-art.ts` | `assets/reward-art/star-shard.svg`, `star-shard.png`; `StarShard` in the app | 2026-10-18 |
| Moon streak | The shard's glossy cel on a disc: a night-blue unlit side, a gold lit side with craters, waxing from new (day 0) to full (day 7) | Drawn in code, no AI | `src/components/kit/art/moon-phase-art.ts` | `assets/reward-art/moon-phase-0.svg` to `-7` (and `.png`); `MoonPhase` in the app; not yet wired into the streak UI | 2026-10-18 |
| Shooting star (run bonus, in place of a coin) | The shard streaking in: a tapered tail and two motion streaks, glossy cel | Drawn in code, no AI | `src/components/kit/art/shooting-star-art.ts` | `assets/reward-art/shooting-star.svg`, `.png`; `ShootingStar` in the app | 2026-10-18 |
| Milestone medal | The full moon in a night-sky recess, set in a gold medal on brand-green ribbon tails | Drawn in code, no AI | `src/components/kit/art/milestone-medal-art.ts` | `assets/reward-art/milestone-medal.png`; `MilestoneMedal` in the app | 2026-10-18 |
| Tab icons (Today, Games, Progress) | The existing castle, board and bars in glossy cel: warm outline, lower-right shade, top-left highlight, a glint | Drawn in code, no AI | `src/components/ui/glyph-art.ts` | `assets/navigation/*.svg`; `KnightlyGlyph` in the app (the side tiles; no tab bar) | 2026-10-18 |
| Ward path places (18 post landmarks, the Keep, the Middle and Inner Wards' skylines) | Each post's place rising behind the wall's battlements in the watch scene, glossy cel in the night palette: warm outline, two-tone stone, lit gold windows; the distant skyline changes as the walk moves inward | Drawn in code, no AI | `src/components/kit/art/post-landmark-art.ts` | Storybook's Today/Watch hero, Post landmarks; `WatchHero`'s `post` on the ward path's node cards | 2026-10-21 |
| Settings gear and line icons | The gear in the tab glyphs' glossy cel, in sky; the `ActionIcon` strokes over a warm outline that drops lower-right (none under dark ink) | Drawn in code, no AI | `src/components/ui/glyph-art.ts`, `src/components/ui/action-icon.tsx` | `assets/navigation/settings.svg`; `KnightlyGlyph` and `ActionIcon` in the app | 2026-10-18 |

Why four points: a five-point star already means the accuracy stat, the medal
and, later, constellations; a four-point twinkle reads as starlight, survives
at 18 pt and can't be mistaken for a rating.
