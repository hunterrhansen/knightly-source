// Knightly's navigation glyphs in the star shard's glossy cel: the moon,
// board, bars and gear, with a warm outline, a lower-right shade, a top-left
// highlight and a glint. Drawn on a 32-unit grid as layers; `clip` layers are
// clipped to the glyph's silhouette so shading never spills past the outline.
// Self-contained, so `scripts/generate-brand.mjs` can write their SVG
// masters from it.

type GlyphLayer = Readonly<{
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Clip to the glyph's silhouette. */
  clip?: boolean;
}>;
type GlyphArt = Readonly<{
  silhouette: readonly string[];
  layers: readonly GlyphLayer[];
}>;

const outline = '#24211c'; // tokens.pieces.outline
const specular = '#fffbe8';

/** The silhouette under a thick outline, then its shade. */
const base = (silhouette: readonly string[], shade: string): GlyphLayer[] => [
  ...silhouette.map((d) => ({
    d,
    fill: outline,
    stroke: outline,
    strokeWidth: 3.4,
  })),
  ...silhouette.map((d) => ({ d, fill: shade })),
];

// Moon: the Watch (the path). Tonight's crescent, the streak's
// moon shape, in the moon phases' gold on a night-sky disc with two stars.
const sky = 'M16 3a13 13 0 1 1 0 26a13 13 0 1 1 0-26z';
const skyLit = 'M15 2a13 13 0 1 1 0 26a13 13 0 1 1 0-26z';
const crescent =
  'M24.59 18.44A8.93 8.93 0 1 1 13.56 7.41a7.35 7.35 0 0 0 11.03 11.03z';
const today: GlyphArt = {
  silhouette: [sky],
  layers: [
    ...base([sky], '#2f3656'),
    { d: skyLit, fill: '#3b4470', clip: true },
    { d: crescent, fill: '#ffc233', stroke: outline, strokeWidth: 1.6 },
    { d: 'M11.2 20.6a6 6 0 0 1-1.6-5.4', stroke: '#ffe48a', strokeWidth: 1.4 },
    { d: 'M21.5 8.6a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z', fill: specular },
    { d: 'M24.8 13.2a.8.8 0 1 1 0 1.6a.8.8 0 1 1 0-1.6z', fill: specular },
  ],
};

// Board: Games.
const board =
  'M9 4h14a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9a5 5 0 0 1 5-5z';
const boardLit =
  'M8 3h14a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z';
const games: GlyphArt = {
  silhouette: [board],
  layers: [
    ...base([board], '#5f8443'),
    { d: boardLit, fill: '#7da35a', clip: true },
    { d: 'M3 15V8a5 5 0 0 1 5-5h7v12z', fill: '#eaefd8', clip: true },
    { d: 'M27 15v7a5 5 0 0 1-5 5h-7V15z', fill: '#eaefd8', clip: true },
    { d: 'M6 7.5a2.5 2.5 0 0 1 2.5-2.5h3', stroke: specular, strokeWidth: 1.6 },
  ],
};

// Bars: Progress.
const bars = [
  'M6.5 16h2a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-2A2.5 2.5 0 0 1 4 24.5v-6A2.5 2.5 0 0 1 6.5 16z',
  'M15 10h2a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5h-2a2.5 2.5 0 0 1-2.5-2.5v-12A2.5 2.5 0 0 1 15 10z',
  'M23.5 4h2A2.5 2.5 0 0 1 28 6.5v18a2.5 2.5 0 0 1-2.5 2.5h-2a2.5 2.5 0 0 1-2.5-2.5v-18A2.5 2.5 0 0 1 23.5 4z',
];
const barsLit = [
  'M5.7 15.2h2a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-2a2.5 2.5 0 0 1-2.5-2.5v-6a2.5 2.5 0 0 1 2.5-2.5z',
  'M14.2 9.2h2a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5h-2a2.5 2.5 0 0 1-2.5-2.5v-12a2.5 2.5 0 0 1 2.5-2.5z',
  'M22.7 3.2h2a2.5 2.5 0 0 1 2.5 2.5v18a2.5 2.5 0 0 1-2.5 2.5h-2a2.5 2.5 0 0 1-2.5-2.5v-18a2.5 2.5 0 0 1 2.5-2.5z',
];
const progress: GlyphArt = {
  silhouette: bars,
  layers: [
    ...base(bars, '#d39a00'),
    ...barsLit.map((d) => ({ d, fill: '#ffc233', clip: true })),
    {
      d: 'M3 15h4v3H3zM11.5 9h4v3h-4zM20 3h4v3h-4z',
      fill: '#ffe48a',
      clip: true,
    },
    { d: 'M23 6.5v6', stroke: specular, strokeWidth: 1.4 },
  ],
};

// Star: Progress's tile on the path (a move that stopped slipping), in the
// stars' gold.
const starShape =
  'M16.00 3.50L19.64 11.98L28.84 12.83L21.90 18.92L23.94 27.92L16.00 23.20L8.06 27.92L10.10 18.92L3.16 12.83L12.36 11.98z';
const starLit =
  'M15.20 2.70L18.84 11.18L28.04 12.03L21.10 18.12L23.14 27.12L15.20 22.40L7.26 27.12L9.30 18.12L2.36 12.03L11.56 11.18z';
const star: GlyphArt = {
  silhouette: [starShape],
  layers: [
    ...base([starShape], '#d39a00'),
    { d: starLit, fill: '#ffc233', clip: true },
    { d: 'M2 2h14v10l-14 2z', fill: '#ffe48a', clip: true },
    { d: 'M12.6 12.6l2.2-5.2', stroke: specular, strokeWidth: 1.4 },
  ],
};

// Gear: Settings. Eight blunt teeth round a hub, in sky.
const gearPath = (dx: number, dy: number) => {
  const point = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    const x = 16 + dx + r * Math.cos(a);
    const y = 16 + dy + r * Math.sin(a);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  const teeth = Array.from({ length: 8 }, (_, k) => {
    const a = k * 45;
    return [
      point(a - 22.5, 9.6),
      point(a - 13, 9.6),
      point(a - 9, 12.8),
      point(a + 9, 12.8),
      point(a + 13, 9.6),
    ].join('L');
  });
  return `M${teeth.join('L')}Z`;
};
const gear = gearPath(0, 0);
const settings: GlyphArt = {
  silhouette: [gear],
  layers: [
    ...base([gear], '#2a83cc'),
    { d: gearPath(-0.9, -0.9), fill: '#49a8f2', clip: true },
    { d: 'M2 2h13v6l-11 9H2z', fill: '#8fd0fa', clip: true },
    {
      d: 'M16 11.6a4.4 4.4 0 1 1 0 8.8a4.4 4.4 0 1 1 0-8.8z',
      fill: '#fff6d6',
      stroke: outline,
      strokeWidth: 2.4,
    },
    {
      d: 'M14.6 14.2a1.8 1.8 0 0 1 1.6-.9',
      stroke: '#ffffff',
      strokeWidth: 1.2,
    },
    { d: 'M9.2 7.4l1.4 1.2', stroke: specular, strokeWidth: 1.4 },
  ],
};

export const glyphArt = { today, games, progress, star, settings } as const;
export type GlyphArtName = keyof typeof glyphArt;

/** A glyph as standalone SVG markup, for exports. */
export function glyphSvg(name: GlyphArtName, size = 32) {
  const art = glyphArt[name];
  const clip = `<clipPath id="g-${name}">${art.silhouette.map((d) => `<path d="${d}"/>`).join('')}</clipPath>`;
  const layers = art.layers
    .map(
      (l) =>
        `<path d="${l.d}" fill="${l.fill ?? 'none'}"${
          l.stroke
            ? ` stroke="${l.stroke}" stroke-width="${l.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`
            : ''
        }${l.clip ? ` clip-path="url(#g-${name})"` : ''}/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><defs>${clip}</defs>${layers}</svg>`;
}
