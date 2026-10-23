import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GradeBadge, type MoveGrade, moveGrades } from '../../chess/board';
import type { GameDetail } from '../../lib/api/review-contract';
import { createStyles } from '../../theme/theme';
import { IconButton } from '../../ui';
import { tally } from './review-moments';

// As Chess.com's summary: the kinds worth a look show; the rest fold away.
const headline = new Set<MoveGrade>([
  'brilliant',
  'great',
  'best',
  'mistake',
  'miss',
  'blunder',
]);

/** Every kind of move with how many each side played, in Chess.com's order;
 * Excellent, Good, Book and Inaccuracy stay folded until asked for. */
export function MoveTally({
  game,
  you,
  them,
  onSelect,
}: {
  game: GameDetail;
  you: string;
  them: string;
  /** Opens the first move of that kind. */
  onSelect?: (kind: MoveGrade) => void;
}) {
  const styles = useStyles();
  const [all, setAll] = useState(false);
  const rows = tally(game).filter((row) => all || headline.has(row.kind));
  return (
    <View accessibilityRole="list" style={styles.table}>
      <View style={styles.row}>
        <Text style={[styles.head, styles.kind]}>Move</Text>
        <Text style={[styles.head, styles.count]} numberOfLines={1}>
          {you}
        </Text>
        <View style={styles.badge} />
        <Text style={[styles.head, styles.count]} numberOfLines={1}>
          {them}
        </Text>
      </View>
      {rows.map((row) => (
        <Pressable
          key={row.kind}
          accessibilityRole={onSelect ? 'button' : undefined}
          disabled={!onSelect || !(row.you + row.them)}
          onPress={() => onSelect?.(row.kind)}
          accessibilityLabel={`${moveGrades[row.kind].label}: ${you} ${row.you}, ${them} ${row.them}`}
          style={[styles.row, styles.line]}
        >
          <Text style={[styles.label, styles.kind]}>
            {moveGrades[row.kind].label}
          </Text>
          <Text style={[styles.value, styles.count, !row.you && styles.zero]}>
            {row.you}
          </Text>
          <View style={styles.badge}>
            <GradeBadge grade={row.kind} size={24} />
          </View>
          <Text style={[styles.value, styles.count, !row.them && styles.zero]}>
            {row.them}
          </Text>
        </Pressable>
      ))}
      <View style={styles.more}>
        <IconButton
          icon={all ? 'up' : 'down'}
          tone="muted"
          accessibilityLabel={
            all ? 'Show fewer kinds of move' : 'Show every kind of move'
          }
          onPress={() => setAll(!all)}
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  table: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  line: { borderTopWidth: 2, borderTopColor: theme.colors.surfaceMuted },
  kind: { flex: 1 },
  count: { width: 72, textAlign: 'center' },
  badge: { width: 36, alignItems: 'center' },
  head: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  label: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  value: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  more: {
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: theme.colors.surfaceMuted,
  },
  zero: { color: theme.colors.inkMuted, opacity: 0.6 },
}));
