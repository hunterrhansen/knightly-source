import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { invalidateAccount } from '../../lib/account-queries';
import { ApiError } from '../../lib/api/api-error';
import { useSessionScope } from '../../lib/auth/session-boundary';
import type { SessionScope } from '../../lib/auth/session-scope';

function deviceTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.length > 0 && zone.length <= 64
      ? zone
      : null;
  } catch {
    return null;
  }
}

type Scope = Pick<SessionScope, 'api' | 'isCurrent' | 'queryClient' | 'meKey'>;

/**
 * Keeps the backend's review day on the device's time zone. Each zone is sent once per
 * session; a failed save is retried on the next sync. Day-scoped queries refresh only
 * after the backend acknowledges the zone.
 */
export function createTimezoneSync(scope: Scope, readZone = deviceTimeZone) {
  let settled: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  async function send() {
    do {
      again = false;
      const zone = readZone();
      if (!zone || zone === settled) continue;
      try {
        await scope.api.setTimezone(zone);
      } catch (error) {
        // The server's zone database lacks it: keep the server day, don't resend.
        if (error instanceof ApiError && error.status === 422) settled = zone;
        return;
      }
      if (!scope.isCurrent()) return;
      settled = zone;
      // Responses that count "today" change when the review day moves.
      void invalidateAccount(scope, 'day');
    } while (again);
  }
  return function sync(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = send().finally(() => {
      running = null;
    });
    return running;
  };
}

const syncs = new WeakMap<SessionScope, () => Promise<void>>();
export function TimezoneSync() {
  const { scope } = useSessionScope();
  useEffect(() => {
    let sync = syncs.get(scope);
    if (!sync) {
      sync = createTimezoneSync(scope);
      syncs.set(scope, sync);
    }
    const run = sync;
    void run();
    if (Platform.OS === 'web') {
      const visible = () => {
        if (document.visibilityState === 'visible') void run();
      };
      document.addEventListener('visibilitychange', visible);
      return () => document.removeEventListener('visibilitychange', visible);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => subscription.remove();
  }, [scope]);
  return null;
}
