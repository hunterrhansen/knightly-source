import { createApi } from './client';

const me = {
  admin: false,
  limits: { history_months: null, max_analysed: 1000, max_accounts: 4 },
};
const options = {
  baseUrl: 'https://api.example',
  getToken: async () => 'token',
  isCurrent: () => true,
};

test('gets the current token on each request and validates capabilities', async () => {
  let token = 'first';
  const seen: string[] = [];
  const api = createApi({
    ...options,
    getToken: async () => token,
    fetcher: async (input) => {
      const request = new Request(input);
      seen.push(request.headers.get('Authorization') ?? '');
      return new Response(JSON.stringify(me));
    },
  });
  expect(await api.me()).toEqual(me);
  token = 'second';
  await api.me();
  expect(seen).toEqual(['Bearer first', 'Bearer second']);
});
test.each([
  [401, 'unauthenticated'],
  [403, 'forbidden'],
  [422, 'validation'],
  [429, 'rate-limited'],
  [500, 'server'],
])('normalizes HTTP %i without retries', async (status, kind) => {
  let calls = 0;
  const api = createApi({
    ...options,
    fetcher: async () => {
      calls++;
      return new Response('upstream error', { status: Number(status) });
    },
  });
  await expect(api.me()).rejects.toMatchObject({ kind });
  expect(calls).toBe(1);
});
test('rejects malformed successful JSON and missing tokens', async () => {
  await expect(
    createApi({ ...options, fetcher: async () => new Response('{') }).me(),
  ).rejects.toMatchObject({ kind: 'invalid-response' });
  await expect(
    createApi({
      ...options,
      fetcher: async () => new Response(JSON.stringify({ admin: false })),
    }).me(),
  ).rejects.toMatchObject({ kind: 'invalid-response' });
  let dispatched = false;
  await expect(
    createApi({
      ...options,
      getToken: async () => null,
      fetcher: async () => {
        dispatched = true;
        return new Response('{}');
      },
    }).me(),
  ).rejects.toMatchObject({ kind: 'unauthenticated' });
  expect(dispatched).toBe(false);
});
test('late token or response cannot cross a disposed session', async () => {
  let current = true;
  let resolveToken!: (token: string) => void;
  let dispatched = false;
  const api = createApi({
    ...options,
    isCurrent: () => current,
    getToken: () =>
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    fetcher: async () => {
      dispatched = true;
      return new Response(JSON.stringify(me));
    },
  });
  const request = api.me();
  current = false;
  resolveToken('old');
  await expect(request).rejects.toMatchObject({ kind: 'cancelled' });
  expect(dispatched).toBe(false);
  current = true;
  const late = createApi({
    ...options,
    isCurrent: () => current,
    fetcher: async () => {
      current = false;
      return new Response(JSON.stringify(me));
    },
  });
  await expect(late.me()).rejects.toMatchObject({ kind: 'cancelled' });
});
test('abort is distinct from network failure', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(createApi(options).me(abort.signal)).rejects.toMatchObject({
    kind: 'cancelled',
  });
  await expect(
    createApi({
      ...options,
      fetcher: async () => {
        throw new TypeError('network');
      },
    }).me(),
  ).rejects.toMatchObject({ kind: 'network' });
});
