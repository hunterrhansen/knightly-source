import { QueryClient } from '@tanstack/react-query';
import { type ApiClient, createApi } from '../api/client';
import { createQueryCache } from '../query-cache';
export type SessionIdentity = Readonly<{
  apiOrigin: string;
  userId: string;
  sessionId: string;
}>;
export type SessionScope = {
  apiOrigin: string;
  api: ApiClient;
  queryClient: QueryClient;
  meKey: readonly string[];
  cache: ReturnType<typeof createQueryCache>;
  isCurrent: () => boolean;
  dispose: () => void;
};
export function createSessionScope(
  identity: SessionIdentity,
  getToken: () => Promise<string | null>,
  fetcher: typeof fetch = fetch,
): SessionScope {
  let current = true;
  const lifetime = new AbortController();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 5 * 60 * 1000 },
      mutations: { retry: false },
    },
  });
  const meKey = [
    'account',
    identity.apiOrigin,
    identity.userId,
    identity.sessionId,
    'me',
  ] as const;
  const cache = createQueryCache(meKey);
  cache.configureClient(queryClient);
  const api = createApi({
    baseUrl: identity.apiOrigin,
    getToken,
    isCurrent: () => current,
    lifetime: lifetime.signal,
    fetcher,
  });
  return {
    apiOrigin: identity.apiOrigin,
    api,
    queryClient,
    meKey,
    cache,
    isCurrent: () => current,
    dispose() {
      if (!current) return;
      current = false;
      cache.stop();
      // Observer teardown and cancelled fetches can schedule GC after clear().
      // Discarded scopes need no timers, including late hydration callbacks.
      const defaults = queryClient.getDefaultOptions();
      queryClient.setDefaultOptions({
        ...defaults,
        queries: { ...defaults.queries, gcTime: Infinity },
      });
      for (const query of queryClient.getQueryCache().getAll())
        query.setOptions({ ...query.options, gcTime: Infinity });
      lifetime.abort();
      void queryClient.cancelQueries();
      queryClient.clear();
    },
  };
}
