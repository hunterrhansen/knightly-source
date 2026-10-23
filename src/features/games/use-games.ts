import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { invalidateAccount } from '../../lib/account-queries';
import type { GameFilters } from '../../lib/api/progress-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { observeImportChanges } from './import-query-sync';
export function useImportProgress() {
  const { scope } = useSessionScope();
  const progress = useQuery({
    queryKey: [...scope.meKey, 'import'],
    queryFn: ({ signal }) => scope.api.onboarding(signal),
    refetchInterval: (q) =>
      !q.state.error && q.state.data?.working ? 3000 : false,
  });
  const status = useQuery({
    queryKey: [...scope.meKey, 'import-status'],
    queryFn: ({ signal }) => scope.api.importStatus(signal),
    refetchInterval: (q) =>
      !q.state.error &&
      (q.state.data?.queued.length || q.state.data?.current_run)
        ? 3000
        : false,
  });
  useEffect(() => observeImportChanges(scope), [scope]);
  return { progress, status };
}
export function useChessLookup(handle: string) {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'chesscom-lookup', handle.toLowerCase()],
    queryFn: ({ signal }) => scope.api.lookup(handle, signal),
    enabled: !!handle,
    staleTime: 60_000,
  });
}
export function useImportActions() {
  const { scope } = useSessionScope();
  const refresh = async () => {
    if (!scope.isCurrent()) return;
    await invalidateAccount(scope, 'games');
  };
  const connect = useMutation({
    mutationFn: (handle: string) => scope.api.connect(handle),
    onSuccess: refresh,
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => scope.api.sync(),
    onSuccess: refresh,
    retry: false,
  });
  return { connect, sync };
}
export function useGameLibrary(filters: GameFilters) {
  const { scope } = useSessionScope();
  return useInfiniteQuery({
    queryKey: [...scope.meKey, 'games', 'library', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      scope.api.games(pageParam, signal, filters),
    getNextPageParam: (page) =>
      page.page * page.page_size < page.total ? page.page + 1 : undefined,
  });
}
