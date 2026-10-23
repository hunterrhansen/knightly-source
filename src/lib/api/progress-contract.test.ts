import { createApi } from './client';

const options = {
  baseUrl: 'https://api.example',
  getToken: async () => 'token',
  isCurrent: () => true,
};
const overview = {
  range: '30d',
  rating: { current: null, change: null, best: null },
  games_played: 0,
  games_analysed: 0,
  games_per_week: 0,
  rating_series: [],
  kpis: {
    blunders_per_game: 0,
    conversion: null,
    punish_rate: null,
    comeback_rate: 0,
    accuracy: null,
    opening_edge: null,
    analysed: 0,
  },
  previous_kpis: null,
  top_openings: [],
};
test('keeps zero distinct from missing analysis and rejects responses for another period', async () => {
  const api = createApi({
    ...options,
    fetcher: async () => new Response(JSON.stringify(overview)),
  });
  const data = await api.overview('30d');
  expect(data.kpis.blunders_per_game).toBe(0);
  expect(data.kpis.conversion).toBeNull();
  await expect(api.overview('90d')).rejects.toMatchObject({
    kind: 'invalid-response',
  });
});
test.each([
  {
    ...overview,
    rating_series: [
      {
        id: 1,
        played_at: 'not a date',
        rating: 900,
        opponent: null,
        outcome: null,
      },
    ],
  },
  { ...overview, kpis: { ...overview.kpis, conversion: 60 } },
  {
    ...overview,
    game_trend: {
      version: 1,
      window: 20,
      games: 40,
      reason: null,
      since: '2026-10-01T00:00:00Z',
      skills: ['tactics', 'safety', 'calculation'].map((key) => ({
        key,
        recent: 1,
        earlier: 2,
        cost: 1,
        change: null,
        practice: { recent: 0, earlier: 0 },
      })),
    },
  },
  {
    ...overview,
    top_openings: [
      {
        eco: 'C50',
        opening: 'Italian',
        color: 'white',
        games: 3,
        win_rate: -1,
      },
    ],
  },
])(
  'rejects unusable dates and out-of-range metrics before they reach account caches',
  async (body) => {
    const api = createApi({
      ...options,
      fetcher: async () => new Response(JSON.stringify(body)),
    });
    await expect(api.overview('30d')).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  },
);
test('sends the selected period and opening/color filters to the rated games endpoint', async () => {
  const urls: URL[] = [];
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      urls.push(new URL(new Request(input).url));
      return new Response(
        JSON.stringify({ total: 0, page: 1, page_size: 20, games: [] }),
      );
    },
  });
  await api.games(1, undefined, { range: '30d', q: 'C50', color: 'black' });
  expect(urls[0]?.searchParams.get('range')).toBe('30d');
  expect(urls[0]?.searchParams.get('q')).toBe('C50');
  expect(urls[0]?.searchParams.get('color')).toBe('black');
  expect(urls[0]?.searchParams.get('unrated')).toBe('false');
  await api.games(1);
  expect(urls[1]?.searchParams.get('unrated')).toBe('true');
});

test('library search, review status and slip scope include unrated games only when explicitly requested', async () => {
  const urls: URL[] = [];
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      urls.push(new URL(new Request(input).url));
      return new Response(
        JSON.stringify({ total: 0, page: 1, page_size: 50, games: [] }),
      );
    },
  });
  await api.games(2, undefined, {
    rated: 'all',
    review_status: 'reviewed',
    slips: 'clean',
    q: 'London',
    speed: 'rapid',
    result: 'win',
  });
  expect(urls[0]?.searchParams.get('unrated')).toBe('true');
  expect(urls[0]?.searchParams.get('review_status')).toBe('reviewed');
  expect(urls[0]?.searchParams.get('slips')).toBe('clean');
  expect(urls[0]?.searchParams.get('page')).toBe('2');
  expect(urls[0]?.searchParams.get('q')).toBe('London');
  expect(urls[0]?.searchParams.get('speed')).toBe('rapid');
  expect(urls[0]?.searchParams.get('result')).toBe('win');
  expect(urls[0]?.searchParams.has('rated')).toBe(false);
});
test('accepts mistake layer counts and rejects a negative count', async () => {
  const layers = {
    theirThreat: 4,
    theirReply: 2,
    calculation: 0,
    ownTactic: 1,
    other: 3,
    pending: 0,
  };
  const ok = createApi({
    ...options,
    fetcher: async () => new Response(JSON.stringify({ ...overview, layers })),
  });
  expect((await ok.overview('30d')).layers).toEqual(layers);
  const bad = createApi({
    ...options,
    fetcher: async () =>
      new Response(
        JSON.stringify({ ...overview, layers: { ...layers, theirReply: -1 } }),
      ),
  });
  await expect(bad.overview('30d')).rejects.toMatchObject({
    kind: 'invalid-response',
  });
});

test('accepts a null or missing skill shape and rejects axes out of their fixed order', async () => {
  const axis = (key: string) => ({
    key,
    score: null,
    reason: 'few_games',
    successes: 0,
    attempts: 0,
    games: 3,
    excluded: 0,
    parts: null,
    previous: null,
  });
  const keys = ['safety', 'tactics', 'calculation', 'converting', 'defending'];
  const respond = (skill_shape: unknown) =>
    createApi({
      ...options,
      fetcher: async () =>
        new Response(JSON.stringify({ ...overview, skill_shape })),
    }).overview('30d');
  expect((await respond(null)).skill_shape).toBeNull();
  expect(
    (await respond({ version: 1, axes: keys.map(axis) })).skill_shape?.axes,
  ).toHaveLength(5);
  await expect(
    respond({ version: 1, axes: [...keys].reverse().map(axis) }),
  ).rejects.toMatchObject({ kind: 'invalid-response' });
});
