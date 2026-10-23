import type { Layer, Sprite } from '../types';
import {
  milestoneMedalLayers,
  milestoneMoonTransform,
} from './milestone-medal-art';
import { litShape, moonPhaseDays, moonPhaseLayers } from './moon-phase-art';
import {
  shootingStarHeadTransform,
  shootingStarTail,
} from './shooting-star-art';
import { starShardLayers } from './star-shard-art';

// The locked reward art as kit sprites. The *-art.ts files stay
// self-contained so `scripts/generate-brand.mjs` can import them; this file
// only wraps their layers with the paint their components always used.

const box = [100, 100] as const;
/** Joins and caps the shard, shooting star and medal have always drawn with. */
const rounded = (layer: Omit<Layer, 'kind'>): Layer =>
  ({ ...layer, linejoin: 'round', linecap: 'round' }) as Layer;

export const starShardSprite: Sprite = {
  id: 'reward.star-shard',
  viewBox: box,
  layers: starShardLayers.map(rounded),
  anchors: { centre: { x: 50, y: 51 } },
  sizes: { min: 20, max: 112 },
};

export const shootingStarSprite: Sprite = {
  id: 'reward.shooting-star',
  viewBox: box,
  layers: [
    ...shootingStarTail.map(rounded),
    {
      kind: 'group',
      transform: shootingStarHeadTransform,
      layers: starShardLayers.map(rounded),
    },
  ],
  anchors: { head: { x: 62, y: 40 } },
  sizes: { min: 30, max: 140 },
};

/** The streak moon at a day of its weekly cycle, 0 (new) to 7 (full); its
 * lit layers are clipped to the phase's lit shape. */
export function moonSprite(day: number): Sprite {
  const lit = Math.min(Math.max(day, 0), moonPhaseDays) / moonPhaseDays;
  return {
    id: `reward.moon-${Math.round(lit * moonPhaseDays)}`,
    viewBox: box,
    clips: { lit: litShape(lit) },
    layers: moonPhaseLayers(day).map(
      ({ lit: clipped, ...layer }): Layer => ({
        ...layer,
        linecap: 'round',
        ...(clipped ? { clip: 'lit' } : {}),
      }),
    ),
    anchors: { centre: { x: 50, y: 50 } },
    sizes: { min: 14, max: 120 },
  };
}

/** The milestone medal: the full moon set in a gold medal on ribbons. A full
 * moon is lit everywhere, so its lit layers need no clip here. */
export const milestoneMedalSprite: Sprite = {
  id: 'reward.milestone-medal',
  viewBox: box,
  layers: [
    ...milestoneMedalLayers.map(rounded),
    {
      kind: 'group',
      transform: milestoneMoonTransform,
      layers: moonPhaseLayers(moonPhaseDays).map(({ lit: _lit, ...layer }) =>
        rounded(layer),
      ),
    },
  ],
  anchors: { centre: { x: 50, y: 44 } },
  sizes: { min: 44, max: 120 },
};
