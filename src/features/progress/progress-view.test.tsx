import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Overview } from '../../lib/api/progress-contract';
import { climbing, firstNights, scheduled } from '../today/today-api';
import { ProgressView, type ProgressViewProps } from './progress-view';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ canGoBack: () => true, push: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('./chart-surface', () => ({ ChartSurface: () => null }));

const kpis = {
  blunders_per_game: 1.8,
  conversion: 0.71,
  punish_rate: 0.58,
  comeback_rate: 0.44,
  accuracy: 78,
  opening_edge: null,
  analysed: 40,
};
const series = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  played_at: `2026-10-0${i + 1}T12:00:00Z`,
  rating: 900 + i,
  opponent: 'dragonfly88',
  outcome: 'win',
}));
const overview: Overview = {
  range: '90d',
  rating: { current: 929, change: 49, best: 941 },
  games_played: 40,
  games_analysed: 40,
  games_per_week: 3,
  rating_series: series,
  kpis,
  previous_kpis: { ...kpis, blunders_per_game: 2.4 },
  top_openings: [],
  layers: {
    theirThreat: 4,
    theirReply: 2,
    calculation: 1,
    ownTactic: 2,
    other: 1,
    pending: 0,
  },
};
const sample = (score: number | null, previous: number | null) => ({
  score,
  reason: score == null ? ('few_games' as const) : null,
  successes: 0,
  attempts: 0,
  games: 40,
  excluded: 0,
  previous:
    previous == null
      ? null
      : {
          score: previous,
          reason: null,
          successes: 0,
          attempts: 0,
          games: 40,
          excluded: 0,
        },
});
const shaped: Overview = {
  ...overview,
  skill_shape: {
    version: 1,
    axes: [
      { key: 'safety', ...sample(34, 26) },
      { key: 'tactics', ...sample(62, 58) },
      { key: 'calculation', ...sample(51, 49) },
      { key: 'converting', ...sample(71, 70) },
      { key: 'defending', ...sample(44, 40) },
    ],
  },
};

const resource = { error: null, isFetching: false, refetch: jest.fn() };
const recent: Overview = {
  ...overview,
  kpis: { ...overview.kpis, blunders_per_game: 1.4 },
  previous_kpis: { ...overview.kpis, blunders_per_game: 2.1 },
};
const onOpen = jest.fn();
const props = (over: Partial<ProgressViewProps> = {}): ProgressViewProps => ({
  journey: { ...resource, data: firstNights },
  range: '90d',
  onRange: jest.fn(),
  overview: { ...resource, data: overview },
  patterns: resource,
  habit: {
    today: '2026-10-16',
    days: {},
    recent: { ...resource, data: recent },
  },
  onTheirWay: 14,
  onOpen,
  ...over,
});
/** Every section from a whole overview, as the old All stats tests built. */
const stats = (data: Overview, over: Partial<ProgressViewProps> = {}) =>
  props({
    overview: { ...resource, data },
    habit: { today: '2026-10-16', days: {}, recent: { ...resource, data } },
    ...over,
  });

beforeEach(() => onOpen.mockReset());

test('Progress is one sheet: rank, is it working, nights, your game and your memory, in that order', () => {
  render(
    <ProgressView
      {...props({
        journey: {
          ...resource,
          data: { ...climbing, moves: { on_watch: 5, held: 9, stopped: 23 } },
        },
        streak: {
          count: 5,
          best: 12,
          freezes: 1,
          safe_today: true,
          week: [],
          nights_total: 13,
        },
        patterns: {
          ...resource,
          data: {
            range: '90d',
            patterns: [],
            pending: 0,
            deck_health: {
              forecast: Array.from({ length: 7 }, (_, i) => ({
                date: `2026-10-${16 + i}`,
                due: i,
              })),
              retention: null,
              tuned: false,
            },
          } as never,
        },
      })}
    />,
  );
  const headings = screen
    .getAllByRole('header')
    .map((node) => node.props.children)
    .filter((text) =>
      [
        'Your rank',
        'Is it working?',
        'Nights',
        'Your game',
        'Your memory',
      ].includes(text),
    );
  expect(headings).toEqual([
    'Your rank',
    'Is it working?',
    'Nights',
    'Your game',
    'Your memory',
  ]);
  // Your rank: the emblem's chip and the stars to the next rank.
  expect(screen.getByText('Squire II · ★ 23')).toBeTruthy();
  expect(screen.getByText('Clear post 9 for Squire III')).toBeTruthy();
  // Nights: all time, in a row, the best run and freezes.
  expect(screen.getByLabelText('13 nights kept')).toBeTruthy();
  expect(screen.getByLabelText('5 in a row')).toBeTruthy();
  expect(screen.getByLabelText('12 best run')).toBeTruthy();
  expect(screen.getByLabelText('1 freeze')).toBeTruthy();
  // Your memory: your moves by where they are on the watch, and coming up.
  expect(
    screen.getByLabelText('5 on watch, 9 held, 23 stopped slipping'),
  ).toBeTruthy();
  expect(screen.getByText('Coming up')).toBeTruthy();
  // All stats is folded in: no separate page to open.
  expect(screen.queryByText(/Opens All stats/)).toBeNull();
});

test('with no star yet Progress reads as early, not empty: Page and the first star card, and no map', () => {
  render(<ProgressView {...props()} />);
  expect(screen.getByLabelText(/^Rank Page, 0 stars\./)).toBeTruthy();
  expect(screen.getByText('Your first star')).toBeTruthy();
  expect(screen.getByText('14 moves are on their way now.')).toBeTruthy();
  // The map of nights moved to the home path.
  expect(screen.queryByLabelText(/^Night \d+/)).toBeNull();
});

test('before the first star, the card shows the held move closest to 11 days as progress toward it', () => {
  render(
    <ProgressView {...props({ journey: { ...resource, data: scheduled } })} />,
  );
  expect(screen.getByText('Closest: Missed threat · Qd4')).toBeTruthy();
  // 7.4 days reads as 7: never as the bar before it is reached.
  expect(
    screen.getByLabelText('Missed threat Qd4 holds 7 of 11 days').props
      .accessibilityValue,
  ).toEqual({ min: 0, max: 11, now: 7.4 });
  expect(
    screen.getByText('Holds 7 of 11 days. Each Good answer stretches it.'),
  ).toBeTruthy();
  screen.unmount();
  // Past the bar on its schedule, a tactic still needs a puzzle of its own.
  const owed = {
    ...scheduled,
    first_star: {
      ...(scheduled.first_star as NonNullable<typeof scheduled.first_star>),
      days: 11,
      needs_family: true,
    },
  };
  render(<ProgressView {...props({ journey: { ...resource, data: owed } })} />);
  expect(
    screen.getByText(
      'Holds 11 of 11 days. Solve one puzzle of its tactic to earn the star.',
    ),
  ).toBeTruthy();
  screen.unmount();
  // From an older server, or with nothing held yet, the card explains stars only.
  render(<ProgressView {...props()} />);
  expect(screen.queryByText(/^Closest:/)).toBeNull();
});

test('a lapsed star is counted as dimmed and back on the watch while the rank chip keeps every star', () => {
  render(
    <ProgressView {...props({ journey: { ...resource, data: climbing } })} />,
  );
  expect(screen.getByText('Squire II · ★ 23')).toBeTruthy();
  expect(screen.getByText('1 dimmed · back on your watch')).toBeTruthy();
  expect(screen.queryByText('Your first star')).toBeNull();
});

test('the proof row compares blunders per game with the 30 days before', () => {
  render(<ProgressView {...props()} />);
  expect(screen.getByText('2.1 → 1.4')).toBeTruthy();
  expect(screen.getByLabelText('Blunders per game, 2.1 to 1.4')).toBeTruthy();
});

test('a rank that fails to load offers a retry and keeps the proof row', () => {
  const refetch = jest.fn();
  render(
    <ProgressView
      {...props({
        journey: { ...resource, error: new Error('Not found'), refetch },
      })}
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Retry your rank' }));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText('2.1 → 1.4')).toBeTruthy();
});

test('loaded ratings stay visible during a background refresh; a failed refresh offers a retry without losing them', () => {
  const refetch = jest.fn();
  const base = stats(overview);
  const view = render(<ProgressView {...base} />);
  expect(screen.getByText('929')).toBeTruthy();
  view.rerender(
    <ProgressView
      {...base}
      overview={{ ...base.overview, isFetching: true }}
    />,
  );
  expect(screen.getByText('929')).toBeTruthy();
  expect(screen.queryByText(/Loading your rating/)).toBeNull();
  view.rerender(
    <ProgressView
      {...base}
      overview={{
        ...base.overview,
        error: new Error('Connection lost'),
        refetch,
      }}
    />,
  );
  expect(screen.getByText('929')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry your rating' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('the lowest score is named weakest with evidence from your games, and its button trains it', () => {
  render(<ProgressView {...stats(shaped)} />);
  expect(screen.getByLabelText(/Safety 34, weakest/)).toBeTruthy();
  expect(screen.getByText('Check their threat first')).toBeTruthy();
  // 4 their-threat + 2 their-reply of 10 settled mistakes (pending excluded).
  expect(
    screen.getByText(
      '6 of your 10 mistakes missed what your opponent was threatening.',
    ),
  ).toBeTruthy();
  fireEvent.press(
    screen.getByRole('button', { name: 'Practice their threats' }),
  );
  expect(onOpen).toHaveBeenCalledWith('/practice');
});

test('without enough analysed games the shape is locked with a count, never a zero score', () => {
  render(<ProgressView {...stats({ ...overview, games_analysed: 3 })} />);
  expect(
    screen.getByText('Your game’s shape appears after 10 analyzed games'),
  ).toBeTruthy();
  expect(screen.getByLabelText('3 of 10 games analyzed')).toBeTruthy();
  expect(
    screen.queryByLabelText(
      /^(Safety|Tactics|Calculation|Converting|Defending) \d/,
    ),
  ).toBeNull();
  expect(screen.queryByText(/weakest/)).toBeNull();
});

test('a falling rating is explained by the habit when blunders still fall', () => {
  render(
    <ProgressView
      {...stats({
        ...overview,
        rating: { current: 902, change: -27, best: 941 },
      })}
    />,
  );
  expect(
    screen.getByText(
      'Ratings swing week to week. Your blunders are still falling.',
    ),
  ).toBeTruthy();
  expect(
    screen.getByText('Blunders are down 25% from the 30 days before.'),
  ).toBeTruthy();
});

test('with fewer than five rated games the rating shows a count instead of a change', () => {
  render(
    <ProgressView
      {...stats({ ...overview, rating_series: series.slice(0, 3) })}
    />,
  );
  expect(screen.getByText('3 rated games')).toBeTruthy();
  expect(screen.queryByLabelText(/Up 49/)).toBeNull();
});
