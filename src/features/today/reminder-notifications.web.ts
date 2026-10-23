import type { PlannedReminder } from './reminder-schedule';

// No web reminders in this release.
export const remindersSupported = false;

export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

export async function cancelReminders() {}

export async function replaceReminders(_plan: PlannedReminder[]) {}
