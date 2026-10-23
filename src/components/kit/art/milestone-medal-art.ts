// The streak milestone medal (7, 30, 100, 365 nights): the full moon set in a
// gold medal on brand-green ribbon tails, in the star shard's glossy cel.
// Drawn in a 100-unit box; self-contained so `scripts/generate-brand.mjs` can
// import it. The moon is the moon-phase art at day 7, placed by
// `milestoneMoonTransform`.

export type MedalLayer = Readonly<{
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}>;

const outline = '#24211c'; // tokens.pieces.outline
const brand = '#6cc23a';
const brandShade = '#4a9620';
const shade = '#d39a00';
const gold = '#ffc233';
const highlight = '#ffe48a';
const specular = '#fffbe8';
const night = '#2f3656'; // the moon-phase art's night sky

const circle = (x: number, y: number, r: number) =>
  `M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`;

const cx = 50;
const cy = 44;
const ribbonLeft = 'M31 50 L47 57 L39 95 L32 86 L23 92 Z';
const ribbonRight = 'M69 50 L53 57 L61 95 L68 86 L77 92 Z';

/** Back to front: ribbon tails, then the gold disc with a recessed night sky. */
export const milestoneMedalLayers: readonly MedalLayer[] = [
  { d: ribbonLeft, fill: outline, stroke: outline, strokeWidth: 8 },
  { d: ribbonRight, fill: outline, stroke: outline, strokeWidth: 8 },
  { d: ribbonLeft, fill: brandShade },
  { d: ribbonRight, fill: brandShade },
  { d: 'M33 52 L45 57 L39 87 L33 80 Z', fill: brand },
  { d: 'M67 52 L55 57 L61 87 L67 80 Z', fill: brand },
  { d: circle(cx, cy, 33), fill: outline, stroke: outline, strokeWidth: 8 },
  { d: circle(cx, cy, 33), fill: shade },
  { d: circle(cx - 1.5, cy - 1.5, 30), fill: gold },
  // A recessed night sky with two stars, for the moon to hang in.
  { d: circle(cx, cy, 24), fill: night },
  { d: circle(cx - 14, cy + 9, 1.4), fill: specular },
  { d: circle(cx + 13, cy - 15, 1.1), fill: specular },
  // Light catching the rim's upper left.
  {
    d: 'M27 34 A26 26 0 0 1 40 21',
    stroke: highlight,
    strokeWidth: 4,
  },
  { d: 'M24.5 41 A26 26 0 0 1 25.5 37.5', stroke: specular, strokeWidth: 4 },
];

/** The full moon inside the recess: the 100-unit moon art scaled to fit. */
export const milestoneMoonTransform = `translate(${cx} ${cy}) scale(0.47) translate(-50 -50)`;
