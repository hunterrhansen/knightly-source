import type {
  Character,
  Layer,
  RaiderKind,
  RaiderRole,
  RaiderState,
  Sprite,
  SpriteNode,
} from '../types';

type Point = Readonly<{ x: number; y: number }>;

// The opponent's pieces waiting at the treeline (docs/specs/2026-10-18-watch-
// story-design.md, "During the watch: looking out from the wall"): each type's
// chess silhouette, so it is recognisable at a glance, with small eyes. Dark
// against the night with a moonlit edge, so they read as shapes in the trees
// rather than as the board's pieces. Placeholder art until the commissioned
// characters replace it.

const r = {
  body: '#0d111b',
  rim: '#56638c',
  eye: '#f2f1ec',
  pupil: '#10141f',
  crown: '#ffc233',
  crownShade: '#d39a00',
  outline: '#24211c',
} as const;

const W = 40;
const H = 48;
const FEET: Point = { x: 20, y: 46 };

type Shape = Layer;
/** A piece's silhouette: its shapes, where its eyes sit and its top. */
type Figure = Readonly<{
  shapes: readonly Shape[];
  eyes: Point;
  top: Point;
}>;

const base = (x = 8, width = 24): Shape => ({
  kind: 'rect',
  x,
  y: 40,
  width,
  height: 6,
  rx: 2,
});

const figures: Readonly<Record<RaiderKind, Figure>> = {
  p: {
    shapes: [
      { kind: 'circle', cx: 20, cy: 16, r: 7 },
      { d: 'M13 41 Q14 32 17 26 L23 26 Q26 32 27 41 Z' },
      { kind: 'ellipse', cx: 20, cy: 25, rx: 7, ry: 2.5 },
      base(10, 20),
    ],
    eyes: { x: 20, y: 16 },
    top: { x: 20, y: 9 },
  },
  n: {
    shapes: [
      {
        d: 'M12 41 L12 31 Q11 22 15 16 L14 8 L19 12 Q25 9 29 15 Q33 21 31 26 L26 25 Q22 25 21 29 L27 41 Z',
      },
      base(),
    ],
    eyes: { x: 22, y: 17 },
    top: { x: 17, y: 9 },
  },
  b: {
    shapes: [
      { kind: 'circle', cx: 20, cy: 6, r: 2.5 },
      { d: 'M20 7 Q30 16 26 27 Q20 31 14 27 Q10 16 20 7 Z' },
      { d: 'M15 28 L25 28 L27 41 L13 41 Z' },
      base(),
    ],
    eyes: { x: 20, y: 19 },
    top: { x: 20, y: 4 },
  },
  r: {
    shapes: [
      { d: 'M10 9 H15 V13 H18 V9 H22 V13 H25 V9 H30 V19 H10 Z' },
      { kind: 'rect', x: 12, y: 18, width: 16, height: 23 },
      base(),
    ],
    eyes: { x: 20, y: 24 },
    top: { x: 20, y: 9 },
  },
  q: {
    shapes: [
      { d: 'M9 13 L14 23 L17 11 L20 22 L23 11 L26 23 L31 13 L28 30 L12 30 Z' },
      { kind: 'circle', cx: 9, cy: 12, r: 2 },
      { kind: 'circle', cx: 17, cy: 10, r: 2 },
      { kind: 'circle', cx: 23, cy: 10, r: 2 },
      { kind: 'circle', cx: 31, cy: 12, r: 2 },
      { d: 'M13 29 L27 29 L28 41 L12 41 Z' },
      base(),
    ],
    eyes: { x: 20, y: 26 },
    top: { x: 20, y: 9 },
  },
  k: {
    shapes: [
      { kind: 'rect', x: 18.5, y: 3, width: 3, height: 11 },
      { kind: 'rect', x: 15, y: 6, width: 10, height: 3 },
      { d: 'M11 16 Q20 11 29 16 L27 29 L13 29 Z' },
      { d: 'M13 28 L27 28 L28 41 L12 41 Z' },
      base(),
    ],
    eyes: { x: 20, y: 21 },
    top: { x: 20, y: 3 },
  },
};

/** A pose: one transform, as SVG writes it, and the same map for anchors. */
type Pose = Readonly<{ transform?: string; at: (p: Point) => Point }>;

const still: Pose = { at: (p) => p };
/** Hit: squashed down onto its feet. */
const squash: Pose = {
  transform: 'translate(20 46) scale(1.08 0.9) translate(-20 -46)',
  at: (p) => ({ x: 20 + (p.x - 20) * 1.08, y: 46 + (p.y - 46) * 0.9 }),
};
/** Running back: leaning away, turning from the wall. */
const lean = (degrees: number): Pose => {
  const a = (degrees * Math.PI) / 180;
  return {
    transform: `rotate(${degrees} ${FEET.x} ${FEET.y})`,
    at: (p) => {
      const dx = p.x - FEET.x;
      const dy = p.y - FEET.y;
      return {
        x: FEET.x + dx * Math.cos(a) - dy * Math.sin(a),
        y: FEET.y + dx * Math.sin(a) + dy * Math.cos(a),
      };
    },
  };
};
/** Knocked over onto its side, head to the left, lying on the ground. */
const toppled: Pose = {
  transform: 'translate(20 35) rotate(-90) scale(0.88) translate(-20 -25)',
  at: (p) => ({ x: 20 + (p.y - 25) * 0.88, y: 35 - (p.x - 20) * 0.88 }),
};

/** The silhouette with a moonlit edge: the edge drawn wide under the fills,
 * so overlapping shapes show one outline. */
const silhouette = (shapes: readonly Shape[]): SpriteNode[] => [
  ...shapes.map(
    (shape): Layer => ({
      ...shape,
      fill: r.rim,
      stroke: r.rim,
      strokeWidth: 3,
      linejoin: 'round',
    }),
  ),
  ...shapes.map((shape): Layer => ({ ...shape, fill: r.body })),
];

type Look = 'down' | 'wide' | 'back' | 'out';

/** Two small eyes, `look` setting the pupils: down at the wall, wide when
 * hit, back over the shoulder when running, crosses when knocked out. */
function eyes({ x, y }: Point, look: Look): SpriteNode[] {
  return [-1, 1].flatMap((side): SpriteNode[] => {
    const cx = x + side * 3;
    if (look === 'out')
      return [
        {
          d: `M${cx - 1.6} ${y - 1.6} L${cx + 1.6} ${y + 1.6} M${cx + 1.6} ${y - 1.6} L${cx - 1.6} ${y + 1.6}`,
          stroke: r.eye,
          strokeWidth: 1.2,
          linecap: 'round',
        },
      ];
    const wide = look === 'wide';
    const pupil =
      look === 'down'
        ? { dx: 0, dy: 0.7 }
        : look === 'back'
          ? { dx: -0.9, dy: 0 }
          : { dx: 0, dy: 0 };
    return [
      {
        kind: 'ellipse',
        cx,
        cy: y,
        rx: wide ? 2.3 : 1.8,
        ry: wide ? 2.8 : 2.2,
        fill: r.eye,
      },
      {
        kind: 'circle',
        cx: cx + pupil.dx,
        cy: y + pupil.dy,
        r: wide ? 0.7 : 1,
        fill: r.pupil,
      },
    ];
  });
}

const states: Readonly<
  Record<RaiderState, Readonly<{ pose: Pose; look: Look }>>
> = {
  lurk: { pose: still, look: 'down' },
  flinch: { pose: squash, look: 'wide' },
  flee: { pose: lean(-12), look: 'back' },
  knockedOut: { pose: toppled, look: 'out' },
};

function raiderSprite(kind: RaiderKind, state: RaiderState): Sprite {
  const figure = figures[kind];
  const { pose, look } = states[state];
  const nodes = [...silhouette(figure.shapes), ...eyes(figure.eyes, look)];
  return {
    id: `raider.${kind}.${state}`,
    viewBox: [W, H],
    layers: pose.transform
      ? [{ kind: 'group', transform: pose.transform, layers: nodes }]
      : nodes,
    anchors: {
      head: pose.at(figure.eyes),
      crown: pose.at(figure.top),
      feet: pose.at(FEET),
    },
    sizes: { min: 18, max: 48 },
  };
}

const raider = (kind: RaiderKind): Character<RaiderState> => ({
  id: `raider.${kind}`,
  states: {
    lurk: raiderSprite(kind, 'lurk'),
    flinch: raiderSprite(kind, 'flinch'),
    knockedOut: raiderSprite(kind, 'knockedOut'),
    flee: raiderSprite(kind, 'flee'),
  },
});

export const raiders: Readonly<Record<RaiderRole, Character<RaiderState>>> = {
  'character.raider.p': raider('p'),
  'character.raider.n': raider('n'),
  'character.raider.b': raider('b'),
  'character.raider.r': raider('r'),
  'character.raider.q': raider('q'),
  'character.raider.k': raider('k'),
};

/** The raid captain's marker: a small gold crown, its `base` set on the
 * raider's `crown` anchor. */
export const captainCrown: Sprite = {
  id: 'raider.captain.crown',
  viewBox: [24, 16],
  layers: [
    {
      d: 'M3 14 L2 5 L8 9 L12 2 L16 9 L22 5 L21 14 Z',
      fill: r.crown,
      stroke: r.outline,
      strokeWidth: 1.5,
      linejoin: 'round',
    },
    { kind: 'rect', x: 3, y: 11, width: 18, height: 3, fill: r.crownShade },
    { kind: 'circle', cx: 12, cy: 7, r: 1.3, fill: r.eye },
  ],
  anchors: { base: { x: 12, y: 14 } },
  sizes: { min: 8, max: 20 },
};

/** Colours for the words and bars the raid shows beside its sprites: the
 * "Out!" word and the captain's health. */
export const raidColors = {
  word: r.crown,
  wordEdge: r.outline,
  health: r.crown,
  healthCracked: '#1a1816',
} as const;
