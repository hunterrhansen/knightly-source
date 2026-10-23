import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameSummary } from '../../lib/api/import-contract';
import {
  type GameFilters,
  gameFiltersSchema,
} from '../../lib/api/progress-contract';
import { GamesView } from './games-view';
import { importPhase } from './import-phase';
import { useGameLibrary, useImportProgress } from './use-games';

/** The Games modal's list. Opening a game, Accounts & sync and (on the web)
 * closing are the route's: a game stays inside the modal. */
export function GamesScreen({
  onOpenGame,
  onAccounts,
  onClose,
}: {
  onOpenGame: (id: number) => void;
  onAccounts: () => void;
  onClose: () => void;
}) {
  const params = useLocalSearchParams();
  const router = useRouter();
  const parsed = gameFiltersSchema.safeParse(params);
  const filterIdentity = JSON.stringify(parsed.success ? parsed.data : {});
  const filters = useMemo<GameFilters>(() => {
    const route = gameFiltersSchema.parse(JSON.parse(filterIdentity));
    return {
      ...route,
      rated: route.rated ?? (Object.keys(route).length ? 'rated' : 'all'),
    };
  }, [filterIdentity]);
  const [search, setSearch] = useState(filters.q ?? '');
  const pendingSearch = useRef<string | undefined>(undefined);
  const games = useGameLibrary(filters);
  const { progress, status } = useImportProgress();
  useEffect(() => {
    const value = filters.q ?? '';
    if (pendingSearch.current === value) pendingSearch.current = undefined;
    else setSearch(value);
  }, [filters.q]);
  const updateFilters = useCallback(
    (next: GameFilters) => {
      const valid = gameFiltersSchema.parse(
        Object.fromEntries(
          Object.entries(next).filter(([, value]) => value !== undefined),
        ),
      );
      router.setParams(
        Object.fromEntries(
          [
            'range',
            'kpi',
            'q',
            'color',
            'speed',
            'result',
            'review_status',
            'slips',
            'rated',
          ].map((key) => [key, valid[key as keyof GameFilters]]),
        ),
      );
    },
    [router],
  );
  useEffect(() => {
    const value = search.trim();
    if (value === (filters.q ?? '')) return;
    const timer = setTimeout(() => {
      pendingSearch.current = value;
      updateFilters({ ...filters, q: value || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filters, updateFilters]);
  const page = games.data?.pages[0];
  const unique = new Map<number, GameSummary>();
  for (const loaded of games.data?.pages ?? [])
    for (const game of loaded.games) unique.set(game.id, game);
  const phase = progress.data
    ? importPhase(progress.data, status.data)
    : undefined;
  const importMessage =
    progress.error || status.error
      ? 'Sync status unavailable · Open Accounts & sync'
      : phase === 'processing' && progress.data
        ? `${progress.data.games} imported · ${progress.data.analysed} analyzed · Import continues`
        : phase === 'failed'
          ? 'Import needs attention · Your games are kept'
          : undefined;
  return (
    <GamesView
      games={[...unique.values()]}
      page={page}
      filters={filters}
      search={search}
      onSearch={setSearch}
      onFilters={(next) => {
        pendingSearch.current = undefined;
        setSearch(next.q ?? '');
        updateFilters(next);
      }}
      onOpenGame={onOpenGame}
      onAccounts={onAccounts}
      onClose={onClose}
      connected={progress.data ? progress.data.accounts.length > 0 : undefined}
      importMessage={importMessage}
      loading={!games.data && games.isPending}
      refreshing={games.isFetching && !games.isFetchingNextPage}
      loadingMore={games.isFetchingNextPage}
      hasMore={games.hasNextPage}
      error={
        games.error
          ? games.isFetchNextPageError
            ? 'Older games could not load. Your history is kept.'
            : 'Could not refresh games. Please try again.'
          : undefined
      }
      filterError={!parsed.success}
      onRetry={() => {
        if (games.isFetchNextPageError) void games.fetchNextPage();
        else void games.refetch();
      }}
      onRefresh={() => {
        void games.refetch();
        void progress.refetch();
        void status.refetch();
      }}
      onLoadMore={() => {
        if (!games.isFetching) void games.fetchNextPage();
      }}
    />
  );
}
