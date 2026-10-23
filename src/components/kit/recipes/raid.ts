import type { RaidRecipeRole, Recipe } from '../types';

// The raiders' reactions at the treeline (docs/specs/2026-10-18-watch-story-
// design.md, "During the watch: looking out from the wall"). They play in
// the far scene only, never over the board, after the verdict lands; each
// holds its last frame. `translateY` is in the raider's own heights. The
// night versions (after 21:00) drop the hops and overshoots. Played in
// reverse, fall back is the raiders arriving from the trees and edge in is
// their reset when the board rewinds.

/** A right answer: a startled hop, then back down into the trees. */
const fallBack: Recipe = {
  id: 'fx.raidersFallBack',
  duration: 700,
  board: false,
  easing: 'out',
  keyframes: [
    { at: 0, translateY: 0, scale: 1, opacity: 1 },
    { at: 0.2, translateY: -0.08, scale: 1.04 },
    { at: 0.45, opacity: 1 },
    { at: 1, translateY: 0.75, scale: 0.9, opacity: 0 },
  ],
  night: [
    { at: 0, translateY: 0, scale: 1, opacity: 1 },
    { at: 1, translateY: 0.75, scale: 0.9, opacity: 0 },
  ],
  end: { translateY: 0.75, scale: 0.9, opacity: 0 },
};

/** A wrong answer: they creep forward, growing nearer, rising only a
 * little so they stay under the lesson's bars. */
const edgeIn: Recipe = {
  id: 'fx.raidersEdgeIn',
  duration: 500,
  board: false,
  easing: 'out',
  keyframes: [
    { at: 0, translateY: 0, scale: 1 },
    { at: 0.7, translateY: -0.1, scale: 1.13 },
    { at: 1, translateY: -0.08, scale: 1.1 },
  ],
  night: [
    { at: 0, translateY: 0, scale: 1 },
    { at: 1, translateY: -0.08, scale: 1.1 },
  ],
  end: { translateY: -0.08, scale: 1.1 },
};

/** A capture: the raider is knocked over with a jolt, lying up on the
 * treetops where it can be seen, then sinks out of sight. */
const out: Recipe = {
  id: 'fx.raiderOut',
  duration: 1100,
  board: false,
  easing: 'linear',
  keyframes: [
    { at: 0, scale: 1.18, opacity: 1, translateY: -0.3 },
    { at: 0.12, scale: 1 },
    { at: 0.65, opacity: 1, translateY: -0.3 },
    { at: 1, opacity: 0, translateY: 0.4 },
  ],
  night: [
    { at: 0, scale: 1, opacity: 1, translateY: -0.3 },
    { at: 0.65, opacity: 1, translateY: -0.3 },
    { at: 1, opacity: 0, translateY: 0.4 },
  ],
  end: { scale: 1, opacity: 0, translateY: 0.4 },
};

/** "Out!" over it: pops in, holds, drifts up a little and fades, staying
 * below the lesson's bars. */
const outWord: Recipe = {
  id: 'fx.raiderOut.word',
  duration: 1100,
  board: false,
  easing: 'linear',
  keyframes: [
    { at: 0, opacity: 0, scale: 0.6, translateY: 0 },
    { at: 0.12, opacity: 1, scale: 1.12 },
    { at: 0.22, scale: 1 },
    { at: 0.7, opacity: 1, translateY: -0.05 },
    { at: 1, opacity: 0, translateY: -0.15 },
  ],
  night: [
    { at: 0, opacity: 0, scale: 1, translateY: 0 },
    { at: 0.2, opacity: 1 },
    { at: 0.7, opacity: 1, translateY: -0.05 },
    { at: 1, opacity: 0, translateY: -0.15 },
  ],
  end: { opacity: 0, scale: 1, translateY: -0.15 },
};

/** A segment of the captain's health cracking: it swells, then empties
 * from its slot. */
const captainHit: Recipe = {
  id: 'fx.captainHit',
  duration: 450,
  board: false,
  easing: 'out',
  keyframes: [
    { at: 0, scale: 1, opacity: 1 },
    { at: 0.3, scale: 1.4, opacity: 1 },
    { at: 1, scale: 1, opacity: 0 },
  ],
  night: [
    { at: 0, scale: 1, opacity: 1 },
    { at: 1, scale: 1, opacity: 0 },
  ],
  end: { scale: 1, opacity: 0 },
};

export const raidRecipes: Readonly<Record<RaidRecipeRole, Recipe>> = {
  'fx.raidersFallBack': fallBack,
  'fx.raidersEdgeIn': edgeIn,
  'fx.raiderOut': out,
  'fx.raiderOut.word': outWord,
  'fx.captainHit': captainHit,
};

/** The word over a knocked-out raider. */
export const raidCopy = { out: 'Out!' } as const;
