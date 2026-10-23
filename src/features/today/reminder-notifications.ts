import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PlannedReminder } from './reminder-schedule';

// Local notifications only: no push token, no server registration.
export const remindersSupported = true;

const CHANNEL = 'daily-reminders';
// One per local day: knightly.daily-reminder.2026-10-18 (earlier builds: .today, .tomorrow).
const PREFIX = 'knightly.daily-reminder.';

// Android 13 shows the permission prompt only once a channel exists.
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Asks for notification permission (only on opt-in). True when reminders can show. */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true },
  });
  return asked.granted;
}

/** Removes Knightly's scheduled daily reminders (and nothing else). */
export async function cancelReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.identifier.startsWith(PREFIX))
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
}

/** Replaces the scheduled daily reminders with `plan`. */
export async function replaceReminders(plan: PlannedReminder[]) {
  await cancelReminders();
  if (!plan.length) return;
  // Permission can be withdrawn in system settings at any time.
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannel();
  for (const reminder of plan)
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + reminder.id,
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
        channelId: CHANNEL,
      },
    });
}
