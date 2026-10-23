import { useMemo } from 'react';
import { Text, View } from 'react-native';
import type {
  FirstStar as FirstStarProgress,
  JourneyMap,
} from '../../lib/api/journey-contract';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles } from '../../theme/theme';
import {
  Card,
  Page,
  ProgressBar,
  SpriteView,
  StatTile,
  useRankEmblem,
} from '../../ui';
import { journeyRank, journeySection, postRankLine } from '../today/today-api';
import { firstStarDays, firstStarLine } from './progress-model';
import {
  IsItWorking,
  type ProgressSectionsProps,
  YourGame,
  YourMemory,
} from './progress-sections';
import { type ProgressResource, SectionState } from './section-state';

export type ProgressViewProps = ProgressSectionsProps & {
  journey: ProgressResource<JourneyMap>;
  /** The streak, for Nights; older servers' `nights_total` falls back to
   * the journey's. */
  streak?: DailyReview['streak'];
  /** Positions on their way to long-term memory (learning), shown while no
   * star is earned yet. */
  onTheirWay?: number;
  importWorking?: boolean;
  /** The web's Back, which closes Progress; native modals draw their ✕. */
  onClose?: () => void;
};

/** The posts still to clear for the next rank, or the highest reached. */
function toNext(journey: JourneyMap) {
  const { next, toGo } = journeySection(journey);
  if (!next) return 'The highest rank';
  if (toGo === null) return `Clear post ${next.post} for ${next.name}`;
  return `${toGo} more ${toGo === 1 ? 'post' : 'posts'} to ${next.name}`;
}

function RankChip({
  model,
  next,
}: {
  model: ReturnType<typeof journeyRank> & { onPosts: boolean };
  next: string;
}) {
  const styles = useStyles();
  const emblem = useRankEmblem(model.rank);
  return (
    <View style={styles.header}>
      <View
        accessible
        accessibilityLabel={
          model.onPosts
            ? `Rank ${model.chip}. ${next}`
            : `Rank ${model.rank.name}, ${model.stars} ${model.stars === 1 ? 'star' : 'stars'}. ${next}`
        }
        style={styles.rank}
      >
        <SpriteView sprite={emblem} size={56} />
        <View style={styles.rankText}>
          <Text style={styles.chipText}>{model.chip}</Text>
          <Text style={styles.quiet}>{next}</Text>
        </View>
      </View>
      {model.dimmed > 0 && (
        <Text style={styles.quiet}>
          {`${model.dimmed} dimmed · back on your watch`}
        </Text>
      )}
    </View>
  );
}

/** Before the first star: what a star is and that it takes a few nights, so an
 * empty sky reads as early rather than broken. */
function FirstStar({
  onTheirWay,
  closest,
}: {
  onTheirWay?: number;
  closest?: FirstStarProgress | null;
}) {
  const styles = useStyles();
  return (
    <Card eyebrow="Your first star">
      <Text style={styles.body}>
        A star is a move from your own games that stopped slipping: held across
        nights, for 11 days or more. Your first can come within a few nights.
      </Text>
      {closest && (
        <View style={styles.closest}>
          <Text style={styles.proofLabel}>
            {`Closest: ${closest.label} · ${closest.san}`}
          </Text>
          <ProgressBar
            value={closest.days}
            max={closest.target}
            label={`${closest.label} ${closest.san} holds ${firstStarDays(closest)} of ${closest.target} days`}
          />
          <Text style={styles.quiet}>{firstStarLine(closest)}</Text>
        </View>
      )}
      {!!onTheirWay && (
        <Text style={styles.quiet}>
          {`${onTheirWay} ${onTheirWay === 1 ? 'move is' : 'moves are'} on their way now.`}
        </Text>
      )}
    </Card>
  );
}

/** Nights: every night kept all time, the streak in a row, the best run
 * and the freezes held. */
function Nights({
  streak,
  total,
}: {
  streak: DailyReview['streak'];
  total: number;
}) {
  const styles = useStyles();
  const tiles = [
    { value: total, label: total === 1 ? 'night kept' : 'nights kept' },
    { value: streak.count, label: 'in a row' },
    { value: streak.best, label: 'best run' },
    {
      value: streak.freezes,
      label: streak.freezes === 1 ? 'freeze' : 'freezes',
    },
  ];
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>
        Nights
      </Text>
      <Card>
        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              value={String(tile.value)}
              label={tile.label}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}

/**
 * Progress (docs/specs/2026-10-19-path-home-design.md, "Progress"): one
 * scrolling sheet over the path. Your rank, then Is it working? (blunders
 * per game, the rating, the last four weeks), Nights, Your game (skills,
 * tactics, clock, openings) and Your memory (your moves, coming up).
 */
export function ProgressView({
  journey,
  streak,
  onTheirWay,
  importWorking,
  onClose,
  ...sections
}: ProgressViewProps) {
  const styles = useStyles();
  const model = useMemo(() => {
    if (!journey.data) return undefined;
    const stars = journeyRank(journey.data);
    // On the ward path the rank is the posts' (or the stars', if higher).
    const posts = postRankLine(journey.data);
    return posts
      ? {
          ...stars,
          rank: posts.rank,
          chip: posts.chip,
          next: posts.next,
          onPosts: true,
        }
      : { ...stars, next: toNext(journey.data), onPosts: false };
  }, [journey.data]);
  const total = streak?.nights_total ?? journey.data?.nights.total;
  return (
    <Page title="Progress" onBack={onClose}>
      {importWorking && (
        <Text accessibilityLiveRegion="polite" style={styles.quiet}>
          Your games are still being analyzed. These numbers update as they
          finish.
        </Text>
      )}
      <Text accessibilityRole="header" style={styles.groupTitle}>
        Your rank
      </Text>
      {model && <RankChip model={model} next={model.next} />}
      <SectionState resource={journey} name="your rank" eyebrow="Rank" />
      {model && model.stars === 0 && (
        <FirstStar onTheirWay={onTheirWay} closest={journey.data?.first_star} />
      )}
      <IsItWorking {...sections} />
      {streak && total !== undefined && (
        <Nights streak={streak} total={total} />
      )}
      <YourGame {...sections} />
      <YourMemory {...sections} moves={sections.moves ?? journey.data?.moves} />
    </Page>
  );
}

const useStyles = createStyles((theme) => ({
  header: { gap: theme.spacing.xs },
  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  rankText: { flex: 1, minWidth: 0, gap: 2 },
  group: { gap: theme.spacing.md },
  groupTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
    lineHeight: 28,
    paddingTop: theme.spacing.sm,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  closest: { gap: theme.spacing.xs },
  proofLabel: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  chipText: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    fontVariant: ['tabular-nums'],
  },
  body: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
}));
