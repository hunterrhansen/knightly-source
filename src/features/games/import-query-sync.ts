import { invalidateAccount } from '../../lib/account-queries';
import type { SessionScope } from '../../lib/auth/session-scope';

type Registration = { readers: number; unsubscribe: () => void };
const registrations = new WeakMap<SessionScope, Registration>();

// One cache subscriber per session, regardless of how many screens read import
// progress. Hydration and identical polling responses do not trigger refreshes.
export function observeImportChanges(scope: SessionScope) {
  let registration = registrations.get(scope);
  if (!registration) {
    const previous = new Map<string, unknown>();
    for (const resource of ['import', 'import-status'])
      previous.set(
        resource,
        scope.queryClient.getQueryData([...scope.meKey, resource]),
      );
    const unsubscribe = scope.queryClient.getQueryCache().subscribe((event) => {
      if (!scope.isCurrent() || event.type !== 'updated') return;
      const key = event.query.queryKey;
      const resource = key[scope.meKey.length];
      if (
        key.length !== scope.meKey.length + 1 ||
        !scope.meKey.every((part, index) => key[index] === part) ||
        (resource !== 'import' && resource !== 'import-status')
      )
        return;
      const data = event.query.state.data;
      // Record restored data as the baseline, without treating it as an update.
      if (event.action.type === 'setState') {
        previous.set(resource, data);
        return;
      }
      if (event.action.type !== 'success' || event.action.manual) return;
      const last = previous.get(resource);
      previous.set(resource, data);
      if (last === undefined || last === data) return;
      void invalidateAccount(scope, 'imported');
    });
    registration = { readers: 0, unsubscribe };
    registrations.set(scope, registration);
  }
  registration.readers++;
  const owned = registration;
  return () => {
    owned.readers--;
    if (!owned.readers) {
      owned.unsubscribe();
      registrations.delete(scope);
    }
  };
}
