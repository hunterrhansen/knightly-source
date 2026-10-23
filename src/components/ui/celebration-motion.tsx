import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type WithTimingConfig,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { decorative as hidden } from './reward-effects';

// Decorative celebration motion (Today, session-end beats). Every effect
// ignores touches and is hidden from assistive technology; under reduced
// motion each one shows its final frame. Reward bursts, sparkles, counts and
// shines are in ./reward-effects.

// Module constants: the entrance restarts whenever its easing changes identity.
const popEasing = Easing.bezier(...tokens.motion.popBezier);
const linear = Easing.linear;

/** 0 → 1 once on mount; 1 straight away under reduced motion. */
function useEntrance(
  duration: number,
  delay = 0,
  easing: WithTimingConfig['easing'] = popEasing,
) {
  const reduced = useSystemReducedMotion();
  const previousReduced = useRef(reduced);
  const progress = useSharedValue(reduced ? 1 : 0);
  useLayoutEffect(() => {
    const changed = previousReduced.current !== reduced;
    previousReduced.current = reduced;
    cancelAnimation(progress);
    if (reduced || changed) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration, easing })));
    return () => cancelAnimation(progress);
  }, [progress, reduced, duration, delay, easing]);
  return progress;
}

type Spring =
  (typeof tokens.motion.springs)[keyof typeof tokens.motion.springs];

/** 0 → 1 on `spring` once on mount (overshooting with `pop`); 1 straight away
 * under reduced motion. */
function useSpringEntrance(spring: Spring, delay = 0) {
  const reduced = useSystemReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useLayoutEffect(() => {
    cancelAnimation(progress);
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withDelay(delay, withSpring(1, spring)));
    return () => cancelAnimation(progress);
  }, [progress, reduced, spring, delay]);
  return progress;
}

/** Pops its child in on the `pop` spring (one lively overshoot), or drops and
 * bounces it in over `celebrate`, after `delay` ms. */
export function PopIn({
  children,
  bounce = false,
  delay = 0,
}: {
  children: ReactNode;
  bounce?: boolean;
  delay?: number;
}) {
  return bounce ? (
    <DropIn delay={delay}>{children}</DropIn>
  ) : (
    <SpringPop delay={delay}>{children}</SpringPop>
  );
}

function SpringPop({
  children,
  delay,
}: {
  children: ReactNode;
  delay: number;
}) {
  const progress = useSpringEntrance(tokens.motion.springs.pop, delay);
  const entrance = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.5], [0, 1], 'clamp'),
      transform: [{ scale: Math.max(0, p) }],
    };
  }, [progress]);
  return (
    <Animated.View style={[{ pointerEvents: 'none' }, entrance]}>
      {children}
    </Animated.View>
  );
}

function DropIn({ children, delay }: { children: ReactNode; delay: number }) {
  const progress = useEntrance(tokens.motion.celebrate, delay);
  const entrance = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], 'clamp'),
      transform: [
        { translateY: interpolate(p, [0, 0.45, 0.7, 1], [-48, 0, -10, 0]) },
        { scale: interpolate(p, [0, 0.45, 0.7, 1], [0.4, 1.08, 0.97, 1]) },
      ],
    };
  }, [progress]);
  return (
    <Animated.View style={[{ pointerEvents: 'none' }, entrance]}>
      {children}
    </Animated.View>
  );
}

/** Fades its child in over `duration` after `delay` ms. */
export function FadeIn({
  children,
  delay = 0,
  duration = tokens.motion.fill,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
}) {
  const progress = useEntrance(duration, delay, linear);
  const fade = useAnimatedStyle(
    () => ({ opacity: progress.get() }),
    [progress],
  );
  return <Animated.View style={fade}>{children}</Animated.View>;
}

/** `from` rolls up and out as `to` rolls in, after `delay` ms. Assistive
 * technology reads only `to` (the caller labels it). */
export function RollingNumber({
  from,
  to,
  delay = 0,
  height,
  render,
}: {
  from: number;
  to: number;
  delay?: number;
  /** The line height of one rendered number at the default text size; the
   * line grows to fit when the system text is larger. */
  height: number;
  render: (value: number) => ReactNode;
}) {
  const progress = useSpringEntrance(tokens.motion.springs.settle, delay);
  const [line, setLine] = useState(height);
  const travel = useSharedValue(height);
  const roll = useAnimatedStyle(
    () => ({ transform: [{ translateY: -travel.get() * progress.get() }] }),
    [progress, travel],
  );
  // Measured, not assumed: a fixed line clips the digits at large text.
  const measure = (event: LayoutChangeEvent) => {
    const measured = Math.max(height, event.nativeEvent.layout.height);
    if (measured === line) return;
    setLine(measured);
    travel.set(measured);
  };
  return (
    <View {...hidden} style={{ height: line, overflow: 'hidden' }}>
      <Animated.View style={roll}>
        <View
          onLayout={measure}
          style={{ minHeight: height, justifyContent: 'center' }}
        >
          {render(from)}
        </View>
        <View style={{ height: line, justifyContent: 'center' }}>
          {render(to)}
        </View>
      </Animated.View>
    </View>
  );
}

/** Cross-fades from `off` to `on` with a bounce, after `delay` ms: the streak
 * moon lighting up. */
export function Ignite({
  off,
  on,
  delay = 0,
}: {
  off: ReactNode;
  on: ReactNode;
  delay?: number;
}) {
  const progress = useEntrance(tokens.motion.celebrate, delay);
  const lit = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.3], [0, 1], 'clamp'),
      transform: [
        { scale: interpolate(p, [0, 0.45, 0.7, 1], [0.6, 1.2, 0.95, 1]) },
      ],
    };
  }, [progress]);
  const dark = useAnimatedStyle(
    () => ({ opacity: interpolate(progress.get(), [0, 0.3], [1, 0], 'clamp') }),
    [progress],
  );
  return (
    <View
      {...hidden}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={dark}>{off}</Animated.View>
      <Animated.View style={[{ position: 'absolute' }, lit]}>
        {on}
      </Animated.View>
    </View>
  );
}

// The beacon's ring swells out and fades, over and over: a CSS loop.
const beaconRing = {
  animationName: {
    from: { opacity: 0.5, transform: [{ scale: 1 }] },
    to: { opacity: 0, transform: [{ scale: 1.6 }] },
  },
  animationDuration: tokens.motion.hint,
  animationTimingFunction: 'ease-out',
  animationIterationCount: 'infinite',
} as const;

/** A soft ring that keeps pulsing out from a round node (the current step). */
export function Beacon({ color }: { color: string }) {
  const reduced = useSystemReducedMotion();
  if (reduced) return null;
  return (
    <Animated.View
      {...hidden}
      testID="today-beacon"
      style={[
        {
          position: 'absolute',
          pointerEvents: 'none',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius: 999,
          borderWidth: 3,
          borderColor: color,
        },
        beaconRing,
      ]}
    />
  );
}
