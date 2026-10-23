import { createSessionScope } from '../../lib/auth/session-scope';
import { createTimezoneSync } from './timezone-sync';

const identity = {
  apiOrigin: 'https://api.example',
  userId: 'A',
  sessionId: 'S',
};

const scopes: ReturnType<typeof createSessionScope>[] = [];
afterEach(() => {
  for (const scope of scopes.splice(0)) {
    scope.dispose();
    scope.queryClient.clear();
  }
});

function setup(respond: (zone: string) => Response | Promise<Response>) {
  const sent: string[] = [];
  const scope = createSessionScope(
    identity,
    async () => 'token',
    async (input, init) => {
      const request = new Request(input, init);
      const { timezone } = (await request.json()) as { timezone: string };
      sent.push(timezone);
      return respond(timezone);
    },
  );
  scopes.push(scope);
  const deckKey = [...scope.meKey, 'deck'];
  scope.queryClient.setQueryData(deckKey, { cards: 1 });
  const deckStale = () =>
    scope.queryClient.getQueryState(deckKey)?.isInvalidated ?? false;
  return { scope, sent, deckStale };
}
const accepted = (zone: string) =>
  new Response(JSON.stringify({ timezone: zone, day: '2026-10-13' }));

test('the device zone is saved once and day counts refresh only after it is accepted', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { scope, sent, deckStale } = setup(async (zone) => {
    await gate;
    return accepted(zone);
  });
  const sync = createTimezoneSync(scope, () => 'America/Denver');
  const first = sync();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(deckStale()).toBe(false);
  release();
  await first;
  expect(deckStale()).toBe(true);
  await sync();
  expect(sent).toEqual(['America/Denver']);
});

test('a failed save is retried later, and travelling sends the new zone', async () => {
  let fail = true;
  let zone = 'America/Denver';
  const { scope, sent, deckStale } = setup((value) =>
    fail ? new Response('{}', { status: 503 }) : accepted(value),
  );
  const sync = createTimezoneSync(scope, () => zone);
  await sync();
  expect(deckStale()).toBe(false);
  fail = false;
  await sync();
  zone = 'Asia/Tokyo';
  await sync();
  expect(sent).toEqual(['America/Denver', 'America/Denver', 'Asia/Tokyo']);
  expect(deckStale()).toBe(true);
});

test('a zone the server rejects is not resent on every foreground', async () => {
  const { scope, sent, deckStale } = setup(
    () => new Response('{}', { status: 422 }),
  );
  const sync = createTimezoneSync(scope, () => 'Etc/Unknown');
  await sync();
  await sync();
  expect(sent).toEqual(['Etc/Unknown']);
  expect(deckStale()).toBe(false);
});

test('an acknowledgement arriving after sign-out refreshes nothing', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { scope, deckStale } = setup(async (zone) => {
    await gate;
    return accepted(zone);
  });
  const pending = createTimezoneSync(scope, () => 'America/Denver')();
  await new Promise((resolve) => setTimeout(resolve, 0));
  scope.dispose();
  release();
  await pending;
  expect(deckStale()).toBe(false);
});
