import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { Sparkles, useRewardMoment } from '../ui/reward-effects';
import { watchColors as c } from './art/wall-art';
import { keyframesOf, useRecipeProgress } from './beats';
import { frameAt } from './recipe';
import { useCharacter, useRecipe, useScene, useWatchEndCopy } from './registry';
import { actorBox, SceneView } from './scene';
import { SpriteView } from './sprite';
import type { Recipe } from './types';

// The end of the watch over the wall (docs/specs/2026-10-18-watch-story-
// design.md, "The wall: art through the watch", Session end): the knight's
// lantern brightens one step per held move, then "N raids turned back"
// lands over the shut gate.

/** The lantern's light before the first held move, and the held moves that
 * bring it to full: fewer leave it partly lit, so each one shows. */
const LOW = 0.35;
const FULL_AT = 5;
/** When the first step starts, in ms from mount. */
const START = 400;
const GLOW = 136;
/** The caption's height, as the scene's `gateCaption` slot draws it. */
const CAPTION = 76;

/** How bright the lantern is (0 to 1) after `step` of `held` held moves. */
export function lanternLevel(step: number, held: number) {
  'worklet';
  const steps = Math.max(held, FULL_AT);
  return LOW + ((1 - LOW) * Math.min(Math.max(step, 0), held)) / steps;
}

/** The watch's end in words: "3 raids turned back" (the scene's caption,
 * for the beat's header and announcement) and the line under the scene. */
export function useWatchEndWords(held: number) {
  const copy = useWatchEndCopy();
  return {
    caption: `${held} ${held === 1 ? copy.one : copy.many}`,
    coach: copy.coach,
  };
}

/** The beat's timings for `held` steps of `step`, then `caption`: each step's
 * spacing (shorter for many, so the whole stays brief), when the caption
 * lands and when the beat is ready for its button. */
function timing(held: number, step: Recipe, caption: Recipe) {
  const every =
    held > 0
      ? Math.max(220, Math.min(step.duration + 140, 3000 / held))
      : step.duration;
  const land = START + held * every;
  return { every, land, ready: land + caption.duration };
}

/** When the watch's end beat is ready for its button, in ms from mount. */
export function useWatchEndReady(held: number) {
  return timing(
    held,
    useRecipe('fx.lanternBrighten'),
    useRecipe('fx.turnedBack'),
  ).ready;
}

/**
 * The wall at the end of the watch, for the session-end beat: the knight on
 * lookout behind the shut gate, his lantern brightening a step for each of
 * `held` moves, then the count landing over the gate with the reward cue.
 * Under reduced motion it shows the end at once; after 21:00 the steps and
 * the caption cross-fade. Decorative: the caller labels it.
 */
export function WatchEndScene({ held }: { held: number }) {
  const styles = useStyles();
  const { theme } = useTheme();
  const reduced = useSystemReducedMotion();
  const scene = useScene('scene.wallHero', 'end');
  const knight = useCharacter('character.knight').states.lookout;
  const copy = useWatchEndCopy();
  const stepRecipe = useRecipe('fx.lanternBrighten');
  const captionRecipe = useRecipe('fx.turnedBack');
  const { every, land } = timing(held, stepRecipe, captionRecipe);
  const stepKeys = keyframesOf(stepRecipe);
  const captionKeys = keyframesOf(captionRecipe);
  const caption = useRecipeProgress(
    useMemo(() => ({ ...captionRecipe, delay: land }), [captionRecipe, land]),
  );
  const landed = useRewardMoment(land, 'reward');

  // Steps taken, 0 → held, one per `every` ms.
  const steps = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      steps.set(held);
      return;
    }
    steps.set(0);
    steps.set(
      withDelay(
        START,
        withTiming(held, { duration: held * every, easing: Easing.linear }),
      ),
    );
    return () => cancelAnimation(steps);
  }, [reduced, steps, held, every]);
  const stepMs = Math.min(stepRecipe.duration, every);
  const glow = useAnimatedStyle(() => {
    const t = steps.get();
    const step = Math.min(Math.floor(t), held);
    let level = lanternLevel(step, held);
    let swell = 1;
    if (step < held) {
      const p = Math.min(1, ((t - step) * every) / stepMs);
      const next = lanternLevel(step + 1, held);
      level += (next - level) * frameAt(stepKeys, 'opacity', p, 1);
      swell = frameAt(stepKeys, 'scale', p, 1);
    }
    return {
      opacity: 0.9 * level,
      transform: [{ scale: (0.55 + 0.45 * level) * swell }],
    };
  });
  const words = useAnimatedStyle(() => {
    const p = reduced ? 1 : caption.get();
    return {
      opacity: frameAt(captionKeys, 'opacity', p, 1),
      transform: [
        {
          translateY: frameAt(captionKeys, 'translateY', p, 0) * CAPTION,
        },
        { scale: frameAt(captionKeys, 'scale', p, 1) },
      ],
    };
  });
  const scale = (slotHeight: number) => slotHeight / knight.viewBox[1];
  const lantern = knight.anchors?.lantern ?? { x: 0, y: 0 };
  return (
    <SceneView
      scene={scene}
      renderActor={(slot) => {
        if (slot.id === 'knight')
          return (
            <View style={actorBox(slot)}>
              <SpriteView sprite={knight} size={slot.height} />
            </View>
          );
        if (slot.id === 'knightLight')
          return (
            <View style={actorBox(slot)}>
              <Animated.View
                style={[
                  styles.glow,
                  {
                    left: lantern.x * scale(slot.height) - GLOW / 2,
                    top: lantern.y * scale(slot.height) - GLOW / 2,
                  },
                  glow,
                ]}
              >
                <Glow />
              </Animated.View>
            </View>
          );
        if (slot.id === 'gateCaption')
          return (
            <View style={[actorBox(slot), styles.centre]}>
              <Animated.View style={[styles.caption, words]}>
                {/* Sized to the slot over the gate; the caller's label
                    carries the words at any text size. */}
                <Text style={styles.count} maxFontSizeMultiplier={1.2}>
                  {held}
                </Text>
                <Text
                  style={styles.words}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {held === 1 ? copy.one : copy.many}
                </Text>
              </Animated.View>
              <View style={styles.sparkles}>
                <Sparkles fire={landed} color={theme.colors.gold} reach={84} />
              </View>
            </View>
          );
        return null;
      }}
    />
  );
}

/** The lantern's light at full: the caller fades and scales it. */
function Glow() {
  const id = `watch-end-lantern-${useId().replace(/:/g, '')}`;
  return (
    <Svg width={GLOW} height={GLOW}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.lanternCore} stopOpacity={0.75} />
          <Stop offset="0.4" stopColor={c.lantern} stopOpacity={0.32} />
          <Stop offset="1" stopColor={c.lantern} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

const useStyles = createStyles((theme) => ({
  glow: { position: 'absolute', width: GLOW, height: GLOW },
  centre: { alignItems: 'center', justifyContent: 'flex-end' },
  caption: {
    alignItems: 'center',
    height: CAPTION,
    justifyContent: 'flex-end',
  },
  sparkles: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    // Over the night sky.
    color: theme.colors.gold,
    fontFamily: theme.typography.heading,
    fontSize: 44,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
    textShadowColor: c.outline,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  words: {
    color: c.moonlight,
    fontFamily: theme.typography.bold,
    fontSize: 16,
    lineHeight: 22,
    textShadowColor: 'rgba(15, 14, 13, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
}));
