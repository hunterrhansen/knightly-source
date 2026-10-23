import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';

/** A quiet number tile inside a card: the value large, an optional unit
 * ("/ 28") and change beside it, and a label underneath. The celebratory
 * session-end stat cards are ResultsBeat's own. */
export function StatTile({
  value,
  unit,
  label,
  change,
  accessibilityLabel,
}: {
  value: string;
  unit?: string;
  label: string;
  /** Usually a <Delta size="small">. */
  change?: ReactNode;
  /** The tile as spoken; defaults to value, unit and label. */
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityLabel={
        accessibilityLabel ?? [value, unit, label].filter(Boolean).join(' ')
      }
      style={styles.tile}
    >
      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {value}
          {unit ? <Text style={styles.unit}>{` ${unit}`}</Text> : null}
        </Text>
        {change}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceMuted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 6,
  },
  value: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.stat,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: theme.colors.inkMuted,
    fontSize: theme.typography.size.small + 4,
  },
  label: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.eyebrow,
    lineHeight: 18,
  },
}));
