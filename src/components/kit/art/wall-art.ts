import type { Layer, Scene, Sprite, WallHeroState } from '../types';

// The castle-wall watch as a side-scroller (docs/specs/2026-10-18-watch-story-design.md,
// "The wall"): placeholder art in one 400 × 220 tile that repeats sideways,
// until the commissioned glossy-cel scene replaces it. Night colours stay in
// this art file, like the star shard's; a navy night palette is still a
// deferred brand decision.

const TILE = 400;
const HEIGHT = 220;
/** The top of the wall walk, where the knight stands. */
const WALL_TOP = 190;
const MERLON = { width: 34, height: 16 };

const c = {
  skyTop: '#121726',
  skyBottom: '#2e3854',
  star: '#f2f1ec',
  moon: '#ffc233',
  moonShade: '#d39a00',
  hills: '#1b2235',
  trees: '#111620',
  raider: '#3a4560',
  stone: '#5b5549',
  mortar: '#4a453b',
  skyTopKept: '#0e1220',
  skyBottomKept: '#27304a',
  halo: 'rgba(255, 194, 51, 0.16)',
  newMoonRim: '#7d869c',
  gate: '#3a2f22',
  gateShade: '#2b2219',
  outline: '#24211c',
} as const;

/** Colours the watch's board effects share with the scene. */
export const watchColors = {
  raiderPiece: '#3d3552',
  guardedFill: 'rgba(255, 228, 138, 0.45)',
  outline: '#24211c', // tokens.pieces.outline
  lantern: '#ffc233',
  lanternCore: '#ffe48a',
  /** The section banner over the path: a night-sky card, so the path's
   * green stays for tonight and the nights kept. */
  banner: '#2b3550',
  bannerEdge: '#3d4a6e',
  bannerLedge: '#161c2c',
  bannerEyebrow: '#9fb3e8',
  /** Text drawn over the night sky, in either theme. */
  moonlight: '#f2f1ec',
  /** The empty part of a ring drawn over the night sky. */
  ringTrack: 'rgba(242, 241, 236, 0.22)',
  /** The night-sky disc a session-end emblem lands on, and its rim. */
  skyDisc: '#2e3854',
  skyDiscRim: '#121726',
} as const;

const tile = (id: string, layers: readonly Layer[]): Sprite => ({
  id,
  viewBox: [TILE, HEIGHT],
  layers,
  sizes: { min: HEIGHT, max: HEIGHT },
});

const starPoints: readonly (readonly [number, number, number])[] = [
  [24, 30, 1.4],
  [70, 74, 1],
  [118, 22, 1.6],
  [160, 58, 1],
  [214, 96, 1.3],
  [262, 40, 1],
  [318, 82, 1.5],
  [366, 34, 1.1],
];
const stars = tile(
  'wall.stars',
  starPoints.map(
    ([cx, cy, r]): Layer => ({
      kind: 'circle',
      cx,
      cy,
      r,
      fill: c.star,
    }),
  ),
);

const moon: Sprite = {
  id: 'wall.moon',
  viewBox: [44, 44],
  sizes: { min: 44, max: 44 },
  layers: [
    { kind: 'circle', cx: 22, cy: 22, r: 18, fill: c.moonShade },
    { kind: 'circle', cx: 19, cy: 20, r: 15, fill: c.moon },
  ],
};

// Each path starts and ends at the same height so the tiles join seamlessly.
const hills = tile('wall.hills', [
  {
    d: 'M0 150 Q50 116 110 136 T230 128 T340 140 T400 150 V220 H0 Z',
    fill: c.hills,
  },
]);

const treeBumps = Array.from(
  { length: 20 },
  (_, i) => `Q${i * 20 + 10} ${i % 3 === 0 ? 146 : 154} ${i * 20 + 20} 168`,
).join(' ');
const treeline: Layer = { d: `M0 168 ${treeBumps} V220 H0 Z`, fill: c.trees };
/** The treeline, with the opponent's pieces lurking in it: the raiders. */
const trees = tile('wall.trees', [
  treeline,
  ...[
    { x: 258, glyph: '♝' },
    { x: 332, glyph: '♞' },
  ].map(
    ({ x, glyph }): Layer => ({
      kind: 'text',
      x,
      y: 166,
      text: glyph,
      fontSize: 24,
      anchor: 'middle',
      fill: c.raider,
    }),
  ),
]);
/** The treeline once the raids are turned back, or before any have come. */
const quietTrees = tile('wall.trees.quiet', [treeline]);

/** Battlements: a merlon every 50 units, so the gap repeats across tiles. */
const wall = tile('wall.battlements', [
  ...Array.from(
    { length: 8 },
    (_, i): Layer => ({
      kind: 'rect',
      x: 8 + i * 50,
      y: WALL_TOP - MERLON.height,
      width: MERLON.width,
      height: MERLON.height + 1,
      rx: 3,
      fill: c.stone,
    }),
  ),
  {
    kind: 'rect',
    x: 0,
    y: WALL_TOP,
    width: TILE,
    height: HEIGHT - WALL_TOP,
    fill: c.stone,
  },
  {
    kind: 'line',
    x1: 0,
    y1: WALL_TOP + 14,
    x2: TILE,
    y2: WALL_TOP + 14,
    stroke: c.mortar,
    strokeWidth: 2,
  },
  ...Array.from({ length: 8 }, (_, i): Layer => {
    const x = i * 50 + (i % 2 ? 25 : 0);
    return {
      kind: 'line',
      x1: x,
      y1: WALL_TOP + (i % 2 ? 14 : 0),
      x2: x,
      y2: WALL_TOP + (i % 2 ? 30 : 14),
      stroke: c.mortar,
      strokeWidth: 2,
    };
  }),
]);

/** Tonight's moon when the watch is kept: full, with a soft halo. */
const fullMoon: Sprite = {
  id: 'wall.moon.full',
  viewBox: [64, 64],
  sizes: { min: 64, max: 64 },
  layers: [
    { kind: 'circle', cx: 32, cy: 32, r: 31, fill: c.halo },
    { kind: 'circle', cx: 32, cy: 32, r: 22, fill: c.moonShade },
    { kind: 'circle', cx: 29, cy: 30, r: 19, fill: c.moon },
  ],
};

/** The first night's new moon: an outline still waiting to fill. */
const newMoon: Sprite = {
  id: 'wall.moon.new',
  viewBox: [44, 44],
  sizes: { min: 44, max: 44 },
  layers: [
    {
      kind: 'circle',
      cx: 22,
      cy: 22,
      r: 16,
      fill: c.skyTop,
      stroke: c.newMoonRim,
      strokeWidth: 2,
    },
  ],
};

const GATE = { width: 44, height: 30 } as const;
/** How far the gate stands from the frame's right edge. */
const GATE_RIGHT = 96;
/** The gate in the wall's face, shut for the night. */
const gate: Sprite = {
  id: 'wall.gate.shut',
  viewBox: [GATE.width, GATE.height],
  sizes: { min: GATE.height, max: GATE.height },
  layers: [
    {
      d: 'M2 30 V14 Q2 2 22 2 Q42 2 42 14 V30 Z',
      fill: c.gate,
      stroke: c.outline,
      strokeWidth: 2.5,
      linejoin: 'round',
    },
    ...[12, 22, 32].map(
      (x): Layer => ({
        kind: 'line',
        x1: x,
        y1: x === 22 ? 3 : 5,
        x2: x,
        y2: 30,
        stroke: c.gateShade,
        strokeWidth: 2,
      }),
    ),
    {
      kind: 'line',
      x1: 3,
      y1: 18,
      x2: 41,
      y2: 18,
      stroke: c.outline,
      strokeWidth: 2.5,
    },
  ],
};

const KNIGHT_HEIGHT = 72;
/** The knight's box: his feet sit below the wall walk, so the parapet hides
 * his body and the merlons pass over it as the wall drifts. */
const knightBox = (left: `${number}%`) =>
  ({
    left,
    top: WALL_TOP + 16 - KNIGHT_HEIGHT,
    width: 60,
    height: KNIGHT_HEIGHT,
  }) as const;

const scene = (
  id: string,
  sky: readonly [string, string],
  items: Scene['items'],
): Scene => ({ id, height: HEIGHT, tile: TILE, radius: 24, sky, items });

/** Before the watch: the knight on the battlements, lantern raised, piece
 * shadows at the treeline and tonight's moon. */
const before = scene(
  'wall.hero',
  [c.skyTop, c.skyBottom],
  [
    { kind: 'tiled', id: 'stars', sprite: stars, parallax: 0.04 },
    { kind: 'fixed', id: 'moon', sprite: moon, size: 44, top: 22, right: 28 },
    { kind: 'tiled', id: 'hills', sprite: hills, parallax: 0.2 },
    { kind: 'tiled', id: 'trees', sprite: trees, parallax: 0.5 },
    { kind: 'actor', id: 'knight', ...knightBox('18%') },
    { kind: 'tiled', id: 'wall', sprite: wall, parallax: 1 },
    { kind: 'actor', id: 'knightLight', ...knightBox('18%') },
  ],
);

/** The watch kept: the raiders gone, the gate shut, a full moon, and a slot
 * for a star relit tonight. The knight dozes (his pose comes from the
 * character); the lantern is low. */
const kept = scene(
  'wall.hero.kept',
  [c.skyTopKept, c.skyBottomKept],
  [
    { kind: 'tiled', id: 'stars', sprite: stars, parallax: 0.04 },
    {
      kind: 'actor',
      id: 'relitStar',
      left: '30%',
      top: 64,
      width: 22,
      height: 22,
    },
    {
      kind: 'fixed',
      id: 'moon',
      sprite: fullMoon,
      size: 64,
      top: 14,
      right: 18,
    },
    { kind: 'tiled', id: 'hills', sprite: hills, parallax: 0.2 },
    { kind: 'tiled', id: 'trees', sprite: quietTrees, parallax: 0.5 },
    { kind: 'actor', id: 'knight', ...knightBox('18%') },
    { kind: 'tiled', id: 'wall', sprite: wall, parallax: 1 },
    {
      kind: 'fixed',
      id: 'gate',
      sprite: gate,
      size: GATE.height,
      top: HEIGHT - GATE.height,
      right: GATE_RIGHT,
    },
    { kind: 'actor', id: 'knightLight', ...knightBox('18%') },
  ],
);

const CAPTION = { width: 200, height: 76 } as const;

/** The end of the watch: the raiders turned back, the gate shut, the knight
 * still on lookout with his lantern (its light grows a step per held move)
 * and a slot over the gate, centred on it at any width, for the count. The
 * knight stands further left than on the Watch page, so the count clears his
 * lantern on a 320-point phone. */
const end = scene(
  'wall.hero.end',
  [c.skyTopKept, c.skyBottomKept],
  [
    { kind: 'tiled', id: 'stars', sprite: stars, parallax: 0.04 },
    { kind: 'fixed', id: 'moon', sprite: moon, size: 44, top: 22, right: 28 },
    { kind: 'tiled', id: 'hills', sprite: hills, parallax: 0.2 },
    { kind: 'tiled', id: 'trees', sprite: quietTrees, parallax: 0.5 },
    { kind: 'actor', id: 'knight', ...knightBox('8%') },
    { kind: 'tiled', id: 'wall', sprite: wall, parallax: 1 },
    {
      kind: 'fixed',
      id: 'gate',
      sprite: gate,
      size: GATE.height,
      top: HEIGHT - GATE.height,
      right: GATE_RIGHT,
    },
    { kind: 'actor', id: 'knightLight', ...knightBox('8%') },
    {
      kind: 'actor',
      id: 'gateCaption',
      right: GATE_RIGHT + (GATE.width - CAPTION.width) / 2,
      top: HEIGHT - GATE.height - CAPTION.height - 18,
      ...CAPTION,
    },
  ],
);

/** The first night: the knight arriving at an empty post under a new moon. */
const firstNight = scene(
  'wall.hero.first-night',
  [c.skyTop, c.skyBottom],
  [
    { kind: 'tiled', id: 'stars', sprite: stars, parallax: 0.04 },
    {
      kind: 'fixed',
      id: 'moon',
      sprite: newMoon,
      size: 44,
      top: 22,
      right: 28,
    },
    { kind: 'tiled', id: 'hills', sprite: hills, parallax: 0.2 },
    { kind: 'tiled', id: 'trees', sprite: quietTrees, parallax: 0.5 },
    { kind: 'actor', id: 'knight', ...knightBox('5%') },
    { kind: 'tiled', id: 'wall', sprite: wall, parallax: 1 },
    { kind: 'actor', id: 'knightLight', ...knightBox('5%') },
  ],
);

/** The Watch page's wall in each of its states. */
export const wallHeroScenes: Readonly<Record<WallHeroState, Scene>> = {
  before,
  kept,
  firstNight,
  end,
};
