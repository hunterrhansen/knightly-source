import { Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { ActionIcon } from './action-icon';

/** Whether an improvement makes the number go up (rating) or down (blunders). */
export type Better = 'up' | 'down';

/** "+49" / "−0.6" with an arrow, green when it moved the good way and muted
 * otherwise: a worse number is information, never an alarm. `null` shows a
 * dash (no comparison yet). */
export function Delta({
  change,
  better = 'up',
  digits = 0,
  suffix,
  size = 'body',
}: {
  change: number | null;
  better?: Better;
  digits?: number;
  /** After the number, e.g. "· 90 days". */
  suffix?: string;
  size?: 'small' | 'body';
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const flat = change == null || Number(change.toFixed(digits)) === 0;
  const good = !flat && change > 0 === (better === 'up');
  const color = good ? theme.colors.brandText : theme.colors.inkMuted;
  const number =
    change == null
      ? '—'
      : flat
        ? (0).toFixed(digits)
        : `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(digits)}`;
  const spoken =
    change == null
      ? 'No comparison yet'
      : flat
        ? 'No change'
        : `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change).toFixed(digits)}`;
  return (
    <View
      accessible
      accessibilityLabel={suffix ? `${spoken} ${suffix}` : spoken}
      style={styles.row}
    >
      {!flat && (
        <ActionIcon
          name={change > 0 ? 'up' : 'down'}
          size={size === 'small' ? 14 : 16}
          strokeWidth={3}
          color={color}
        />
      )}
      <Text style={[styles.text(size), { color }]}>
        {suffix ? `${number} ${suffix}` : number}
      </Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  text: (size: 'small' | 'body') => ({
    fontFamily: theme.typography.bold,
    fontSize:
      size === 'small'
        ? theme.typography.size.eyebrow
        : theme.typography.size.body,
    fontVariant: ['tabular-nums'],
  }),
}));
