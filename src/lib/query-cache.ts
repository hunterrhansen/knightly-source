import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { dehydrate, QueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import { z } from 'zod';
import {
  gamesPagesSchema,
  gamesSchema,
  onboardingSchema,
} from './api/import-contract';
import { deckSchema } from './api/practice-contract';
import { overviewSchema, patternsSchema } from './api/progress-contract';
import { meSchema } from './api/response-schemas';
import { dailyReviewSchema } from './api/today-contract';

export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
export const CACHE_VERSION = '1';
const MAX_QUERIES = 50;
const MAX_SIZE = 2 * 1024 * 1024;
const timestamp = z.number().finite().nonnegative();
const snapshotSchema = z.object({
  buster: z.string(),
  timestamp,
  queries: z
    .array(
      z.object({
        queryKey: z.array(z.unknown()),
        data: z.unknown(),
        dataUpdatedAt: timestamp,
      }),
    )
    .max(MAX_QUERIES),
});
const schemas: Record<string, z.ZodType> = {
  me: meSchema,
  import: onboardingSchema,
  games: gamesSchema,
  overview: overviewSchema,
  patterns: patternsSchema,
  'daily-review': dailyReviewSchema,
  deck: deckSchema,
};
// Serialize disk changes across scope replacement and Strict Mode. A queued
// removal must finish after an already running write, never before it.
let writes = Promise.resolve();
function enqueue(operation: () => Promise<void>) {
  writes = writes.then(operation).catch(() => {});
  return writes;
}

// Small per-account values outside the query cache. Listed here so clearing an
// account always removes every one of them. `play-game` is an unfinished game
// from the removed bot play: devices may still hold one until sign-out clears it.
const accountItems = ['play-game', 'daily-reminder', 'watch-ask'] as const;
export type AccountItem = (typeof accountItems)[number];

export function createQueryCache(meKey: readonly string[]) {
  const key = `knightly.account-cache.${JSON.stringify(meKey)}`;
  const itemKey = (name: AccountItem) =>
    `knightly.account-data.${name}.${JSON.stringify(meKey)}`;
  let active = true;
  const schemaFor = (queryKey: QueryKey) => {
    if (!meKey.every((part, index) => queryKey[index] === part)) return;
    const resource =
      queryKey.length === meKey.length ? 'me' : queryKey[meKey.length];
    if (resource === 'games' && queryKey[meKey.length + 1] === 'library')
      return gamesPagesSchema;
    return typeof resource === 'string' && Object.hasOwn(schemas, resource)
      ? schemas[resource]
      : undefined;
  };
  function parseData(queryKey: QueryKey, data: unknown) {
    const result = schemaFor(queryKey)?.safeParse(data);
    return result?.success ? result.data : undefined;
  }
  const storagePersister = createAsyncStoragePersister({
    key,
    throttleTime: 1000,
    storage: {
      async getItem(storageKey) {
        await writes;
        return active ? AsyncStorage.getItem(storageKey) : null;
      },
      setItem(storageKey, value) {
        return enqueue(async () => {
          if (active) await AsyncStorage.setItem(storageKey, value);
        });
      },
      removeItem: (storageKey) =>
        enqueue(() => AsyncStorage.removeItem(storageKey)),
    },
    serialize(client) {
      if (!active) return '';
      const now = Date.now();
      const queries = client.clientState.queries
        .map((query) => ({
          queryKey: query.queryKey,
          // HTTP responses are already validated. Decode again only on restore.
          data: query.state.data,
          dataUpdatedAt: query.state.dataUpdatedAt,
        }))
        .filter(
          (query) =>
            query.data !== undefined &&
            now - query.dataUpdatedAt < CACHE_MAX_AGE,
        )
        .sort((a, b) => b.dataUpdatedAt - a.dataUpdatedAt)
        .slice(0, MAX_QUERIES);
      // Bound storage without losing the freshest small summaries when a large
      // history response exceeds the budget. JSON uses up to two bytes per unit.
      let encoded = JSON.stringify({
        buster: client.buster,
        timestamp: client.timestamp,
        queries,
      });
      while (encoded.length * 2 > MAX_SIZE && queries.length) {
        queries.pop();
        encoded = JSON.stringify({
          buster: client.buster,
          timestamp: client.timestamp,
          queries,
        });
      }
      return encoded;
    },
    deserialize(stored): PersistedClient {
      if (stored.length * 2 > MAX_SIZE) throw new Error('Oversized cache');
      const snapshot = snapshotSchema.parse(JSON.parse(stored));
      const now = Date.now();
      if (
        snapshot.buster !== CACHE_VERSION ||
        snapshot.timestamp > now ||
        now - snapshot.timestamp >= CACHE_MAX_AGE
      ) {
        throw new Error('Expired or incompatible cache');
      }
      const restored = new QueryClient({
        defaultOptions: { queries: { gcTime: Infinity } },
      });
      for (const query of snapshot.queries) {
        const data = parseData(query.queryKey, query.data);
        if (
          data !== undefined &&
          query.dataUpdatedAt <= now &&
          now - query.dataUpdatedAt < CACHE_MAX_AGE
        )
          restored.setQueryData(query.queryKey, data, {
            updatedAt: query.dataUpdatedAt,
          });
      }
      const clientState = dehydrate(restored);
      restored.clear();
      return {
        buster: snapshot.buster,
        timestamp: snapshot.timestamp,
        clientState,
      };
    },
  });
  let previousQueries: PersistedClient['clientState']['queries'] | undefined;
  let pendingSave: Promise<void> = Promise.resolve();
  const persister: Persister = {
    persistClient(client) {
      if (!active) return Promise.resolve();
      const queries = client.clientState.queries.filter(
        (query) => schemaFor(query.queryKey) && query.state.data !== undefined,
      );
      // Fetch status/error notifications don't change the saved response. Empty
      // startup notifications must not consume the throttle's first write.
      if (
        (!queries.length && !previousQueries) ||
        (previousQueries?.length === queries.length &&
          queries.every((query, index) => {
            const previous = previousQueries?.[index];
            return (
              previous?.queryHash === query.queryHash &&
              previous.state.dataUpdatedAt === query.state.dataUpdatedAt &&
              previous.state.data === query.state.data
            );
          }))
      )
        return pendingSave;
      previousQueries = queries;
      pendingSave = Promise.resolve(
        storagePersister.persistClient({
          ...client,
          clientState: { queries, mutations: [] },
        }),
      );
      return pendingSave;
    },
    async restoreClient() {
      try {
        const restored = await storagePersister.restoreClient();
        return active ? restored : undefined;
      } catch {
        if (active) await persister.removeClient();
        return;
      }
    },
    removeClient() {
      return storagePersister.removeClient();
    },
  };
  return {
    persister,
    configureClient(client: QueryClient) {
      for (const resource of Object.keys(schemas))
        if (resource !== 'me')
          client.setQueryDefaults([...meKey, resource], {
            gcTime: CACHE_MAX_AGE,
          });
    },
    stop() {
      active = false;
    },
    clear() {
      active = false;
      for (const name of accountItems)
        void enqueue(() => AsyncStorage.removeItem(itemKey(name)));
      return persister.removeClient();
    },
    /** A device-stored value for this account only; cleared with the account. */
    item(name: AccountItem) {
      return {
        async get() {
          await writes;
          return active ? AsyncStorage.getItem(itemKey(name)) : null;
        },
        set(value: string) {
          return enqueue(async () => {
            if (active) await AsyncStorage.setItem(itemKey(name), value);
          });
        },
        remove() {
          return enqueue(() => AsyncStorage.removeItem(itemKey(name)));
        },
      };
    },
  };
}
