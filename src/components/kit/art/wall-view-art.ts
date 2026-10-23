import type { Layer, Scene, Sprite, Surface, WallView } from '../types';

// The lesson seen from the castle wall (docs/specs/2026-10-18-watch-story-design.md,
// "During the watch: looking out from the wall"), after the wireframes'
// "Combined · watch from the wall" boards: placeholder art until the
// commissioned glossy-cel scene replaces it.

const TILE = 400;
const FAR = { height: 96, treeTop: 66 } as const;
const NEAR = { height: 360, merlonTop: 62, merlon: 24 } as const;
const FRINGE = 12;

type Palette = Readonly<{
  skyTop: string;
  skyBottom: string;
  star: string;
  moon: string;
  moonShade: string;
  hills: string;
  trees: string;
  ground: string;
  nearTop: string;
  stone: string;
  stoneLight: string;
  stoneShade: string;
  mortar: string;
  lantern: string;
  lanternCore: string;
}>;

const night: Palette = {
  skyTop: '#10141f',
  skyBottom: '#2b3550',
  star: '#f2f1ec',
  moon: '#ffc233',
  moonShade: '#d39a00',
  hills: '#1b2235',
  trees: '#111620',
  ground: '#1c2338',
  nearTop: '#1a2418',
  stone: '#6a6356',
  stoneLight: '#7c7466',
  stoneShade: '#585246',
  mortar: '#4f493f',
  lantern: '#ffc233',
  lanternCore: '#ffe48a',
};

const tile = (
  id: string,
  height: number,
  layers: readonly Layer[],
): Sprite => ({
  id,
  viewBox: [TILE, height],
  layers,
  sizes: { min: height, max: height },
});

const starPoints: readonly (readonly [number, number, number])[] = [
  [26, 14, 1.3],
  [92, 34, 1],
  [150, 10, 1.5],
  [206, 40, 1],
  [262, 18, 1.2],
  [334, 44, 1.4],
  [378, 12, 1],
];

const treeBumps = Array.from(
  { length: 20 },
  (_, i) =>
    `Q${i * 20 + 10} ${FAR.treeTop + (i % 3 === 0 ? -12 : -5)} ${i * 20 + 20} ${FAR.treeTop}`,
).join(' ');

function far(p: Palette): Scene {
  return {
    id: 'wallView.far',
    height: FAR.height,
    tile: TILE,
    radius: 0,
    sky: [p.skyTop, p.skyBottom],
    items: [
      {
        kind: 'tiled',
        id: 'stars',
        parallax: 0,
        sprite: tile(
          'wallView.stars',
          FAR.height,
          starPoints.map(
            ([cx, cy, r]): Layer => ({
              kind: 'circle',
              cx,
              cy,
              r,
              fill: p.star,
            }),
          ),
        ),
      },
      {
        kind: 'fixed',
        id: 'moon',
        size: 24,
        top: 50,
        right: 72,
        sprite: {
          id: 'wallView.moon',
          viewBox: [44, 44],
          sizes: { min: 24, max: 44 },
          layers: [
            { kind: 'circle', cx: 22, cy: 22, r: 18, fill: p.moonShade },
            { kind: 'circle', cx: 19, cy: 20, r: 15, fill: p.moon },
          ],
        },
      },
      {
        kind: 'tiled',
        id: 'hills',
        parallax: 0,
        sprite: tile('wallView.hills', FAR.height, [
          {
            d: `M0 ${FAR.treeTop - 8} Q60 44 130 56 T260 52 T400 ${FAR.treeTop - 8} V${FAR.height} H0 Z`,
            fill: p.hills,
          },
        ]),
      },
      // Where the opponent's pieces wait as raiders, their feet just inside
      // the trees: low enough to stay clear of the lesson's progress bar.
      {
        kind: 'actor',
        id: 'raiders',
        left: '0%',
        top: FAR.treeTop - 26,
        width: TILE,
        height: 30,
      },
      {
        kind: 'tiled',
        id: 'trees',
        parallax: 0,
        sprite: tile('wallView.trees', FAR.height, [
          {
            d: `M0 ${FAR.treeTop} ${treeBumps} V${FAR.height} H0 Z`,
            fill: p.trees,
          },
        ]),
      },
    ],
  };
}

/** The treeline's ragged edge, hanging over the board's top edge. */
function fringe(p: Palette): WallView['fringe'] {
  const teeth = Array.from(
    { length: 25 },
    (_, i) => `L${i * 16 + 8} ${FRINGE} L${i * 16 + 16} ${FRINGE * 0.4}`,
  ).join(' ');
  return {
    overlap: 5,
    sprite: tile('wallView.fringe', FRINGE, [
      {
        d: `M0 0 H${TILE} V${FRINGE * 0.4} L0 ${FRINGE * 0.4} ${teeth} Z`,
        fill: p.trees,
      },
    ]),
  };
}

const KNIGHT_HEIGHT = 100;
/** The knight's box: he stands behind the merlons, helmet, shoulders and
 * lantern above them. */
const knightBox = {
  left: '3%',
  top: 4,
  width: (KNIGHT_HEIGHT * 100) / 120,
  height: KNIGHT_HEIGHT,
} as const;

function near(p: Palette): Scene {
  const wallTop = NEAR.merlonTop + NEAR.merlon;
  return {
    id: 'wallView.near',
    height: NEAR.height,
    tile: TILE,
    radius: 0,
    sky: [p.nearTop, p.ground],
    fill: p.stone,
    items: [
      { kind: 'actor', id: 'knight', ...knightBox },
      {
        kind: 'tiled',
        id: 'wall',
        parallax: 0,
        sprite: tile('wallView.battlements', NEAR.height, [
          // A merlon every 57 units, shaded on its right like the wireframe's.
          ...Array.from({ length: 7 }, (_, i): Layer[] => {
            const x = 6 + i * 57;
            return [
              {
                kind: 'rect',
                x,
                y: NEAR.merlonTop,
                width: 44,
                height: NEAR.merlon + 2,
                rx: 5,
                fill: p.stone,
              },
              {
                kind: 'rect',
                x: x + 40,
                y: NEAR.merlonTop + 3,
                width: 4,
                height: NEAR.merlon - 1,
                fill: p.stoneShade,
              },
              {
                kind: 'rect',
                x: x + 2,
                y: NEAR.merlonTop,
                width: 40,
                height: 3,
                rx: 1.5,
                fill: p.stoneLight,
              },
            ];
          }).flat(),
          {
            kind: 'rect',
            x: 0,
            y: wallTop,
            width: TILE,
            height: NEAR.height - wallTop,
            fill: p.stone,
          },
          {
            kind: 'rect',
            x: 0,
            y: wallTop,
            width: TILE,
            height: 4,
            fill: p.stoneLight,
          },
          // Courses of stone, offset every other row.
          ...Array.from({ length: 8 }, (_, row): Layer[] => {
            const y = wallTop + 30 + row * 33;
            return [
              {
                kind: 'line',
                x1: 0,
                y1: y,
                x2: TILE,
                y2: y,
                stroke: p.mortar,
                strokeWidth: 3,
              },
              ...Array.from({ length: 7 }, (_, i): Layer => {
                const x = i * 65 + (row % 2 ? 32 : 0) + 20;
                return {
                  kind: 'line',
                  x1: x,
                  y1: y - 30,
                  x2: x,
                  y2: y,
                  stroke: p.mortar,
                  strokeWidth: 3,
                };
              }),
            ];
          }).flat(),
        ]),
      },
      { kind: 'actor', id: 'knightLight', ...knightBox },
    ],
  };
}

function wallView(p: Palette): WallView {
  return {
    id: 'wallView',
    far: far(p),
    fringe: fringe(p),
    ground: p.ground,
    near: near(p),
    light: { color: p.lantern, core: p.lanternCore, radius: 64 },
  };
}

export const wallViewScene: WallView = wallView(night);

const parchment: Surface = {
  fill: '#f4ecd8',
  ledge: '#0f0e0d',
  edge: '#24211c',
  ink: '#2a1d00',
  inkMuted: '#5a4a2c',
};

/** The lesson's chrome on the wall: the coach's parchment, stone buttons and
 * name plaques. */
export const wallSurfaces: Readonly<
  Record<'parchment' | 'stoneButton' | 'plaque', Surface>
> = {
  parchment,
  stoneButton: {
    fill: '#938a7b',
    ledge: '#4f493f',
    edge: '#24211c',
    ink: '#1d1a15',
    inkMuted: '#26221c',
  },
  plaque: {
    fill: '#3b3834',
    ledge: '#0f0e0d',
    edge: '#24211c',
    ink: '#f2f1ec',
    inkMuted: '#aba89f',
  },
};
