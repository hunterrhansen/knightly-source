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
  SpriteView,
  StreakCalendar,
  type StreakDays,
  type StreakNights,
  todayOf,
  useRankEmblem,
  useRewardMoment,
  useWatchEndReady,
  useWatchEndWords,
  WatchEndScene,
  watchColors,
  weekDays,
} from '../../ui';
import { PostBeat } from './post-beat';
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
const RANK = { name: 500, story: 900, moves: 1300, ready: 1800 };
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
  `${count === 1 ? 'night' : 'nights'} in a row`;

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
      message: `I've kept my Knightly streak for ${streak.to} ${streak.to === 1 ? 'night' : 'nights'}.`,
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

/** The end of the watch, before its Results: over the wall, the knight's
 * lantern brightens a step per held move and "N raids turned back" lands
 * over the gate. The board is gone by now: nothing here can move it. */
function WatchEndBeat({
  held,
  primary,
}: {
  held: number;
  primary: BeatAction;
}) {
  const styles = useStyles();
  const words = useWatchEndWords(held);
  return (
    <BeatFrame
      announcement={words.caption}
      readyAfter={useWatchEndReady(held)}
      primary={primary}
    >
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={words.caption}
      >
        <WatchEndScene held={held} />
      </View>
      <Text style={styles.coachText}>{words.coach}</Text>
    </BeatFrame>
  );
}

const earnedOn = (date: string, today: string) =>
  date === today
    ? 'tonight'
    : new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

/** A new rank: its emblem drops onto the night-sky disc, the stars that
 * carried it, the last moves that stopped slipping and the next rank. In
 * place of Long-term memory, so a session ends on one reward beat. Gold sparkle and the
 * reward cue; no confetti, so nothing to hold back after 21:00. */
export function RankUpBeat({
  rankUp,
  today,
  primary,
}: {
  rankUp: RankUp;
  today: string;
  primary: BeatAction;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const emblem = useRankEmblem({ key: rankUp.key, name: rankUp.rank });
  const landed = useRewardMoment(BOUNCE_LANDS, 'reward');
  const moves = rankUp.stars === 1 ? 'move' : 'moves';
  const story = `Every post before this castle is held. ${rankUp.stars} ${moves} from your own games ${rankUp.stars === 1 ? 'has' : 'have'} stopped slipping along the way.`;
  return (
    <BeatFrame
      announcement={`New rank. ${rankUp.rank}. ${story}`}
      readyAfter={RANK.ready}
      primary={primary}
    >
      <View style={styles.centered}>
        <View style={styles.skyDisc}>
          <PopIn bounce>
            <SpriteView sprite={emblem} size={96} />
          </PopIn>
          <Sparkles fire={landed} color={theme.colors.gold} reach={84} />
        </View>
        <FadeIn delay={RANK.name}>
          <View style={styles.centered}>
            <Text style={styles.eyebrow}>New rank</Text>
            <Text accessibilityRole="header" style={styles.rankName}>
              {rankUp.rank}
            </Text>
          </View>
        </FadeIn>
        <FadeIn delay={RANK.story}>
          <Text style={styles.coachText}>{story}</Text>
        </FadeIn>
      </View>
      {!!rankUp.latest?.length && (
        <FadeIn delay={RANK.moves}>
          <View style={styles.moves}>
            {rankUp.latest.map((star) => (
              <View key={`${star.game_id}-${star.ply}`} style={styles.move}>
                <Text style={styles.moveLabel} numberOfLines={1}>
                  {`★ ${star.label} · ${star.san}`}
                </Text>
                <Text style={styles.moveMeta}>
                  {earnedOn(star.earned_on, today)}
                </Text>
              </View>
            ))}
          </View>
        </FadeIn>
      )}
      {rankUp.nextRank && rankUp.nextPost != null && (
        <FadeIn delay={RANK.moves}>
          <Text style={styles.next}>
            {`Next: ${rankUp.nextRank} after post ${rankUp.nextPost}`}
          </Text>
        </FadeIn>
      )}
    </BeatFrame>
  );
}

/** A session's end: the watch's end over the wall (the daily lesson, when
 * a move held), Results, then Streak extended, then the posts held on the
 * ward path, then Rank up or Long-term
 * memory when they apply (a rank-up replaces Long-term memory), each
 * advancing on its button; the last one finishes. */
export function SessionBeats({
  held = 0,
  results,
  streak,
  mastered = 0,
  rankUp,
  posts,
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
    ...(held > 0 ? (['wall'] as const) : []),
    'results' as const,
    ...(streak ? (['streak'] as const) : []),
    ...(streak?.askWatch ? (['watch'] as const) : []),
    ...(posts ? (['post'] as const) : []),
    ...(rankUp
      ? (['rank'] as const)
      : mastered > 0
        ? (['memory'] as const)
        : []),
  ];
  const beat = beats[Math.min(index, beats.length - 1)];
  const action =
    index >= beats.length - 1
      ? finish
      : { label: 'Continue', onPress: () => setIndex(index + 1) };
  if (beat === 'wall')
    return <WatchEndBeat key="wall" held={held} primary={action} />;
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
  if (beat === 'post' && posts)
    return (
      <PostBeat key="post" posts={posts} showRank={!rankUp} primary={action} />
    );
  if (beat === 'rank' && rankUp)
    return (
      <RankUpBeat
        key="rank"
        rankUp={rankUp}
        today={streak?.day ?? localDay()}
        primary={action}
      />
    );
  if (beat === 'memory')
    return <MemoryBeat key="memory" count={mastered} primary={action} />;
  return (
    <ResultsBeat key="results" {...results} hold={pending} primary={action} />
  );
}

const localDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const useStyles = createStyles((theme) => ({
  skyDisc: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: watchColors.skyDisc,
    borderWidth: 4,
    borderColor: watchColors.skyDiscRim,
  },
  eyebrow: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rankName: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 36,
    lineHeight: 42,
    textAlign: 'center',
  },
  moves: {
    alignSelf: 'stretch',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  move: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  moveLabel: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  moveMeta: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  next: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    textAlign: 'center',
  },
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
