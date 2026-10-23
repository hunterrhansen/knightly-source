import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet as NativeStyleSheet,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cubicBezier,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { momentHaptic } from '../../lib/haptics';
import type { PointsAward } from '../../lib/lesson-points';
import { quadInOut } from '../../theme/css-easing';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { IconButton } from './icon-button';
import {
  lessonSegments,
  progressLabel,
  type RunTier,
  runLabel,
  runTier,
} from './lesson-progress';
import { PointsCounter } from './points-flight';

// Approved motion (answer-feedback spec, "Progress bar and combo").
const FILL_MS = 300;
const SWEEP_MS = 520;
const SWEEP_DELAY = 180;
const COLOUR_MS = 400;
const GLOW_MS = 1400;
const fillEasing = Easing.bezier(...tokens.motion.popBezier);
const sweepEasing = Easing.out(Easing.quad);
const fillCurve = cubicBezier(...tokens.motion.popBezier);
// A gold run's halo breathes: a CSS loop Reanimated runs natively.
const haloPulse = {
  animationName: { from: { opacity: 0 }, to: { opacity: 0.6 } },
  animationDuration: GLOW_MS / 2,
  animationTimingFunction: quadInOut,
  animationDirection: 'alternate',
  animationIterationCount: 'infinite',
} as const;
const noHalo = { opacity: 0 } as const;
const hidden = {
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  'aria-hidden': true,
} as const;

/** A lesson's top bar: ✕ (progress is saved), one segment per item and, when
 * offered, the list button. The fill eases in and sweeps, a run of clean
 * answers shows "N IN A ROW" and turns its segments gold at 5 and flame at
 * 7 (earlier runs keep the colour they earned), a
 * miss shakes the current segment, and the last two items glow. Lessons are
 * full screen, without tabs. */
export function LessonTopBar({
  done,
  current,
  total,
  combo = 0,
  misses = 0,
  points,
  award,
  onExit,
  onList,
  listLabel = 'All moves',
  listShortcut,
  exitLabel = 'Exit, progress is saved',
  loading = false,
}: {
  done: number;
  current: number;
  total: number;
  /** Consecutive clean answers in this session. */
  combo?: number;
  /** Misses so far this session; each new one shakes the current segment. */
  misses?: number;
  /** Pattern points this session; shows the counter when set. */
  points?: number;
  /** The latest award, counted in as its shard lands. */
  award?: PointsAward;
  /** ✕; leave it out where a native header already offers it. */
  onExit?: () => void;
  onList?: () => void;
  listLabel?: string;
  /** The list button's web keyboard shortcut ("L"). */
  listShortcut?: string;
  /** The ✕'s spoken label. */
  exitLabel?: string;
  /** Before the lesson's size is known: one empty track. */
  loading?: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const reduced = useSystemReducedMotion();
  const tier = runTier(combo);
  const colours = {
    none: theme.colors.brand,
    gold: theme.colors.gold,
    flame: theme.colors.flame,
  };
  const { segments, gap } = loading
    ? lessonSegments(0, -1, 1)
    : lessonSegments(done, current, total);
  const earned = useEarnedTiers(segments, combo, tier);
  const remaining = Math.max(0, total - done);
  const complete = total > 0 && done >= total;
  const label = runLabel(combo);

  // The whole bar pops and flashes gold as the lesson completes.
  const burst = useSharedValue(1);
  const flash = useSharedValue(0);
  const bursting = useAnimatedStyle(() => ({
    transform: [{ scale: burst.get() }],
  }));
  const flashing = useAnimatedStyle(() => ({ opacity: flash.get() }));

  // Haptics follow changes, never the first render or a restored session.
  const previous = useRef({ combo, complete });
  useEffect(() => {
    const before = previous.current;
    previous.current = { combo, complete };
    if (complete && !before.complete) {
      momentHaptic('success');
      if (!reduced) {
        burst.set(
          withSequence(
            withTiming(1.08, { duration: 120 }),
            withSpring(1, tokens.motion.springs.pop),
          ),
        );
        flash.set(
          withSequence(
            withTiming(0.85, { duration: 90 }),
            withTiming(0, { duration: 520 }),
          ),
        );
      }
    } else if (runTier(combo) !== runTier(before.combo) && combo > before.combo)
      momentHaptic('light');
  }, [combo, complete, reduced, burst, flash]);

  return (
    <View style={[styles.bar, !onExit && !onList && styles.barOnly]}>
      {onExit && (
        <IconButton
          icon="close"
          tone="muted"
          accessibilityLabel={exitLabel}
          onPress={onExit}
        />
      )}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={
          loading ? 'Loading' : progressLabel(done, total, combo)
        }
        accessibilityValue={{ min: 0, max: total, now: Math.min(done, total) }}
        style={styles.track}
      >
        {label && (
          <RunLabel
            key={tier}
            text={label}
            combo={combo}
            tier={tier}
            reduced={reduced}
          />
        )}
        <Animated.View style={[styles.segments, { gap }, bursting]} {...hidden}>
          {segments.map((segment, index) => (
            <Segment
              // biome-ignore lint/suspicious/noArrayIndexKey: segments are fixed positions
              key={index}
              fill={segment.fill}
              current={segment.current}
              colour={colours[earned[index] ?? tier]}
              glow={segment.current && remaining <= 2 && remaining > 0}
              misses={segment.current ? misses : 0}
              reduced={reduced}
            />
          ))}
          {complete && <Sweep reduced={reduced} wide />}
          <Animated.View
            pointerEvents="none"
            style={[
              motionStyles.flash,
              { backgroundColor: theme.colors.gold },
              flashing,
            ]}
          />
        </Animated.View>
      </View>
      {points !== undefined && <PointsCounter points={points} award={award} />}
      {onList ? (
        <IconButton
          icon="list"
          tone="muted"
          accessibilityLabel={listLabel}
          shortcut={listShortcut}
          onPress={onList}
        />
      ) : (
        // Balances ✕ only when nothing else holds the right slot; with
        // points, they are the right slot (✕ | bar | points, as on Duolingo).
        onExit && points === undefined && <View style={styles.icon} />
      )}
    </View>
  );
}

const rank: Record<RunTier, number> = { none: 0, gold: 1, flame: 2 };
/** Each filled segment's colour: the best tier its run of clean answers
 * reached. The current run's segments turn gold or flame together; a miss
 * starts a new run, so earlier runs keep the colour they earned. */
function useEarnedTiers(
  segments: { fill: number }[],
  combo: number,
  tier: RunTier,
) {
  const memory = useRef({
    combo,
    run: 0,
    best: [tier] as RunTier[],
    filled: [] as { fill: number; run: number }[],
  });
  const was = memory.current;
  const run = combo < was.combo ? was.run + 1 : was.run;
  const best = [...was.best];
  const before = best[run] ?? 'none';
  best[run] = rank[tier] > rank[before] ? tier : before;
  const filled = segments.map((segment, i) => {
    const old = was.filled[i];
    if (segment.fill <= 0) return { fill: 0, run };
    // A segment that grows joins the current run (none when it broke the
    // run, so a later run never paints a miss gold); a full one keeps it.
    return old && segment.fill <= old.fill
      ? old
      : { fill: segment.fill, run: combo > 0 ? run : -1 };
  });
  useEffect(() => {
    memory.current = { combo, run, best, filled };
  });
  return filled.map((segment) =>
    segment.fill > 0 ? (best[segment.run] ?? 'none') : undefined,
  );
}

function Segment({
  fill,
  current,
  colour,
  glow,
  misses,
  reduced,
}: {
  fill: number;
  current: boolean;
  colour: string;
  glow: boolean;
  misses: number;
  reduced: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const shake = useSharedValue(0);
  // A segment that fills stretches tall and springs back: a little pop.
  const pop = useSharedValue(1);
  const [sweeps, setSweeps] = useState(0);
  const before = useRef({ fill, misses });

  useEffect(() => {
    const was = before.current.fill;
    before.current.fill = fill;
    if (!reduced && fill >= 1 && was < 1) {
      setSweeps((n) => n + 1);
      pop.set(
        withDelay(
          FILL_MS * 0.6,
          withSequence(
            withTiming(1.6, { duration: 80 }),
            withSpring(1, tokens.motion.springs.pop),
          ),
        ),
      );
    }
  }, [fill, reduced, pop]);

  useEffect(() => {
    const was = before.current.misses;
    before.current.misses = misses;
    if (reduced || misses <= was) return;
    // ±5 pt, one and a half shakes over 360 ms.
    const step = (to: number) => withTiming(to, { duration: 72 });
    shake.set(withSequence(step(-5), step(5), step(-4), step(3), step(0)));
  }, [misses, reduced, shake]);

  // The fill grows on a transition and drops at once (a broken run empties
  // it); its colour eases between run tiers. The duration only changes when
  // the fill does, so a re-render never restarts a transition.
  const growth = useRef({ fill, duration: 0 });
  if (growth.current.fill !== fill)
    growth.current = {
      fill,
      duration: !reduced && fill > growth.current.fill ? FILL_MS : 0,
    };
  const filled = {
    width: `${fill * 100}%` as const,
    backgroundColor: colour,
    transitionProperty: ['width' as const, 'backgroundColor' as const],
    transitionDuration: [growth.current.duration, reduced ? 0 : COLOUR_MS],
    transitionTimingFunction: [fillCurve, quadInOut],
  };
  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.get() }, { scaleY: pop.get() }],
  }));
  const glowing = reduced ? noHalo : haloPulse;

  return (
    <Animated.View style={[motionStyles.segmentSlot, moved]}>
      {glow && (
        <Animated.View
          style={[
            motionStyles.halo,
            { backgroundColor: theme.colors.gold },
            glowing,
          ]}
        />
      )}
      <View
        style={[
          styles.segment,
          current && styles.current,
          current && {
            borderColor: glow ? theme.colors.gold : theme.colors.line,
          },
        ]}
      >
        <Animated.View style={[motionStyles.fill, filled]} />
        {sweeps > 0 && <Sweep key={sweeps} reduced={reduced} />}
      </View>
    </Animated.View>
  );
}

/** A light band crossing a fill once, after it lands. */
function Sweep({
  reduced,
  wide = false,
}: {
  reduced: boolean;
  wide?: boolean;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced || !width) return;
    x.set(0);
    x.set(
      withDelay(
        wide ? FILL_MS : SWEEP_DELAY,
        withTiming(1, { duration: SWEEP_MS, easing: sweepEasing }),
      ),
    );
  }, [reduced, width, wide, x]);
  const band = useAnimatedStyle(() => {
    const p = x.get();
    return {
      opacity: p > 0 && p < 1 ? 1 : 0,
      transform: [{ translateX: -width * 0.5 + p * width * 1.5 }],
    };
  });
  if (reduced) return null;
  return (
    <View
      pointerEvents="none"
      style={styles.sweepClip}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[motionStyles.sweep, wide && motionStyles.sweepWide, band]}
      />
    </View>
  );
}

/** "N IN A ROW" above the start of the bar; pops when the run grows. */
function RunLabel({
  text,
  combo,
  tier,
  reduced,
}: {
  text: string;
  combo: number;
  tier: RunTier;
  reduced: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const scale = useSharedValue(reduced ? 1 : 0.5);
  useEffect(() => {
    if (reduced || combo < 3) {
      scale.set(1);
      return;
    }
    scale.set(0.5);
    scale.set(
      withSequence(
        withTiming(1.18, {
          duration: tokens.motion.pop * 0.6,
          easing: fillEasing,
        }),
        withTiming(0.94, { duration: tokens.motion.pop * 0.2 }),
        withTiming(1, { duration: tokens.motion.pop * 0.2 }),
      ),
    );
  }, [combo, reduced, scale]);
  const popped = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: Math.min(1, scale.get() * 1.6 - 0.4),
  }));
  const colour = {
    none: theme.colors.brandText,
    gold: theme.colors.goldText,
    flame: theme.colors.flame,
  }[tier];
  return (
    <Animated.View style={[motionStyles.labelSlot, popped]} {...hidden}>
      <Text style={[styles.label, { color: colour }]} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    minHeight: theme.layout.minControl,
  },
  // Under a native header: just the segments, close below it, with room
  // above them for the run label.
  barOnly: {
    minHeight: 0,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md + 2,
    paddingBottom: theme.spacing.xs,
  },
  icon: {
    width: theme.layout.minControl,
    height: theme.layout.minControl,
  },
  track: { flex: 1, justifyContent: 'center' },
  segments: { flexDirection: 'row' },
  segment: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceMuted,
  },
  current: { borderWidth: 2 },
  sweepClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: 999,
  },
  label: {
    fontFamily: theme.typography.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
}));

/** Counts the times `wrong` turns on, for LessonTopBar's `misses`: each new
 * miss shakes the current segment once. */
export function useMissCount(wrong: boolean) {
  const [count, setCount] = useState(0);
  const was = useRef(wrong);
  useEffect(() => {
    if (wrong && !was.current) setCount((n) => n + 1);
    was.current = wrong;
  }, [wrong]);
  return count;
}

// Theme-independent styles for the animated segments.
const motionStyles = NativeStyleSheet.create({
  flash: {
    position: 'absolute',
    left: -3,
    right: -3,
    top: -3,
    bottom: -3,
    borderRadius: 999,
    opacity: 0,
  },
  segmentSlot: { flex: 1, minWidth: 2 },
  // Out of flow and childless, so growing its width re-lays out nothing else.
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 999 },
  halo: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: -3,
    right: -3,
    borderRadius: 999,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '45%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  sweepWide: { width: '18%' },
  labelSlot: {
    position: 'absolute',
    left: 0,
    bottom: 14,
    transformOrigin: 'left center',
  },
});
