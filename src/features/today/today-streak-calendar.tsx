import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { DailyReview } from '../../lib/api/today-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';
import {
  dayNights,
  StreakCalendar,
  type StreakDays,
  type StreakNights,
  todayOf,
  weekDays,
} from '../../ui';

type Range = { from: string; to: string };

type StreakHistoryData = { days: StreakDays; nights: StreakNights };

/** Streak days and their nights from the backend for `range`; none while
 * loading or unset. */
export function useStreakHistory(
  range: Range | undefined,
): StreakHistoryData | undefined {
  const { scope } = useSessionScope();
  const { data } = useQuery({
    queryKey: [...scope.meKey, 'streak-days', range?.from, range?.to],
    queryFn: ({ signal }) =>
      range ? scope.api.streakDays(range.from, range.to, signal) : { days: [] },
    enabled: range !== undefined,
  });
  return useMemo(
    () =>
      data && {
        days: Object.fromEntries(data.days.map((day) => [day.date, day.state])),
        nights: dayNights(data.days),
      },
    [data],
  );
}
const noHistory = (_: Range | undefined): StreakHistoryData | undefined =>
  undefined;

// Signed-in screens fetch history; previews and stories show only the week.
const StreakHistory = createContext(noHistory);
export function LiveStreakHistory({ children }: PropsWithChildren) {
  return (
    <StreakHistory.Provider value={useStreakHistory}>
      {children}
    </StreakHistory.Provider>
  );
}

/**
 * The streak calendar for Today and the streak popover: this week from the
 * summary, earlier weeks and months from the backend as they come on screen.
 * Days still loading show blank, never missed.
 */
export function TodayStreakCalendar({
  streak,
  atRisk = false,
}: {
  streak: DailyReview['streak'];
  /** Today's socket turns gold, as the hero's does in its last hours. */
  atRisk?: boolean;
}) {
  const useHistory = useContext(StreakHistory);
  const today = todayOf(streak.week);
  // The summary's week is Monday-first whatever the calendar's first day.
  const monday = streak.week[0]?.date ?? today;
  const [visible, setVisible] = useState<{ start: string; end: string }>();
  // The summary already has its week; the backend serves nothing after today.
  const fetched = useHistory(
    visible && visible.start < monday
      ? { from: visible.start, to: visible.end < today ? visible.end : today }
      : undefined,
  );
  const days = useMemo(
    () => ({ ...fetched?.days, ...weekDays(streak.week) }),
    [fetched, streak.week],
  );
  const nights = useMemo(
    () => ({ ...fetched?.nights, ...dayNights(streak.week) }),
    [fetched, streak.week],
  );
  return (
    <StreakCalendar
      today={today}
      days={days}
      nights={nights}
      todayAtRisk={atRisk}
      onVisibleRangeChange={setVisible}
    />
  );
}
