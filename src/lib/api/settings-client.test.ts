import { createSessionScope } from '../auth/session-scope';
import { createApi } from './client';

const options = {
  baseUrl: 'https://api.example',
  getToken: async () => 'token',
  isCurrent: () => true,
};

test('analysis acknowledges the requested depth; a mismatched success is rejected', async () => {
  const sent: unknown[] = [];
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      const request = new Request(input);
      sent.push(await request.json());
      return new Response(JSON.stringify({ nodes: 200000 }));
    },
  });
  await expect(api.setAnalysis(500000)).rejects.toMatchObject({
    kind: 'invalid-response',
  });
  expect(sent).toEqual([{ nodes: 500000 }]);
});
test('a practice pace is saved only when the backend acknowledges that same pace', async () => {
  const sent: unknown[] = [];
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      const request = new Request(input);
      sent.push([
        request.method,
        new URL(request.url).pathname,
        await request.json(),
      ]);
      return new Response(JSON.stringify({ pace: 'standard' }));
    },
  });
  await expect(api.setPractice('light')).rejects.toMatchObject({
    kind: 'invalid-response',
  });
  expect(sent).toEqual([['PUT', '/api/settings/practice', { pace: 'light' }]]);
});
test('a time zone is saved only when the backend acknowledges that same zone', async () => {
  const sent: unknown[] = [];
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      const request = new Request(input);
      sent.push([
        request.method,
        new URL(request.url).pathname,
        await request.json(),
      ]);
      return new Response(
        JSON.stringify({ timezone: 'Europe/Paris', day: '2026-10-13' }),
      );
    },
  });
  await expect(api.setTimezone('America/Denver')).rejects.toMatchObject({
    kind: 'invalid-response',
  });
  expect(sent).toEqual([
    ['PUT', '/api/settings/timezone', { timezone: 'America/Denver' }],
  ]);
});
test('removing a linked account sends its own identifiers and accepts an empty 204', async () => {
  let url = '',
    auth = '';
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      const request = new Request(input);
      url = request.url;
      auth = request.headers.get('Authorization') ?? '';
      return new Response(null, { status: 204 });
    },
  });
  await api.removeConnection('chesscom', 'a/b');
  expect(url).toBe('https://api.example/api/accounts/chesscom/a%2Fb');
  expect(auth).toBe('Bearer token');
});
test('settings from a backend without practice paces still load, as Standard', async () => {
  const settings = {
    accounts: [],
    running: false,
    last_run: null,
    earlier_runs: [],
    current_run: null,
    engine: 'Stockfish',
    nodes: 500000,
    fsrs: { personal: false, reviews: 0, needed: 512, tuned_reviews: null },
    your_data: { games: 0, analysed: 0, first_game: null, approx_bytes: 0 },
    limits: { history_months: null, max_analysed: null, max_accounts: 4 },
  };
  const api = createApi({
    ...options,
    fetcher: async () => new Response(JSON.stringify(settings)),
  });
  await expect(api.settings()).resolves.toMatchObject({ pace: 'standard' });
});
test('malformed settings cannot enter the account cache', async () => {
  const api = createApi({
    ...options,
    fetcher: async () => new Response(JSON.stringify({ accounts: [] })),
  });
  await expect(api.settings()).rejects.toMatchObject({
    kind: 'invalid-response',
  });
});
test('an export finishing after sign-out is cancelled before any download is offered', async () => {
  let finish!: (response: Response) => void;
  const scope = createSessionScope(
    { apiOrigin: options.baseUrl, userId: 'A', sessionId: 'S' },
    options.getToken,
    async () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = scope.api.exportData();
  await Promise.resolve();
  await Promise.resolve();
  scope.dispose();
  finish(
    new Response('archive', { headers: { 'Content-Type': 'application/zip' } }),
  );
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
});
test('a watch is saved only when the backend acknowledges that same time and anchor', async () => {
  const sent: unknown[] = [];
  let reply = { time: '20:00', anchor: 'finish dinner', set_on: '2026-10-18' };
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      const request = new Request(input);
      sent.push([
        request.method,
        new URL(request.url).pathname,
        await request.json(),
      ]);
      return new Response(JSON.stringify(reply));
    },
  });
  const watch = { time: '20:00', anchor: 'finish dinner' };
  await expect(api.setWatch(watch)).resolves.toEqual(reply);
  reply = { ...reply, time: '21:00' };
  await expect(api.setWatch(watch)).rejects.toMatchObject({
    kind: 'invalid-response',
  });
  expect(sent).toEqual([
    ['PUT', '/api/settings/watch', watch],
    ['PUT', '/api/settings/watch', watch],
  ]);
});
