import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';

export type Swatch =
  | { kind: 'dot'; color: string }
  /** An empty dot: a share with no fill of its own (New in the deck). */
  | { kind: 'ring'; color: string }
  | { kind: 'line'; color: string }
  | { kind: 'dash'; color: string };

/** One key entry: a swatch, its label and, in a list, its count at the end.
 * Decorative next to a chart that already has its own accessible label. */
export function LegendItem({
  swatch,
  label,
  count,
}: {
  swatch: Swatch;
  label: string;
  count?: number | string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.item}>
      <View style={styles.swatch(swatch.kind, swatch.color)} />
      <Text style={[styles.label, count != null && styles.fill]}>{label}</Text>
      {count != null && <Text style={styles.count}>{count}</Text>}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  item: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  swatch: (kind: Swatch['kind'], color: string) =>
    kind === 'line'
      ? { width: 14, height: 4, borderRadius: 2, backgroundColor: color }
      : kind === 'dash'
        ? {
            width: 14,
            borderTopWidth: 2,
            borderStyle: 'dashed',
            borderColor: color,
          }
        : kind === 'ring'
          ? {
              width: 10,
              height: 10,
              borderRadius: 5,
              borderWidth: 1,
              borderColor: color,
              backgroundColor: theme.colors.surfaceMuted,
            }
          : { width: 10, height: 10, borderRadius: 5, backgroundColor: color },
  label: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
  },
  fill: { flex: 1 },
  count: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small + 1,
    fontVariant: ['tabular-nums'],
  },
}));
