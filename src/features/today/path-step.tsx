import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { type Sprite, SpriteView } from '../../ui';

// The step along the path after a watch is kept (docs/specs/2026-10-19-path-
// home-design.md, "After a watch"): the node just kept pops, the road fills up to
// the next one, the knight walks it and the next node lights. Each piece is
// decorative: it ignores touches and is hidden from assistive technology.
// Reduced motion never starts a step (PathView), so none of this runs then.

/** When each beat starts, in ms from the step playing. */
export const STEP = {
  kept: 150,
  walk: 550,
  walkFor: 900,
  arrive: 1350,
  end: 2000,
} as const;

const walkEasing = Easing.inOut(Easing.cubic);
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The node just kept: a pop and a ring that spreads and fades. */
export function KeptPop({
  playing,
  size,
  children,
}: {
  playing: boolean;
  size: number;
  children: ReactNode;
}) {
  const styles = useStyles();
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!playing) return;
    scale.set(
      withDelay(
        STEP.kept,
        withSequence(
          withTiming(1.3, { duration: 160 }),
          withSpring(1, tokens.motion.springs.release),
        ),
      ),
    );
    ring.set(withDelay(STEP.kept, withTiming(1, { duration: 600 })));
  }, [playing, scale, ring]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const spread = useAnimatedStyle(() => ({
    opacity: ring.get() > 0 ? 1 - ring.get() : 0,
    transform: [{ scale: 1 + ring.get() * 1.2 }],
  }));
  return (
    <View>
      <Animated.View
        {...hidden}
        style={[
          styles.ring,
          styles.still,
          { width: size, height: size, borderRadius: size / 2 },
          spread,
        ]}
      />
      <Animated.View style={pop}>{children}</Animated.View>
    </View>
  );
}

/** The next node: small and dim until the knight reaches it, then lit. */
export function ArrivePop({
  playing,
  children,
}: {
  playing: boolean;
  children: ReactNode;
}) {
  const grow = useSharedValue(0);
  useEffect(() => {
    if (playing)
      grow.set(
        withDelay(STEP.arrive, withSpring(1, tokens.motion.springs.pop)),
      );
  }, [playing, grow]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * Math.min(1, grow.get()),
    transform: [{ scale: 0.55 + 0.45 * grow.get() }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The knight walking from one node to the next, three hops on the way. */
export function WalkingKnight({
  playing,
  sprite,
  size,
  from,
  to,
}: {
  playing: boolean;
  sprite: Sprite;
  size: number;
  from: { left: number; top: number };
  to: { left: number; top: number };
}) {
  const styles = useStyles();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (playing)
      progress.set(
        withDelay(
          STEP.walk,
          withTiming(1, { duration: STEP.walkFor, easing: walkEasing }),
        ),
      );
  }, [playing, progress]);
  const style = useAnimatedStyle(() => {
    const t = progress.get();
    const hop = Math.abs(Math.sin(t * Math.PI * 3)) * 10;
    return {
      transform: [
        { translateX: (to.left - from.left) * t },
        { translateY: (to.top - from.top) * t - hop },
      ],
    };
  });
  return (
    <Animated.View
      {...hidden}
      style={[
        styles.still,
        { position: 'absolute', left: from.left, top: from.top },
        style,
      ]}
    >
      <SpriteView sprite={sprite} size={size} />
    </Animated.View>
  );
}

/** The road from the kept node to the next, drawn on as the knight walks. */
export function RoadFill({
  playing,
  d,
  length,
  width,
  height,
}: {
  playing: boolean;
  d: string;
  /** At least the path's length: the fill finishes as it covers it. */
  length: number;
  width: number;
  height: number;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(
        1,
        Math.max(0, (now - start - STEP.walk) / STEP.walkFor),
      );
      setDrawn(t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  if (!drawn) return null;
  return (
    <View {...hidden} style={[styles.still, styles.fill]}>
      <Svg width={width} height={height}>
        <Path
          d={d}
          stroke={theme.colors.brandLedge}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          strokeDashoffset={length * (1 - drawn)}
          fill="none"
        />
      </Svg>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  still: { pointerEvents: 'none' },
  fill: { position: 'absolute', top: 0, left: 0 },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 3,
    borderColor: theme.colors.brand,
  },
}));
