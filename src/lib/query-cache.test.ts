import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import { createSessionScope } from './auth/session-scope';
import { CACHE_VERSION } from './query-cache';

const identity = {
  apiOrigin: 'https://api.example',
  userId: 'a',
  sessionId: 'a',
};
const me = {
  admin: false,
  limits: { history_months: null, max_analysed: null, max_accounts: 4 },
};
const games = {
  total: 1,
  page: 1,
  page_size: 20,
  games: [
    {
      id: 7,
      opponent: 'Opponent',
      played_at: null,
      speed: 'rapid',
      outcome: 'win',
      analysed: true,
    },
  ],
};
const save = (scope: ReturnType<typeof createSessionScope>) =>
  persistQueryClientSave({
    queryClient: scope.queryClient,
    persister: scope.cache.persister,
    buster: CACHE_VERSION,
  });
const restore = (scope: ReturnType<typeof createSessionScope>) =>
  persistQueryClientRestore({
    queryClient: scope.queryClient,
    persister: scope.cache.persister,
    buster: CACHE_VERSION,
  });
beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => jest.restoreAllMocks());

test('a returning library restores all loaded pages only for the same account', async () => {
  const scope = createSessionScope(identity, async () => 'token');
  const key = [...scope.meKey, 'games', 'library', { rated: 'all' }];
  const pages = {
    pages: [
      { ...games, total: 2, page_size: 1 },
      {
        ...games,
        total: 2,
        page: 2,
        page_size: 1,
        games: [{ ...games.games[0], id: 8, opponent: 'Older opponent' }],
      },
    ],
    pageParams: [1, 2],
  };
  scope.queryClient.setQueryData(key, pages);
  await save(scope);
  const reopened = createSessionScope(identity, async () => 'token');
  await restore(reopened);
  expect(reopened.queryClient.getQueryData(key)).toEqual(pages);
  const other = createSessionScope(
    { ...identity, userId: 'b', sessionId: 'b' },
    async () => 'b',
  );
  await restore(other);
  expect(
    other.queryClient.getQueryData([
      ...other.meKey,
      'games',
      'library',
      { rated: 'all' },
    ]),
  ).toBeUndefined();
  scope.dispose();
  reopened.dispose();
  other.dispose();
});

test('a leftover unfinished bot game stays with its account and is removed at sign-out', async () => {
  const mine = createSessionScope(identity, async () => 'token');
  const other = createSessionScope(
    { ...identity, userId: 'b', sessionId: 'b' },
    async () => 'token',
  );
  await mine.cache.item('play-game').set('{"moves":["e2e4"]}');
  expect(await other.cache.item('play-game').get()).toBeNull();
  expect(await mine.cache.item('play-game').get()).toBe('{"moves":["e2e4"]}');
  await mine.cache.clear();
  // A save that arrives after sign-out cannot bring it back.
  await mine.cache.item('play-game').set('{"moves":["d2d4"]}');
  const again = createSessionScope(identity, async () => 'token');
  expect(await again.cache.item('play-game').get()).toBeNull();
});

test('a burst of successful responses writes the latest value once per second and late writes cannot undo sign-out', async () => {
  jest.useFakeTimers();
  const scope = createSessionScope(identity, async () => 'token');
  const setItem = jest.spyOn(AsyncStorage, 'setItem');
  try {
    scope.queryClient.setQueryData(scope.meKey, me);
    await save(scope);
    const writesBefore = setItem.mock.calls.length;
    scope.queryClient.setQueryData(scope.meKey, {
      ...me,
      limits: { ...me.limits, max_accounts: 2 },
    });
    const second = save(scope);
    scope.queryClient.setQueryData(scope.meKey, {
      ...me,
      limits: { ...me.limits, max_accounts: 3 },
    });
    const third = save(scope);
    expect(setItem.mock.calls.length).toBe(writesBefore);
    await jest.advanceTimersByTimeAsync(1000);
    await Promise.all([second, third]);
    expect(setItem.mock.calls.length).toBe(writesBefore + 1);
    const reopened = createSessionScope(identity, async () => 'token');
    await restore(reopened);
    expect(reopened.queryClient.getQueryData(reopened.meKey)).toEqual({
      ...me,
      limits: { ...me.limits, max_accounts: 3 },
    });
    reopened.dispose();
    scope.queryClient.setQueryData(scope.meKey, me);
    const trailing = save(scope);
    scope.dispose();
    await scope.cache.clear();
    await jest.advanceTimersByTimeAsync(1000);
    await trailing;
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  } finally {
    scope.dispose();
    jest.useRealTimers();
  }
});

test('inactive Games survive brief navigation while an unrelated lookup is released after five minutes', () => {
  jest.useFakeTimers();
  const scope = createSessionScope(identity, async () => 'token');
  const gameKey = [...scope.meKey, 'games', {}, 1];
  const lookupKey = [...scope.meKey, 'chesscom-lookup', 'opponent'];
  scope.queryClient.setQueryData(gameKey, games);
  scope.queryClient.setQueryData(lookupKey, { handle: 'opponent' });
  try {
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(scope.queryClient.getQueryData(gameKey)).toEqual(games);
    expect(scope.queryClient.getQueryData(lookupKey)).toBeUndefined();
  } finally {
    scope.dispose();
    jest.useRealTimers();
  }
});

test('saved Games restore only for the same authenticated account, session and API', async () => {
  const first = createSessionScope(identity, async () => 'token');
  const gameKey = [...first.meKey, 'games', {}, 1];
  first.queryClient.setQueryData(gameKey, games);
  first.queryClient.setQueryData([...first.meKey, 'settings'], {
    secret: 'excluded',
  });
  await save(first);
  first.dispose();
  for (const changed of [
    identity,
    { ...identity, userId: 'b' },
    { ...identity, sessionId: 'b' },
    { ...identity, apiOrigin: 'https://other.example' },
  ]) {
    const scope = createSessionScope(changed, async () => 'token');
    await restore(scope);
    expect(
      scope.queryClient.getQueryData([...scope.meKey, 'games', {}, 1]),
    ).toEqual(changed === identity ? games : undefined);
    expect(
      scope.queryClient.getQueryData([...scope.meKey, 'settings']),
    ).toBeUndefined();
    scope.dispose();
  }
});

test('a fresh response cannot extend the lifetime of an older cached response', async () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  const first = createSessionScope(identity, async () => 'token');
  first.queryClient.setQueryData([...first.meKey, 'games', {}, 1], games);
  clock.mockReturnValue(now + 23 * 60 * 60 * 1000);
  first.queryClient.setQueryData(first.meKey, me);
  await save(first);
  first.dispose();
  clock.mockReturnValue(now + 25 * 60 * 60 * 1000);
  const next = createSessionScope(identity, async () => 'token');
  await restore(next);
  expect(next.queryClient.getQueryData(next.meKey)).toEqual(me);
  expect(
    next.queryClient.getQueryData([...next.meKey, 'games', {}, 1]),
  ).toBeUndefined();
  next.dispose();
});

test('corrupted cache and unavailable storage fall back to an empty usable scope', async () => {
  const first = createSessionScope(identity, async () => 'token');
  first.queryClient.setQueryData(first.meKey, me);
  await save(first);
  first.dispose();
  const [key] = await AsyncStorage.getAllKeys();
  await AsyncStorage.setItem(key as string, '{');
  const next = createSessionScope(identity, async () => 'token');
  await restore(next);
  expect(next.queryClient.getQueryData(next.meKey)).toBeUndefined();
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  jest
    .spyOn(AsyncStorage, 'getItem')
    .mockRejectedValue(new Error('unavailable'));
  await expect(restore(next)).resolves.toBeUndefined();
  expect(next.isCurrent()).toBe(true);
  next.dispose();
});

test('sign-out removal waits for an in-flight write and rejects subsequent saves', async () => {
  const first = createSessionScope(identity, async () => 'token');
  first.queryClient.setQueryData(first.meKey, me);
  const setItem = AsyncStorage.setItem;
  let complete!: () => void;
  const started = new Promise<void>((resolve) => {
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(
      (key, value) =>
        new Promise<void>((finish) => {
          complete = () => {
            void setItem(key, value).then(finish);
          };
          resolve();
        }),
    );
  });
  const pending = save(first);
  await started;
  first.dispose();
  const removal = first.cache.clear();
  complete();
  await Promise.all([pending, removal]);
  await save(first);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
