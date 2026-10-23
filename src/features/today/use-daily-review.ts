import { useMutation, useQuery } from '@tanstack/react-query';
import { invalidateAccount } from '../../lib/account-queries';
import { useSessionScope } from '../../lib/auth/session-boundary';

/** Today's daily review (plan, streak, memory) for the signed-in account. */
export function useDailyReview(
  options: { refetchOnMount?: 'always'; enabled?: boolean } = {},
) {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'daily-review'],
    queryFn: ({ signal }) => scope.api.dailyReview(signal),
    ...options,
  });
}

/** Learn more: raises today's new-position limit, then refreshes today's plan and
 * deck so the new positions are served. `onAdded` runs only when some were added. */
export function useLearnMore(onAdded: () => void) {
  const { scope } = useSessionScope();
  return useMutation({
    mutationFn: () => scope.api.learnMore(),
    onSuccess: async ({ added }) => {
      if (!scope.isCurrent()) return;
      await invalidateAccount(scope, 'plan');
      if (added > 0) onAdded();
    },
  });
}

/** The daily lesson's deck (`/api/deck?mode=lesson`): its next card names
 * tonight's first move, and its results say how tonight went. Shares the
 * deck's cache key prefix, so a saved answer refreshes it. */
export function useLessonDeck(enabled: boolean) {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'deck', 'lesson'],
    queryFn: ({ signal }) => scope.api.deck(signal, 'lesson'),
    enabled,
  });
}

/** A kept night's watch (`/api/journey/night`), for its node card: what it
 * held and where each of its moves stands now. Under the journey's key, so
 * whatever refreshes the path refreshes it. */
export function useKeptNight(date: string | undefined) {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'journey', 'night', date],
    queryFn: ({ signal }) => scope.api.keptNight(date ?? '', signal),
    enabled: !!date,
  });
}

/** The path's nights: stars, ranks and nights kept (`/api/journey`). Progress
 * shares it for the rank chip. */
export function useJourney() {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'journey'],
    queryFn: ({ signal }) => scope.api.journey(signal),
  });
}
