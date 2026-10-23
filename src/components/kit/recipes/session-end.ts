import type { Recipe, SessionEndRecipeRole } from '../types';

// The end of the watch over the wall (docs/specs/2026-10-18-watch-story-
// design.md, "The wall: art through the watch", Session end). Both play in
// the session-end beat's scene, after the lesson's last answer, never over a
// board. The night versions (after 21:00) cross-fade without swelling.

/** One held move: the lantern's light swells as it steps up to its next
 * brightness. `opacity` is the share of the step's brightening reached;
 * `scale` swells the glow. */
const lanternBrighten: Recipe = {
  id: 'fx.lanternBrighten',
  duration: 360,
  board: false,
  easing: 'out',
  keyframes: [
    { at: 0, opacity: 0, scale: 1 },
    { at: 0.35, scale: 1.2 },
    { at: 1, opacity: 1, scale: 1 },
  ],
  night: [
    { at: 0, opacity: 0, scale: 1 },
    { at: 1, opacity: 1, scale: 1 },
  ],
  end: { opacity: 1, scale: 1 },
};

/** "N raids turned back" lands over the gate: drops in with one bounce, or
 * fades in at night. `translateY` is in the caption's own heights. */
const turnedBack: Recipe = {
  id: 'fx.turnedBack',
  duration: 600,
  board: false,
  easing: 'linear',
  keyframes: [
    { at: 0, opacity: 0, scale: 0.6, translateY: -0.4 },
    { at: 0.25, opacity: 1 },
    { at: 0.5, scale: 1.1, translateY: 0 },
    { at: 0.75, scale: 0.96 },
    { at: 1, opacity: 1, scale: 1, translateY: 0 },
  ],
  night: [
    { at: 0, opacity: 0, scale: 1, translateY: 0 },
    { at: 1, opacity: 1, scale: 1, translateY: 0 },
  ],
  end: { opacity: 1, scale: 1, translateY: 0 },
};

export const sessionEndRecipes: Readonly<Record<SessionEndRecipeRole, Recipe>> =
  {
    'fx.lanternBrighten': lanternBrighten,
    'fx.turnedBack': turnedBack,
  };

/** The words with the count over the gate, and the line under the scene. */
export const watchEndCopy = {
  one: 'raid turned back',
  many: 'raids turned back',
  coach: 'Your lantern burns brighter for every move you held.',
} as const;
