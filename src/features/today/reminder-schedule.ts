import { z } from 'zod';
import type { DailyReview, Watch } from '../../lib/api/today-contract';

/** Watch times offered on Your watch (local device time); evening is the default. */
export const WATCH_TIMES = [
  '07:00',
  '08:00',
  '12:00',
  '13:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
] as const;
export const DEFAULT_WATCH_TIME = '20:00';

/** Whether this device reminds, and (from before Your watch) the time it chose. The
 * saved watch's time wins once there is one. */
export type ReminderPreference = { enabled: boolean; time: string };
export const DEFAULT_REMINDER: ReminderPreference = {
  enabled: false,
  time: DEFAULT_WATCH_TIME,
};

const preferenceSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/),
});

/** The stored preference, or the default (off at 20:00) when missing or unreadable. */
export function parseReminderPreference(
  stored: string | null,
): ReminderPreference {
  if (!stored) return DEFAULT_REMINDER;
  try {
    const parsed = preferenceSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : DEFAULT_REMINDER;
  } catch {
    return DEFAULT_REMINDER;
  }
}

/** "8:00 PM" or "20:00", following the device locale. */
export function reminderTimeLabel(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Days of silence reminded every day; then Mondays only up to `STOP_AFTER`. */
const DAILY_FOR = 7;
const STOP_AFTER = 30;

const FRESH_START =
  'A new week, a new moon. Your watch is ready whenever you are.';

/** Encouraging lines, one per day in turn so consecutive days differ. Never guilt. */
function rotatingLine(dayNumber: number, part: string) {
  const lines = [
    'Your watch is ready. A few minutes is enough.',
    `Your past mistakes are ready for another look ${part}.`,
    `A short watch ${part}. You can stop whenever you like.`,
    'The knight is keeping watch. Join in for a few minutes.',
    `One small watch ${part} keeps the habit growing.`,
  ];
  return lines[dayNumber % lines.length] ?? FRESH_START;
}

/** Today's line from the real streak and lesson numbers. On a day with nothing to
 * practice, reviewing the game is what keeps the streak. */
function reviewLine(review: DailyReview) {
  const left = Math.max(0, review.lesson.total - review.lesson.done);
  if (review.streak.count > 0)
    return `Your ${review.streak.count}-night streak is waiting. ${
      left
        ? `Today’s lesson keeps it: ${left} to go.`
        : 'Reviewing your game keeps it.'
    }`;
  return left
    ? 'Today’s lesson is ready. Finish it to start a streak.'
    : 'Your game is ready to review. Review it to start a streak.';
}

export type PlannedReminder = {
  /** The local day it is for, YYYY-MM-DD. */
  id: string;
  at: Date;
  title?: string;
  body: string;
};

const DAY_MS = 86_400_000;
/** Whole days since 1970 for a local calendar date (DST-proof). */
const dayNumber = (y: number, m: number, d: number) =>
  Math.round(Date.UTC(y, m, d) / DAY_MS);
const dayNumberOf = (iso: string) => {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return dayNumber(y, m - 1, d);
};
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/**
 * The local notifications to keep scheduled, at most one a day. Pure: `now` is the
 * device's time.
 *
 * - Off: none. The time is the watch's (else this device's earlier choice).
 * - Silence counts from the later of the last day kept and the day the watch was
 *   saved: reminded every day for `DAILY_FOR` days, then Mondays only (a fresh
 *   start) until `STOP_AFTER` days, then none. All of it is scheduled ahead, so
 *   it holds when the app isn't opened.
 * - Today's, when its time is still ahead: skipped when the review for that day
 *   says the streak is safe or there is nothing to do (a rest day), with the real
 *   numbers otherwise. Without a review covering that moment it uses the rotating
 *   line. Later days can't be known, so they rotate; keeping a watch reloads the
 *   review and the reschedule drops that day.
 * - Titled with the learner's anchor: "After I finish dinner".
 */
export function planReminders({
  preference,
  watch,
  review,
  now,
}: {
  preference: ReminderPreference;
  watch: Watch | null | undefined;
  review: DailyReview | undefined;
  now: Date;
}): PlannedReminder[] {
  if (!preference.enabled) return [];
  const time = watch?.time ?? preference.time;
  const [hour = 20, minute = 0] = time.split(':').map(Number);
  const part = hour >= 17 ? 'tonight' : 'today';
  const title = watch ? `After I ${watch.anchor}` : undefined;
  const today = dayNumber(now.getFullYear(), now.getMonth(), now.getDate());
  const starts = [review?.streak.last_kept, watch?.set_on]
    .filter((day): day is string => !!day)
    .map(dayNumberOf);
  const silenceStart = starts.length ? Math.max(...starts) : today;
  const dayEnds = review ? Date.parse(review.day_ends_at) : Number.NaN;

  const planned: PlannedReminder[] = [];
  for (let offset = 0; ; offset++) {
    const silence = today + offset - silenceStart;
    if (silence > STOP_AFTER) break;
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour,
      minute,
    );
    const monday = at.getDay() === 1;
    if (silence > DAILY_FOR && !monday) continue;
    if (at.getTime() <= now.getTime()) continue;
    let body =
      silence > DAILY_FOR ? FRESH_START : rotatingLine(today + offset, part);
    if (
      offset === 0 &&
      review &&
      now.getTime() < dayEnds &&
      at.getTime() < dayEnds
    ) {
      if (review.streak.safe_today || !review.plan.some((step) => !step.done))
        continue;
      body = reviewLine(review);
    }
    planned.push({ id: isoDay(at), at, title, body });
  }
  return planned;
}
