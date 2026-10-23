import {
  type DailyReview,
  homeTodaySchema,
} from '../../lib/api/today-contract';
import {
  AT_RISK_HOURS,
  dailyProgress,
  inARow,
  isStreakMilestone,
  todayState,
  tonightNight,
} from './today-state';

const DAY_END = '2026-10-14T06:00:00Z';
const hoursBeforeEnd = (hours: number) =>
  new Date(Date.parse(DAY_END) - hours * 3_600_000);

function review(overrides: Partial<DailyReview> = {}): DailyReview {
  return {
    day: '2026-10-13',
    day_ends_at: DAY_END,
    plan: [
      { kind: 'game', done: false },
      { kind: 'positions', done: false, count: 0, total: 8 },
      { kind: 'puzzles', done: false, count: 0, total: 5 },
    ],
    streak: {
      count: 12,
      best: 20,
      freezes: 1,
      safe_today: false,
      week: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-10-${12 + i}`,
        state: 'upcoming' as const,
      })),
    },
    lesson: { done: 0, total: 10 },
    memory: { total: 142, mastered: 61, learning: 54, new: 27 },
    learn_more: 0,
    tomorrow_due: 6,
    game: {
      id: 7,
      opponent: 'dragonfly88',
      speed: 'rapid',
      outcome: 'loss',
      blunders: 1,
      mistakes: 2,
    },
    new_games: 1,
    puzzles: { theme: 'fork', share: 0.31 },
    ...overrides,
  };
}

test('a fresh day leads with the lesson and offers the waiting game beside it', () => {
  const state = todayState({ review: review() }, hoursBeforeEnd(12));
  expect(state).toMatchObject({
    kind: 'ready',
    start: {
      kind: 'lesson',
      done: 0,
      total: 10,
      href: '/practice?mode=lesson',
    },
    game: { kind: 'game', href: '/review/7' },
    // 10 items × 0.5 min.
    minutes: 5,
  });
});

test('a started lesson is returning until the streak is safe, then Today is done', () => {
  const started = review({ lesson: { done: 4, total: 10 } });
  expect(todayState({ review: started }, hoursBeforeEnd(1))).toMatchObject({
    kind: 'returning',
    minutes: 3,
  });
  const safe = review({
    lesson: { done: 10, total: 10 },
    streak: { ...review().streak, safe_today: true },
  });
  expect(todayState({ review: safe }, hoursBeforeEnd(1))).toMatchObject({
    kind: 'done',
    next: { kind: 'game', href: '/review/7' },
  });
});

test('reviewing the game makes Today done even with the lesson untouched', () => {
  const plan = review().plan.map((step) =>
    step.kind === 'game' ? { ...step, done: true } : step,
  );
  const state = todayState(
    {
      review: review({
        plan,
        streak: { ...review().streak, safe_today: true },
      }),
    },
    hoursBeforeEnd(8),
  );
  expect(state).toMatchObject({
    kind: 'done',
    next: { kind: 'positions', href: '/practice?mode=lesson' },
  });
});

test('with nothing to practice, the game review is what Today starts', () => {
  const state = todayState(
    {
      review: review({
        plan: [{ kind: 'game', done: false }],
        lesson: { done: 0, total: 0 },
      }),
    },
    hoursBeforeEnd(12),
  );
  expect(state).toMatchObject({
    kind: 'ready',
    start: { kind: 'game', href: '/review/7' },
    game: null,
  });
});

test('an untouched streak is at risk only in the last hours of the user’s day', () => {
  expect(
    todayState({ review: review() }, hoursBeforeEnd(AT_RISK_HOURS + 0.5)).kind,
  ).toBe('ready');
  expect(
    todayState({ review: review() }, hoursBeforeEnd(AT_RISK_HOURS - 0.5)),
  ).toMatchObject({
    kind: 'at-risk',
    hoursLeft: AT_RISK_HOURS - 0.5,
    start: { kind: 'lesson' },
  });
  const noStreak = review({ streak: { ...review().streak, count: 0 } });
  expect(todayState({ review: noStreak }, hoursBeforeEnd(1)).kind).toBe(
    'ready',
  );
});

test('an empty day rests unless the account is new or importing', () => {
  const empty = review({ plan: [], lesson: { done: 0, total: 0 } });
  expect(
    todayState({ review: empty, accounts: 1 }, hoursBeforeEnd(1)).kind,
  ).toBe('rest');
  expect(
    todayState(
      { review: empty, accounts: 1, importing: true },
      hoursBeforeEnd(1),
    ).kind,
  ).toBe('processing');
  const blank = review({
    plan: [],
    lesson: { done: 0, total: 0 },
    memory: { total: 0, mastered: 0, learning: 0, new: 0 },
  });
  expect(
    todayState({ review: blank, accounts: 0 }, hoursBeforeEnd(1)).kind,
  ).toBe('new');
});

test('with no night kept yet, a ready lesson is the first watch; once started or kept, it is an ordinary night', () => {
  const firstNight = review({
    streak: { ...review().streak, count: 0, best: 0, nights_total: 0 },
  });
  expect(
    todayState(
      {
        review: firstNight,
        importing: true,
        checked: { done: 12, total: 20 },
      },
      hoursBeforeEnd(12),
    ),
  ).toMatchObject({
    kind: 'first',
    start: { kind: 'lesson', href: '/practice?mode=lesson' },
    checked: { done: 12, total: 20 },
  });
  const started = { ...firstNight, lesson: { done: 1, total: 10 } };
  expect(todayState({ review: started }, hoursBeforeEnd(12)).kind).toBe(
    'returning',
  );
  // A streak that lapsed still counts its nights: not a first night.
  const lapsed = review({
    streak: { ...review().streak, count: 0, best: 4, nights_total: 4 },
  });
  expect(todayState({ review: lapsed }, hoursBeforeEnd(12)).kind).toBe('ready');
});

test('while the first import runs, analysis says how many games are checked', () => {
  const empty = review({ plan: [], lesson: { done: 0, total: 0 } });
  const input = { review: empty, accounts: 1, importing: true };
  expect(
    todayState(
      { ...input, checked: { done: 12, total: 20 } },
      hoursBeforeEnd(1),
    ),
  ).toMatchObject({ kind: 'processing', checked: { done: 12, total: 20 } });
  // Before the import knows its target, the count is unknown.
  expect(
    todayState({ ...input, checked: { done: 0, total: 0 } }, hoursBeforeEnd(1)),
  ).toMatchObject({ kind: 'processing', checked: null });
});

test('a home response with a malformed plan never reaches Today', () => {
  const plan = [{ kind: 'positions', done: false, count: -1, total: 8 }];
  expect(
    homeTodaySchema.safeParse({ today: { ...review(), plan } }).success,
  ).toBe(false);
  expect(homeTodaySchema.parse({ units: [], today: review() })).toEqual(
    review(),
  );
});

test('between Keep going steps, the review continues with the next unfinished step until none remain', () => {
  const plan = review().plan;
  const afterGame = dailyProgress(
    review({
      plan: plan.map((s) => (s.kind === 'game' ? { ...s, done: true } : s)),
    }),
  );
  expect(afterGame).toMatchObject({
    finished: false,
    next: { kind: 'positions', href: '/practice?mode=lesson' },
    minutes: 8,
  });
  const allDone = dailyProgress(
    review({ plan: plan.map((s) => ({ ...s, done: true })) }),
  );
  expect(allDone).toMatchObject({ finished: true, next: null });
  expect(dailyProgress(review({ plan: [] })).finished).toBe(false);
});

test('Done celebrates only a 7, 30, 100 or 365-night streak', () => {
  for (const count of [7, 30, 100, 365])
    expect(isStreakMilestone(count)).toBe(true);
  for (const count of [0, 1, 6, 8, 14, 20, 29, 31, 99, 101, 364, 366, 730])
    expect(isStreakMilestone(count)).toBe(false);
});

test('tonight’s night counts every night kept, all time, while the streak reads in a row', () => {
  const streak = { ...review().streak, nights_total: 16 };
  // 16 kept all time, 12 in a row: tonight is the 17th night.
  expect(tonightNight(streak)).toBe(17);
  // Once kept, tonight is the night just kept.
  expect(
    tonightNight({ ...streak, count: 13, safe_today: true, nights_total: 17 }),
  ).toBe(17);
  // An older server without the all-time count falls back to the streak.
  expect(tonightNight({ ...streak, nights_total: undefined })).toBe(13);
  expect(inARow(5)).toBe('5 in a row');
});
