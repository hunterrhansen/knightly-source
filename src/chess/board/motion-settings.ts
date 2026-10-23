import type { Square } from 'chess.js';
import {
  Easing,
  ReduceMotion,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { type Preferences, usePreferences } from '../../theme/preferences';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';

type Bezier = readonly [number, number, number, number];
type Travel = Readonly<{ duration: number; bezier: Bezier }>;

const standard = tokens.motion.moveBezier as Bezier;
// Stable curve identities so re-renders never restart a running animation.
const eased: Bezier = [0.25, 0.1, 0.25, 1];
const overshoot: Bezier = [0.34, 1.56, 0.64, 1];
const sharp: Bezier = [0.5, 0, 0.2, 1];
// Fixed speeds share the board curve; styles vary pacing with distance.
const styles: Record<
  Exclude<Preferences['animation'], 'none'>,
  (squares: number) => Travel
> = {
  fast: () => ({ duration: 120, bezier: standard }),
  medium: () => ({ duration: tokens.motion.move, bezier: standard }),
  slow: () => ({ duration: 300, bezier: standard }),
  // Eased like a hand placing a piece; longer moves take slightly longer.
  natural: (squares) => ({
    duration: Math.min(300, 160 + 20 * squares),
    bezier: eased,
  }),
  // Quick with a small overshoot before settling.
  arcade: () => ({ duration: 220, bezier: overshoot }),
  // Duration follows distance, so short hops are snappy.
  dynamic: (squares) => ({
    duration: Math.min(360, 70 + 35 * squares),
    bezier: sharp,
  }),
};

/**
 * The fade for a piece appearing: one dropping in eases out over `enter`, any
 * other fades over `move` with Reanimated's default easing. `easing` is left
 * out, never undefined: withTiming copies every key over its defaults, and an
 * undefined easing crashes its frame loop.
 */
export function pieceFadeIn(entering: boolean): WithTimingConfig {
  return entering
    ? {
        duration: tokens.motion.enter,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }
    : { duration: tokens.motion.move, reduceMotion: ReduceMotion.System };
}

/**
 * How a moved piece lands: its scale at points in time (ms after it
 * arrives), starting and ending at 1. The layered board runs it linearly on
 * the UI thread; web eases each step. Features pass their own (the watch
 * kit's `fx.land`); the default is the small press below.
 */
export type LandingCurve = readonly Readonly<{ at: number; scale: number }>[];

export const pressLanding: LandingCurve = [
  { at: 0, scale: 1 },
  { at: tokens.motion.landingDown, scale: tokens.motion.landingScale },
  { at: tokens.motion.landingDown + tokens.motion.landingUp, scale: 1 },
];

/** When the landing has settled, in ms. */
export function landingDuration(curve: LandingCurve) {
  return curve[curve.length - 1]?.at ?? 0;
}

/** The landing's scale `t` ms after arriving; 1 before and after it. */
export function landingScaleAt(t: number, curve: LandingCurve): number {
  'worklet';
  for (let i = 1; i < curve.length; i++) {
    const from = curve[i - 1];
    const to = curve[i];
    if (from && to && t < to.at) {
      const span = to.at - from.at;
      const u = span > 0 ? Math.max(0, (t - from.at) / span) : 1;
      return from.scale + (to.scale - from.scale) * u;
    }
  }
  return 1;
}

function squaresBetween(from: Square, to: Square): number {
  return Math.max(
    Math.abs(from.charCodeAt(0) - to.charCodeAt(0)),
    Math.abs(Number(from[1]) - Number(to[1])),
  );
}

/** Piece travel follows the device preference; system reduced motion wins. */
export function useBoardMotionSettings() {
  const { animation } = usePreferences().preferences;
  const still = useSystemReducedMotion() || animation === 'none';
  const travel = (from: Square, to: Square): Travel =>
    animation === 'none' || still
      ? { duration: 0, bezier: standard }
      : styles[animation](squaresBetween(from, to));
  // How much a selected or dragged piece grows, by style (not by motion).
  const lift =
    animation === 'arcade' || animation === 'dynamic'
      ? tokens.motion.pieceScaleLarge
      : tokens.motion.pieceScale;
  // Representative duration for effects that wait for a typical move.
  return { still, travel, lift, moveDuration: travel('a1', 'a3').duration };
}
