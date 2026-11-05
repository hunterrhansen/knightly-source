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

/** The path's nights: stars, ranks and nights kept (`/api/journey`). Progress
 * shares it for the rank chip. */
export function useJourney() {
  const { scope } = useSessionScope();
  return useQuery({
    queryKey: [...scope.meKey, 'journey'],
    queryFn: ({ signal }) => scope.api.journey(signal),
  });
}
