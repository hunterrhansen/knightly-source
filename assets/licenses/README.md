# Asset provenance

Piece geometry and fixed side colors are adapted from Hunter Hansen’s Knightly: `../knightly/mobile/src/components/piece.tsx` and `../knightly/web/src/styles/tokens.css`. The source MIT notice is preserved as `knightly-MIT.txt`. Only artwork geometry and colors are carried over; rendering and theme code are owned here.

Fredoka 600, Nunito 600 and Nunito 800 TTFs are copied from the sibling app’s installed `@expo-google-fonts/fredoka` and `@expo-google-fonts/nunito` packages. Their original SIL Open Font License notices are preserved beside this file.

The inspected Expo default SDK 57 scaffold carries the Expo MIT notice, preserved as `expo-template-MIT.txt`.

Brand mark and navigation glyph geometry are adapted from Hunter Hansen’s original
Knightly `web/src/components/logo.tsx` and `kn-icon.tsx`, under the preserved
[MIT notice](knightly-MIT.txt). Expo rendering uses react-native-svg.
The navigation glyphs' SVG masters in `assets/navigation/` are written by
`npm run brand:generate` from the same glyph shapes in Knightly's glossy cel
(`src/components/ui/glyph-art.ts`, original Knightly art; the Progress tile's
star is drawn here too). The moon (`today.svg`, which replaced the castle) is original
Knightly art drawn here: the streak moon's crescent (`src/components/ui/moon.tsx`)
in the moon phases' gold on a night-sky disc.
The chart's generated `public/canvaskit.wasm` comes from Skia's pinned
`canvaskit-wasm` 0.41.0 dependency. `npm ci` copies it locally for Expo web and
Storybook; it is not downloaded from a CDN at runtime. Its BSD-3-Clause notice
ships as [canvaskit-LICENSE.txt](../../public/canvaskit-LICENSE.txt).

Review's side-line engine on web is Stockfish.js 19 (the `stockfish` npm
package, pinned at 19.0.1, built from Stockfish by its authors and published by
Chess.com, LLC; its small network by Chris Bao). It is GPL-3.0. `npm ci` copies
its unmodified `lite-single` build and its `Copying.txt` to the ignored
`public/stockfish/` (`scripts/prepare-engine-web.mjs`); the corresponding source
is <https://github.com/nmrugg/stockfish.js> at tag v19.0.1 and
<https://github.com/official-stockfish/Stockfish>.

On iOS and Android the same engine is compiled into the app from
`modules/stockfish/cpp/engine/`: Stockfish 19's light flavour with Lichess's
1.1 MB net (`nn-61e7af4bb97d.nnue`), copied unchanged from
<https://github.com/lichess-org/dart-multistockfish> (commit `fd8dcea`). It is
GPL-3.0 ([LICENSE](../../modules/stockfish/LICENSE)), and linking it makes the
apps' distributed builds subject to the GPL.

Classic board pieces (`src/chess/board/cburnett-art.ts`) are Colin M.L. Burnett's
`Chess_{k,q,r,b,n,p}{l,d}t45.svg` files from Wikimedia Commons, licensed
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). They were
normalized to attribute-only SVG markup without changing the artwork; that file
and any derivative remain under CC BY-SA 3.0 with this attribution.

Sounds in `assets/audio/` are built by `npm run sounds:generate`
(`scripts/generate-board-sounds.mjs`). Feedback, the run-bonus coin cascade and
the UI sounds (pop, tick, fanfare) are original Knightly audio synthesized in
code. Board sounds (move, capture, castle, check, promote, game end), the launch
sound and the points coin mix recorded hits kept in `assets/audio/source/`:

| Source file | From | Licence |
| --- | --- | --- |
| `piece-1`–`piece-4` | "Chess Pieces" by MattyCauldron, Freesound sound 765866 (https://freesound.org/people/MattyCauldron/sounds/765866/) | CC0 1.0 |
| `clack-1`, `pieces-drop` | "Chess Pieces Drop" by IENBA, Freesound sound 755250 (https://freesound.org/people/IENBA/sounds/755250/) | CC0 1.0 |
| `coin-drop` | "Real Coin Drop" by Rocotilos, Freesound sound 343462 (https://freesound.org/people/Rocotilos/sounds/343462/) | CC0 1.0 |

Each is a single hit or drop cut from the recording's Freesound preview and
levelled; CC0 needs no attribution, recorded here for provenance.

The PNGs in `assets/reward-art/references/` are renders of Knightly's own art
(the Knightly piece set, brand mark, streak moon and a Storybook screenshot of
the practice screen, which shows the Classic cburnett pieces under their CC BY-SA
3.0 licence above). They are style references for AI image tools and are not
shipped in the app. AI-generated candidates in `assets/reward-art/candidates/`
are not shipped either; see [art style lock](../../docs/art-style-lock.md).

Never commit third-party artwork, sounds or screenshots (for example Chess.com's
pieces, sounds or site UI) that Knightly is not licensed to redistribute.

The app icon (`assets/app-icon/icon.png`, which also supplies the web favicon),
Android's adaptive icon layers and the native splash tile
(`assets/splash/launch-mark.png`) are rasterised from the brand-mark geometry
(`src/components/ui/brand-mark-geometry.ts`, adapted from the original Knightly
mark under the preserved [MIT notice](knightly-MIT.txt)) by
`npm run brand:generate`. The icon's 2×2 green board is original Knightly work.
Regenerate them whenever that geometry or the brand colours change.
The star shard reward (`assets/reward-art/star-shard.svg` and `.png`) is original
Knightly art drawn in code (`src/components/kit/art/star-shard-art.ts`) and exported
by the same command. So are the moon-phase streak symbols
(`assets/reward-art/moon-phase-*.svg` and `.png`, from
`src/components/kit/art/moon-phase-art.ts`), the run bonus's shooting star
(`shooting-star.svg` and `.png`) and the milestone medal
(`milestone-medal.png`).
The watch kit's scenes (the wall, the lesson's view from it and the
side-profile knight: `src/components/kit/art/wall-art.ts`,
`wall-view-art.ts` and `knight-art.ts`) and the raiders at the treeline with
the captain's crown (`raider-art.ts`), and the rank emblems and the Progress
map's rank castles (`rank-art.ts`) are original Knightly placeholder art
drawn in code.
