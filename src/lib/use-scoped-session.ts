import { useEffect, useSyncExternalStore } from 'react';
import { useSessionScope } from './auth/session-boundary';
import type { SessionScope } from './auth/session-scope';

type Session = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
  load: () => unknown;
};
/** Sessions kept per account scope and key, outliving the screen that shows
 * them: returning to one keeps its attempt. A new account starts afresh. */
export type ScopedSessions<K, T extends Session> = WeakMap<
  SessionScope,
  Map<K, T>
>;

/** The account's session for `key` (created on first use) and its state;
 * `load` starts or resumes it. */
export function useScopedSession<K, T extends Session>(
  sessions: ScopedSessions<K, T>,
  key: K,
  create: (scope: SessionScope) => T,
  load = true,
) {
  const { scope } = useSessionScope();
  let keyed = sessions.get(scope);
  if (!keyed) {
    keyed = new Map();
    sessions.set(scope, keyed);
  }
  let session = keyed.get(key);
  if (!session) {
    session = create(scope);
    keyed.set(key, session);
  }
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  ) as ReturnType<T['getSnapshot']>;
  useEffect(() => {
    if (load) void session.load();
  }, [session, load]);
  return { session, state };
}
