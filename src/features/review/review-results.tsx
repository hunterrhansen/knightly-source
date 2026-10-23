import { Text, View } from 'react-native';
import { GradeBadge } from '../../chess/board';
import type { GameDetail, ReviewMark } from '../../lib/api/review-contract';
import { breakdownRows, type PointsSummary } from '../../lib/lesson-points';
import { createStyles } from '../../theme/theme';
import {
  type BeatStat,
  markLabels,
  pointsStat,
  type SessionResults,
  timeOrRevisit,
} from '../../ui';
import type { ReviewStep } from './review-lesson';
import { gradeOf } from './review-moments';

/** The Results beat for a finished review: moves found on your own,
 * accuracy over the find steps, and this visit's time. */
export function reviewResults(
  review: {
    marks: readonly ReviewMark[];
    steps: readonly ReviewStep[];
    labels?: readonly string[];
  },
  game: GameDetail,
  elapsed: number | undefined,
  points?: PointsSummary,
): Omit<SessionResults, 'secondary'> {
  const count = (...marks: string[]) =>
    review.marks.filter((m) => marks.includes(m.mark)).length;
  const finds = review.steps.filter((s) => s.type === 'find').length;
  const found = count('found', 'good');
  const rate = `${finds ? Math.round((100 * found) / finds) : 0}%`;
  const earned = !!finds && !!points?.total;
  // A later visit, with no points, shows what was found and its accuracy.
  const stats: BeatStat[] = !finds
    ? [
        {
          label: 'Moments',
          value: String(review.steps.length),
          tone: 'brand',
          icon: 'review',
        },
      ]
    : earned
      ? [
          pointsStat(points.total),
          { label: 'First try', value: rate, tone: 'brand', icon: 'check' },
        ]
      : [
          {
            label: 'Found',
            value: String(found),
            tone: 'brand',
            icon: 'check',
          },
          { label: 'Accuracy', value: rate, tone: 'gold', icon: 'best' },
        ];
  stats.push(timeOrRevisit(elapsed, 'To revisit', count('missed')));
  return {
    title: 'Review complete',
    coach: finds
      ? `You found ${found} of ${finds} better moves on your own.`
      : 'Every key moment reviewed.',
    stats,
    ...(earned ? { breakdown: breakdownRows(points) } : {}),
    details: (
      <ReviewMarks
        marks={review.marks}
        labels={review.labels}
        game={game}
        helped={count('missed', 'helped') > 0}
      />
    ),
  };
}

function ReviewMarks({
  marks,
  labels,
  game,
  helped,
}: {
  marks: readonly ReviewMark[];
  labels?: readonly string[];
  game: GameDetail;
  helped: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.marks}>
      {marks.map((m) => {
        const grade = gradeOf(game.plies[m.ply - 1]);
        return (
          <View key={m.ply} style={styles.markRow}>
            {grade && <GradeBadge grade={grade} size={22} />}
            <Text style={styles.markMove}>
              {labels?.[m.ply] ?? `Move ${m.ply}`}
            </Text>
            <Text style={styles.markLabel}>{markLabels[m.mark]}</Text>
          </View>
        );
      })}
      {helped && (
        <Text style={styles.completeBody}>
          Positions you needed help with join your practice, so you see them
          again soon.
        </Text>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  completeBody: {
    textAlign: 'center',
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
  marks: { gap: theme.spacing.xs },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 40,
  },
  markMove: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  markLabel: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
  },
}));
