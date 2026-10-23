import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet as NativeStyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  type WithTimingConfig,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  coinHaptic,
  lightHaptic,
  successHaptic,
  tapHaptic,
} from '../../lib/haptics';
import { usePreferences } from '../../theme/preferences';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { playSound } from './sounds';

// The reward effects kit: fly-to-target, burst, sparkles, count-up and shine,
// shared by points, session-end beats, the verdict sheet and streak days.
// Every effect ignores touches and is hidden from assistive technology (the
// caller labels the real value). Under reduced motion each shows its final
// frame: a flight, burst or shine shows nothing, a count shows its number.
// A reward beat pairs its motion with `useRewardCue` (haptic and sound) at the
// same moment; `useRewardMoment` schedules both.

/** Spread on decorative views to hide them from assistive technology. */
export const decorative = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  'aria-hidden': true,
} as const;

export type Point = { x: number; y: number };

/**
 * A reward moment's haptic and sound, played together so they land with its
 * motion: `land` when something arrives (a streak day lighting, a card
 * landing), with the points shard's coin ting; `reward` when a reward completes
 * (a count finishing, a badge), with the run bonus's coin cascade; `arrive`
 * when a card pops into place; `tick` as a count rolls; `fanfare` as a
 * session's results open; `celebrate` when a streak lights.
 */
type RewardCue =
  | 'land'
  | 'reward'
  | 'arrive'
  | 'tick'
  | 'fanfare'
  | 'celebrate';

/** Plays `cue`'s haptic, and its sound unless sounds are off. Reduced motion
 * keeps both: they mark the moment without moving anything. */
export function playRewardCue(cue: RewardCue, sounds: 'on' | 'off') {
  if (cue === 'land') {
    coinHaptic();
    playSound('coin', sounds);
  } else if (cue === 'arrive') {
    lightHaptic();
    playSound('pop', sounds);
  } else if (cue === 'tick') {
    tapHaptic();
    playSound('tick', sounds);
  } else if (cue === 'fanfare') {
    successHaptic();
    playSound('fanfare', sounds);
  } else if (cue === 'celebrate') {
    successHaptic();
    playSound('fanfare-short', sounds);
  } else {
    successHaptic();
    playSound('coin-bonus', sounds);
  }
}

/** Plays a reward cue's haptic and sound, following the sounds setting. */
export function useRewardCue() {
  const { sounds } = usePreferences().preferences;
  return useCallback((cue: RewardCue) => playRewardCue(cue, sounds), [sounds]);
}

/** 0 until `at` ms after mount, then 1, playing `cue` at that moment; pass
 * the result as an effect's `fire`. Never fires when `at` is undefined. The
 * cue keeps its time under reduced motion, as haptics do elsewhere. */
export function useRewardMoment(at: number | undefined, cue?: RewardCue) {
  const play = useRewardCue();
  const [fire, setFire] = useState(0);
  // A moment happens once per mount: refetches that change `at` (or the sound
  // setting) afterwards must not replay its motion and cue.
  const fired = useRef(false);
  const latest = useRef({ cue, play });
  latest.current = { cue, play };
  useEffect(() => {
    if (at === undefined || fired.current) return;
    const timer = setTimeout(() => {
      fired.current = true;
      setFire(1);
      const { cue: now, play: cueNow } = latest.current;
      if (now) cueNow(now);
    }, at);
    return () => clearTimeout(timer);
  }, [at]);
  return fire;
}

/** Runs `progress` 0 → 1 whenever `fire` is truthy (on mount or a new value);
 * stays at 0 under reduced motion. */
function useFired(
  fire: number | string | undefined,
  progress: SharedValue<number>,
  timing: WithTimingConfig,
  delay = 0,
) {
  const reduced = useSystemReducedMotion();
  // biome-ignore lint/correctness/useExhaustiveDependencies: replays on a new `fire` only; the timing is fixed per effect
  useEffect(() => {
    if (!fire || reduced) return;
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, timing)));
    return () => cancelAnimation(progress);
  }, [fire, reduced, progress]);
}

/**
 * Pops `children` in at `from`, then flies them to `to`, turning, shrinking and
 * fading on the way (the points shard). Coordinates are the parent's; the child
 * is centred on the point. Plays once on mount; render it only when motion is
 * allowed, since its final frame has nothing left on screen.
 */
export function FlyTo({
  from,
  to,
  size,
  children,
  pop,
  delay = 0,
  duration,
  easing,
  turn = 0,
  endScale = 1,
  endOpacity = 1,
}: {
  from: Point;
  to: Point;
  /** The child's width and height. */
  size: number;
  children: ReactNode;
  /** Pops 0 → 1.18 → 1 before the flight. */
  pop?: WithTimingConfig;
  delay?: number;
  duration: number;
  easing: WithTimingConfig['easing'];
  /** Degrees turned by the time it lands. */
  turn?: number;
  endScale?: number;
  endOpacity?: number;
}) {
  const popped = useSharedValue(pop ? 0 : 1);
  const fly = useSharedValue(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: plays once on mount
  useEffect(() => {
    if (pop) popped.set(withTiming(1, pop));
    fly.set(withDelay(delay, withTiming(1, { duration, easing })));
    return () => {
      cancelAnimation(popped);
      cancelAnimation(fly);
    };
  }, [popped, fly]);
  const style = useAnimatedStyle(() => {
    const p = popped.get();
    const f = fly.get();
    const scale =
      f > 0
        ? 1 - f * (1 - endScale)
        : p < 0.6
          ? (p / 0.6) * 1.18
          : 1.18 - ((p - 0.6) / 0.4) * 0.18;
    return {
      opacity: f > 0 ? 1 - f * (1 - endOpacity) : 1,
      transform: [
        { translateX: from.x - size / 2 + (to.x - from.x) * f },
        { translateY: from.y - size / 2 + (to.y - from.y) * f },
        { rotate: `${f * turn}deg` },
        { scale },
      ],
    };
  });
  return (
    <Animated.View
      {...decorative}
      style={[effect.fly, { width: size, height: size }, style]}
    >
      {children}
    </Animated.View>
  );
}

const burstEase = Easing.bezier(0, 0, 0.2, 1);

/**
 * A disc of `color` that grows from `fromScale` to `toScale` while fading out
 * from `peak` opacity, each time `fire` is truthy (on mount or a new value).
 * Position it with `style` (absolute, sized). Hidden at rest.
 */
export function Burst({
  fire,
  color,
  style,
  duration = 500,
  delay = 0,
  fromScale = 0.5,
  toScale = 3.2,
  peak = 0.7,
}: {
  fire: number | string | undefined;
  color: string;
  style: object;
  duration?: number;
  delay?: number;
  fromScale?: number;
  toScale?: number;
  peak?: number;
}) {
  const progress = useSharedValue(0);
  useFired(fire, progress, { duration, easing: burstEase }, delay);
  const bursting = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p > 0 && p < 1 ? peak * (1 - p) : 0,
      transform: [{ scale: fromScale + (toScale - fromScale) * p }],
    };
  });
  return (
    <Animated.View
      {...decorative}
      style={[effect.round, { backgroundColor: color }, style, bursting]}
    />
  );
}

const SPARKS = 8;

function Spark({
  index,
  reach,
  color,
  progress,
}: {
  index: number;
  reach: number;
  color: string;
  progress: SharedValue<number>;
}) {
  // Alternate long and short rays, offset so they read as a twinkle.
  const angle = (index / SPARKS) * Math.PI * 2 - Math.PI / 2;
  const far = index % 2 ? reach * 0.7 : reach;
  const size = index % 2 ? 5 : 7;
  const spark = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.1, 0.6, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * far * p },
        { translateY: Math.sin(angle) * far * p },
        { scale: interpolate(p, [0, 0.3, 1], [0.4, 1.2, 0]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        effect.spark,
        {
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        spark,
      ]}
    />
  );
}

/** A ring of sparks flying out from the parent's centre to `reach` points and
 * winking out, each time `fire` is truthy. Nothing at rest. */
export function Sparkles({
  fire,
  color,
  reach = 36,
  duration = 600,
  delay = 0,
}: {
  fire: number | string | undefined;
  color: string;
  reach?: number;
  duration?: number;
  delay?: number;
}) {
  const progress = useSharedValue(0);
  useFired(fire, progress, { duration, easing: burstEase }, delay);
  return (
    <View {...decorative} style={effect.centre}>
      {Array.from({ length: SPARKS }, (_, index) => (
        <Spark
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ring of sparks
          key={index}
          index={index}
          reach={reach}
          color={color}
          progress={progress}
        />
      ))}
    </View>
  );
}

/**
 * Counts `from` → `to` over `duration` ms easing out, after `delay` ms. Calls
 * `onTick` each time it passes a multiple of `tickEvery`, and `onDone` when it
 * reaches `to` (at once under reduced motion, which shows the final number).
 * Renders text only: put it inside a `Text` the caller labels.
 */
export function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 900,
  tickEvery = 10,
  onTick,
  onDone,
}: {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  tickEvery?: number;
  onTick?: () => void;
  onDone?: () => void;
}) {
  const reduced = useSystemReducedMotion();
  const [value, setValue] = useState(reduced ? to : from);
  // A count runs once; a later total (a save landing, a refetch) just shows,
  // without counting from zero again or repeating its cue.
  const finished = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: callbacks are read when called; a new count restarts only on its numbers
  useEffect(() => {
    if (finished.current) {
      setValue(to);
      return;
    }
    const done = () => {
      finished.current = true;
      onDone?.();
    };
    if (reduced) {
      setValue(to);
      done();
      return;
    }
    setValue(from);
    let frame = 0;
    let last = from;
    const timer = setTimeout(() => {
      const start = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        const next = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
        if (Math.floor(next / tickEvery) > Math.floor(last / tickEvery))
          onTick?.();
        last = next;
        setValue(next);
        if (t < 1) frame = requestAnimationFrame(step);
        else done();
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [to, from, delay, duration, tickEvery, reduced]);
  return <>{String(value)}</>;
}

const shineEase = Easing.inOut(Easing.quad);

/**
 * A slanted band of light that sweeps once across its parent (which clips it:
 * give the parent `overflow: 'hidden'` and its radius) each time `fire` is
 * truthy. Fills the parent absolutely; nothing under reduced motion.
 */
export function Shine({
  fire,
  delay = 0,
  duration = 700,
}: {
  fire: number | string | undefined;
  delay?: number;
  duration?: number;
}) {
  const reduced = useSystemReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  useFired(
    width ? fire : undefined,
    progress,
    {
      duration,
      easing: shineEase,
    },
    delay,
  );
  const band = Math.max(16, width * 0.3);
  const sweep = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p > 0 && p < 1 ? 1 : 0,
      transform: [
        { translateX: -band * 1.5 + (width + band * 3) * p },
        { skewX: '-20deg' },
      ],
    };
  });
  if (reduced) return null;
  return (
    <View
      {...decorative}
      pointerEvents="none"
      style={effect.fill}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[effect.band, { width: band }, sweep]}>
        <View style={effect.glow} />
        <View style={effect.core} />
      </Animated.View>
    </View>
  );
}

// Theme-independent styles for the effects' animated layers.
const effect = NativeStyleSheet.create({
  fly: { position: 'absolute', left: 0, top: 0 },
  round: { position: 'absolute', borderRadius: 9999 },
  centre: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    pointerEvents: 'none',
  },
  spark: { position: 'absolute' },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    top: -8,
    bottom: -8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  core: { width: '40%', backgroundColor: 'rgba(255, 255, 255, 0.4)' },
});
