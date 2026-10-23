import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useSessionScope } from '../../lib/auth/session-boundary';
import {
  cancelReminders,
  remindersSupported,
  replaceReminders,
  requestReminderPermission,
} from './reminder-notifications';
import {
  DEFAULT_REMINDER,
  parseReminderPreference,
  planReminders,
  type ReminderPreference,
} from './reminder-schedule';
import { useDailyReview } from './use-daily-review';

// Native scheduling calls run one at a time, in order, so the latest plan wins.
let queue = Promise.resolve();
function enqueue(operation: () => Promise<void>) {
  queue = queue.then(operation).catch(() => {});
  return queue;
}

/** Removes scheduled reminders, e.g. when no account is signed in on this device. */
export function cancelDailyReminders() {
  if (remindersSupported) void enqueue(cancelReminders);
}

/** The signed-in account's reminder choice (stored on this device, cleared with the account). */
export function useReminderPreference() {
  const { scope } = useSessionScope();
  const key = [...scope.meKey, 'daily-reminder'];
  const query = useQuery({
    queryKey: key,
    queryFn: async () =>
      parseReminderPreference(await scope.cache.item('daily-reminder').get()),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: remindersSupported,
  });
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const running = useRef(false);
  const preference = query.data ?? DEFAULT_REMINDER;
  /** Applies `next`; false when it wasn't (busy, stale session or permission refused). */
  async function update(next: ReminderPreference): Promise<boolean> {
    if (running.current || !scope.isCurrent()) return false;
    running.current = true;
    setBusy(true);
    try {
      if (next.enabled && !preference.enabled) {
        const granted = await requestReminderPermission().catch(() => false);
        if (!scope.isCurrent()) return false;
        setBlocked(!granted);
        if (!granted) return false;
      }
      if (!next.enabled) setBlocked(false);
      scope.queryClient.setQueryData(key, next);
      await scope.cache.item('daily-reminder').set(JSON.stringify(next));
      return true;
    } finally {
      running.current = false;
      if (scope.isCurrent()) setBusy(false);
    }
  }
  return {
    supported: remindersSupported,
    ready: query.data !== undefined,
    preference,
    busy,
    /** Permission was refused; only system settings can turn it back on. */
    blocked,
    update: (next: ReminderPreference) => void update(next),
    /** As `update`, resolving true once applied. */
    apply: update,
    openSystemSettings: () => void Linking.openSettings(),
  };
}

/**
 * Keeps the device's reminders matching the daily review: rescheduled whenever the
 * review or the choice changes (answers, finished reviews and time zone changes
 * refresh the review), and removed when the session ends.
 */
export function DailyReminders() {
  const { scope } = useSessionScope();
  const { preference, ready } = useReminderPreference();
  const review = useDailyReview({ enabled: ready && preference.enabled });
  const waiting = preference.enabled && review.isPending;
  useEffect(() => {
    if (!ready || waiting) return;
    const plan = planReminders({
      preference,
      watch: review.data?.watch,
      review: review.data,
      now: new Date(),
    });
    void enqueue(async () => {
      if (scope.isCurrent()) await replaceReminders(plan);
    });
  }, [scope, ready, waiting, preference, review.data]);
  useEffect(
    () => () => {
      // Signed out or switched account: this account's reminders must not fire.
      if (!scope.isCurrent()) cancelDailyReminders();
    },
    [scope],
  );
  return null;
}
