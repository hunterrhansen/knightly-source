import { Pressable, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles } from '../../theme/theme';
import { MoonPhase, moonPhaseForNight, usePressSquish } from '../../ui';

const freezeCount = (count: number) =>
  `${count || 'no'} ${count === 1 ? 'freeze' : 'freezes'}`;

/** The pill's accessible name: the streak, whether today counts, and freezes. */
const streakLabel = (streak: DailyReview['streak']) =>
  `${streak.count}-night streak${streak.safe_today ? ', safe today' : ''}, ${freezeCount(streak.freezes)}`;

/** The streak count beside its night's moon phase: dashed while today doesn't
 * count yet. Opens the streak popover. */
export function StreakPill({
  streak,
  onPress,
}: {
  streak: DailyReview['streak'];
  onPress: () => void;
}) {
  const styles = useStyles();
  const squish = usePressSquish();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={streakLabel(streak)}
      accessibilityHint="Shows your week, best streak and freezes"
      onPress={onPress}
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
      hitSlop={4}
    >
      <Animated.View
        style={[styles.pill, !streak.safe_today && styles.open, squish.style]}
      >
        <MoonPhase size={24} day={moonPhaseForNight(streak.count)} />
        <Text style={styles.count}>{streak.count}</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  open: { borderStyle: 'dashed', borderColor: theme.colors.goldLedge },
  count: {
    color: theme.colors.goldText,
    fontFamily: theme.typography.heading,
    fontSize: 18,
  },
}));
