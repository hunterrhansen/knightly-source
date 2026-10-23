import type { LandingCurve } from '../../chess/board';
import type { Frame, Praise, Recipe } from './types';

type Keyframes = Recipe['keyframes'];

/**
 * A property's value at progress `p` (0 to 1): linear between the keyframes
 * that set it, held before the first and after the last. `fallback` when no
 * keyframe sets it.
 */
export function frameAt(
  keyframes: Keyframes,
  property: keyof Frame,
  p: number,
  fallback: number,
): number {
  'worklet';
  let before: { at: number; value: number } | undefined;
  for (const key of keyframes) {
    const value = key[property];
    if (value === undefined) continue;
    if (key.at >= p) {
      if (!before) return value;
      const span = key.at - before.at;
      const u = span > 0 ? (p - before.at) / span : 1;
      return before.value + (value - before.value) * u;
    }
    before = { at: key.at, value };
  }
  return before ? before.value : fallback;
}

/** Whether it is night by the direction's rule: from 21:00 until 05:00. */
export function isNight(date: Date) {
  const hour = date.getHours();
  return hour >= 21 || hour < 5;
}

/** A landing recipe as the board's scale curve, in ms; the night version
 * after 21:00. */
export function landingCurve(recipe: Recipe, night: boolean): LandingCurve {
  const keyframes = (night && recipe.night) || recipe.keyframes;
  return keyframes.map((key) => ({
    at: Math.round(key.at * recipe.duration),
    scale: key.scale ?? 1,
  }));
}

/** The praise for a run of clean answers: the biggest word it has reached. */
export function praiseFor(words: readonly Praise[], run: number) {
  return words.reduce<Praise | undefined>(
    (best, word) => (run >= word.run ? word : best),
    undefined,
  );
}
