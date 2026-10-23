// The run bonus: the star shard streaking in as a shooting star, its tail
// trailing to the lower left. Same glossy cel as the shard; drawn in a
// 100-unit box so ShootingStar and `scripts/generate-brand.mjs` share it.
// Self-contained (the generator imports it directly): the head is the shard's
// own art, passed in where markup is needed.

export type StarLayer = Readonly<{
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}>;

const outline = '#24211c'; // tokens.pieces.outline
const shade = '#d39a00';
const gold = '#ffc233';
const highlight = '#ffe48a';
const tail = 'M52.81 30.81 L12 90 L71.19 49.19 Z';

/** The tail, back to front: two motion streaks, then the outline, shade, a
 * gold core and a light streak, wide at the head and tapering away from it. */
export const shootingStarTail: readonly StarLayer[] = [
  // Two short motion streaks beside the tail.
  { d: 'M37 31 L20 48', stroke: outline, strokeWidth: 7 },
  { d: 'M71 65 L54 82', stroke: outline, strokeWidth: 7 },
  { d: 'M37 31 L20 48', stroke: gold, strokeWidth: 3 },
  { d: 'M71 65 L54 82', stroke: gold, strokeWidth: 3 },
  { d: tail, fill: outline, stroke: outline, strokeWidth: 10 },
  { d: tail, fill: shade },
  { d: 'M53.84 36.84 L21 81 L65.16 48.16 Z', fill: gold },
  { d: 'M54.74 42.74 L32 70 L59.26 47.26 Z', fill: highlight },
];

/** Where the shard sits: its centre (50, 51) moved to (62, 40) at 60%. */
export const shootingStarHead = { x: 62, y: 40, scale: 0.6 };
export const shootingStarHeadTransform = `translate(${shootingStarHead.x} ${shootingStarHead.y}) scale(${shootingStarHead.scale}) translate(-50 -51)`;

/** The shooting star as SVG markup, around the shard's own `<svg>` markup. */
export function shootingStarSvg(shardSvg: string, size = 100) {
  const path = (l: StarLayer) =>
    `<path d="${l.d}" fill="${l.fill ?? 'none'}"${
      l.stroke
        ? ` stroke="${l.stroke}" stroke-width="${l.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`
        : ''
    }/>`;
  const head = shardSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${shootingStarTail.map(path).join('')}<g transform="${shootingStarHeadTransform}">${head}</g></svg>`;
}
