import type { DailyReview } from '../../lib/api/today-contract';
import { sessionEnd } from './session-end';

const week = (today: 'today' | 'done') =>
  (
    [
      'done',
      'done',
      today,
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ] as const
  ).map((state, i) => ({ date: `2026-10-${12 + i}`, state }));
const review = (
  streak: { count: number; safe_today: boolean },
  { day = '2026-10-14', mastered = 0 } = {},
): DailyReview => ({
  day,
  day_ends_at: '2026-10-15T06:00:00Z',
  plan: [{ kind: 'positions', done: streak.safe_today, count: 0, total: 3 }],
  streak: {
    ...streak,
    best: 20,
    freezes: 0,
    week: week(streak.safe_today ? 'done' : 'today'),
  },
  lesson: { done: 0, total: 10 },
  memory: {
    total: 9,
    mastered: 2,
    learning: 4,
    new: 3,
    mastered_today: mastered,
  },
  learn_more: 0,
  tomorrow_due: 0,
  game: null,
  new_games: 0,
  puzzles: { theme: null, share: null },
});

test('the streak beat appears when the session made today count and the streak grew', () => {
  const end = sessionEnd(
    review({ count: 12, safe_today: false }),
    review({ count: 13, safe_today: true }),
  );
  expect(end.streak).toEqual({
    from: 12,
    to: 13,
    day: '2026-10-14',
    week: week('done'),
  });
});

test('no streak beat when today was already safe before the session', () => {
  expect(
    sessionEnd(
      review({ count: 13, safe_today: true }),
      review({ count: 14, safe_today: true }),
    ).streak,
  ).toBeNull();
});

test('no streak beat when the session did not make today count', () => {
  expect(
    sessionEnd(
      review({ count: 12, safe_today: false }),
      review({ count: 12, safe_today: false }),
    ).streak,
  ).toBeNull();
});

test('reads from different days, or a missing read, show no extra beats', () => {
  const after = review(
    { count: 1, safe_today: true },
    { day: '2026-10-15', mastered: 2 },
  );
  expect(sessionEnd(review({ count: 12, safe_today: false }), after)).toEqual(
    expect.objectContaining({ streak: null, mastered: 0 }),
  );
  expect(
    sessionEnd(undefined, review({ count: 13, safe_today: true })),
  ).toEqual(expect.objectContaining({ streak: null, mastered: 0 }));
});

test('positions moved to long-term memory count only those from this session', () => {
  expect(
    sessionEnd(
      review({ count: 13, safe_today: true }, { mastered: 1 }),
      review({ count: 13, safe_today: true }, { mastered: 3 }),
    ).mastered,
  ).toBe(2);
});

test("tomorrow's due reviews come from the read after the session", () => {
  const after = {
    ...review({ count: 13, safe_today: true }),
    tomorrow_due: 12,
  };
  expect(
    sessionEnd(review({ count: 12, safe_today: false }), after).tomorrowDue,
  ).toBe(12);
  expect(sessionEnd(undefined, after).tomorrowDue).toBe(12);
  expect(
    sessionEnd(review({ count: 12, safe_today: false }), undefined).tomorrowDue,
  ).toBe(0);
});

const journey = (stars: number, rank: string) => ({
  stars,
  rank,
  rank_reached_on: '2026-10-14',
  next_rank: rank === 'Page' ? 'Squire I' : 'Squire II',
  next_post: rank === 'Page' ? 3 : 6,
});
const withJourney = (stars: number, rank: string) => ({
  ...review({ count: 13, safe_today: true }),
  journey: journey(stars, rank),
});

test('a rank-up shows when the session reached a new rank, whatever the stars did', () => {
  // Ranks come from clearing posts: a new rank with no new star is this
  // session's, and names the post the next one waits on.
  expect(
    sessionEnd(withJourney(4, 'Page'), withJourney(4, 'Squire I')).rankUp,
  ).toEqual({ rank: 'Squire I', stars: 4, nextRank: 'Squire II', nextPost: 6 });
  // Stars alone never reach a rank.
  expect(
    sessionEnd(withJourney(8, 'Page'), withJourney(12, 'Page')).rankUp,
  ).toBeNull();
  // An older server sends no journey.
  expect(
    sessionEnd(
      review({ count: 13, safe_today: true }),
      withJourney(10, 'Squire I'),
    ).rankUp,
  ).toBeNull();
});
