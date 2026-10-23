import type { DailyReview } from '../../lib/api/today-contract';
import type { Tonight } from './today-screen';
import { type TodayState, todayState } from './today-state';

// Development sample data for stories and the shell lab, run through the real state logic.
const DAY_ENDS = '2026-10-14T06:00:00Z';
const hoursBefore = (hours: number) =>
  new Date(Date.parse(DAY_ENDS) - hours * 3_600_000);
/** A Monday-first sample week. Done days are numbered back from `lastNight`,
 * the latest one's night, as the backend numbers them; a miss ends the run. */
const week = (
  states: DailyReview['streak']['week'][number]['state'][],
  lastNight: number,
) => {
  let night: number | undefined = lastNight;
  const nights = [...states]
    .reverse()
    .map((state) => {
      if (state === 'missed') night = undefined;
      if (state !== 'done' || night === undefined) return null;
      return night--;
    })
    .reverse();
  return states.map((state, i) => ({
    date: `2026-10-${String(12 + i).padStart(2, '0')}`,
    state,
    night: nights[i] ?? null,
  }));
};

const base: DailyReview = {
  day: '2026-10-14',
  day_ends_at: DAY_ENDS,
  plan: [
    { kind: 'game', done: false },
    { kind: 'positions', done: false, count: 0, total: 8 },
    { kind: 'puzzles', done: false, count: 0, total: 5 },
  ],
  streak: {
    count: 12,
    best: 20,
    freezes: 1,
    safe_today: false,
    // All time: a broken run before this one, so the night is not the streak.
    nights_total: 16,
    week: week(
      ['done', 'done', 'today', 'upcoming', 'upcoming', 'upcoming', 'upcoming'],
      12,
    ),
  },
  lesson: { done: 0, total: 10 },
  focus: { key: 'safety', cost: 6.5, window: 20 },
  memory: {
    total: 142,
    mastered: 61,
    learning: 54,
    new: 27,
    mastered_today: 3,
    stopped_today: 3,
  },
  learn_more: 0,
  tomorrow_due: 6,
  game: {
    id: 42,
    opponent: 'dragonfly88',
    speed: 'rapid',
    outcome: 'loss',
    blunders: 1,
    mistakes: 2,
  },
  new_games: 2,
  puzzles: { theme: 'fork', share: 0.31 },
  journey: {
    stars: 23,
    rank: 'Squire II',
    rank_reached_on: '2026-10-10',
    next_rank: 'Squire III',
    next_post: 9,
  },
};
const safe = {
  ...base.streak,
  count: 13,
  nights_total: 17,
  safe_today: true,
  week: week(
    ['done', 'done', 'done', 'upcoming', 'upcoming', 'upcoming', 'upcoming'],
    13,
  ),
};
// The lesson done, with ten positions of twelve answered and the game left for Keep going.
const lessonDone = {
  lesson: { done: 10, total: 10 },
  plan: [
    { kind: 'game', done: false },
    { kind: 'positions', done: false, count: 10, total: 12 },
    { kind: 'puzzles', done: false, count: 0, total: 5 },
  ],
  streak: safe,
} satisfies Partial<DailyReview>;
const allDone = {
  ...lessonDone,
  plan: [
    { kind: 'game', done: true },
    { kind: 'positions', done: true, count: 12, total: 12 },
    { kind: 'puzzles', done: true, count: 5, total: 5 },
  ],
  // Today's queue is finished, so Learn more offers the pace's worth (Standard: 5).
  learn_more: 5,
} satisfies Partial<DailyReview>;

export const todaySamples = {
  Ready: todayState({ review: base, accounts: 1 }, hoursBefore(12)),
  Returning: todayState(
    { review: { ...base, lesson: { done: 4, total: 10 } }, accounts: 1 },
    hoursBefore(8),
  ),
  'At risk': todayState({ review: base, accounts: 1 }, hoursBefore(3)),
  // Last night's game, newly analysed: its slips lead tonight's watch.
  'New game': todayState(
    {
      review: {
        ...base,
        tonight: {
          slipped_recent: 1,
          cards: [],
          remaining: 9,
          game: {
            id: 42,
            opponent: 'dragonfly88',
            played_at: new Date(Date.now() - 86_400_000).toISOString(),
            slipped: 1,
          },
        },
      },
      accounts: 1,
    },
    hoursBefore(12),
  ),
  // No streak yet, and one that lapsed (the hero leads with starting one).
  'First night': todayState(
    {
      review: {
        ...base,
        streak: {
          ...base.streak,
          count: 0,
          best: 0,
          freezes: 0,
          nights_total: 0,
        },
      },
      accounts: 1,
    },
    hoursBefore(12),
  ),
  'Streak lost': todayState(
    {
      review: {
        ...base,
        streak: {
          ...base.streak,
          count: 0,
          freezes: 0,
          week: week(
            [
              'done',
              'missed',
              'today',
              'upcoming',
              'upcoming',
              'upcoming',
              'upcoming',
            ],
            5,
          ),
        },
      },
      accounts: 1,
    },
    hoursBefore(12),
  ),
  Done: todayState(
    { review: { ...base, ...lessonDone }, accounts: 1 },
    hoursBefore(6),
  ),
  'All done': todayState(
    { review: { ...base, ...allDone }, accounts: 1 },
    hoursBefore(2),
  ),
  // A 7-night streak is a milestone, so Done adds confetti.
  Milestone: todayState(
    {
      review: {
        ...base,
        ...allDone,
        streak: {
          ...safe,
          count: 7,
          best: 7,
          freezes: 1,
          week: week(
            [
              'done',
              'frozen',
              'done',
              'upcoming',
              'upcoming',
              'upcoming',
              'upcoming',
            ],
            7,
          ),
        },
      },
      accounts: 1,
    },
    hoursBefore(2),
  ),
  Rest: todayState(
    {
      review: {
        ...base,
        plan: [],
        lesson: { done: 0, total: 0 },
        streak: {
          ...base.streak,
          week: week(
            [
              'done',
              'done',
              'rest',
              'upcoming',
              'upcoming',
              'upcoming',
              'upcoming',
            ],
            12,
          ),
        },
      },
      accounts: 1,
    },
    hoursBefore(10),
  ),
  New: { kind: 'new' },
  Analyzing: {
    kind: 'processing',
    step: 'analysing',
    checked: { done: 12, total: 20 },
  },
  Loading: { kind: 'loading' },
  Error: {
    kind: 'error',
    message: 'Could not connect to Knightly. Check your connection.',
  },
} satisfies Record<string, TodayState>;

/** The streak popover's sample: a freeze used this week, below the best streak. */
export const sampleStreak: DailyReview['streak'] = {
  ...base.streak,
  freezes: 2,
  week: week(
    ['done', 'frozen', 'today', 'upcoming', 'upcoming', 'upcoming', 'upcoming'],
    12,
  ),
};

/** Tonight's moves (`today.tonight`) and answers, as the Watch page shows them. */
export const sampleTonight = {
  rows: [
    {
      gameId: 42,
      ply: 27,
      fen: 'r4rk1/pp3ppp/2n1b3/3q4/3N4/2P1B3/PP3PPP/R2Q1RK1 w - - 0 14',
      color: 'white',
      label: 'Fork · Nf5',
      day: 'yesterday',
      detail: 'vs dragonfly88 · yesterday',
      chip: 'New',
    },
  ],
  held: 9,
  slipped: 1,
  back: 'Thursday',
  stoppedLabels: ['Loose piece'],
} satisfies Tonight;
