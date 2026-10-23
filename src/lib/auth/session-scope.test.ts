import { createSessionScope } from './session-scope';

const identity = {
  apiOrigin: 'https://api.example',
  userId: 'account-a',
  sessionId: 'session-a',
};
const me = {
  admin: false,
  limits: { history_months: null, max_analysed: null, max_accounts: 4 },
};
test('disposed scope cannot return late data to the next account', async () => {
  let resolve!: (value: Response) => void;
  const a = createSessionScope(
    identity,
    async () => 'token',
    async () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = a.api.me();
  await Promise.resolve();
  await Promise.resolve();
  a.queryClient.setQueryData(a.meKey, me);
  a.dispose();
  const b = createSessionScope(
    { ...identity, userId: 'account-b', sessionId: 'session-b' },
    async () => 'b',
  );
  resolve(new Response(JSON.stringify(me)));
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  expect(a.isCurrent()).toBe(false);
  expect(a.queryClient.getQueryData(a.meKey)).toBeUndefined();
  expect(b.queryClient.getQueryData(b.meKey)).toBeUndefined();
  b.dispose();
});
test('disposal aborts pending fetches and is idempotent', async () => {
  let observed: AbortSignal | undefined;
  const scope = createSessionScope(
    identity,
    async () => 'token',
    async (input) => {
      observed = new Request(input).signal;
      return new Promise((_, reject) =>
        observed?.addEventListener('abort', () =>
          reject(new DOMException('cancelled', 'AbortError')),
        ),
      );
    },
  );
  const pending = scope.api.me();
  await Promise.resolve();
  await Promise.resolve();
  scope.dispose();
  scope.dispose();
  expect(observed?.aborted).toBe(true);
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
});
test('a new same-user session receives a fresh cache', () => {
  const a = createSessionScope(identity, async () => 'a');
  a.queryClient.setQueryData(a.meKey, me);
  a.dispose();
  const b = createSessionScope(
    { ...identity, sessionId: 'new-session' },
    async () => 'b',
  );
  expect(b.queryClient.getQueryData(b.meKey)).toBeUndefined();
  b.dispose();
});
