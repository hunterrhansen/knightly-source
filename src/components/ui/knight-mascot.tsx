import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import {
  knightPath,
  knightTransform,
  moon,
  moonCutout,
  tileDarkSquares,
} from './brand-mark-geometry';
import { decorative, Sparkles } from './reward-effects';

/** The knight's moods: the same states the commissioned animated mascot will
 * expose (docs/art-direction.md), so the art can replace this stand-in. */
export type KnightMood =
  | 'idle'
  | 'thinking'
  | 'cheer'
  | 'encourage'
  | 'sleepy'
  | 'celebrate';

// The eye, in the brand mark's 100-unit box: bigger than the mark's dot, so it
// reads as a friendly cartoon eye.
const EYE = { x: 41, y: 38, r: 7.5 };
const BLINK_EVERY_MS = 3600;
const BOB_MS = 1300;

/**
 * A stand-in knight mascot drawn in code from the brand mark: it bobs and
 * blinks when idle, tilts and looks up when thinking, hops on a cheer, nods to
 * encourage after a miss (never mocking), dozes when sleepy and hops, wiggles
 * and sparkles to celebrate. One-off moods replay when `mood` or `play`
 * changes. Decorative: the caller says what happened. Under reduced motion it
 * holds each mood's pose.
 */
export function KnightMascot({
  mood = 'idle',
  size = 44,
  play,
}: {
  mood?: KnightMood;
  size?: number;
  /** Change it to replay a one-off mood (cheer, encourage, celebrate). */
  play?: number | string;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const reduced = useSystemReducedMotion();
  const y = useSharedValue(0);
  const tilt = useSharedValue(0);
  const squash = useSharedValue(1);
  const lid = useSharedValue(1);
  const look = useSharedValue(0);
  const zzz = useSharedValue(0);
  const [sparkle, setSparkle] = useState(0);

  // Body motion for the mood.
  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable; a new mood or play replays it
  useEffect(() => {
    for (const v of [y, tilt, squash, zzz]) cancelAnimation(v);
    y.set(0);
    tilt.set(0);
    squash.set(1);
    zzz.set(0);
    look.set(mood === 'thinking' ? 1 : 0);
    lid.set(mood === 'sleepy' ? 0.12 : 1);
    if (mood === 'thinking')
      tilt.set(reduced ? -8 : withSpring(-8, tokens.motion.springs.settle));
    if (reduced) return;
    const hop = (height: number) =>
      withSequence(
        withTiming(-height, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 130, easing: Easing.in(Easing.quad) }),
      );
    const land = withSequence(
      withTiming(1, { duration: 280 }),
      withTiming(0.86, { duration: 60 }),
      withSpring(1, tokens.motion.springs.release),
    );
    if (mood === 'idle' || mood === 'thinking')
      y.set(
        withRepeat(
          withTiming(-size * 0.04, {
            duration: BOB_MS,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        ),
      );
    else if (mood === 'cheer') {
      y.set(withSequence(hop(size * 0.22), hop(size * 0.14)));
      squash.set(withSequence(land, land));
    } else if (mood === 'celebrate') {
      y.set(withSequence(hop(size * 0.32), hop(size * 0.16)));
      squash.set(withSequence(land, land));
      const wiggle = (to: number) => withTiming(to, { duration: 90 });
      tilt.set(
        withSequence(wiggle(10), wiggle(-10), wiggle(8), wiggle(-6), wiggle(0)),
      );
      setSparkle((n) => n + 1);
    } else if (mood === 'encourage') {
      const nod = (to: number) =>
        withTiming(to, { duration: 180, easing: Easing.inOut(Easing.quad) });
      tilt.set(withSequence(nod(7), nod(0), nod(5), nod(0)));
    } else if (mood === 'sleepy') {
      squash.set(
        withRepeat(
          withTiming(1.03, {
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
          }),
          -1,
          true,
        ),
      );
      zzz.set(withRepeat(withTiming(1, { duration: 2200 }), -1));
    }
  }, [mood, play, reduced, size]);

  // Blinks while awake.
  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable
  useEffect(() => {
    if (reduced || mood === 'sleepy') return;
    const timer = setInterval(() => {
      lid.set(
        withSequence(
          withTiming(0.1, { duration: 70 }),
          withDelay(40, withTiming(1, { duration: 90 })),
        ),
      );
    }, BLINK_EVERY_MS);
    return () => clearInterval(timer);
  }, [mood, reduced]);

  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.get() },
      { rotate: `${tilt.get()}deg` },
      { scaleY: squash.get() },
      { scaleX: 2 - squash.get() },
    ],
  }));
  const k = size / 100;
  const eyeSize = EYE.r * 2 * k;
  const eye = useAnimatedStyle(() => ({
    transform: [{ scaleY: lid.get() }],
  }));
  const pupil = useAnimatedStyle(() => ({
    transform: [
      { translateX: -look.get() * eyeSize * 0.12 },
      { translateY: -look.get() * eyeSize * 0.2 },
    ],
  }));
  const z = useAnimatedStyle(() => ({
    opacity: Math.sin(Math.PI * zzz.get()),
    transform: [
      { translateY: -zzz.get() * size * 0.3 },
      { translateX: zzz.get() * size * 0.12 },
    ],
  }));

  // The brow sits above the eye: raised for a cheer, soft for encouragement,
  // furrowed in thought, low and flat when sleepy.
  const brow = {
    idle: -6,
    thinking: 14,
    cheer: -16,
    celebrate: -18,
    encourage: -10,
    sleepy: 0,
  }[mood];

  return (
    <View {...decorative} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect
          x="4"
          y="8"
          width="92"
          height="88"
          rx="22"
          fill={theme.colors.brandLedge}
        />
        <Rect
          x="4"
          y="4"
          width="92"
          height="88"
          rx="22"
          fill={theme.colors.brand}
        />
        {tileDarkSquares.map((d) => (
          <Path key={d} d={d} fill={theme.colors.brandSquare} />
        ))}
        <Circle {...moon} fill={theme.boardAnnotations.hintGold} />
        <Circle {...moonCutout} fill={theme.colors.brandSquare} />
      </Svg>
      <Animated.View style={[styles.layer, body]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d={knightPath}
            transform={`translate(${knightTransform.x} ${knightTransform.y}) scale(${knightTransform.scale})`}
            fill={theme.colors.onBrand}
          />
        </Svg>
        <View
          style={[
            styles.brow,
            {
              left: (EYE.x - EYE.r) * k,
              top: (EYE.y - EYE.r - 4.5) * k,
              width: eyeSize,
              height: Math.max(2, 2.6 * k),
              transform: [{ rotate: `${brow}deg` }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.eye,
            {
              left: (EYE.x - EYE.r) * k,
              top: (EYE.y - EYE.r) * k,
              width: eyeSize,
              height: eyeSize,
              borderRadius: eyeSize / 2,
            },
            eye,
          ]}
        >
          <Animated.View
            style={[
              styles.pupil,
              {
                width: eyeSize * 0.55,
                height: eyeSize * 0.55,
                borderRadius: eyeSize,
              },
              pupil,
            ]}
          >
            <View
              style={[
                styles.glint,
                {
                  width: eyeSize * 0.2,
                  height: eyeSize * 0.2,
                  borderRadius: eyeSize,
                },
              ]}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {mood === 'sleepy' && !reduced && (
        <Animated.View
          style={[styles.z, { left: size * 0.62, top: size * 0.08 }, z]}
        >
          <Text style={[styles.zText, { fontSize: Math.max(9, size * 0.22) }]}>
            z
          </Text>
        </Animated.View>
      )}
      {mood === 'celebrate' && (
        <View style={[styles.layer, styles.centre]}>
          <Sparkles
            fire={sparkle || undefined}
            color={theme.colors.gold}
            reach={size * 0.9}
          />
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  layer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  brow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: theme.colors.brandText,
  },
  eye: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  pupil: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    backgroundColor: theme.colors.onBrand,
    padding: 1,
  },
  glint: { backgroundColor: '#ffffff' },
  z: { position: 'absolute' },
  zText: { color: theme.colors.onBrand, fontFamily: theme.typography.bold },
}));
