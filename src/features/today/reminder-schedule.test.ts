import type { DailyReview, Watch } from '../../lib/api/today-contract';
import {
  DEFAULT_REMINDER,
  parseReminderPreference,
  planReminders,
  type ReminderPreference,
} from './reminder-schedule';

// Local device times (Date's local constructor), so the cases hold in any zone.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute);
const ON: ReminderPreference = { enabled: true, time: '20:00' };
const WATCH: Watch = {
  time: '20:00',
  anchor: 'finish dinner',
  set_on: '2026-09-01',
};

function review(overrides: Partial<DailyReview> = {}): DailyReview {
  return {
    day: '2026-10-13',
    // The user's day ends at local midnight.
    day_ends_at: at(14, 0).toISOString(),
    plan: [
      { kind: 'positions', done: false, count: 0, total: 8 },
      { kind: 'puzzles', done: false, count: 0, total: 5 },
    ],
    streak: {
      count: 12,
      best: 20,
      freezes: 1,
      safe_today: false,
      last_kept: '2026-10-12',
      week: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-10-${12 + i}`,
        state: 'upcoming' as const,
      })),
    },
    lesson: { done: 0, total: 10 },
    memory: { total: 142, mastered: 61, learning: 54, new: 27 },
    learn_more: 0,
    tomorrow_due: 6,
    game: null,
    new_games: 0,
    puzzles: { theme: null, share: null },
    ...overrides,
  };
}
const streak = (changes: Partial<DailyReview['streak']>) => ({
  ...review().streak,
  ...changes,
});

/** 13 October 2026 is a Tuesday; the 19th and 26th and 2 and 9 November are Mondays. */
const plan = (
  changes: {
    review?: DailyReview;
    watch?: Watch | null;
    now?: Date;
    preference?: ReminderPreference;
  } = {},
) =>
  planReminders({
    preference: ON,
    watch: WATCH,
    review: review(),
    now: at(13, 9),
    ...changes,
  });
const ids = (planned: { id: string }[]) => planned.map((r) => r.id);

test('reminders stay off until the user opts in, defaulting to 20:00', () => {
  expect(DEFAULT_REMINDER).toEqual({ enabled: false, time: '20:00' });
  expect(parseReminderPreference(null)).toEqual(DEFAULT_REMINDER);
  expect(parseReminderPreference('{"enabled":true,"time":"03:17"}')).toEqual(
    DEFAULT_REMINDER,
  );
  expect(parseReminderPreference('not json')).toEqual(DEFAULT_REMINDER);
  expect(plan({ preference: DEFAULT_REMINDER })).toEqual([]);
});

test('tonight’s reminder fires at the watch time, quotes the anchor and uses real numbers', () => {
  expect(plan({ watch: { ...WATCH, time: '21:30' } })[0]).toEqual({
    id: '2026-10-13',
    at: at(13, 21, 30),
    title: 'After I finish dinner',
    body: 'Your 12-night streak is waiting. Today’s lesson keeps it: 10 to go.',
  });
});

test('no reminder today once the watch is kept, on a rest day, or after its time', () => {
  const kept = review({
    streak: streak({ safe_today: true, count: 13, last_kept: '2026-10-13' }),
  });
  expect(ids(plan({ review: kept }))[0]).toBe('2026-10-14');
  const rest = review({ plan: [], lesson: { done: 0, total: 0 } });
  expect(ids(plan({ review: rest }))[0]).toBe('2026-10-14');
  expect(ids(plan({ now: at(13, 20, 5) }))[0]).toBe('2026-10-14');
});

test('a week of silence is reminded daily, then Mondays only, then not at all after 30 days', () => {
  // Last kept on the 12th: the 13th is day 1 of silence, the 19th day 7.
  expect(ids(plan())).toEqual([
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
    '2026-10-19',
    '2026-10-26',
    '2026-11-02',
    '2026-11-09',
  ]);
  const backedOff = plan().slice(7);
  for (const reminder of backedOff) {
    expect(reminder.at.getDay()).toBe(1);
    expect(reminder.body).toBe(
      'A new week, a new moon. Your watch is ready whenever you are.',
    );
  }
  const quiet = review({ streak: streak({ last_kept: '2026-09-12' }) });
  expect(plan({ review: quiet })).toEqual([]);
});

test('saving the watch again restarts the back-off', () => {
  const quiet = review({ streak: streak({ last_kept: '2026-09-12' }) });
  expect(
    ids(plan({ review: quiet, watch: { ...WATCH, set_on: '2026-10-13' } }))
      .length,
  ).toBe(7 + 4); // today and 7 more days, then three Mondays up to day 30
});

test('consecutive days rotate encouraging lines, timed to the watch', () => {
  // Without a review, silence counts from the day the watch was saved.
  const fresh = { ...WATCH, set_on: '2026-10-12' };
  const evening = plan({ review: undefined, watch: fresh }).slice(0, 7);
  for (let i = 1; i < evening.length; i++)
    expect(evening[i]?.body).not.toBe(evening[i - 1]?.body);
  expect(evening.some((r) => r.body.includes('tonight'))).toBe(true);
  const morning = plan({
    review: undefined,
    watch: { ...fresh, time: '07:00' },
    now: at(13, 6),
  }).slice(0, 7);
  expect(morning.some((r) => r.body.includes('today'))).toBe(true);
  expect(morning.some((r) => r.body.includes('tonight'))).toBe(false);
  for (const line of [...evening, ...morning])
    expect(line.body).not.toMatch(/miss|broke|lose|don’t|forgot/i);
});

test('without a watch, the device’s earlier time is used with no title', () => {
  const [first] = plan({
    watch: null,
    preference: { enabled: true, time: '19:00' },
  });
  expect(first?.at).toEqual(at(13, 19));
  expect(first?.title).toBeUndefined();
});

test('the copy counts what is left of the lesson and is gentle without a streak', () => {
  const body = (changes: Partial<DailyReview>) =>
    plan({ review: review(changes) })[0]?.body;
  expect(body({ lesson: { done: 7, total: 10 } })).toBe(
    'Your 12-night streak is waiting. Today’s lesson keeps it: 3 to go.',
  );
  expect(
    body({
      streak: streak({ count: 1 }),
      plan: [{ kind: 'game', done: false }],
      lesson: { done: 0, total: 0 },
    }),
  ).toBe('Your 1-night streak is waiting. Reviewing your game keeps it.');
  expect(body({ streak: streak({ count: 0 }) })).toBe(
    'Today’s lesson is ready. Finish it to start a streak.',
  );
});

test('without a review for today, tonight’s reminder still comes with a rotating line', () => {
  const yesterday = review({
    day: '2026-10-12',
    day_ends_at: at(13, 0).toISOString(),
    streak: streak({ safe_today: true }),
  });
  for (const stale of [undefined, yesterday]) {
    const [first] = plan({
      review: stale,
      watch: { ...WATCH, set_on: '2026-10-12' },
    });
    expect(first?.id).toBe('2026-10-13');
    expect(first?.body).not.toMatch(/streak/);
  }
});
