import type { SessionScope } from './auth/session-scope';

/** Account responses refreshed together when a change on the server makes
 * them stale. One list per kind of change, so callers never drift apart. */
const answer = [
  'deck',
  'daily-review',
  'journey',
  'overview',
  'patterns',
  'streak-days',
] as const;
const imported = ['games', 'overview', 'patterns', 'deck'] as const;
const groups = {
  /** A practice answer saved: the deck, today's plan and the summaries it
   * counts in. Games show only a review's completion, which it never changes. */
  answer,
  /** A game review saved: as an answer, and the game's reviewed state. */
  review: ['games', ...answer],
  /** A position hidden or shown again. */
  hidden: ['deck', 'daily-review', 'patterns', 'suspended'],
  /** The review day moved: every response that counts "today". */
  day: [
    'deck',
    'daily-review',
    'journey',
    'streak-days',
    'overview',
    'patterns',
  ],
  /** The watch time or anchor saved: Today shows and reminds with them. */
  watch: ['daily-review'],
  /** Positions added to today's plan. */
  plan: ['daily-review', 'deck'],
  /** New games imported: the library and what it feeds. */
  imported,
  /** An account connected or synced: its import state, then as imported. */
  games: ['import', 'import-status', ...imported],
} as const;
export type AccountQueryGroup = keyof typeof groups;

/** An account response's query key. */
export const accountKey = (
  scope: Pick<SessionScope, 'meKey'>,
  resource: string,
) => [...scope.meKey, resource];

/** Marks a group's responses stale; resolves once refetched. */
export function invalidateAccount(
  scope: Pick<SessionScope, 'meKey' | 'queryClient'>,
  group: AccountQueryGroup,
) {
  return Promise.all(
    groups[group].map((resource) =>
      scope.queryClient.invalidateQueries({
        queryKey: accountKey(scope, resource),
      }),
    ),
  );
}
