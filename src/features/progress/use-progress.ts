import { useQuery } from '@tanstack/react-query';
import { invalidateAccount } from '../../lib/account-queries';
import type { ProgressRange } from '../../lib/api/progress-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { addDays } from '../../ui';
import { useStreakHistory } from '../today/today-api';
import { HABIT_DAYS, localToday } from './progress-model';

const overviewQuery = (range: ProgressRange) => ['overview', range] as const;

/** The selected period for Progress's rating and Your game. */
export function useProgressRange(range: ProgressRange) {
  const { scope } = useSessionScope();
  const overview = useQuery({
    queryKey: [...scope.meKey, ...overviewQuery(range)],
    queryFn: ({ signal }) => scope.api.overview(range, signal),
  });
  const patterns = useQuery({
    queryKey: [...scope.meKey, 'patterns', range],
    queryFn: ({ signal }) => scope.api.patterns(range, signal),
  });
  return { overview, patterns };
}

/** Last 4 weeks ignores the range: the last 30 days' blunders and the
 * streak days of the four weeks ending today. */
export function useHabit() {
  const { scope } = useSessionScope();
  const today = localToday();
  const recent = useQuery({
    queryKey: [...scope.meKey, ...overviewQuery('30d')],
    queryFn: ({ signal }) => scope.api.overview('30d', signal),
  });
  const history = useStreakHistory({
    from: addDays(today, 1 - HABIT_DAYS),
    to: today,
  });
  return { today, recent, days: history?.days, nights: history?.nights };
}

/** The deck's size for Progress's Your moves (hidden positions); the same cache entry daily
 * practice keeps current. */
export function useDeckSummary() {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'deck'],
    queryFn: ({ signal }) => scope.api.deck(signal),
  });
}

/** Positions hidden with "Don't show this again", for the list behind Progress's Your moves. */
export function useHiddenPositions() {
  const { scope } = useSessionScope();
  const hidden = useQuery({
    queryKey: [...scope.meKey, 'suspended'],
    queryFn: ({ signal }) => scope.api.suspendedCards(signal),
  });
  /** Show one again: its schedule resumes where it was. */
  async function showAgain(gameId: number, ply: number) {
    await scope.api.unsuspendCard(gameId, ply);
    if (!scope.isCurrent()) return;
    void invalidateAccount(scope, 'hidden');
  }
  return { hidden, showAgain };
}
