import { Text, View } from 'react-native';
import { tacticNames } from '../../chess/tactics';
import type { Deck } from '../../lib/api/practice-contract';
import { breakdownRows, type PointsSummary } from '../../lib/lesson-points';
import { createStyles } from '../../theme/theme';
import {
  markLabels,
  pointsStat,
  type SessionResults,
  timeOrRevisit,
} from '../../ui';

/** The Results beat for today's answers: found without help, accuracy, and
 * this visit's time (or what to revisit when the time is unknown). */
/** The words at the end of a post's test (backend challenge.py): cleared, or
 * the post goes on as before, saying so when its games held it back. */
export function challengeEnd(
  challenge: NonNullable<Deck['challenge']>,
  _place: string | undefined,
): { title: string; coach: string; note: string } {
  const score = `${challenge.right} of ${challenge.total} right`;
  if (challenge.passed)
    return {
      title: 'Practice complete',
      coach:
        'You completed this practice check. Keep applying these ideas in your games.',
      note: score,
    };
  return {
    title: 'Not this time',
    coach: challenge.games_not_yet
      ? 'Keep practicing these ideas in your games before trying again.'
      : 'Review these positions and try again when you’re ready.',
    note: score,
  };
}

export function practiceResults(
  deck: Deck,
  elapsed: number | undefined,
  points?: PointsSummary,
): Omit<SessionResults, 'title'> {
  const marks = (...kinds: string[]) =>
    deck.results.filter((r) => kinds.includes(r.mark)).length;
  const puzzleResults = deck.puzzle_results ?? [];
  const solved = puzzleResults.filter((r) => r.correct).length;
  const found = marks('found', 'good') + solved;
  const answered = deck.results.length + puzzleResults.length;
  const missed = marks('missed') + puzzleResults.length - solved;
  const accuracy = answered ? Math.round((100 * found) / answered) : 0;
  // One shape on every visit: points need this visit's session, so a revisit
  // shows what was found in their place; first-try rate always comes second.
  const earned = !!points?.total;
  return {
    coach:
      answered && found === answered
        ? 'Every one on your own. Sharp work!'
        : accuracy >= 70
          ? 'Solid session. Your next reviews are scheduled.'
          : deck.results.length
            ? 'The ones you missed come back soon for another go.'
            : 'A tricky set. Fresh puzzles tomorrow.',
    stats: [
      earned
        ? pointsStat(points.total)
        : { label: 'Found', value: String(found), tone: 'gold', icon: 'best' },
      {
        label: 'First try',
        value: `${accuracy}%`,
        tone: 'brand',
        icon: 'check',
      },
      // Missed positions come back; missed puzzles don't.
      timeOrRevisit(
        elapsed,
        deck.results.length ? 'To revisit' : 'Missed',
        missed,
      ),
    ],
    ...(earned ? { breakdown: breakdownRows(points) } : {}),
    details: <ResultList deck={deck} puzzles={deck.puzzle_results} />,
  };
}

function ResultList({
  deck,
  puzzles,
}: {
  deck: Deck;
  puzzles: Deck['puzzle_results'];
}) {
  const styles = useStyles();
  return (
    <View>
      {deck.results.map((r) => (
        <View key={`${r.game_id}:${r.ply}`} style={styles.result}>
          <Text style={styles.resultMove}>{r.san}</Text>
          <Text style={[styles.muted, styles.fill]} numberOfLines={1}>
            vs {r.opponent ?? 'Unknown opponent'}
          </Text>
          <Text style={styles.resultMark}>{markLabels[r.mark]}</Text>
        </View>
      ))}
      {puzzles?.map((r) => (
        <View key={r.id} style={styles.result}>
          <Text style={styles.resultMove}>Puzzle</Text>
          <Text style={[styles.muted, styles.fill]} numberOfLines={1}>
            {[
              r.rating ? `Rated ${r.rating}` : undefined,
              tacticNames[r.themes.find((t) => tacticNames[t]) ?? ''],
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {/* A missed puzzle is not revisited: it says so plainly. */}
          <Text style={styles.resultMark}>
            {r.correct ? 'Found' : 'Missed'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  fill: { flex: 1 },
  muted: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.layout.minControl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  resultMove: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  resultMark: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
  },
}));
