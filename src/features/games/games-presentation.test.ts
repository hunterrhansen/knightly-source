import type { GameSummary } from '../../lib/api/import-contract';
import { groupGames, slipStatus, weekSummary } from './games-presentation';

const playedOn = (day: number, month = 10, year = 2026) =>
  ({
    id: day * 100 + month,
    played_at: new Date(year, month - 1, day, 18).toISOString(),
  }) as GameSummary;

test('game days read Today, Yesterday, then weekdays for the past week, then dates', () => {
  // Tuesday, 13 October 2026.
  const now = new Date(2026, 9, 13, 9);
  const titles = groupGames(
    [13, 12, 11, 8, 7, 6, 1]
      .map((day) => playedOn(day))
      .concat(playedOn(28, 12, 2025)),
    now,
  ).map((group) => group.title);
  expect(titles).toEqual([
    'Today',
    'Yesterday',
    'Sunday',
    'Thursday',
    'Wednesday',
    'October 6',
    'October 1',
    'December 28, 2025',
  ]);
});

test('a row names its slips by the earliest state, Clean when none slipped, and waits while unanalysed', () => {
  const row = (slips: GameSummary['slips'], analysed = true) =>
    slipStatus({ analysed, slips });
  expect(row({ on_watch: 3, held: 2, stopped: 1 })).toEqual({
    label: '3 on watch',
    tone: 'watch',
  });
  expect(row({ on_watch: 0, held: 2, stopped: 1 })).toEqual({
    label: '2 held',
    tone: 'held',
  });
  expect(row({ on_watch: 0, held: 0, stopped: 1 })).toEqual({
    label: '1 stopped slipping',
    tone: 'stopped',
  });
  expect(row({ on_watch: 0, held: 0, stopped: 0 })).toEqual({
    label: 'Clean',
    tone: 'clean',
  });
  expect(row(null, false)).toEqual({
    label: 'Checking for slips…',
    tone: 'pending',
  });
  // Servers from before the watch send no slips: the row keeps its review status.
  expect(row(undefined)).toBeUndefined();
});

test('the summary card is hidden until a game in the last seven days is analysed', () => {
  const week = {
    games: 3,
    analysed: 0,
    slipped: 0,
    on_watch: 0,
    held: 0,
    stopped: 0,
  };
  expect(weekSummary(undefined)).toBeUndefined();
  expect(weekSummary(week)).toBeUndefined();
  expect(
    weekSummary({
      ...week,
      analysed: 2,
      slipped: 4,
      on_watch: 2,
      held: 1,
      stopped: 1,
    }),
  ).toEqual({
    eyebrow: 'Last 7 days · 3 games',
    title: '4 moves slipped past you',
    chips: [
      { tone: 'watch', label: '2 on your watch' },
      { tone: 'held', label: '1 held' },
      { tone: 'stopped', label: '1 stopped slipping' },
    ],
  });
});
