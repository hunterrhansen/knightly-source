import type { Meta, StoryObj } from '@storybook/react-native';
import { View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { StreakCalendar } from './streak-calendar';
import {
  addDays,
  type StreakDayState,
  type StreakDays,
  type StreakNights,
} from './streak-calendar-model';

const TODAY = '2026-10-16';

/** Sample history ending yesterday: `pattern` repeats back from yesterday,
 * starting `length` days ago (earlier days have no streak). */
function history(pattern: StreakDayState[], length: number): StreakDays {
  const days: Record<string, StreakDayState> = {};
  for (let back = 1; back <= length; back++)
    days[addDays(TODAY, -back)] =
      pattern[(back - 1) % pattern.length] ?? 'done';
  return days;
}

/** Each done day's night, numbered oldest first as the backend does: frozen
 * and rest days add none, a miss starts over. */
function nightsOf(days: StreakDays): StreakNights {
  const nights: Record<string, number> = {};
  let night = 0;
  for (const date of Object.keys(days).sort()) {
    if (days[date] === 'done') nights[date] = ++night;
    else if (days[date] === 'missed') night = 0;
  }
  return nights;
}

const sample = history(
  ['done', 'done', 'rest', 'done', 'done', 'frozen', 'done', 'done'],
  70,
);
const doneToday: StreakDays = { ...history(['done'], 40), [TODAY]: 'done' };
const broken = history(
  ['done', 'done', 'done', 'missed', 'missed', 'done', 'done', 'rest'],
  50,
);
const fresh = history(['done'], 3);

const useStyles = createStyles((theme) => ({
  frame: {
    padding: theme.spacing.lg,
    maxWidth: 420,
    backgroundColor: theme.colors.page,
  },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
  },
}));

const meta = {
  title: 'UI/Streak calendar',
  component: StreakCalendar,
  args: {
    today: TODAY,
    days: sample,
    nights: nightsOf(sample),
    onVisibleRangeChange: () => {},
  },
  decorators: [
    (Story) => {
      const styles = useStyles();
      return (
        <View style={styles.frame}>
          <View style={styles.card}>
            <Story />
          </View>
        </View>
      );
    },
  ],
} satisfies Meta<typeof StreakCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Week: Story = {};
export const Month: Story = { args: { initialExpanded: true } };
export const DoneToday: Story = {
  args: { days: doneToday, nights: nightsOf(doneToday) },
};
export const BrokenStreak: Story = {
  args: { days: broken, nights: nightsOf(broken), initialExpanded: true },
};
export const NewStreak: Story = {
  args: { days: fresh, nights: nightsOf(fresh), initialExpanded: true },
};
