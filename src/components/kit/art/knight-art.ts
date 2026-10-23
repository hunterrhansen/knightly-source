import type {
  Character,
  KnightState,
  Layer,
  Sprite,
  SpriteNode,
} from '../types';

type Point = Readonly<{ x: number; y: number }>;

// The lantern knight in side profile, facing right toward the treeline: a
// development stand-in for the commissioned mascot, in the locked glossy cel
// (docs/art-style-lock.md). A bold warm outline, two-tone shading with light
// from the top left, one white highlight and a sky edge light on chunky toy
// proportions: a big helmet with a warm eye in the visor, a Knight Green plume
// streaming back and a tabard with a gold moon, the lantern held out ahead.

const k = {
  outline: '#24211c', // tokens.pieces.outline
  steel: '#d9dce4',
  steelShade: '#9aa0b0',
  highlight: '#ffffff',
  rim: '#49a8f2', // sky: the edge light, as on the star shard
  tabard: '#6cc23a', // brand
  tabardShade: '#4a9620', // brand ledge
  moon: '#ffc233',
  visor: '#1d2026',
  eye: '#ffe48a',
  lantern: '#ffc233',
  lanternCore: '#fffbe8',
  lanternLow: '#c28c00',
  unlit: '#5b6070',
  sleep: '#aab3c8',
} as const;

// The helmet in profile: a dome with the visor jutting forward to the right.
const helmet =
  'M24 42 C24 23 37 12 52 12 C66 12 76 21 77 34 L81 41 C82 48 78 54 71 56 L38 60 C30 59 24 52 24 42 Z';
const helmetLight =
  'M28 40 C28 25 39 16 51 16 C62 16 70 22 72 32 L74 38 C66 44 50 48 30 50 C28.5 47 28 44 28 40 Z';
const tabard = 'M33 63 C40 58 60 58 66 62 L70 112 C56 118 42 118 30 112 Z';

type Light = Readonly<{ glass: string; core: string }>;
const lit: Light = { glass: k.lantern, core: k.lanternCore };
/** Turned down for the night: the glass glows low. */
const low: Light = { glass: k.lanternLow, core: k.lantern };
/** Not yet lit: the knight has only just arrived. */
const dark: Light = { glass: k.steelShade, core: k.unlit };

/** Tabard, belt and moon badge. */
const bodyLayers: readonly SpriteNode[] = [
  // Plume, streaming back from the crest.
  {
    d: 'M40 16 C30 6 14 6 5 16 C13 14 19 16 23 21 C16 20 10 23 7 28 C17 24 28 24 37 27 Z',
    fill: k.tabard,
    stroke: k.outline,
    strokeWidth: 3,
    linejoin: 'round',
  },
  {
    d: 'M37 27 C28 24 17 24 8 27 C15 25.5 24 25.5 31 28 Z',
    fill: k.tabardShade,
  },
  // Tabard, shaded on the far side.
  { d: tabard, fill: k.tabard },
  {
    d: 'M55 59.5 C60 60 64 61 66 62 L70 112 C64 114.5 60 116 56 116.5 Z',
    fill: k.tabardShade,
  },
  {
    d: 'M31 90 L68.5 90 L69 97 L30.5 97 Z',
    fill: k.steelShade,
    stroke: k.outline,
    strokeWidth: 2.5,
    linejoin: 'round',
  },
  { d: tabard, stroke: k.outline, strokeWidth: 3.5, linejoin: 'round' },
  { kind: 'circle', cx: 40, cy: 82, r: 6, fill: k.moon },
  { kind: 'circle', cx: 43, cy: 80.5, r: 5, fill: k.tabard },
];

/** The helmet with the visor's eye, which sleep closes. */
const headLayers = (eye: readonly Layer[]): readonly SpriteNode[] => [
  // Helmet: shade, light, outline, crest, then the visor and its eye.
  { d: helmet, fill: k.steelShade },
  { d: helmetLight, fill: k.steel },
  { d: helmet, stroke: k.outline, strokeWidth: 3.5, linejoin: 'round' },
  {
    d: 'M30 27 C38 15 57 11 71 21',
    stroke: k.steelShade,
    strokeWidth: 3,
    linecap: 'round',
  },
  {
    d: 'M57 37 L78 36.5 L80 43 L57 44.5 C54 43 54 38.5 57 37 Z',
    fill: k.visor,
    stroke: k.outline,
    strokeWidth: 2,
    linejoin: 'round',
  },
  ...eye,
  {
    kind: 'circle',
    cx: 41,
    cy: 42,
    r: 3,
    fill: k.steelShade,
    stroke: k.outline,
    strokeWidth: 1.5,
  },
  { kind: 'circle', cx: 73, cy: 50, r: 1.2, fill: k.outline },
  { kind: 'circle', cx: 68, cy: 51.5, r: 1.2, fill: k.outline },
  {
    kind: 'ellipse',
    cx: 37,
    cy: 23,
    rx: 6,
    ry: 3.5,
    transform: 'rotate(-35 37 23)',
    fill: k.highlight,
  },
  {
    d: 'M73 23 C76 27 77.5 31 78 35',
    stroke: k.rim,
    strokeWidth: 2.5,
    linecap: 'round',
  },
];
const openEye: readonly Layer[] = [
  { kind: 'circle', cx: 69, cy: 40.5, r: 2.6, fill: k.eye },
];
const closedEye: readonly Layer[] = [
  {
    d: 'M65.5 40 Q69 43.5 72.5 40',
    stroke: k.eye,
    strokeWidth: 2,
    linecap: 'round',
  },
];

/** The lantern as drawn held out ahead; poses move it with `translate`. */
const lanternLayers = (light: Light): readonly SpriteNode[] => [
  { d: 'M84 52 Q88 46 92 52', stroke: k.outline, strokeWidth: 2 },
  {
    kind: 'circle',
    cx: 87,
    cy: 47.5,
    r: 4.5,
    fill: k.steel,
    stroke: k.outline,
    strokeWidth: 2.5,
  },
  {
    kind: 'rect',
    x: 82.5,
    y: 51,
    width: 11,
    height: 4,
    rx: 1.5,
    fill: k.steelShade,
    stroke: k.outline,
    strokeWidth: 2,
  },
  {
    kind: 'rect',
    x: 83.5,
    y: 55,
    width: 9,
    height: 11,
    rx: 2,
    fill: light.glass,
    stroke: k.outline,
    strokeWidth: 2.5,
  },
  {
    kind: 'rect',
    x: 86,
    y: 57.5,
    width: 4,
    height: 6,
    rx: 2,
    fill: light.core,
  },
  {
    kind: 'rect',
    x: 82.5,
    y: 65.5,
    width: 11,
    height: 3.5,
    rx: 1.5,
    fill: k.steelShade,
    stroke: k.outline,
    strokeWidth: 2,
  },
];

/** The near shoulder, the arm to `hand` and the lantern hanging from it.
 * `hand` is where the lantern's ring sits; the glass hangs 12.5 below it. */
function armWithLantern(hand: Point, light: Light): readonly SpriteNode[] {
  const reach = `M55 64 L${hand.x - 1} ${hand.y + 0.5}`;
  return [
    // Near shoulder, and the arm reaching the lantern out ahead.
    { kind: 'circle', cx: 50, cy: 66, r: 11, fill: k.steelShade },
    { kind: 'circle', cx: 48.5, cy: 64, r: 8.5, fill: k.steel },
    {
      kind: 'circle',
      cx: 50,
      cy: 66,
      r: 11,
      stroke: k.outline,
      strokeWidth: 3,
    },
    { d: reach, stroke: k.outline, strokeWidth: 9, linecap: 'round' },
    { d: reach, stroke: k.steel, strokeWidth: 5, linecap: 'round' },
    {
      kind: 'group',
      transform: `translate(${hand.x - 87} ${hand.y - 47.5})`,
      layers: lanternLayers(light),
    },
  ];
}
const glassOf = (hand: Point): Point => ({ x: hand.x + 1, y: hand.y + 12.5 });

const VIEW_BOX = [100, 120] as const;
const SIZES = { min: 44, max: 160 } as const;
const FEET = { x: 50, y: 116 } as const;
const HEAD = { x: 52, y: 12 } as const;

/** On watch: the lantern raised ahead, toward the treeline. */
const RAISED = { x: 87, y: 47.5 } as const;
const lookout: Sprite = {
  id: 'knight.profile.lookout',
  viewBox: VIEW_BOX,
  sizes: SIZES,
  anchors: {
    // The lantern's glass, where its light is centred.
    lantern: glassOf(RAISED),
    // Where he stands; the scene puts this on (or below) the wall walk.
    feet: FEET,
    head: HEAD,
  },
  layers: [
    ...bodyLayers,
    ...headLayers(openEye),
    ...armWithLantern(RAISED, lit),
  ],
};

/** The night kept: head nodding, eyes shut, the lantern low at his side. */
const LOWERED = { x: 72, y: 83 } as const;
const dozing: Sprite = {
  id: 'knight.profile.dozing',
  viewBox: VIEW_BOX,
  sizes: SIZES,
  anchors: { lantern: glassOf(LOWERED), feet: FEET, head: { x: 58, y: 14 } },
  layers: [
    ...bodyLayers,
    {
      kind: 'group',
      transform: 'rotate(14 50 58)',
      layers: headLayers(closedEye),
    },
    ...armWithLantern(LOWERED, low),
    {
      kind: 'text',
      x: 86,
      y: 22,
      text: 'z',
      fontSize: 13,
      anchor: 'middle',
      fill: k.sleep,
    },
    {
      kind: 'text',
      x: 94,
      y: 11,
      text: 'z',
      fontSize: 9,
      anchor: 'middle',
      fill: k.sleep,
    },
  ],
};

/** The first night: just arrived at the post, the lantern carried unlit. */
const CARRIED = { x: 80, y: 74 } as const;
const arriving: Sprite = {
  id: 'knight.profile.arriving',
  viewBox: VIEW_BOX,
  sizes: SIZES,
  anchors: { lantern: glassOf(CARRIED), feet: FEET, head: HEAD },
  layers: [
    ...bodyLayers,
    ...headLayers(openEye),
    ...armWithLantern(CARRIED, dark),
  ],
};

export const lanternKnight: Character<KnightState> = {
  id: 'knight.profile',
  states: { lookout, dozing, arriving },
};
