import type {
  CastleState,
  Character,
  Layer,
  RankTier,
  Sprite,
  SpriteNode,
} from '../types';
import { starShardLayers } from './star-shard-art';

// Rank emblems and the map's rank castles (docs/specs/2026-10-18-watch-story-design.md,
// "Stars and ranks"): original Knightly placeholder art in glossy cel until
// the ranks are named and drawn for real. An emblem is a shield per tier
// (Page, Squire, Knight) with one pip per level (Squire I–III); the castle
// stands beside the map of nights with a green flag once its rank is reached.

const outline = '#24211c'; // tokens.pieces.outline
const pip = '#f2f1ec'; // moonlight: the pips' own colour, used by nothing else here
const moon = '#ffc233';
const moonShade = '#d39a00';

const tiers: Readonly<
  Record<
    RankTier,
    { rim: string; rimShade: string; field: string; fieldLight: string }
  >
> = {
  // Moonlit silver on the night sky: the first watch.
  page: {
    rim: '#9aa3b5',
    rimShade: '#6b7385',
    field: '#2e3854',
    fieldLight: '#3b4766',
  },
  // Silver on sky blue.
  squire: {
    rim: '#c9ccd3',
    rimShade: '#8e939c',
    field: '#2577bb',
    fieldLight: '#49a8f2',
  },
  // Gold on the brand green.
  knight: {
    rim: '#ffc233',
    rimShade: '#d39a00',
    field: '#3f8a18',
    fieldLight: '#6cc23a',
  },
};

const shield = 'M50 8 L86 19 L86 48 Q86 76 50 93 Q14 76 14 48 L14 19 Z';
const field = 'M50 16 L78 25 L78 48 Q78 70 50 84 Q22 70 22 48 L22 25 Z';
const fieldLight = 'M27 29 L49 22 L49 33 Q36 36 27 44 Z';
const crown = 'M35 22 L38 9 L45 17 L50 6 L55 17 L62 9 L65 22 Z';

const rounded = (layer: Layer): Layer =>
  ({ ...layer, linejoin: 'round', linecap: 'round' }) as Layer;

/** The tier's device in the shield: Page a crescent moon, the others a star. */
function device(tier: RankTier, level: number): SpriteNode[] {
  if (tier === 'page')
    return [
      { kind: 'circle', cx: 50, cy: 47, r: 15, fill: outline },
      { kind: 'circle', cx: 50, cy: 47, r: 12, fill: moonShade },
      { kind: 'circle', cx: 49, cy: 46, r: 10.5, fill: moon },
      { kind: 'circle', cx: 57, cy: 42, r: 11, fill: tiers.page.field },
    ];
  // Pips below the star leave less room, so the star sits higher with them.
  const y = level > 0 ? 43 : 50;
  return [
    {
      kind: 'group',
      transform: `translate(50 ${y}) scale(0.42) translate(-50 -51)`,
      layers: starShardLayers.map((layer) => rounded(layer as Layer)),
    },
  ];
}

/** One diamond per level, centred along the shield's lower field. */
function pips(level: number): Layer[] {
  const gap = 15;
  const start = 50 - ((level - 1) * gap) / 2;
  return Array.from({ length: level }, (_, i) => {
    const x = start + i * gap;
    return rounded({
      d: `M${x} 64 L${x + 6} 70 L${x} 76 L${x - 6} 70 Z`,
      fill: pip,
      stroke: outline,
      strokeWidth: 2.5,
    });
  });
}

/** The emblem of `tier` at `level` (0 for a rank without levels, as Page). */
export function rankEmblemSprite(tier: RankTier, level: number): Sprite {
  const c = tiers[tier];
  const shown = Math.max(0, Math.min(3, Math.round(level)));
  return {
    id: `reward.rank-emblem.${tier}${shown ? `-${shown}` : ''}`,
    viewBox: [100, 100],
    layers: [
      rounded({ d: shield, fill: outline, stroke: outline, strokeWidth: 10 }),
      rounded({
        d: shield,
        fill: c.rimShade,
        stroke: c.rimShade,
        strokeWidth: 2,
      }),
      rounded({
        d: 'M50 11 L83 21 L83 46 Q60 40 50 40 Q40 40 17 46 L17 21 Z',
        fill: c.rim,
      }),
      rounded({ d: field, fill: c.field, stroke: outline, strokeWidth: 3 }),
      { d: fieldLight, fill: c.fieldLight },
      ...device(tier, shown),
      ...pips(shown),
      ...(tier === 'knight'
        ? [rounded({ d: crown, fill: moon, stroke: outline, strokeWidth: 3 })]
        : []),
    ],
    anchors: { centre: { x: 50, y: 48 }, base: { x: 50, y: 93 } },
    sizes: { min: 24, max: 120 },
  };
}

const stone = '#5b5549';
const stoneLight = '#736b5c';
const gate = '#2b2219';
const windowFill = { lit: '#ffe48a', dark: '#1b2235' };
const flags: Readonly<Record<CastleState, string>> = {
  reached: '#6cc23a', // the brand green: reached
  ahead: '#7d869c',
};

const block = (x: number, y: number, width: number, height: number): Layer => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  fill: stone,
  stroke: outline,
  strokeWidth: 3,
  linejoin: 'round',
});
const merlons = (x: number, width: number, y: number): Layer[] => {
  const w = width / 5;
  return [0, 2, 4].map((i) => block(x + i * w, y, w, 7));
};

function castle(state: CastleState): Sprite {
  return {
    id: `map.castle.${state}`,
    viewBox: [100, 90],
    layers: [
      {
        kind: 'line',
        x1: 50,
        y1: 4,
        x2: 50,
        y2: 26,
        stroke: outline,
        strokeWidth: 3,
        linecap: 'round',
      },
      rounded({
        d: 'M51 5 L68 10.5 L51 16 Z',
        fill: flags[state],
        stroke: outline,
        strokeWidth: 2.5,
      }),
      ...merlons(12, 24, 32),
      block(12, 38, 24, 48),
      ...merlons(64, 24, 32),
      block(64, 38, 24, 48),
      ...merlons(39, 22, 19),
      block(39, 25, 22, 61),
      { kind: 'rect', x: 15, y: 41, width: 6, height: 40, fill: stoneLight },
      { kind: 'rect', x: 42, y: 28, width: 5, height: 50, fill: stoneLight },
      {
        kind: 'rect',
        x: 47,
        y: 34,
        width: 6,
        height: 9,
        rx: 3,
        fill: state === 'reached' ? windowFill.lit : windowFill.dark,
        stroke: outline,
        strokeWidth: 2,
      },
      rounded({
        d: 'M43 86 L43 72 Q50 62 57 72 L57 86 Z',
        fill: gate,
        stroke: outline,
        strokeWidth: 3,
      }),
    ],
    anchors: { flag: { x: 59, y: 10 }, base: { x: 50, y: 86 } },
    sizes: { min: 32, max: 96 },
  };
}

/** A rank's castle beside the map of nights: flag up once reached. */
export const rankCastle: Character<CastleState> = {
  id: 'map.castle',
  states: { reached: castle('reached'), ahead: castle('ahead') },
};
