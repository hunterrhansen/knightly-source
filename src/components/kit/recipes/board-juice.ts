import type { BoardRecipeRole, Praise, Recipe } from '../types';

// Board juice after Candy Crush, kept to a chess board's calm
// (docs/specs/2026-10-18-watch-story-design.md, "Board juice"). Each recipe
// ends within 600 ms and only moves a piece or an overlay, never a square.
// Tune timings here; screens and the board read them through the kit.

/** A piece landing: a press with a small overshoot. The board runs it as a
 * scale curve (see `landingCurve`). */
const land: Recipe = {
  id: 'fx.land',
  duration: 240,
  board: true,
  easing: 'linear',
  keyframes: [
    { at: 0, scale: 1 },
    { at: 0.375, scale: 0.86 },
    { at: 0.75, scale: 1.06 },
    { at: 1, scale: 1 },
  ],
  // After 21:00 the squash is halved.
  night: [
    { at: 0, scale: 1 },
    { at: 0.375, scale: 0.93 },
    { at: 0.75, scale: 1.03 },
    { at: 1, scale: 1 },
  ],
  end: { scale: 1 },
};

/** The captured piece swells and fades as it bursts into sparks. */
const swell: Recipe = {
  id: 'fx.capturePop.swell',
  duration: 300,
  board: true,
  easing: 'out',
  keyframes: [
    { at: 0, scale: 1, opacity: 1 },
    { at: 1, scale: 1.35, opacity: 0 },
  ],
  end: { opacity: 0 },
};

/** "+N" rising off the captured square. */
const score: Recipe = {
  id: 'fx.capturePop.score',
  duration: 500,
  delay: 80,
  board: true,
  easing: 'out',
  keyframes: [
    { at: 0, opacity: 0, translateY: 0, scale: 0.8 },
    { at: 0.25, opacity: 1 },
    { at: 1, opacity: 0, translateY: -0.9, scale: 1.1 },
  ],
  end: { opacity: 0 },
};

/** A beam from the solving move's piece to the square it now guards… */
const beam: Recipe = {
  id: 'fx.lineLight.beam',
  duration: 600,
  delay: 150,
  board: true,
  easing: 'out',
  keyframes: [
    { at: 0, grow: 0, opacity: 1 },
    { at: 0.43, grow: 1, opacity: 1 },
    { at: 1, opacity: 0 },
  ],
  end: { opacity: 0 },
};

/** …then that square glows and fades. */
const glow: Recipe = {
  id: 'fx.lineLight.glow',
  duration: 600,
  delay: 150,
  board: true,
  easing: 'out',
  keyframes: [
    { at: 0, opacity: 0, scale: 0.9 },
    { at: 0.43, opacity: 0 },
    { at: 0.72, opacity: 1 },
    { at: 1, opacity: 0, scale: 1.1 },
  ],
  end: { opacity: 0 },
};

/** The praise word: pops in with one overshoot, holds, then fades. */
const praise: Recipe = {
  id: 'fx.praise',
  duration: 600,
  board: true,
  easing: 'linear',
  keyframes: [
    { at: 0, scale: 0.4, opacity: 1 },
    { at: 0.2, scale: 1.12 },
    { at: 0.27, scale: 1 },
    { at: 0.73, opacity: 1 },
    { at: 1, opacity: 0 },
  ],
  end: { opacity: 0 },
};

export const boardJuice: Readonly<Record<BoardRecipeRole, Recipe>> = {
  'fx.land': land,
  'fx.capturePop.swell': swell,
  'fx.capturePop.score': score,
  'fx.lineLight.beam': beam,
  'fx.lineLight.glow': glow,
  'fx.praise': praise,
};

/** One word per clean answer, bigger at 3, 5 and 10 in a row. */
export const praiseWords: readonly Praise[] = [
  { run: 1, word: 'Sharp!', scale: 1 },
  { run: 3, word: 'Spotted!', scale: 1.08 },
  { run: 5, word: 'Brilliant!', scale: 1.18 },
  { run: 10, word: 'Unbreakable!', scale: 1.3 },
];
