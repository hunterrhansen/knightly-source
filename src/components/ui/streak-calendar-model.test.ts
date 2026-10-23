import {
  dayState,
  step,
  visibleRange,
  weekdayLetters,
  weekStartOf,
} from './streak-calendar-model';

const today = '2026-10-16'; // Friday

test('weeks start on the Sunday or Monday on or before a day', () => {
  expect(weekStartOf(today, 'sunday')).toBe('2026-10-11');
  expect(weekStartOf(today, 'monday')).toBe('2026-10-12');
  // A Sunday starts its own Sunday-first week but ends a Monday-first one.
  expect(weekStartOf('2026-10-18', 'sunday')).toBe('2026-10-18');
  expect(weekStartOf('2026-10-18', 'monday')).toBe('2026-10-12');
  // A Monday ends a Sunday-first week's second day.
  expect(weekStartOf('2026-10-12', 'sunday')).toBe('2026-10-11');
  expect(weekStartOf('2026-10-12', 'monday')).toBe('2026-10-12');
});

test('column letters start on the chosen day', () => {
  expect(weekdayLetters('sunday')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  expect(weekdayLetters('monday')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
});

test('previous and next move by whole weeks and stop at the week holding today', () => {
  expect(step(today, -1, false, today, 'monday')).toBe('2026-10-05');
  expect(step('2026-10-05', 1, false, today, 'monday')).toBe('2026-10-12');
  expect(step(today, 1, false, today, 'monday')).toBeUndefined();
  expect(step(today, -1, false, today, 'sunday')).toBe('2026-10-04');
  expect(step('2026-10-04', 1, false, today, 'sunday')).toBe('2026-10-11');
  expect(step(today, 1, false, today, 'sunday')).toBeUndefined();
});

test('open, they move by month, focus today in its month and stop there', () => {
  expect(step(today, -1, true, today, 'sunday')).toBe('2026-09-01');
  expect(step('2026-09-01', 1, true, today, 'sunday')).toBe(today);
  expect(step(today, 1, true, today, 'sunday')).toBeUndefined();
});

test('the week and open month span whole weeks from the chosen first day', () => {
  expect(visibleRange(today, false, 'monday')).toEqual({
    start: '2026-10-12',
    end: '2026-10-18',
  });
  expect(visibleRange(today, true, 'monday')).toEqual({
    start: '2026-09-28',
    end: '2026-11-01',
  });
  expect(visibleRange(today, false, 'sunday')).toEqual({
    start: '2026-10-11',
    end: '2026-10-17',
  });
  expect(visibleRange(today, true, 'sunday')).toEqual({
    start: '2026-09-27',
    end: '2026-10-31',
  });
});

test('days without history are blank before today and upcoming after it', () => {
  expect(dayState('2026-10-10', today, {})).toBe('none');
  expect(dayState(today, today, {})).toBe('today');
  expect(dayState('2026-10-17', today, {})).toBe('upcoming');
  expect(dayState('2026-10-10', today, { '2026-10-10': 'frozen' })).toBe(
    'frozen',
  );
});
