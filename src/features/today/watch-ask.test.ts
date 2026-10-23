import { keptWatchTime, watchAskDue } from './watch-ask';

const due = (over: Partial<Parameters<typeof watchAskDue>[0]> = {}): boolean =>
  watchAskDue({
    watch: null,
    streakTo: 1,
    day: '2026-10-18',
    ask: { skips: 0, last_skipped: null },
    ...over,
  });

test('the first watch kept without a watch set asks for one', () => {
  expect(due()).toBe(true);
  expect(
    due({ watch: { time: '20:00', anchor: 'finish dinner', set_on: 'x' } }),
  ).toBe(false);
  // An older server that doesn't say whether a watch is set never asks.
  expect(due({ watch: undefined })).toBe(false);
});

test('after one skip it asks once more, from three nights and two nights later', () => {
  const skipped = { skips: 1, last_skipped: '2026-10-18' };
  expect(due({ ask: skipped, streakTo: 3, day: '2026-10-19' })).toBe(false);
  expect(due({ ask: skipped, streakTo: 2, day: '2026-10-21' })).toBe(false);
  expect(due({ ask: skipped, streakTo: 3, day: '2026-10-20' })).toBe(true);
  expect(
    due({
      ask: { skips: 2, last_skipped: '2026-10-01' },
      streakTo: 30,
      day: '2026-10-31',
    }),
  ).toBe(false);
});

test('the preselected time is when the watch was kept, to the nearest 15 minutes', () => {
  const at = (h: number, m: number, s = 0) => new Date(2026, 9, 18, h, m, s);
  expect(keptWatchTime(at(20, 40))).toBe('20:45');
  expect(keptWatchTime(at(20, 37))).toBe('20:30');
  // A tie goes later.
  expect(keptWatchTime(at(20, 37, 30))).toBe('20:45');
  // Across midnight.
  expect(keptWatchTime(at(23, 53))).toBe('00:00');
});
