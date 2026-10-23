import { router } from 'expo-router';
import { useReminderPreference } from './daily-reminders';
import { remindersSupported } from './reminder-notifications';
import { DEFAULT_WATCH_TIME, reminderTimeLabel } from './reminder-schedule';
import { useDailyReview } from './use-daily-review';

type ReminderChoice = 'off' | 'on';

export const REMINDER_FOOTER =
  'One notification at your watch time, only on days you haven’t kept your watch. It asks for notification permission when you turn it on.';
export const BLOCKED_MESSAGE =
  'Notifications are off for Knightly. Turn them on in system settings to get reminders.';

export type ReminderSettingsView = {
  supported: boolean;
  /** "8:00 PM", and the habit it follows ("After I finish dinner") once chosen. */
  watch: { time: string; anchor?: string };
  onOpenWatch: () => void;
  value: ReminderChoice;
  choices: { value: ReminderChoice; label: string }[];
  disabled: boolean;
  blocked: boolean;
  onChange: (value: ReminderChoice) => void;
  onOpenSystemSettings: () => void;
};

const choicesAt = (time: string) => [
  { value: 'off' as const, label: 'Off' },
  { value: 'on' as const, label: `At ${time}` },
];

/** Settings → Your watch: the watch (edited on its own screen) and whether this
 * device reminds at its time. */
export function useReminderSettings(): ReminderSettingsView {
  const reminder = useReminderPreference();
  const review = useDailyReview();
  const watch = review.data?.watch;
  const time = watch?.time ?? reminder.preference.time;
  return {
    supported: reminder.supported,
    watch: {
      time: reminderTimeLabel(time),
      anchor: watch ? `After I ${watch.anchor}` : undefined,
    },
    onOpenWatch: () => router.push('/watch'),
    value: reminder.preference.enabled ? 'on' : 'off',
    choices: choicesAt(reminderTimeLabel(time)),
    disabled: !reminder.ready || reminder.busy,
    blocked: reminder.blocked,
    onChange: (value) => reminder.update({ enabled: value === 'on', time }),
    onOpenSystemSettings: reminder.openSystemSettings,
  };
}

/** Account previews have no session: show the defaults, inert. */
export const previewReminderSettings: ReminderSettingsView = {
  supported: remindersSupported,
  watch: { time: reminderTimeLabel(DEFAULT_WATCH_TIME) },
  onOpenWatch: () => {},
  value: 'off',
  choices: choicesAt(reminderTimeLabel(DEFAULT_WATCH_TIME)),
  disabled: true,
  blocked: false,
  onChange: () => {},
  onOpenSystemSettings: () => {},
};
