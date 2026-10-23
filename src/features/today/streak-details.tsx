import { Text, View } from 'react-native';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles, useTheme } from '../../theme/theme';
import { Button, Moon } from '../../ui';
import { TodayStreakCalendar } from './today-streak-calendar';

const FREEZE_EXPLANATION =
  'A freeze covers a missed day; you earn one every 7 days, up to 2.';

/** The streak popover's content: its calendar, current and best streak, freezes. */
export function StreakDetails({
  streak,
  onDone,
}: {
  streak: DailyReview['streak'];
  onDone: () => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const stats = [
    { label: 'Current streak', value: streak.count },
    { label: 'Best streak', value: streak.best },
    { label: 'Freezes held', value: streak.freezes },
  ];
  return (
    <View style={styles.body}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Moon size={24} color={theme.colors.gold} />
          <Text accessibilityRole="header" style={styles.title}>
            Your streak
          </Text>
        </View>
        <Button variant="text" onPress={onDone}>
          Done
        </Button>
      </View>
      <TodayStreakCalendar streak={streak} />
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            accessible
            accessibilityLabel={`${stat.label}: ${stat.value}`}
            style={styles.stat}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>{FREEZE_EXPLANATION}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  body: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: theme.layout.readingMax,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 22,
  },
  stats: { flexDirection: 'row', gap: theme.spacing.sm },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  statValue: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 26,
  },
  statLabel: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 18,
  },
  note: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
}));
