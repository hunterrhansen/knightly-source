import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { IconButton } from '../../ui';

/** ‹ › through a solution line, with the move on the board named between. */
export function LineSteps({
  view,
  san,
  onStep,
}: {
  /** Plies shown, 0 (the start) to `san.length`. */
  view: number;
  san: readonly string[];
  onStep: (delta: -1 | 1) => void;
}) {
  const styles = useStyles();
  const atStart = view <= 0;
  const atEnd = view >= san.length;
  const label =
    view === 0 ? 'Start' : `${view} / ${san.length} · ${san[view - 1] ?? ''}`;
  const button = (delta: -1 | 1, disabled: boolean) => (
    <IconButton
      icon={delta < 0 ? 'previous' : 'next'}
      iconSize={30}
      backdrop="surface"
      accessibilityLabel={delta < 0 ? 'Previous move' : 'Next move'}
      disabled={disabled}
      onPress={() => onStep(delta)}
    />
  );
  return (
    <View style={styles.row}>
      {button(-1, atStart)}
      <Text accessibilityLiveRegion="polite" style={styles.label}>
        {label}
      </Text>
      {button(1, atEnd)}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
}));
