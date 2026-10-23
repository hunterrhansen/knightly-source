import { practiceProgress } from './practice-progress';

const deck = (
  today: { done: number; total: number },
  puzzles?: { done: number; session: number; available: boolean },
) => ({ today, puzzles });

test('regular practice keeps one total from the first position to the last puzzle', () => {
  const start = practiceProgress({
    deck: deck({ done: 0, total: 6 }, { done: 0, session: 5, available: true }),
    lesson: false,
    answered: false,
  });
  const onPuzzles = practiceProgress({
    deck: deck({ done: 6, total: 6 }, { done: 2, session: 5, available: true }),
    lesson: false,
    answered: false,
  });
  expect(start).toEqual({ done: 0, total: 11 });
  // Moving on to puzzles keeps the total and carries the positions done.
  expect(onPuzzles).toEqual({ done: 8, total: 11 });
});

test('without puzzles to serve, only the positions and any puzzles already solved count', () => {
  expect(
    practiceProgress({
      deck: deck(
        { done: 2, total: 4 },
        { done: 0, session: 5, available: false },
      ),
      lesson: false,
      answered: false,
    }),
  ).toEqual({ done: 2, total: 4 });
  expect(
    practiceProgress({
      deck: deck(
        { done: 0, total: 0 },
        { done: 3, session: 5, available: false },
      ),
      lesson: false,
      answered: false,
    }),
  ).toEqual({ done: 3, total: 3 });
});

test('the lesson and an extra watch keep their own counts', () => {
  const full = {
    ...deck({ done: 1, total: 6 }, { done: 0, session: 5, available: true }),
    lesson: { done: 4, total: 10 },
    extra: { done: 2, total: 10, kept: 0 },
  };
  expect(
    practiceProgress({ deck: full, lesson: true, answered: false }),
  ).toEqual({ done: 4, total: 10 });
  expect(
    practiceProgress({
      deck: full,
      lesson: false,
      extra: true,
      answered: false,
    }),
  ).toEqual({ done: 2, total: 10 });
});

test('a saved answer counts before the deck refreshes, never past the total', () => {
  expect(
    practiceProgress({
      deck: deck({ done: 3, total: 6 }),
      lesson: false,
      answered: true,
    }),
  ).toEqual({ done: 4, total: 6 });
  expect(
    practiceProgress({
      deck: deck({ done: 6, total: 6 }),
      lesson: false,
      answered: true,
    }),
  ).toEqual({ done: 6, total: 6 });
  expect(
    practiceProgress({
      deck: deck({ done: 0, total: 0 }),
      lesson: false,
      answered: false,
    }),
  ).toBeUndefined();
});
