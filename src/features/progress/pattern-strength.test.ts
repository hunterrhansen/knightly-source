import type { Patterns } from '../../lib/api/progress-contract';
import { patternRows, weakSpots } from './pattern-strength';

const tries = (pattern: string, attempts: number, first_try: number) => ({
  pattern,
  attempts,
  first_try,
  previous: null,
});
const missed = (pattern: string, total: number) => ({
  pattern,
  total,
  blunder: total,
  mistake: 0,
  miss: 0,
});
const names = (rows: { pattern: string }[]) => rows.map((r) => r.pattern);

test('a tactic with fewer than six first tries gets no rate and is weak only if it cost you games', () => {
  const data: Patterns = {
    range: '30d',
    pending: 0,
    patterns: [missed('skewer', 2)],
    strength: [tries('fork', 5, 0), tries('skewer', 2, 2), tries('pin', 10, 9)],
  };
  const rows = patternRows(data);
  expect(rows.find((r) => r.pattern === 'fork')?.rate).toBeNull();
  expect(rows.find((r) => r.pattern === 'pin')?.rate).toBe(0.9);
  // Five failed forks are not enough to call it weak; two skewer blunders are.
  expect(names(weakSpots(rows))).toEqual(['skewer']);
});

test('weak spots put the tactic costing most game mistakes first, then the lower first-try rate', () => {
  const data: Patterns = {
    range: '30d',
    pending: 0,
    patterns: [missed('fork', 4), missed('pin', 4), missed('mate', 1)],
    strength: [
      tries('fork', 10, 6),
      tries('pin', 10, 3),
      tries('mate', 10, 9),
      tries('skewer', 10, 2),
      tries('hangingPiece', 20, 18),
    ],
  };
  // Pin and fork tie on games; pin's 30% beats fork's 60%. Skewer was never a
  // game mistake but fails eight of ten in practice, below the 63% average.
  expect(names(weakSpots(patternRows(data)))).toEqual(['pin', 'fork', 'mate']);
  expect(names(weakSpots(patternRows(data), 5))).toEqual([
    'pin',
    'fork',
    'mate',
    'skewer',
  ]);
});
