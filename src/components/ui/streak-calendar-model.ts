import {
  buildCalendar,
  type CalendarDayMetadata,
  fromDateId,
  toDateId,
} from '@marceloterreiro/flash-calendar';
import type { DailyReview } from '../../lib/api/today-contract';
import type { Preferences } from '../../theme/preferences';

export type StreakDayState = DailyReview['streak']['week'][number]['state'];
/** Streak states by `YYYY-MM-DD` user-local day, as the backend computes them. */
export type StreakDays = Readonly<Record<string, StreakDayState>>;
/** Each done day's night in its streak, by user-local day, from the backend. */
export type StreakNights = Readonly<Record<string, number>>;

export function addDays(id: string, days: number) {
  const date = fromDateId(id);
  date.setDate(date.getDate() + days);
  return toDateId(date);
}

export type WeekStart = Preferences['weekStart'];

/** The first day of the week holding `id`. */
export function weekStartOf(id: string, weekStart: WeekStart) {
  const weekday = fromDateId(id).getDay();
  return addDays(id, -((weekday - (weekStart === 'monday' ? 1 : 0) + 7) % 7));
}

/** Column letters, starting on the chosen day. */
export function weekdayLetters(weekStart: WeekStart) {
  return weekStart === 'monday'
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
}

function firstOfMonth(id: string) {
  return `${id.slice(0, 8)}01`;
}

function addMonths(id: string, months: number) {
  const date = fromDateId(firstOfMonth(id));
  date.setMonth(date.getMonth() + months);
  return toDateId(date);
}

/** The state shown for a day: the backend's, else upcoming after today and
 * blank before it (no recorded history). */
export function dayState(
  id: string,
  today: string,
  days: StreakDays,
): StreakDayState {
  return (
    days[id] ?? (id === today ? 'today' : id > today ? 'upcoming' : 'none')
  );
}

/** Weeks of `focus`'s month from the chosen first day, padded with
 * neighbouring days, and the row holding `focus` (the one the collapsed
 * calendar shows). */
export function monthGrid(
  focus: string,
  weekStart: WeekStart,
): {
  weeks: CalendarDayMetadata[][];
  focusRow: number;
} {
  const { weeksList } = buildCalendar({
    calendarMonthId: firstOfMonth(focus),
    calendarFirstDayOfWeek: weekStart,
  });
  const focusRow = Math.max(
    0,
    weeksList.findIndex((week) => week.some((day) => day.id === focus)),
  );
  return { weeks: weeksList, focusRow };
}

/** Where previous/next lead from `focus`: a week collapsed, a month expanded.
 * Never past the week or month holding today. A new month focuses today when
 * it holds it, else its first day. */
export function step(
  focus: string,
  direction: -1 | 1,
  expanded: boolean,
  today: string,
  weekStart: WeekStart,
): string | undefined {
  if (!expanded) {
    const next = addDays(weekStartOf(focus, weekStart), direction * 7);
    return next > weekStartOf(today, weekStart) ? undefined : next;
  }
  const month = addMonths(focus, direction);
  if (month > firstOfMonth(today)) return undefined;
  return month === firstOfMonth(today) ? today : month;
}

/** The days on screen: the focus week collapsed, the whole grid expanded. */
export function visibleRange(
  focus: string,
  expanded: boolean,
  weekStart: WeekStart,
) {
  if (!expanded) {
    const start = weekStartOf(focus, weekStart);
    return { start, end: addDays(start, 6) };
  }
  const { weeks } = monthGrid(focus, weekStart);
  const days = weeks.flat();
  return {
    start: days[0]?.id ?? focus,
    end: days[days.length - 1]?.id ?? focus,
  };
}

type StreakWeek = DailyReview['streak']['week'];

/** The summary's week (always Monday-first) as streak days by date. */
export function weekDays(week: StreakWeek): StreakDays {
  return Object.fromEntries(week.map((day) => [day.date, day.state]));
}

/** The nights of the done days among `days` (from the summary or history). */
export function dayNights(
  days: readonly { date: string; night?: number | null }[],
): StreakNights {
  return Object.fromEntries(
    days.flatMap((day) => (day.night ? [[day.date, day.night]] : [])),
  );
}

/** Today within the summary's week: its last day that is not upcoming. */
export function todayOf(week: StreakWeek) {
  return (
    [...week].reverse().find((day) => day.state !== 'upcoming')?.date ??
    week[0]?.date ??
    ''
  );
}
