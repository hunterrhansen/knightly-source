// The star shard, Knightly's points reward: a chunky four-point twinkle in
// glossy cel (docs/art-style-lock.md, lock record). Drawn in a 100-unit box
// as layers, back to front, so the app (StarShard) and
// `scripts/generate-brand.mjs` (the SVG and PNG in assets/reward-art/) share
// one source. Round joins on thick strokes give the tips their toy softness.

export type ShardLayer = Readonly<{
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}>;

const outline = '#24211c'; // tokens.pieces.outline
const shade = '#d39a00';
const gold = '#ffc233';
const highlight = '#ffe48a';
const specular = '#fffbe8';
const starlight = '#49a8f2'; // sky: the rim light that keeps it readable on dark

const body =
  'M50 13 L63.44 37.56 L88 51 L63.44 64.44 L50 89 L36.56 64.44 L12 51 L36.56 37.56 Z';
const core =
  'M48.5 23 L57.69 40.31 L75 49.5 L57.69 58.69 L48.5 76 L39.31 58.69 L22 49.5 L39.31 40.31 Z';
const light =
  'M46 33 L50.6 41.9 L59.5 46.5 L50.6 51.1 L46 60 L41.4 51.1 L32.5 46.5 L41.4 41.9 Z';

export const starShardLayers: readonly ShardLayer[] = [
  { d: body, fill: outline, stroke: outline, strokeWidth: 18 },
  { d: body, fill: shade, stroke: shade, strokeWidth: 8 },
  { d: core, fill: gold, stroke: gold, strokeWidth: 7 },
  { d: light, fill: highlight, stroke: highlight, strokeWidth: 4 },
  { d: 'M45.5 38 Q38.5 38.5 38 45.5 Q45 45 45.5 38 Z', fill: specular },
  {
    d: 'M81.23 56.43 L64.84 65.84 L55.43 82.23',
    stroke: starlight,
    strokeWidth: 2.5,
  },
];

/** The layers as standalone SVG markup, for exports and canvas renderers. */
export function starShardSvg(size = 100) {
  const layers = starShardLayers
    .map(
      (l) =>
        `<path d="${l.d}" fill="${l.fill ?? 'none'}"${
          l.stroke
            ? ` stroke="${l.stroke}" stroke-width="${l.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`
            : ''
        }/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${layers}</svg>`;
}
