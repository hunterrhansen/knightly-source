import { fromDateId } from '@marceloterreiro/flash-calendar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { usePreferences } from '../../theme/preferences';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { IconButton } from './icon-button';
import {
  addDays,
  dayState,
  monthGrid,
  type StreakDayState,
  type StreakDays,
  type StreakNights,
  step,
  visibleRange,
  type WeekStart,
  weekdayLetters,
  weekStartOf,
} from './streak-calendar-model';
import { STREAK_DAY, StreakDay } from './streak-day';

const DOT = STREAK_DAY;
const ROW = DOT + 10;
const SWIPE = 48;
// How far a swipe past today can pull the week before it stops giving.
const STRETCH = 24;

/** A drag towards a week that doesn't exist yet resists, never hard-stops. */
function rubberBand(offset: number) {
  'worklet';
  return (STRETCH * offset) / (Math.abs(offset) + STRETCH);
}
const STATE_LABEL: Record<StreakDayState, string> = {
  done: 'Done',
  frozen: 'Streak freeze used',
  rest: 'Nothing due',
  missed: 'Missed',
  none: 'No streak yet',
  today: 'Today',
  upcoming: 'Upcoming',
};
const clip = { overflow: 'hidden' } as const;
const easing = Easing.bezier(...tokens.motion.popBezier);
const dayName = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});
const monthName = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
});
const shortDay = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

function title(
  focus: string,
  expanded: boolean,
  today: string,
  weekStart: WeekStart,
) {
  if (expanded) return monthName.format(fromDateId(focus));
  const start = weekStartOf(focus, weekStart);
  const current = weekStartOf(today, weekStart);
  if (start === current) return 'This week';
  if (start === addDays(current, -7)) return 'Last week';
  return `${shortDay.format(fromDateId(start))} – ${shortDay.format(fromDateId(addDays(start, 6)))}`;
}

/**
 * The streak's days as a week that expands into its month: swipe sideways or
 * use the arrows for the previous or next week (month when open), and drag down
 * or press the handle to open the whole month. Never moves past today's week
 * or month. `onVisibleRangeChange` reports the days on screen so the owner can
 * fetch their history. Without `navigable` it is just this week, as at the end
 * of a session; with `landing`, that done day starts as today's empty socket
 * and its moon drops in after `delay` ms. Done days show their night's moon
 * phase, like the streak hero's medal; today is its empty dashed socket. Weeks start on the day chosen in
 * Appearance.
 */
export function StreakCalendar({
  today,
  days,
  nights,
  initialExpanded = false,
  navigable = true,
  landing,
  todayAtRisk = false,
  onVisibleRangeChange,
}: {
  today: string;
  days: StreakDays;
  /** Each done day's night, for its moon phase; unknown nights show full. */
  nights?: StreakNights;
  initialExpanded?: boolean;
  navigable?: boolean;
  landing?: { date: string; delay: number };
  /** Today's empty socket in gold: the streak runs out within hours. */
  todayAtRisk?: boolean;
  onVisibleRangeChange?: (range: { start: string; end: string }) => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const { weekStart } = usePreferences().preferences;
  const reduced = useSystemReducedMotion();
  const [focus, setFocus] = useState(today);
  const [expanded, setExpanded] = useState(initialExpanded);
  const { weeks, focusRow } = useMemo(
    () => monthGrid(focus, weekStart),
    [focus, weekStart],
  );
  const progress = useSharedValue(initialExpanded ? 1 : 0);
  const dragStart = useSharedValue(0);
  const rows = useSharedValue(weeks.length);
  const row = useSharedValue(focusRow);
  const slide = useSharedValue(0);
  const duration = reduced ? 0 : tokens.motion.sheet;

  useEffect(() => {
    rows.set(withTiming(weeks.length, { duration, easing }));
    row.set(focusRow);
  }, [weeks.length, focusRow, duration, rows, row]);

  const range = visibleRange(focus, expanded, weekStart);
  useEffect(() => {
    onVisibleRangeChange?.({ start: range.start, end: range.end });
  }, [range.start, range.end, onVisibleRangeChange]);

  const canPrevious = step(focus, -1, expanded, today, weekStart) !== undefined;
  const canNext = step(focus, 1, expanded, today, weekStart) !== undefined;
  // A release from a drag carries the finger's speed; a press settles calmly.
  const settle = useCallback(
    (to: number, velocity: number) => {
      'worklet';
      if (reduced) return to;
      return velocity === 0
        ? withSpring(to, tokens.motion.springs.settle)
        : withSpring(to, { ...tokens.motion.springs.fling, velocity });
    },
    [reduced],
  );
  const go = useCallback(
    (direction: -1 | 1, velocity = 0) => {
      const next = step(focus, direction, expanded, today, weekStart);
      if (!next) {
        slide.set(settle(0, velocity));
        return;
      }
      setFocus(next);
      // The new days enter from the side the user moved towards.
      slide.set(reduced ? 0 : direction * 40);
      slide.set(settle(0, velocity));
    },
    [focus, expanded, today, weekStart, reduced, settle, slide],
  );
  const toggle = useCallback(
    (open: boolean, velocity = 0) => {
      setExpanded(open);
      progress.set(settle(open ? 1 : 0, velocity));
    },
    [settle, progress],
  );

  const gestures = useMemo(() => {
    const swipe = Gesture.Pan()
      .enabled(navigable)
      .activeOffsetX([-12, 12])
      .failOffsetY([-12, 12])
      .onUpdate((event) => {
        const offset = event.translationX * 0.6;
        // Right is the previous week, left the next.
        const blocked = offset > 0 ? !canPrevious : !canNext;
        slide.set(blocked ? rubberBand(offset) : offset);
      })
      .onEnd((event) => {
        const direction =
          event.translationX < -SWIPE || event.velocityX < -600
            ? 1
            : event.translationX > SWIPE || event.velocityX > 600
              ? -1
              : 0;
        const velocity = event.velocityX * 0.6;
        if (direction === 0) slide.set(settle(0, velocity));
        else scheduleOnRN(go, direction, velocity);
      });
    // One instance per detector: the grid's and the handle's.
    const verticalDrag = () =>
      Gesture.Pan()
        .enabled(navigable)
        .activeOffsetY([-10, 10])
        .failOffsetX([-12, 12])
        .onStart(() => {
          dragStart.set(progress.get());
        })
        .onUpdate((event) => {
          const travel = Math.max(ROW, (rows.get() - 1) * ROW);
          progress.set(
            Math.min(
              1,
              Math.max(0, dragStart.get() + event.translationY / travel),
            ),
          );
        })
        .onEnd((event) => {
          const open =
            event.velocityY > 500 ||
            (event.velocityY > -500 && progress.get() > 0.5);
          const travel = Math.max(ROW, (rows.get() - 1) * ROW);
          scheduleOnRN(toggle, open, event.velocityY / travel);
        });
    return {
      grid: Gesture.Race(swipe, verticalDrag()),
      handle: verticalDrag(),
    };
  }, [
    navigable,
    canPrevious,
    canNext,
    settle,
    go,
    toggle,
    slide,
    progress,
    dragStart,
    rows,
  ]);

  const viewport = useAnimatedStyle(() => ({
    height: interpolate(progress.get(), [0, 1], [ROW, rows.get() * ROW]),
  }));
  const grid = useAnimatedStyle(() => ({
    transform: [
      { translateX: slide.get() },
      { translateY: -row.get() * ROW * (1 - progress.get()) },
    ],
  }));
  const handle = useAnimatedStyle(() => ({
    width: interpolate(progress.get(), [0, 1], [36, 52]),
  }));

  const done = weeks
    .flat()
    .filter(
      (day) =>
        !(expanded && day.isDifferentMonth) &&
        day.id >= range.start &&
        day.id <= range.end &&
        dayState(day.id, today, days) === 'done',
    ).length;

  return (
    <View style={styles.root} accessibilityLabel="Streak calendar">
      {navigable && (
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">
              {title(focus, expanded, today, weekStart)}
            </Text>
            <Text style={styles.count}>
              {done === 1 ? '1 night' : `${done} nights`}
            </Text>
          </View>
          <ArrowButton
            name="previous"
            label={expanded ? 'Previous month' : 'Previous week'}
            disabled={!canPrevious}
            onPress={() => go(-1)}
          />
          <ArrowButton
            name="next"
            label={expanded ? 'Next month' : 'Next week'}
            disabled={!canNext}
            onPress={() => go(1)}
          />
        </View>
      )}
      <View style={styles.weekdays}>
        {weekdayLetters(weekStart).map((letter, index) => (
          <Text
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday columns.
            key={index}
            style={styles.weekday}
            aria-hidden
          >
            {letter}
          </Text>
        ))}
      </View>
      <GestureDetector gesture={gestures.grid}>
        <Animated.View style={[clip, viewport]}>
          <Animated.View style={grid}>
            {weeks.map((week, index) => (
              <View
                key={week[0]?.id}
                style={styles.week}
                // Collapsed, only the focus week is on screen.
                accessibilityElementsHidden={!expanded && index !== focusRow}
                importantForAccessibility={
                  !expanded && index !== focusRow
                    ? 'no-hide-descendants'
                    : 'auto'
                }
              >
                {week.map((day) => (
                  <StreakDay
                    key={day.id}
                    label={day.displayLabel}
                    accessibilityLabel={`${dayName.format(day.date)}: ${STATE_LABEL[dayState(day.id, today, days)]}`}
                    state={dayState(day.id, today, days)}
                    faded={expanded && day.isDifferentMonth}
                    landingDelay={
                      landing?.date === day.id ? landing.delay : undefined
                    }
                    night={nights?.[day.id]}
                    atRisk={todayAtRisk}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {navigable && (
        <GestureDetector gesture={gestures.handle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show week' : 'Show month'}
            accessibilityState={{ expanded }}
            onPress={() => toggle(!expanded)}
            hitSlop={8}
            style={styles.handleArea}
          >
            <Animated.View
              style={[
                {
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: theme.colors.line,
                },
                handle,
              ]}
            />
          </Pressable>
        </GestureDetector>
      )}
    </View>
  );
}

function ArrowButton({
  name,
  label,
  disabled,
  onPress,
}: {
  name: 'previous' | 'next';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <IconButton
      icon={name}
      iconSize={20}
      compact
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
    />
  );
}

const useStyles = createStyles((theme) => ({
  root: { gap: theme.spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  heading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  count: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 12,
  },
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xs,
  },
  weekday: {
    width: DOT,
    textAlign: 'center',
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 11,
  },
  week: {
    height: ROW,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  handleArea: { alignItems: 'center', paddingVertical: theme.spacing.xs },
}));
