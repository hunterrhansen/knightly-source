import { Pressable, Text, View } from 'react-native';
import type { Candidate } from '../../lib/api/practice-contract';
import { tapHaptic } from '../../lib/haptics';
import { createStyles } from '../../theme/theme';

/** The evaluation chip, from the learner's side: "+1.2", "M3". */
function candidateEval(candidate: Candidate): string {
  if (candidate.mate !== null)
    return `${candidate.mate < 0 ? '-' : ''}M${Math.abs(candidate.mate)}`;
  const pawns = Math.round(candidate.score_cp / 10) / 10 || 0;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

/** The heading for the list: the sheet's title while it shows. */
export const topMovesTitle = (candidates: readonly Candidate[]) =>
  candidates.slice(1).every((c) => c.about_equal)
    ? 'Several moves work here'
    : 'Top moves';

/** The top engine moves after an answer, each with its reason. As tall as the
 * line's ‹ › steps it replaces, so the sheet never pushes Continue away.
 * Tapping a row plays its line on the board. */
export function TopMoves({
  candidates,
  playing,
  onPlay,
}: {
  candidates: readonly Candidate[];
  /** The row whose line is on the board. */
  playing?: string;
  onPlay: (uci: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {candidates.map((candidate) => (
        <Pressable
          key={candidate.uci}
          accessibilityRole="button"
          accessibilityLabel={`${candidate.san}, ${candidateEval(candidate)}. ${candidate.reason_text}`}
          accessibilityHint="Plays this move's line on the board"
          accessibilityState={{ selected: playing === candidate.uci }}
          onPress={() => {
            tapHaptic();
            onPlay(candidate.uci);
          }}
          style={({ pressed }) => [
            styles.row,
            playing === candidate.uci && styles.playing,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.san}>{candidate.san}</Text>
          <Text style={styles.chip}>{candidateEval(candidate)}</Text>
          <Text numberOfLines={1} style={styles.reason}>
            {candidate.reason_text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.spacing.xs,
  },
  playing: { backgroundColor: theme.colors.surface },
  pressed: { opacity: 0.7 },
  san: {
    minWidth: 44,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  chip: {
    minWidth: 40,
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
  },
  reason: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
}));
