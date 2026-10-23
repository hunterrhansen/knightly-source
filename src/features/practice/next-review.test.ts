import { nextReviewLine, savedRating } from './next-review';

const today = '2026-10-16';
const line = (
  due: string,
  more: Partial<Parameters<typeof nextReviewLine>[0]> = {},
) =>
  nextReviewLine({
    rating: 'good',
    due,
    today,
    mastered: false,
    wasMastered: false,
    ...more,
  });

test('each row of the copy table', () => {
  expect(line('2026-10-17', { rating: 'again' })).toBe('Back tomorrow.');
  expect(line('2026-10-17')).toBe('Back tomorrow.');
  expect(line('2026-10-18')).toBe('Back in 2 days.');
  expect(line('2026-11-14')).toBe('Back in 29 days.');
  expect(line('2026-11-15')).toBe('Back in about 4 weeks.');
  expect(line('2027-01-15')).toBe('Back in about 3 months.');
  expect(line('2026-12-20', { mastered: true })).toBe(
    'In long-term memory. Back in about 2 months.',
  );
  // Already long-term: just when it comes back.
  expect(line('2027-01-15', { mastered: true, wasMastered: true })).toBe(
    'Back in about 3 months.',
  );
});

test('a quick exact find is saved as Easy, as the server decides', () => {
  expect(savedRating('good', 'best', 1, 6)).toBe('easy');
  expect(savedRating('good', 'best', 2, 25)).toBe('good');
  expect(savedRating('good', 'excellent', 1, 2)).toBe('good');
  expect(savedRating('hard', 'good', 1, 2)).toBe('hard');
});
