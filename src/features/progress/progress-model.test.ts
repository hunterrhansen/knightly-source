import type { GameTrend } from '../../lib/api/progress-contract';
import {
  blunderTrend,
  currentRun,
  focusFor,
  lastFourWeeks,
  localToday,
  skillAxes,
  trendRows,
  weakestAxis,
} from './progress-model';

test('the four weeks end today, oldest first; unknown days stay blank and today stays open', () => {
  const cells = lastFourWeeks({ '2026-10-15': 'done' }, '2026-10-16');
  expect(cells).toHaveLength(28);
  expect(cells[0]).toEqual({ id: '2026-09-19', state: 'none' });
  expect(cells[26]).toEqual({ id: '2026-10-15', state: 'done' });
  expect(cells[27]).toEqual({ id: '2026-10-16', state: 'today' });
});

test('the run counts practiced and frozen nights, not breaking on an open today', () => {
  const states = ['done', 'missed', 'done', 'frozen', 'done', 'today'] as const;
  expect(currentRun(states.map((state) => ({ state })))).toBe(3);
  expect(currentRun([{ state: 'done' }, { state: 'missed' }])).toBe(0);
});

test('fewer blunders is good news; more, or no earlier month, is not', () => {
  expect(blunderTrend(1.8, 2.4)).toEqual({
    better: true,
    text: 'Blunders are down 25% from the 30 days before.',
  });
  expect(blunderTrend(2.4, 2)?.better).toBe(false);
  expect(blunderTrend(1.8, null)).toBeNull();
  expect(blunderTrend(1.8, 0)).toBeNull();
});

test('an older server without a skill shape gives five unscored axes and no weakest', () => {
  const axes = skillAxes(undefined);
  expect(axes.map((axis) => axis.key)).toEqual([
    'safety',
    'tactics',
    'calculation',
    'converting',
    'defending',
  ]);
  expect(axes.every((axis) => axis.score === null)).toBe(true);
  expect(weakestAxis(axes)).toBeNull();
});

test('the weakest axis is the lowest score, ignoring unscored axes; ties keep the fixed order', () => {
  const axes = skillAxes(undefined).map((axis, index) => ({
    ...axis,
    score: [null, 40, 40, 70, 55][index] ?? null,
  }));
  expect(weakestAxis(axes)?.key).toBe('tactics');
});

test('the local day is the device calendar date', () => {
  expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
});

const trend = (
  safety: Partial<GameTrend['skills'][number]>,
  reason: GameTrend['reason'] = null,
): GameTrend => ({
  version: 1,
  window: reason ? 0 : 20,
  games: reason ? 12 : 40,
  reason,
  since: reason ? null : '2026-09-20T00:00:00Z',
  skills: (['safety', 'tactics', 'calculation'] as const).map((key) => ({
    key,
    recent: 0,
    earlier: 0,
    cost: null,
    change: null,
    practice: { recent: 0, earlier: 0 },
    ...(key === 'safety' ? safety : {}),
  })),
});
const kpis = {
  blunders_per_game: 1,
  conversion: null,
  punish_rate: null,
  comeback_rate: null,
  accuracy: null,
  opening_edge: null,
  analysed: 40,
};
const layers = {
  theirThreat: 6,
  theirReply: 0,
  calculation: 0,
  ownTactic: 4,
  other: 0,
  pending: 0,
};
const safetyEvidence = (game_trend: GameTrend | undefined) =>
  focusFor('safety', { kpis, layers, game_trend }, '90d').evidence;

test('the safety focus reports the in-game trend, worded by the change the server called', () => {
  const practice = { recent: 64, earlier: 3 };
  expect(
    safetyEvidence(
      trend({ recent: 16, earlier: 28, change: 'fewer', practice }),
    ),
  ).toBe(
    'In your last 20 games: 0.8 missed threats a game, down from 1.4, with 64 positions practiced.',
  );
  expect(
    safetyEvidence(
      trend({ recent: 30, earlier: 28, change: 'same', practice }),
    ),
  ).toBe(
    'In your last 20 games: 1.5 missed threats a game, about the same as the 20 before, with 64 positions practiced.',
  );
  expect(
    safetyEvidence(
      trend({
        recent: 40,
        earlier: 20,
        change: 'more',
        practice: { recent: 1, earlier: 0 },
      }),
    ),
  ).toBe(
    'In your last 20 games: 2.0 missed threats a game, up from 1.0, with 1 position practiced.',
  );
});

test('without a trend to report, the safety focus keeps the share of your mistakes', () => {
  const share =
    '6 of your 10 mistakes missed what your opponent was threatening.';
  expect(safetyEvidence(undefined)).toBe(share);
  expect(safetyEvidence(trend({ recent: 1, earlier: 2, change: null }))).toBe(
    share,
  );
  expect(safetyEvidence(trend({}, 'few_games'))).toBe(share);
});

test('trend rows show a change only when the server calls one, lower being better', () => {
  const rows = trendRows(
    trend({
      recent: 16,
      earlier: 28,
      change: 'fewer',
      practice: { recent: 0, earlier: 0 },
    }),
  );
  expect(rows[0]).toMatchObject({
    label: 'Missed threats',
    value: '0.8',
    hint: 'None practiced',
  });
  expect(rows[0]?.change).toBeCloseTo(-0.6);
  expect(rows[1]).toMatchObject({ label: 'Missed tactics', change: null });
});
