import type { Layer, Sprite } from '../types';

// The posts' landmarks (docs/specs/2026-10-20-ward-path-design.md, "Place
// art"): each post of the ward path is a place in the castle, drawn as one
// landmark that stands behind the wall's battlements in the watch scene, so a
// card still reads as the watch with the place rising over it. Glossy cel as
// the rest of the kit: a warm dark outline, two-tone shading with the light
// from the top left, one pale highlight, gold where a window is lit. Drawn in
// code, no AI. Each sprite's base runs below the wall walk, which hides it.

const W = 200;
const H = 160;

const c = {
  outline: '#24211c',
  stone: '#6a6355',
  stoneShade: '#524c41',
  stoneLight: 'rgba(255, 244, 214, 0.22)',
  dark: '#1c1a17',
  glow: '#ffc233',
  glowCore: '#ffe48a',
  wood: '#6b4a2b',
  woodShade: '#4f3620',
  iron: '#3b3f4a',
  ironLight: '#5c6272',
  banner: '#a8413a',
  bannerShade: '#7d2f2a',
  cream: '#e3d6b6',
  creamShade: '#bfae88',
  slate: '#3f4658',
  slateShade: '#2f3546',
  ivy: '#3f6b3a',
  smoke: 'rgba(200, 204, 214, 0.35)',
  forge: '#d9662c',
  glass1: '#4a7fd0',
  glass2: '#c9a63a',
  falcon: '#8a6a48',
} as const;

const line = { stroke: c.outline, strokeWidth: 3, linejoin: 'round' } as const;

const landmark = (
  id: string,
  layers: readonly Layer[],
  clips?: Record<string, string>,
): Sprite => ({
  id,
  viewBox: [W, H],
  layers,
  ...(clips ? { clips } : {}),
  sizes: { min: 96, max: 160 },
});

/** Merlons along `y` from `x0` to `x1`: a crenellated top as one path. */
function crenels(x0: number, x1: number, y: number, size = 10): string {
  let d = `M${x0} ${y + size}`;
  for (let x = x0; x < x1; x += size * 2) {
    const end = Math.min(x + size, x1);
    d += ` V${y} H${end} V${y + size}`;
    if (end < x1) d += ` H${Math.min(end + size, x1)}`;
  }
  return `${d} V${y + size}`;
}

/** A stone block with a crenellated top, shaded on its right. */
function block(x: number, y: number, width: number, height: number): Layer[] {
  const top = crenels(x, x + width, y);
  const body = `${top} V${y + height} H${x} Z`;
  const shadeX = x + width * 0.72;
  return [
    { d: body, fill: c.stone },
    {
      kind: 'rect',
      x: shadeX,
      y: y + 10,
      width: x + width - shadeX,
      height: height - 10,
      fill: c.stoneShade,
    },
    {
      kind: 'line',
      x1: x + 4,
      y1: y + 14,
      x2: x + 4,
      y2: y + height,
      stroke: c.stoneLight,
      strokeWidth: 3,
      linecap: 'round',
    },
    { d: body, fill: 'none', ...line },
  ];
}

/** A lit slit window. */
const slit = (x: number, y: number, h = 12): Layer[] => [
  {
    kind: 'rect',
    x,
    y,
    width: 6,
    height: h,
    rx: 3,
    fill: c.glow,
    ...line,
    strokeWidth: 2,
  },
  {
    kind: 'rect',
    x: x + 2,
    y: y + 2,
    width: 2,
    height: h - 5,
    rx: 1,
    fill: c.glowCore,
  },
];

/** A pennant on a pole, the cloth flying right. */
const pennant = (x: number, y: number, h = 26): Layer[] => [
  {
    kind: 'line',
    x1: x,
    y1: y,
    x2: x,
    y2: y + h,
    stroke: c.outline,
    strokeWidth: 3,
    linecap: 'round',
  },
  {
    d: `M${x} ${y + 2} L${x + 22} ${y + 8} L${x} ${y + 14} Z`,
    fill: c.banner,
    ...line,
    strokeWidth: 2.5,
  },
  {
    d: `M${x} ${y + 9} L${x + 22} ${y + 8} L${x} ${y + 14} Z`,
    fill: c.bannerShade,
  },
];

/** Post 1, the Gatehouse: two drum towers either side of the gate, where every
 * watch starts. */
const gatehouse = landmark('post.gatehouse', [
  ...block(14, 34, 54, 126),
  ...block(132, 34, 54, 126),
  ...block(62, 62, 76, 98),
  {
    d: 'M80 160 V120 Q80 98 100 98 Q120 98 120 120 V160 Z',
    fill: c.dark,
    ...line,
  },
  ...[88, 100, 112].map(
    (x): Layer => ({
      kind: 'line',
      x1: x,
      y1: 101,
      x2: x,
      y2: 160,
      stroke: c.iron,
      strokeWidth: 3,
    }),
  ),
  ...[118, 136].map(
    (y): Layer => ({
      kind: 'line',
      x1: 81,
      y1: y,
      x2: 119,
      y2: y,
      stroke: c.iron,
      strokeWidth: 3,
    }),
  ),
  ...slit(38, 60),
  ...slit(38, 96),
  ...slit(156, 60),
  ...slit(156, 96),
  ...slit(97, 74, 10),
  ...pennant(41, 8),
]);

/** Post 4, the Lists: the tiltyard, where knights charge. A striped pavilion,
 * the tilt barrier and two lances crossed. */
const lists = landmark('post.lists', [
  { d: 'M60 92 L100 40 L140 92 Z', fill: c.cream, ...line },
  { d: 'M100 40 L140 92 H118 Z', fill: c.creamShade },
  { d: 'M100 40 L84 92 H72 Z', fill: c.banner },
  { d: 'M100 40 L112 92 H124 Z', fill: c.banner },
  { d: 'M60 92 L100 40 L140 92 Z', fill: 'none', ...line },
  { kind: 'rect', x: 68, y: 92, width: 64, height: 68, fill: c.cream, ...line },
  { kind: 'rect', x: 108, y: 94, width: 22, height: 64, fill: c.creamShade },
  { kind: 'rect', x: 80, y: 92, width: 10, height: 68, fill: c.banner },
  { kind: 'rect', x: 110, y: 92, width: 10, height: 68, fill: c.bannerShade },
  { d: 'M88 160 V124 Q100 112 112 124 V160 Z', fill: c.dark, ...line },
  { kind: 'rect', x: 68, y: 92, width: 64, height: 68, fill: 'none', ...line },
  ...pennant(100, 14),
  // The tilt barrier runs the yard's length.
  {
    kind: 'rect',
    x: 0,
    y: 110,
    width: W,
    height: 9,
    rx: 3,
    fill: c.wood,
    ...line,
  },
  { kind: 'rect', x: 0, y: 115, width: W, height: 4, fill: c.woodShade },
  ...[10, 52, 148, 190].map(
    (x): Layer => ({
      kind: 'rect',
      x: x - 4,
      y: 110,
      width: 8,
      height: 50,
      fill: c.wood,
      ...line,
      strokeWidth: 2.5,
    }),
  ),
  // Two lances, crossed over the barrier.
  {
    kind: 'line',
    x1: 150,
    y1: 156,
    x2: 186,
    y2: 58,
    stroke: c.outline,
    strokeWidth: 7,
    linecap: 'round',
  },
  {
    kind: 'line',
    x1: 150,
    y1: 156,
    x2: 186,
    y2: 58,
    stroke: c.cream,
    strokeWidth: 3.5,
    linecap: 'round',
  },
  {
    kind: 'line',
    x1: 190,
    y1: 156,
    x2: 154,
    y2: 58,
    stroke: c.outline,
    strokeWidth: 7,
    linecap: 'round',
  },
  {
    kind: 'line',
    x1: 190,
    y1: 156,
    x2: 154,
    y2: 58,
    stroke: c.banner,
    strokeWidth: 3.5,
    linecap: 'round',
  },
  ...pennant(18, 74, 50),
]);

const ARCH = 'M58 160 V102 Q58 66 100 66 Q142 66 142 102 V160 Z';
/** Post 6, the Portcullis: the iron grille half lowered in the gate passage,
 * its chains running up to the winch room, lit, above. */
const portcullis = landmark(
  'post.portcullis',
  [
    ...block(26, 26, 148, 134),
    { d: ARCH, fill: c.dark, ...line },
    // The grille, clipped to the arch: bars, cross bars and spikes.
    ...[66, 78, 90, 102, 114, 126].map(
      (x): Layer => ({
        kind: 'rect',
        x,
        y: 60,
        width: 5,
        height: 74,
        fill: c.iron,
        clip: 'arch',
      }),
    ),
    ...[82, 100, 118].map(
      (y): Layer => ({
        kind: 'rect',
        x: 58,
        y,
        width: 84,
        height: 5,
        fill: c.iron,
        clip: 'arch',
      }),
    ),
    ...[66, 78, 90, 102, 114, 126].map(
      (x): Layer => ({
        d: `M${x} 134 H${x + 5} L${x + 2.5} 142 Z`,
        fill: c.ironLight,
        clip: 'arch',
      }),
    ),
    ...[66, 102].map(
      (x): Layer => ({
        kind: 'rect',
        x: x + 1,
        y: 62,
        width: 2,
        height: 70,
        fill: c.ironLight,
        clip: 'arch',
      }),
    ),
    { d: ARCH, fill: 'none', ...line },
    // Chains up to the winch room.
    {
      kind: 'line',
      x1: 66,
      y1: 70,
      x2: 80,
      y2: 46,
      stroke: c.iron,
      strokeWidth: 3,
      linecap: 'round',
    },
    {
      kind: 'line',
      x1: 134,
      y1: 70,
      x2: 120,
      y2: 46,
      stroke: c.iron,
      strokeWidth: 3,
      linecap: 'round',
    },
    {
      kind: 'rect',
      x: 80,
      y: 38,
      width: 40,
      height: 14,
      rx: 4,
      fill: c.glow,
      ...line,
      strokeWidth: 2.5,
    },
    {
      kind: 'rect',
      x: 84,
      y: 41,
      width: 14,
      height: 4,
      rx: 2,
      fill: c.glowCore,
    },
    ...slit(38, 52),
    ...slit(156, 52),
  ],
  { arch: ARCH },
);

// More of the kit's shapes for the posts below. In the scene only a sprite's
// top ~125 units show over the battlements, so each place is drawn there.

/** A pitched roof from x0 to x1 on `y`, its peak at `peak`, shaded on the right. */
function roof(
  x0: number,
  x1: number,
  y: number,
  peak: number,
  fill: string,
  shade: string,
): Layer[] {
  const mid = (x0 + x1) / 2;
  const d = `M${x0} ${y} L${mid} ${peak} L${x1} ${y} Z`;
  return [
    { d, fill },
    {
      d: `M${mid} ${peak} L${x1} ${y} H${mid + (x1 - mid) * 0.35} Z`,
      fill: shade,
    },
    { d, fill: 'none', ...line },
  ];
}

/** A plain stone wall (no crenels), shaded on its right. */
function wallBlock(
  x: number,
  y: number,
  width: number,
  height: number,
): Layer[] {
  const shadeX = x + width * 0.72;
  return [
    { kind: 'rect', x, y, width, height, fill: c.stone },
    {
      kind: 'rect',
      x: shadeX,
      y,
      width: x + width - shadeX,
      height,
      fill: c.stoneShade,
    },
    {
      kind: 'line',
      x1: x + 4,
      y1: y + 4,
      x2: x + 4,
      y2: y + height,
      stroke: c.stoneLight,
      strokeWidth: 3,
      linecap: 'round',
    },
    { kind: 'rect', x, y, width, height, fill: 'none', ...line },
  ];
}

/** A lit arched window. */
function archWindow(
  x: number,
  y: number,
  w = 12,
  h = 18,
  glass: string = c.glow,
): Layer[] {
  const d = `M${x} ${y + h} V${y + w / 2} Q${x} ${y} ${x + w / 2} ${y} Q${x + w} ${y} ${x + w} ${y + w / 2} V${y + h} Z`;
  return [
    { d, fill: glass, ...line, strokeWidth: 2.5 },
    {
      kind: 'rect',
      x: x + 2.5,
      y: y + w / 2,
      width: 2.5,
      height: h - w / 2 - 3,
      rx: 1,
      fill: c.glowCore,
    },
  ];
}

/** A dark doorway. */
const doorway = (x: number, y: number, w: number, h: number): Layer => ({
  d: `M${x} ${y + h} V${y + w / 2} Q${x} ${y} ${x + w / 2} ${y} Q${x + w} ${y} ${x + w} ${y + w / 2} V${y + h} Z`,
  fill: c.dark,
  ...line,
});

/** A round tower: a body and a cone roof. */
function roundTower(
  x: number,
  y: number,
  width: number,
  height: number,
  cone = 34,
): Layer[] {
  return [
    ...wallBlock(x, y, width, height),
    ...roof(x - 6, x + width + 6, y + 2, y - cone, c.slate, c.slateShade),
  ];
}

/** Post 2, the Drawbridge: the bridge lowered on its chains from the gate. */
const drawbridge = landmark('post.drawbridge', [
  ...block(54, 20, 92, 140),
  doorway(78, 62, 44, 98),
  {
    kind: 'line',
    x1: 62,
    y1: 40,
    x2: 40,
    y2: 108,
    stroke: c.iron,
    strokeWidth: 3,
    linecap: 'round',
  },
  {
    kind: 'line',
    x1: 138,
    y1: 40,
    x2: 160,
    y2: 108,
    stroke: c.iron,
    strokeWidth: 3,
    linecap: 'round',
  },
  { d: 'M78 104 L40 112 L160 112 L122 104 Z', fill: c.wood, ...line },
  { d: 'M40 112 H160 V120 H40 Z', fill: c.woodShade, ...line },
  ...[60, 80, 100, 120, 140].map(
    (x): Layer => ({
      kind: 'line',
      x1: x,
      y1: 106,
      x2: x,
      y2: 112,
      stroke: c.woodShade,
      strokeWidth: 2,
    }),
  ),
  ...slit(70, 34),
  ...slit(124, 34),
  ...pennant(100, 0, 22),
]);

/** Post 3, the Armoury: a stone store with its weapons racked by the door. */
const armoury = landmark('post.armoury', [
  ...wallBlock(40, 56, 120, 104),
  ...roof(30, 170, 58, 22, c.slate, c.slateShade),
  doorway(86, 80, 28, 80),
  ...archWindow(54, 74),
  ...archWindow(134, 74),
  // A rack of swords and a round shield beside the door.
  {
    kind: 'rect',
    x: 120,
    y: 92,
    width: 30,
    height: 6,
    fill: c.wood,
    ...line,
    strokeWidth: 2.5,
  },
  ...[126, 134, 142].map(
    (x): Layer => ({
      kind: 'line',
      x1: x,
      y1: 84,
      x2: x,
      y2: 120,
      stroke: c.ironLight,
      strokeWidth: 3,
      linecap: 'round',
    }),
  ),
  {
    kind: 'circle',
    cx: 66,
    cy: 108,
    r: 11,
    fill: c.banner,
    ...line,
    strokeWidth: 2.5,
  },
  { kind: 'circle', cx: 66, cy: 108, r: 4, fill: c.glow },
]);

/** Post 5, the Turret Stair: a stair turret, its windows climbing the spiral. */
const turretStair = landmark('post.turret-stair', [
  ...wallBlock(30, 60, 70, 100),
  ...roundTower(96, 30, 48, 130, 30),
  ...archWindow(114, 104, 10, 14),
  ...archWindow(114, 78, 10, 14),
  ...archWindow(114, 52, 10, 14),
  {
    d: 'M100 112 L140 96 M100 86 L140 70',
    fill: 'none',
    stroke: c.stoneShade,
    strokeWidth: 3,
    linecap: 'round',
  },
  ...slit(52, 80),
  ...slit(72, 80),
]);

/** Post 7, the Guardroom: the guards' lodge, halberds crossed at its door and
 * a lantern hung beside it. */
const guardroom = landmark('post.guardroom', [
  ...block(44, 50, 112, 110),
  doorway(84, 76, 32, 84),
  {
    kind: 'line',
    x1: 70,
    y1: 64,
    x2: 96,
    y2: 120,
    stroke: c.wood,
    strokeWidth: 4,
    linecap: 'round',
  },
  {
    kind: 'line',
    x1: 130,
    y1: 64,
    x2: 104,
    y2: 120,
    stroke: c.wood,
    strokeWidth: 4,
    linecap: 'round',
  },
  { d: 'M64 60 L74 66 L68 72 Z', fill: c.ironLight, ...line, strokeWidth: 2 },
  {
    d: 'M136 60 L126 66 L132 72 Z',
    fill: c.ironLight,
    ...line,
    strokeWidth: 2,
  },
  {
    kind: 'line',
    x1: 140,
    y1: 80,
    x2: 140,
    y2: 88,
    stroke: c.outline,
    strokeWidth: 2,
  },
  {
    kind: 'rect',
    x: 135,
    y: 88,
    width: 10,
    height: 13,
    rx: 3,
    fill: c.glow,
    ...line,
    strokeWidth: 2,
  },
  ...slit(58, 76),
]);

/** Post 8, the Postern: a stretch of curtain wall and its small hidden door,
 * half under ivy. */
const postern = landmark('post.postern', [
  ...block(10, 40, 180, 120),
  doorway(124, 90, 22, 70),
  { kind: 'rect', x: 128, y: 96, width: 14, height: 4, fill: c.wood },
  ...[
    [112, 70, 9],
    [124, 80, 7],
    [150, 74, 10],
    [158, 92, 8],
    [118, 100, 6],
  ].map(
    ([cx = 0, cy = 0, r = 0]): Layer => ({
      kind: 'circle',
      cx,
      cy,
      r,
      fill: c.ivy,
      ...line,
      strokeWidth: 2,
    }),
  ),
  ...slit(40, 66),
  ...slit(76, 66),
]);

/** Post 9, the Watchtower: tall and slim, a brazier burning on its open top. */
const watchtower = landmark('post.watchtower', [
  ...wallBlock(78, 30, 44, 130),
  { d: crenels(70, 130, 14, 8) + ' V30 H70 Z', fill: c.stone, ...line },
  {
    kind: 'rect',
    x: 92,
    y: 2,
    width: 16,
    height: 10,
    rx: 3,
    fill: c.glow,
    ...line,
    strokeWidth: 2,
  },
  { d: 'M94 2 Q100 -8 106 2 Z', fill: c.glowCore },
  ...archWindow(94, 50, 12, 18),
  ...slit(97, 84),
]);

/** Post 10, the Barbican: the outer gate and its walled passage, the inner
 * gate behind it. */
const barbican = landmark('post.barbican', [
  ...block(84, 20, 96, 140),
  doorway(116, 56, 32, 104),
  ...block(20, 56, 88, 104),
  doorway(48, 84, 32, 76),
  { kind: 'rect', x: 50, y: 100, width: 28, height: 4, fill: c.iron },
  ...slit(30, 74),
  ...slit(98, 38),
  ...slit(162, 38),
]);

/** Post 11, the Smithy: an open forge glowing under its lean-to, the anvil
 * before it and smoke from the chimney. */
const smithy = landmark('post.smithy', [
  ...wallBlock(56, 58, 104, 102),
  ...roof(40, 172, 60, 34, c.wood, c.woodShade),
  {
    kind: 'rect',
    x: 138,
    y: 14,
    width: 16,
    height: 38,
    fill: c.stone,
    ...line,
  },
  { kind: 'circle', cx: 148, cy: 4, r: 6, fill: c.smoke },
  { kind: 'circle', cx: 158, cy: -4, r: 5, fill: c.smoke },
  {
    d: 'M80 120 V96 Q80 80 98 80 Q116 80 116 96 V120 Z',
    fill: c.forge,
    ...line,
  },
  { d: 'M88 120 Q98 98 108 120 Z', fill: c.glowCore },
  { d: 'M36 112 H70 L64 100 H42 Z', fill: c.iron, ...line, strokeWidth: 2.5 },
  ...archWindow(130, 82),
]);

/** Post 12, the Gate Towers: two tall round towers either side of the inner
 * gate, a walk bridging them. */
const gateTowers = landmark('post.gate-towers', [
  ...roundTower(22, 36, 50, 124),
  ...roundTower(128, 36, 50, 124),
  ...block(66, 74, 68, 86),
  doorway(84, 94, 32, 66),
  ...archWindow(41, 60),
  ...archWindow(147, 60),
  ...archWindow(41, 92),
  ...archWindow(147, 92),
]);

/** Post 13, the Stocks: the stocks on their platform in the yard. */
const stocks = landmark('post.stocks', [
  ...wallBlock(10, 70, 180, 90),
  ...archWindow(30, 84),
  ...archWindow(158, 84),
  {
    kind: 'rect',
    x: 56,
    y: 110,
    width: 88,
    height: 14,
    rx: 2,
    fill: c.woodShade,
    ...line,
  },
  {
    kind: 'rect',
    x: 66,
    y: 76,
    width: 8,
    height: 40,
    fill: c.wood,
    ...line,
    strokeWidth: 2.5,
  },
  {
    kind: 'rect',
    x: 126,
    y: 76,
    width: 8,
    height: 40,
    fill: c.wood,
    ...line,
    strokeWidth: 2.5,
  },
  {
    kind: 'rect',
    x: 60,
    y: 86,
    width: 80,
    height: 18,
    rx: 3,
    fill: c.wood,
    ...line,
  },
  {
    kind: 'line',
    x1: 60,
    y1: 95,
    x2: 140,
    y2: 95,
    stroke: c.outline,
    strokeWidth: 2,
  },
  ...[82, 100, 118].map(
    (cx): Layer => ({ kind: 'circle', cx, cy: 95, r: 4.5, fill: c.dark }),
  ),
]);

/** Post 14, the Kitchens: a great chimney, and through the wide arch a spit
 * turning over the fire. */
const kitchens = landmark('post.kitchens', [
  ...wallBlock(30, 60, 140, 100),
  ...roof(20, 180, 62, 30, c.slate, c.slateShade),
  { kind: 'rect', x: 120, y: 8, width: 22, height: 44, fill: c.stone, ...line },
  { kind: 'circle', cx: 131, cy: -2, r: 7, fill: c.smoke },
  {
    d: 'M62 122 V96 Q62 78 92 78 Q122 78 122 96 V122 Z',
    fill: c.forge,
    ...line,
  },
  { d: 'M74 122 Q92 102 110 122 Z', fill: c.glowCore },
  {
    kind: 'line',
    x1: 62,
    y1: 98,
    x2: 122,
    y2: 98,
    stroke: c.ironLight,
    strokeWidth: 3,
    linecap: 'round',
  },
  {
    kind: 'ellipse',
    cx: 92,
    cy: 98,
    rx: 10,
    ry: 6,
    fill: c.wood,
    ...line,
    strokeWidth: 2,
  },
  ...archWindow(142, 84),
]);

/** Post 15, the Courtyard: the square, its well in the middle and an arcade
 * behind. */
const courtyard = landmark('post.courtyard', [
  ...wallBlock(10, 50, 180, 110),
  ...[24, 64, 104, 144].map((x) => doorway(x, 66, 30, 40)),
  {
    kind: 'rect',
    x: 76,
    y: 104,
    width: 48,
    height: 18,
    rx: 3,
    fill: c.stone,
    ...line,
  },
  {
    d: 'M80 104 V84 M120 104 V84',
    fill: 'none',
    stroke: c.wood,
    strokeWidth: 4,
    linecap: 'round',
  },
  ...roof(72, 128, 86, 70, c.wood, c.woodShade),
  {
    kind: 'line',
    x1: 100,
    y1: 86,
    x2: 100,
    y2: 100,
    stroke: c.outline,
    strokeWidth: 2,
  },
  {
    kind: 'rect',
    x: 95,
    y: 98,
    width: 10,
    height: 7,
    rx: 2,
    fill: c.woodShade,
    ...line,
    strokeWidth: 2,
  },
]);

/** Post 16, the Chapel: a steep roof, a bell in its cote and a rose window
 * lit in colour. */
const chapel = landmark('post.chapel', [
  ...wallBlock(54, 64, 92, 96),
  ...roof(46, 154, 66, 14, c.slate, c.slateShade),
  {
    kind: 'rect',
    x: 92,
    y: -2,
    width: 16,
    height: 20,
    fill: c.stone,
    ...line,
    strokeWidth: 2.5,
  },
  { kind: 'circle', cx: 100, cy: 8, r: 4, fill: c.glow },
  { kind: 'circle', cx: 100, cy: 88, r: 15, fill: c.glass1, ...line },
  {
    d: 'M100 73 V103 M85 88 H115',
    fill: 'none',
    stroke: c.outline,
    strokeWidth: 2,
  },
  { d: 'M100 88 L89 77 A15 15 0 0 1 100 73 Z', fill: c.glass2 },
  { d: 'M100 88 L111 99 A15 15 0 0 1 100 103 Z', fill: c.glass2 },
  ...archWindow(66, 104, 12, 22, c.glass1),
  ...archWindow(122, 104, 12, 22, c.glass1),
]);

/** Post 17, the Mews: the hawks' wooden house, a hooded falcon on its perch. */
const mews = landmark('post.mews', [
  { kind: 'rect', x: 40, y: 70, width: 120, height: 90, fill: c.wood, ...line },
  { kind: 'rect', x: 126, y: 72, width: 32, height: 88, fill: c.woodShade },
  ...[60, 80, 100, 120, 140].map(
    (x): Layer => ({
      kind: 'line',
      x1: x,
      y1: 72,
      x2: x,
      y2: 160,
      stroke: c.woodShade,
      strokeWidth: 2,
    }),
  ),
  ...roof(30, 170, 72, 38, c.slate, c.slateShade),
  { kind: 'rect', x: 66, y: 90, width: 68, height: 30, fill: c.dark, ...line },
  {
    kind: 'line',
    x1: 70,
    y1: 112,
    x2: 130,
    y2: 112,
    stroke: c.wood,
    strokeWidth: 4,
    linecap: 'round',
  },
  {
    kind: 'ellipse',
    cx: 100,
    cy: 103,
    rx: 8,
    ry: 10,
    fill: c.falcon,
    ...line,
    strokeWidth: 2,
  },
  {
    kind: 'circle',
    cx: 100,
    cy: 92,
    r: 5.5,
    fill: c.banner,
    ...line,
    strokeWidth: 2,
  },
  {
    d: 'M95 112 L97 107 M105 112 L103 107',
    fill: 'none',
    stroke: c.glow,
    strokeWidth: 2,
  },
]);

/** Post 18, the Great Hall: a long hall under a steep roof, its tall windows
 * lit and banners at the door. */
const greatHall = landmark('post.great-hall', [
  ...wallBlock(16, 60, 168, 100),
  ...roof(6, 194, 62, 18, c.slate, c.slateShade),
  ...[32, 62, 126, 156].flatMap((x) => archWindow(x, 76, 14, 30)),
  doorway(88, 88, 24, 72),
  {
    kind: 'rect',
    x: 72,
    y: 72,
    width: 12,
    height: 26,
    fill: c.banner,
    ...line,
    strokeWidth: 2,
  },
  {
    kind: 'rect',
    x: 116,
    y: 72,
    width: 12,
    height: 26,
    fill: c.banner,
    ...line,
    strokeWidth: 2,
  },
]);

/** The Keep: the castle's last and strongest tower, beyond the posts. */
const keep = landmark('post.keep', [
  ...block(44, 26, 112, 134),
  ...roundTower(30, 14, 24, 60, 18),
  ...roundTower(146, 14, 24, 60, 18),
  ...[62, 92, 122].flatMap((x) => archWindow(x, 52)),
  ...[62, 122].flatMap((x) => archWindow(x, 90)),
  doorway(90, 96, 22, 64),
  ...pennant(100, -14, 40),
]);

/** The distant skyline behind the hills, by ward: the Outer Ward sees open
 * country, the Middle Ward the castle's rooftops, the Inner Ward the keep
 * looming. In silhouette, a shade lighter than the hills, with a window or two
 * lit, so the walk visibly moves inward. */
const SKY = { far: '#2c3552', window: 'rgba(255, 194, 51, 0.55)' } as const;
const skyline = (
  id: string,
  height: number,
  layers: readonly Layer[],
): Sprite => ({
  id,
  viewBox: [200, height],
  layers,
  sizes: { min: height, max: height },
});
const rooftops = skyline('ward.middle.rooftops', 60, [
  {
    d: 'M0 60 V40 L14 26 L28 40 V34 L44 20 L60 34 V42 H72 V24 L84 12 L96 24 V40 L112 28 L128 40 V30 H140 V18 L152 8 L164 18 V36 L180 24 L200 36 V60 Z',
    fill: SKY.far,
  },
  { kind: 'rect', x: 80, y: 30, width: 5, height: 7, fill: SKY.window },
  { kind: 'rect', x: 148, y: 24, width: 5, height: 7, fill: SKY.window },
]);
const keepLooming = skyline('ward.inner.keep', 96, [
  {
    d: 'M40 96 V30 H48 V20 H58 V30 H70 V22 H80 V30 H92 V22 H102 V30 H114 V22 H124 V30 H134 V20 H144 V30 H152 V96 Z',
    fill: SKY.far,
  },
  {
    d: 'M30 96 V40 L38 26 L46 40 V96 Z M146 96 V40 L154 26 L162 40 V96 Z',
    fill: SKY.far,
  },
  { kind: 'rect', x: 74, y: 46, width: 6, height: 10, fill: SKY.window },
  { kind: 'rect', x: 108, y: 46, width: 6, height: 10, fill: SKY.window },
  { kind: 'rect', x: 92, y: 64, width: 6, height: 10, fill: SKY.window },
]);
/** The skyline each ward shows; the Outer Ward has none. */
export const wardSkylines: Readonly<Record<'middle' | 'inner', Sprite>> = {
  middle: rooftops,
  inner: keepLooming,
};

/** Each post's landmark by its key (`curriculum.WARDS`). A post without one
 * yet shows the wall alone. */
export const postLandmarks: Readonly<Record<string, Sprite>> = {
  'board-vision': gatehouse,
  'mate-in-one': drawbridge,
  'loose-pieces': armoury,
  'double-attack': lists,
  'mate-in-two': turretStair,
  'the-pin': portcullis,
  'remove-the-defender': guardroom,
  'discovered-attack': postern,
  'defending-mate': watchtower,
  'in-between': barbican,
  'pawn-endings': smithy,
  'double-check': gateTowers,
  'pinned-pieces': stocks,
  'x-ray': kitchens,
  'square-of-the-pawn': courtyard,
  'mating-patterns': chapel,
  trapping: mews,
  luring: greatHall,
  keep,
};
