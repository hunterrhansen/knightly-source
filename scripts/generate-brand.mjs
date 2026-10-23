// Rasterises Knightly's brand art from its shared geometry: the app icon,
// Android's adaptive icon layers, the native splash tile, the native tab
// glyphs and the reward art (star shard, shooting star, moon phases and the
// milestone medal). The app draws the same geometry, so every surface matches.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  milestoneMedalLayers,
  milestoneMoonTransform,
} from '../src/components/kit/art/milestone-medal-art.ts';
import {
  litShape,
  moonPhaseDays,
  moonPhaseLayers,
  moonPhaseSvg,
} from '../src/components/kit/art/moon-phase-art.ts';
import {
  shootingStarHead,
  shootingStarSvg,
  shootingStarTail,
} from '../src/components/kit/art/shooting-star-art.ts';
import {
  starShardLayers,
  starShardSvg,
} from '../src/components/kit/art/star-shard-art.ts';
import {
  boardSplit,
  knightEye,
  knightPath,
  knightTransform,
  moon,
  moonCutout,
  tileDarkSquares,
} from '../src/components/ui/brand-mark-geometry.ts';
import { glyphArt, glyphSvg } from '../src/components/ui/glyph-art.ts';

// darkTheme.colors brand / brandTileLedge / brandSquare / onBrand and
// boardAnnotations.hintGold.
const brand = '#6cc23a';
const brandLedge = '#4a9620';
const brandSquare = '#5eb22f';
const onBrand = '#13200c';
const gold = '#ffc233';
const size = 1024;
// The icon's ledge strip, matching the tile's 4-unit ledge.
const ledgeTop = 96;
// Android masks the adaptive foreground to its centre, so the mark shrinks.
const adaptiveScale = 0.59;

// Resolve through Skia, which pins the CanvasKit version the app already ships.
const skiaRequire = createRequire(
  createRequire(import.meta.url).resolve(
    '@shopify/react-native-skia/package.json',
  ),
);
const kit = await skiaRequire('canvaskit-wasm')();
const paint = new kit.Paint();
paint.setAntiAlias(true);
const knight = kit.Path.MakeFromSVGString(knightPath);

/** Draws `file` at `px` square from art on a `units`-wide grid. */
function render(file, draw, { px = size, units = 100 } = {}) {
  const surface = kit.MakeSurface(px, px);
  if (!surface) throw new Error('Could not create a raster surface.');
  const canvas = surface.getCanvas();
  canvas.clear(kit.TRANSPARENT);
  canvas.scale(px / units, px / units);
  const fill = (color) => paint.setColor(kit.parseColorString(color));
  draw({
    canvas,
    rect: (l, t, r, b, color) => {
      fill(color);
      canvas.drawRect(kit.LTRBRect(l, t, r, b), paint);
    },
    path: (d, color) => {
      fill(color);
      canvas.drawPath(kit.Path.MakeFromSVGString(d), paint);
    },
    tile: () => {
      for (const [top, color] of [
        [8, brandLedge],
        [4, brand],
      ]) {
        fill(color);
        canvas.drawRRect(
          kit.RRectXY(kit.LTRBRect(4, top, 96, top + 88), 22, 22),
          paint,
        );
      }
    },
    circle: ({ cx, cy, r }, color) => {
      fill(color);
      canvas.drawCircle(cx, cy, r, paint);
    },
    knight: () => {
      fill(onBrand);
      canvas.save();
      canvas.translate(knightTransform.x, knightTransform.y);
      canvas.scale(knightTransform.scale, knightTransform.scale);
      canvas.drawPath(knight, paint);
      canvas.restore();
    },
  });
  const png = surface.makeImageSnapshot().encodeToBytes();
  if (!png) throw new Error(`Could not encode ${file}.`);
  writeFileSync(file, png);
}

/** Knight and moon; the moon's cutout takes the colour behind it. */
function mark(d, behindMoon) {
  d.circle(moon, gold);
  d.circle(moonCutout, behindMoon);
  d.knight();
  d.circle(knightEye, brand);
}

/** A 2×2 board whose light squares are brand green, split at (x, y). */
function board(d, x, y, bottom) {
  d.rect(0, 0, 100, bottom, brand);
  d.rect(x, 0, 100, y, brandSquare);
  d.rect(0, y, x, bottom, brandSquare);
}

// iOS and web: full-bleed tile with its ledge; iOS rounds the corners.
render('assets/app-icon/icon.png', (d) => {
  d.rect(0, 0, 100, 100, brandLedge);
  board(d, boardSplit.x, boardSplit.y, ledgeTop);
  mark(d, brandSquare);
});

// Android: the board behind, the mark scaled about the centre in front.
const adaptiveSplitY = 50 + (boardSplit.y - 50) * adaptiveScale;
render('assets/app-icon/adaptive-background.png', (d) =>
  board(d, boardSplit.x, adaptiveSplitY, 100),
);
render('assets/app-icon/adaptive-foreground.png', (d) => {
  d.canvas.translate(50, 50);
  d.canvas.scale(adaptiveScale, adaptiveScale);
  d.canvas.translate(-50, -50);
  mark(d, brandSquare);
});

// Native splash: the board tile, as in BrandMark, over the launch screen's green.
render('assets/splash/launch-mark.png', (d) => {
  d.tile();
  for (const square of tileDarkSquares) d.path(square, brandSquare);
  mark(d, brandSquare);
});

/** Art layers ({d, fill, stroke, strokeWidth}) with round joins and caps;
 * `clip(layer)` returns a path to clip that layer to, if any. */
function drawLayers(canvas, layers, clip = () => undefined) {
  for (const layer of layers) {
    const path = kit.Path.MakeFromSVGString(layer.d);
    const within = clip(layer);
    canvas.save();
    if (within) canvas.clipPath(within, kit.ClipOp.Intersect, true);
    if (layer.fill) {
      paint.setStyle(kit.PaintStyle.Fill);
      paint.setColor(kit.parseColorString(layer.fill));
      canvas.drawPath(path, paint);
    }
    if (layer.stroke) {
      paint.setStyle(kit.PaintStyle.Stroke);
      paint.setStrokeWidth(layer.strokeWidth);
      paint.setStrokeJoin(kit.StrokeJoin.Round);
      paint.setStrokeCap(kit.StrokeCap.Round);
      paint.setColor(kit.parseColorString(layer.stroke));
      canvas.drawPath(path, paint);
      paint.setStyle(kit.PaintStyle.Fill);
    }
    canvas.restore();
  }
}

/** Applies an SVG `translate(x y) scale(s) translate(-a -b)` placement. */
function place(canvas, transform) {
  const [x, y, s, a, b] = transform.match(/-?[\d.]+/g).map(Number);
  canvas.translate(x, y);
  canvas.scale(s, s);
  canvas.translate(a, b);
}

// The star shard reward: an editable SVG master and a 1024 px transparent PNG.
writeFileSync('assets/reward-art/star-shard.svg', `${starShardSvg(1024)}\n`);
render('assets/reward-art/star-shard.png', (d) =>
  drawLayers(d.canvas, starShardLayers),
);

// The run bonus: the shard as a shooting star.
writeFileSync(
  'assets/reward-art/shooting-star.svg',
  `${shootingStarSvg(starShardSvg(), 1024)}\n`,
);
render('assets/reward-art/shooting-star.png', (d) => {
  drawLayers(d.canvas, shootingStarTail);
  d.canvas.save();
  d.canvas.translate(shootingStarHead.x, shootingStarHead.y);
  d.canvas.scale(shootingStarHead.scale, shootingStarHead.scale);
  d.canvas.translate(-50, -51);
  drawLayers(d.canvas, starShardLayers);
  d.canvas.restore();
});

// The moon-phase streak: an SVG master per day and a 1024 px PNG per day.
for (let day = 0; day <= moonPhaseDays; day += 1) {
  writeFileSync(
    `assets/reward-art/moon-phase-${day}.svg`,
    `${moonPhaseSvg(day, 1024)}\n`,
  );
  const lit = kit.Path.MakeFromSVGString(litShape(day / moonPhaseDays));
  render(`assets/reward-art/moon-phase-${day}.png`, (d) =>
    drawLayers(d.canvas, moonPhaseLayers(day), (layer) =>
      layer.lit ? lit : undefined,
    ),
  );
}

// The milestone medal: the full moon (lit everywhere, so unclipped) in gold.
render('assets/reward-art/milestone-medal.png', (d) => {
  drawLayers(d.canvas, milestoneMedalLayers);
  d.canvas.save();
  place(d.canvas, milestoneMoonTransform);
  drawLayers(d.canvas, moonPhaseLayers(moonPhaseDays));
  d.canvas.restore();
});

// SVG masters of the glyphs (drawn in the app by KnightlyGlyph; there are no
// native tab icons since the one-screen home).
for (const name of Object.keys(glyphArt))
  writeFileSync(`assets/navigation/${name}.svg`, `${glyphSvg(name, 32)}\n`);
