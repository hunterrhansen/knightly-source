import { clocksAt, formatClock, startClock } from './player-clocks';

const ply = (n: number, clock_left: number | null) => ({
  ply: n,
  color: n % 2 ? ('white' as const) : ('black' as const),
  san: 'x',
  uci: 'e2e4',
  classification: null,
  best_san: null,
  best_uci: null,
  win_pct_before: null,
  win_pct_after: null,
  clock_left,
});
const game = {
  time_control: '600+5',
  plies: [ply(1, 603), ply(2, 598.4), ply(3, 571)],
};

test('each side shows its starting time until it moves, then the time left after its latest move', () => {
  expect(clocksAt(game, 0)).toEqual({ white: 600, black: 600 });
  expect(clocksAt(game, 1)).toEqual({ white: 603, black: 600 });
  expect(clocksAt(game, 2)).toEqual({ white: 603, black: 598.4 });
  expect(clocksAt(game, 3)).toEqual({ white: 571, black: 598.4 });
});

test('a game without recorded clocks shows none, and daily games have no starting time', () => {
  expect(
    clocksAt(
      { ...game, plies: game.plies.map((p) => ({ ...p, clock_left: null })) },
      2,
    ),
  ).toBeUndefined();
  expect(startClock('1/259200')).toBeNull();
  expect(startClock('180')).toBe(180);
});

test('clocks read like Chess.com: minutes, hours, and tenths under 20 seconds', () => {
  expect(formatClock(298.3)).toBe('4:58');
  expect(formatClock(3723)).toBe('1:02:03');
  expect(formatClock(20)).toBe('0:20');
  expect(formatClock(9.87)).toBe('0:09.8');
  expect(formatClock(-1)).toBe('0:00.0');
});
