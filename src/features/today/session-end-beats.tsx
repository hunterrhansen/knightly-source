import { useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import type { JourneyStar } from '../../lib/api/journey-contract';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import {
  ActionIcon,
  type BeatAction,
  BeatFrame,
  BrandMark,
  dayNights,
  FadeIn,
  Ignite,
  MoonPhase,
  moonPhaseForNight,
  PopIn,
  ResultsBeat,
  RollingNumber,
  type SessionResults,
  Sparkles,
  StreakCalendar,
  type StreakDays,
  type StreakNights,
  todayOf,
  useRewardMoment,
  weekDays,
} from '../../ui';
import type { PostMoment } from './ward-path';
import { WatchAskBeat } from './watch-ask-beat';

// The streak and long-term-memory beats that follow a session's Results.
// Timings are in ms from the beat's mount.
const STREAK = {
  ignite: 500,
  roll: 700,
  mark: 1400,
  week: 2000,
  land: 2600,
  ready: 3800,
};
const MEMORY_READY = tokens.motion.celebrate + 300;
// When a bounce first touches down: the moment its sparkles, haptic and sound
// play.
const BOUNCE_LANDS = tokens.motion.celebrate * 0.45;

export type StreakExtension = {
  from: number;
  to: number;
  day: string;
  week: DailyReview['streak']['week'];
  /** Days before the summary's Monday-first week that a Sunday-first week
   * shows; blank until known. */
  earlier?: StreakDays;
  /** Those earlier days' nights, for their moon phases. */
  earlierNights?: StreakNights;
  /** No watch is set and the ask is due: Same time tomorrow? follows. */
  askWatch?: { keptAt: Date };
};

/** A session's stars carried the learner to a new rank (from the server's
 * journey before and after the session). */
export type RankUp = {
  rank: string;
  /** The rank's server key, for its emblem; blank until the map is read. */
  key?: string;
  stars: number;
  nextRank: string | null;
  /** The post whose clearing reaches the next rank, or null. */
  nextPost: number | null;
  /** The last moves that stopped slipping, newest first; blank until read. */
  latest?: readonly JourneyStar[];
};

const nightsInARow = (count: number) =>
  `${count === 1 ? 'day' : 'days'} in a row`;

/** The streak grew: the moon waxes to the new night's phase, the count rolls
 * on, and today's moon drops into the week. */
export function StreakBeat({
  streak,
  primary,
}: {
  streak: StreakExtension;
  primary: BeatAction;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const lit = useRewardMoment(STREAK.ignite + BOUNCE_LANDS, 'celebrate');
  const share = () =>
    void Share.share({
      message: `I've kept my Knightly streak for ${streak.to} ${streak.to === 1 ? 'day' : 'days'}.`,
    }).catch(() => {});
  return (
    <BeatFrame
      announcement={`Streak extended. ${streak.to} ${nightsInARow(streak.to)}`}
      readyAfter={STREAK.ready}
      primary={primary}
      secondary={
        Platform.OS === 'web' ? undefined : { label: 'Share', onPress: share }
      }
    >
      <View style={styles.centered}>
        <View>
          <Ignite
            delay={STREAK.ignite}
            off={
              <View style={styles.dimmed}>
                <MoonPhase size={112} day={moonPhaseForNight(streak.from)} />
              </View>
            }
            on={<MoonPhase size={112} day={moonPhaseForNight(streak.to)} />}
          />
          <Sparkles fire={lit} color={theme.colors.gold} reach={84} />
        </View>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${streak.to} ${nightsInARow(streak.to)}`}
          style={styles.centered}
        >
          <RollingNumber
            from={streak.from}
            to={streak.to}
            delay={STREAK.roll}
            height={72}
            render={(value) => <Text style={styles.count}>{value}</Text>}
          />
          <View style={styles.streakLabel}>
            <PopIn delay={STREAK.mark}>
              <BrandMark size={32} />
            </PopIn>
            <FadeIn delay={STREAK.mark}>
              <Text style={styles.streakText}>{nightsInARow(streak.to)}</Text>
            </FadeIn>
          </View>
        </View>
      </View>
      <FadeIn delay={STREAK.week}>
        <View style={styles.week}>
          <StreakCalendar
            today={todayOf(streak.week)}
            days={{ ...streak.earlier, ...weekDays(streak.week) }}
            nights={{ ...streak.earlierNights, ...dayNights(streak.week) }}
            navigable={false}
            // The calendar mounts with the beat; FadeIn only delays its opacity.
            landing={{ date: streak.day, delay: STREAK.land }}
          />
        </View>
      </FadeIn>
    </BeatFrame>
  );
}

/** Positions that moved into long-term memory during the session. */
export function MemoryBeat({
  count,
  primary,
}: {
  count: number;
  primary: BeatAction;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const landed = useRewardMoment(BOUNCE_LANDS, 'reward');
  const title = `${count} ${count === 1 ? 'position' : 'positions'} moved to long-term memory`;
  return (
    <BeatFrame announcement={title} readyAfter={MEMORY_READY} primary={primary}>
      <View style={styles.centered}>
        <View>
          <PopIn bounce>
            <View style={styles.memoryBadge}>
              <ActionIcon name="best" color={theme.colors.onSky} size={52} />
            </View>
          </PopIn>
          <Sparkles fire={landed} color={theme.colors.sky} reach={80} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.coachText}>You won’t see them for a while.</Text>
      </View>
    </BeatFrame>
  );
}

/** Results, streak acknowledgement and optional learning/reminder follow-up. */
export function SessionBeats({
  results,
  streak,
  mastered = 0,
  pending = false,
  finish,
}: {
  /** The watch's moves held tonight: above 0, the wall beat leads. */
  held?: number;
  results: SessionResults;
  /** Null when this session did not extend the streak. */
  streak?: StreakExtension | null;
  /** Positions moved into long-term memory during the session. */
  mastered?: number;
  /** Null unless the session's stars reached a new rank. */
  rankUp?: RankUp | null;
  /** Posts this session cleared on the ward path (before the rank beat). */
  posts?: PostMoment | null;
  /** The streak comparison is still loading: Results holds its button. */
  pending?: boolean;
  finish: BeatAction;
}) {
  const [index, setIndex] = useState(0);
  const beats = [
    'results' as const,
    ...(streak ? (['streak'] as const) : []),
    ...(streak?.askWatch ? (['watch'] as const) : []),
    ...(mastered > 0 ? (['memory'] as const) : []),
  ];
  const beat = beats[Math.min(index, beats.length - 1)];
  const action =
    index >= beats.length - 1
      ? finish
      : { label: 'Continue', onPress: () => setIndex(index + 1) };
  if (beat === 'streak' && streak)
    return <StreakBeat key="streak" streak={streak} primary={action} />;
  if (beat === 'watch' && streak?.askWatch)
    return (
      <WatchAskBeat
        key="watch"
        keptAt={streak.askWatch.keptAt}
        day={streak.day}
        next={action.onPress}
      />
    );
  if (beat === 'memory')
    return <MemoryBeat key="memory" count={mastered} primary={action} />;
  return (
    <ResultsBeat key="results" {...results} hold={pending} primary={action} />
  );
}

const useStyles = createStyles((theme) => ({
  // The old night's moon, waiting to wax.
  dimmed: { opacity: 0.45 },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  coachText: {
    flexShrink: 1,
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  centered: { alignItems: 'center', gap: theme.spacing.sm },
  count: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.heading,
    fontSize: 64,
    lineHeight: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  streakText: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 20,
  },
  week: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  memoryBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.sky,
    borderBottomWidth: 5,
    borderColor: theme.colors.skyLedge,
  },
}));
