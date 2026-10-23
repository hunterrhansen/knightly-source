// The moon-phase streak symbol in the star shard's glossy cel style: a night
// disc whose lit part waxes from new (day 0) to full (day 7). Drawn in a
// 100-unit box as layers so MoonPhase and `scripts/generate-brand.mjs` share
// one source. Lit layers are clipped to the phase's lit shape, so the cel
// shading reads as one lit sphere at every phase.

export type MoonLayer = Readonly<{
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Clip this layer to the lit part of the moon. */
  lit?: boolean;
}>;

/** Days in one moon: the streak's weekly cycle, full on day 7. */
export const moonPhaseDays = 7;

/**
 * The moon for a streak night: night N (N ≥ 1) is phase ((N − 1) mod 7) + 1,
 * so nights 7, 14, 21… are full; 0 (no streak) is the new moon. A done day
 * whose night is unknown (an older server) shows the full moon.
 */
export function moonPhaseForNight(night: number | null | undefined) {
  if (night == null) return moonPhaseDays;
  if (night <= 0) return 0;
  return ((night - 1) % moonPhaseDays) + 1;
}

const cx = 50;
const cy = 50;
/** The disc inside the outline. */
const r = 35;

const outline = '#24211c'; // tokens.pieces.outline
const night = '#2f3656'; // the unlit side, a night-sky blue
const nightEdge = '#3b4470';
const shade = '#d39a00';
const gold = '#ffc233';
const highlight = '#ffe48a';
const crater = '#eeb21c';
const specular = '#fffbe8';
const starlight = '#49a8f2';

const f = (n: number) => +n.toFixed(2);

const circle = (x: number, y: number, radius: number) =>
  `M${f(x - radius)} ${y} A${radius} ${radius} 0 1 0 ${f(x + radius)} ${y} A${radius} ${radius} 0 1 0 ${f(x - radius)} ${y} Z`;

/**
 * The lit part of a waxing moon lit from the right: the right half-disc
 * closed by the terminator, an ellipse arc that bulges right for a crescent
 * and left for a gibbous moon. `lit` runs from 0 (new) to 1 (full).
 */
export function litShape(lit: number) {
  const top = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;
  if (lit >= 1) return circle(cx, cy, r);
  const terminator = f(r * Math.abs(1 - 2 * lit));
  const sweep = lit < 0.5 ? 0 : 1;
  return `M${top} A${r} ${r} 0 0 1 ${bottom} A${terminator} ${r} 0 0 ${sweep} ${top} Z`;
}

/** The layers for a streak day, 0 (new moon) to 7 (full). */
export function moonPhaseLayers(day: number): readonly MoonLayer[] {
  const lit = Math.min(Math.max(day, 0), moonPhaseDays) / moonPhaseDays;
  const layers: MoonLayer[] = [
    { d: circle(cx, cy, r + 6), fill: outline },
    { d: circle(cx, cy, r), fill: night },
    // A soft lighter rim on the unlit side, so a new moon still reads round.
    { d: circle(cx, cy, r - 2.5), stroke: nightEdge, strokeWidth: 2 },
  ];
  if (lit > 0)
    layers.push(
      { d: circle(cx, cy, r), fill: shade, lit: true },
      { d: circle(cx - 2.5, cy - 2.5, r - 5), fill: gold, lit: true },
      { d: circle(cx - 10, cy - 10, 13), fill: highlight, lit: true },
      { d: circle(cx + 12, cy + 4, 5.5), fill: crater, lit: true },
      { d: circle(cx + 2, cy + 18, 3.5), fill: crater, lit: true },
      { d: circle(cx + 18, cy - 14, 3), fill: crater, lit: true },
      {
        d: 'M40 30 Q33 31 31 38 Q37 37 40 30 Z',
        fill: specular,
        lit: true,
      },
    );
  layers.push({
    d: `M${f(cx + r * Math.cos(0.35))} ${f(cy + r * Math.sin(0.35))} A${r} ${r} 0 0 1 ${f(cx + r * Math.cos(1.2))} ${f(cy + r * Math.sin(1.2))}`,
    stroke: starlight,
    strokeWidth: 2.5,
  });
  return layers;
}

/** A phase as standalone SVG markup, for exports and canvas renderers. */
export function moonPhaseSvg(day: number, size = 100) {
  const lit = Math.min(Math.max(day, 0), moonPhaseDays) / moonPhaseDays;
  const clip = `<clipPath id="lit"><path d="${litShape(lit)}"/></clipPath>`;
  const layers = moonPhaseLayers(day)
    .map(
      (l) =>
        `<path d="${l.d}" fill="${l.fill ?? 'none'}"${
          l.stroke
            ? ` stroke="${l.stroke}" stroke-width="${l.strokeWidth}" stroke-linecap="round"`
            : ''
        }${l.lit ? ' clip-path="url(#lit)"' : ''}/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><defs>${clip}</defs>${layers}</svg>`;
}
