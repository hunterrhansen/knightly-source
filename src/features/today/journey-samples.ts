// Development samples only: the journey (`/api/journey`) for stories and tests.
import type { JourneyMap } from '../../lib/api/journey-contract';
import { addDays } from '../../ui';

const ranks = (reached: Record<string, string>): JourneyMap['ranks'] =>
  (
    [
      ['page', 'Page', null],
      ['squire-1', 'Squire I', 3],
      ['squire-2', 'Squire II', 6],
      ['squire-3', 'Squire III', 9],
      ['knight-1', 'Knight I', 12],
      ['knight-2', 'Knight II', 15],
      ['knight-3', 'Knight III', null],
    ] as const
  ).map(([key, name, post]) => ({
    key,
    name,
    post,
    reached_on: reached[key] ?? null,
  }));
const milestones = (reached: (string | null)[]) =>
  [7, 30, 100, 365].map((nights, i) => ({
    nights,
    reached_on: reached[i] ?? null,
  }));

/** The map today for every learner: a few nights kept, Page, no star yet. */
export const firstNights: JourneyMap = {
  stars: 0,
  rank: 'Page',
  rank_reached_on: '2026-10-12',
  next_rank: 'Squire I',
  next_post: 3,
  dimmed: 0,
  ranks: ranks({ page: '2026-10-12' }),
  star_list: [],
  nights: { total: 4, milestones: milestones([]) },
};

const FEN = 'r4rk1/pp3ppp/2n1b3/3q4/3N4/2P1B3/PP3PPP/R2Q1RK1 w - - 0 14';
type AheadMove = NonNullable<JourneyMap['ahead']>[number]['moves'][number];
const move = (
  ply: number,
  san: string,
  label: string,
  held: number,
  lastCheck = false,
): AheadMove => ({
  game_id: 7,
  ply,
  san,
  label,
  opponent: 'kd_88',
  color: 'white',
  fen: FEN,
  held,
  last_check: lastCheck,
});
const none = (date: string) => ({ date, due: 0, last_checks: 0, moves: [] });

/**
 * Four nights kept on their real dates (a gap after the second), an extra
 * watch on the fourth, and the schedule ahead from Wednesday Oct 14: what a
 * server since the path's schedule (build step 3) serves.
 */
export const scheduled: JourneyMap = {
  ...firstNights,
  rank_reached_on: '2026-10-09',
  ranks: ranks({ page: '2026-10-09' }),
  ahead: [
    {
      date: '2026-10-15',
      due: 6,
      last_checks: 0,
      moves: [move(21, 'Nf5', 'Fork', 2), move(23, 'Re1', 'Pin', 1)],
    },
    {
      date: '2026-10-16',
      due: 1,
      last_checks: 0,
      moves: [move(25, 'Nf5', 'Loose piece', 1)],
    },
    {
      date: '2026-10-17',
      due: 3,
      last_checks: 1,
      moves: [
        move(27, 'Qd4', 'Missed threat', 3, true),
        move(29, 'Bb5', 'Skewer', 1),
        move(31, 'h3', 'Your move 16', 0),
      ],
    },
    none('2026-10-18'),
    {
      date: '2026-10-19',
      due: 4,
      last_checks: 0,
      moves: [
        move(33, 'Bxf7', 'Fork', 2),
        move(35, 'Rd1', 'Pin', 1),
        move(37, 'e5', 'Loose piece', 1),
      ],
    },
    none('2026-10-20'),
    none('2026-10-21'),
  ],
  history: {
    nights: [
      { date: '2026-10-09', held: 6, slipped: 4, stopped: 0 },
      { date: '2026-10-10', held: 7, slipped: 3, stopped: 0 },
      { date: '2026-10-12', held: 8, slipped: 2, stopped: 0 },
      { date: '2026-10-13', held: 9, slipped: 1, stopped: 0 },
    ],
    extra: [{ date: '2026-10-13', held: 4, slipped: 1, stopped: 0 }],
  },
  first_star: {
    game_id: 7,
    ply: 27,
    san: 'Qd4',
    label: 'Missed threat',
    days: 7.4,
    target: 11,
    needs_family: false,
  },
};

/** The first night: nothing kept yet. */
export const noNights: JourneyMap = {
  ...firstNights,
  rank_reached_on: null,
  ranks: ranks({}),
  nights: { total: 0, milestones: milestones([]) },
};

const labels = ['Loose piece', 'Fork', 'Missed threat', 'Pin', 'Skewer'];
/** Weeks in: Squire II with 23 stars, one dimmed after a lapse. */
export const climbing: JourneyMap = {
  stars: 23,
  rank: 'Squire II',
  rank_reached_on: '2026-10-12',
  next_rank: 'Squire III',
  next_post: 9,
  dimmed: 1,
  ranks: ranks({
    page: '2026-08-10',
    'squire-1': '2026-09-24',
    'squire-2': '2026-10-12',
  }),
  star_list: Array.from({ length: 23 }, (_, i) => ({
    game_id: 100 + i,
    ply: 21 + i,
    san: 'Nf5',
    label: labels[i % labels.length] ?? 'Your move',
    earned_on: addDays('2026-09-14', i + Math.floor(i / 3)),
    dimmed: i === 20,
  })),
  nights: {
    total: 66,
    milestones: milestones(['2026-08-16', '2026-09-08']),
  },
};
