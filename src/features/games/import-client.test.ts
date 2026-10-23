import { createApi } from '../../lib/api/client';
import { createSessionScope } from '../../lib/auth/session-scope';

const profile = {
  source: 'chesscom',
  handle: 'GGHansen',
  rating: 914,
  rating_kind: 'Rapid',
  games: 5,
  since: '2026-01',
};
const identity = {
  apiOrigin: 'https://api.example',
  userId: 'A',
  sessionId: 'A',
};
test('lookup encodes username and confirmation posts the canonical profile with fresh authentication', async () => {
  const seen: Request[] = [];
  let token = 'first';
  const api = createApi({
    baseUrl: identity.apiOrigin,
    isCurrent: () => true,
    getToken: async () => token,
    fetcher: async (input) => {
      const request = new Request(input);
      seen.push(request);
      return new Response(
        JSON.stringify(
          request.method === 'POST'
            ? { source: 'chesscom', handle: 'GGHansen' }
            : profile,
        ),
      );
    },
  });
  expect(await api.lookup('gghansen')).toEqual(profile);
  token = 'second';
  await api.connect(profile.handle);
  const lookupRequest = seen[0];
  const connectRequest = seen[1];
  if (!lookupRequest || !connectRequest)
    throw new Error('Expected two requests');
  expect(new URL(lookupRequest.url).searchParams.get('handle')).toBe(
    'gghansen',
  );
  expect(connectRequest.headers.get('Authorization')).toBe('Bearer second');
  expect(await connectRequest.json()).toEqual({
    source: 'chesscom',
    handle: 'GGHansen',
  });
});
test('preserves useful lookup errors and rejects malformed imported data', async () => {
  const api = createApi({
    baseUrl: identity.apiOrigin,
    isCurrent: () => true,
    getToken: async () => 'token',
    fetcher: async () =>
      new Response(
        JSON.stringify({ detail: 'No Chess.com account is called nobody.' }),
        { status: 404 },
      ),
  });
  await expect(api.lookup('nobody')).rejects.toMatchObject({
    status: 404,
    message: 'No Chess.com account is called nobody.',
  });
  const malformed = createApi({
    baseUrl: identity.apiOrigin,
    isCurrent: () => true,
    getToken: async () => 'token',
    fetcher: async () => new Response(JSON.stringify({ games: [] })),
  });
  await expect(malformed.onboarding()).rejects.toMatchObject({
    kind: 'invalid-response',
  });
});
test('sign-out aborts pending account writes and rejects late responses', async () => {
  let finish!: (value: Response) => void;
  let request!: Request;
  const scope = createSessionScope(
    identity,
    async () => 'token',
    async (input) => {
      request = new Request(input);
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    },
  );
  const pending = scope.api.connect('GGHansen');
  await new Promise((resolve) => setTimeout(resolve, 0));
  scope.dispose();
  expect(request.signal.aborted).toBe(true);
  finish(
    new Response(JSON.stringify({ source: 'chesscom', handle: 'GGHansen' })),
  );
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  await expect(scope.api.sync()).rejects.toMatchObject({ kind: 'cancelled' });
});
