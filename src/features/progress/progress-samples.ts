// Development samples only: Storybook data, no backend reads or writes.
import type { Overview, Patterns } from '../../lib/api/progress-contract';
import type { StreakDays, StreakNights } from '../../ui';
import { addDays } from '../../ui';

export const sampleToday = '2026-10-16';

/** A rating walking from `from` to `to` over `games`, one game every
 * `spacing` days ending on the sample today. */
function series(games: number, from: number, to: number, spacing = 1.5) {
  const end = Date.parse(`${sampleToday}T20:00:00Z`);
  return Array.from({ length: games }, (_, i) => {
    const t = games === 1 ? 1 : i / (games - 1);
    const wobble =
      i === 0 || i === games - 1
        ? 0
        : 7 * Math.sin(i * 1.7) + 4 * Math.sin(i * 0.45);
    return {
      id: i + 1,
      played_at: new Date(
        end - (games - 1 - i) * spacing * 86_400_000,
      ).toISOString(),
      rating: Math.round(from + (to - from) * t + wobble),
      opponent: ['dragonfly88', 'knightowl', 'pawnstorm'][i % 3] ?? null,
      outcome: 'win',
    };
  });
}

const kpis = {
  blunders_per_game: 1.8,
  conversion: 0.71,
  punish_rate: 0.58,
  comeback_rate: 0.44,
  accuracy: 78,
  opening_edge: 32,
  analysed: 40,
};
const axis = (
  key: 'safety' | 'tactics' | 'calculation' | 'converting' | 'defending',
  score: number,
  previous: number,
) => ({
  key,
  score,
  reason: null,
  successes: score,
  attempts: 100,
  games: 40,
  excluded: 2,
  previous: {
    score: previous,
    reason: null,
    successes: previous,
    attempts: 100,
    games: 38,
    excluded: 1,
  },
});

export const improving: Overview = {
  range: '90d',
  rating: { current: 929, change: 49, best: 941 },
  games_played: 60,
  games_analysed: 40,
  games_per_week: 4.7,
  rating_series: series(60, 880, 929),
  kpis,
  previous_kpis: {
    ...kpis,
    blunders_per_game: 2.4,
    accuracy: 75,
    conversion: 0.7,
    comeback_rate: 0.4,
    punish_rate: 0.6,
  },
  phase_accuracy: {
    current: {
      opening: { accuracy: 81, moves: 400, games: 40 },
      middlegame: { accuracy: 75, moves: 800, games: 40 },
      endgame: { accuracy: 69, moves: 160, games: 22 },
    },
    previous: {
      opening: { accuracy: 80, moves: 380, games: 38 },
      middlegame: { accuracy: 73, moves: 760, games: 38 },
      endgame: { accuracy: null, moves: 40, games: 8 },
    },
  },
  layers: {
    theirThreat: 4,
    theirReply: 2,
    calculation: 1,
    ownTactic: 2,
    other: 1,
    pending: 0,
  },
  skill_shape: {
    version: 1,
    axes: [
      axis('safety', 34, 26),
      axis('tactics', 62, 58),
      axis('calculation', 51, 49),
      axis('converting', 71, 70),
      axis('defending', 44, 40),
    ],
  },
  game_trend: {
    version: 1,
    window: 20,
    games: 52,
    reason: null,
    since: '2026-09-21T18:04:00Z',
    skills: [
      {
        key: 'safety',
        recent: 16,
        earlier: 28,
        cost: 9.4,
        change: 'fewer',
        practice: { recent: 64, earlier: 12 },
      },
      {
        key: 'tactics',
        recent: 9,
        earlier: 11,
        cost: 4.1,
        change: 'same',
        practice: { recent: 30, earlier: 22 },
      },
      {
        key: 'calculation',
        recent: 3,
        earlier: 2,
        cost: 1.2,
        change: null,
        practice: { recent: 4, earlier: 1 },
      },
    ],
  },
  time_management: {
    policy: '10+0-descriptive-v1',
    control: '600+0',
    analysis_versions: ['sample'],
    analysed_games: 38,
    timed_decisions: 1400,
    excluded_decisions: 0,
    pressure: {
      numerator: 98,
      decisions: 1400,
      games: 38,
      rate: 0.07,
      reason: null,
      examples: [],
    },
    fast: {
      numerator: 4,
      decisions: 60,
      games: 41,
      rate: null,
      reason: 'insufficient_sample',
      examples: [],
    },
    long: {
      numerator: 6,
      decisions: 80,
      games: 30,
      rate: null,
      reason: 'insufficient_sample',
      examples: [],
    },
    timeouts: { losses: 2, games: 38, examples: [] },
  },
  top_openings: [
    {
      eco: 'C50',
      opening: 'Italian Game',
      color: 'white',
      games: 14,
      win_rate: 0.57,
    },
    {
      eco: 'B20',
      opening: 'Sicilian Defense',
      color: 'black',
      games: 9,
      win_rate: 0.44,
    },
  ],
};

export const dip: Overview = {
  ...improving,
  range: '30d',
  rating: { current: 902, change: -27, best: 941 },
  rating_series: series(24, 929, 902),
};

export const newPlayer: Overview = {
  ...improving,
  rating: { current: 812, change: null, best: 812 },
  games_played: 3,
  games_analysed: 3,
  rating_series: series(3, 806, 812, 1),
  kpis: { ...kpis, blunders_per_game: null, analysed: 3 },
  previous_kpis: null,
  skill_shape: undefined,
  layers: undefined,
  game_trend: {
    version: 1,
    window: 0,
    games: 3,
    reason: 'few_games',
    since: null,
    skills: (['safety', 'tactics', 'calculation'] as const).map((key) => ({
      key,
      recent: 0,
      earlier: 0,
      cost: null,
      change: null,
      practice: { recent: 0, earlier: 0 },
    })),
  },
  time_management: undefined,
  top_openings: [],
};

/** Many games, for chart density. */
export const manyGames: Overview = {
  ...improving,
  range: 'all',
  rating_series: series(2000, 666, 929, 0.2),
};

export const recentImproving = {
  kpis,
  previous_kpis: { ...kpis, blunders_per_game: 2.4 },
};
export const recentDip = {
  kpis: { ...kpis, blunders_per_game: 2 },
  previous_kpis: { ...kpis, blunders_per_game: 2.3 },
};

/** Four weeks of moons from a pattern: d practiced, f frozen, x missed. Done
 * days are numbered oldest first, as the backend numbers their nights. */
export function sampleHabit(pattern: string): {
  days: StreakDays;
  nights: StreakNights;
} {
  const days: Record<string, 'done' | 'frozen' | 'missed'> = {};
  const nights: Record<string, number> = {};
  let night = 0;
  [...pattern].forEach((c, i) => {
    const id = addDays(sampleToday, i - pattern.length);
    days[id] = c === 'd' ? 'done' : c === 'f' ? 'frozen' : 'missed';
    if (c === 'd') nights[id] = ++night;
    else if (c === 'x') night = 0;
  });
  return { days, nights };
}

export const samplePatterns: Patterns = {
  range: '90d',
  deck_health: {
    forecast: [14, 6, 9, 0, 11, 5, 7].map((due, i) => ({
      date: `2026-10-${String(16 + i).padStart(2, '0')}`,
      due,
    })),
    retention: { rate: 0.87, answers: 212, target: 0.9 },
    tuned: true,
    noticing: { rate: 0.61, answers: 34 },
  },
  patterns: [
    { pattern: 'fork', total: 6, blunder: 4, mistake: 1, miss: 1 },
    { pattern: 'hangingPiece', total: 4, blunder: 3, mistake: 1, miss: 0 },
  ],
  pending: 0,
  strength: [
    ['fork', 22, 9],
    ['hangingPiece', 25, 12],
    ['pin', 14, 8],
    ['discoveredAttack', 8, 5],
    ['backRankMate', 19, 14],
    ['skewer', 4, 3],
  ].map(([pattern, attempts, first_try]) => ({
    pattern: String(pattern),
    attempts: Number(attempts),
    first_try: Number(first_try),
    previous: null,
  })),
};
