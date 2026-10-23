import {
  SettingsActionRow,
  SettingsChoiceList,
  SettingsNavigationRow,
  SettingsRow,
  SettingsSection,
} from '../../ui';
import {
  BLOCKED_MESSAGE,
  previewReminderSettings,
  REMINDER_FOOTER,
  type ReminderSettingsView,
  useReminderSettings,
} from './reminder-settings-model';

function WatchSection({ view }: { view: ReminderSettingsView }) {
  return (
    <SettingsSection title="Your watch" padded={false}>
      <SettingsNavigationRow
        label="Time and habit"
        value={view.watch.time}
        description={
          view.watch.anchor ?? 'Choose the habit your watch follows.'
        }
        onPress={view.onOpenWatch}
      />
    </SettingsSection>
  );
}

function ReminderPanel({ view }: { view: ReminderSettingsView }) {
  if (!view.supported)
    return (
      <>
        <WatchSection view={view} />
        <SettingsSection title="Daily reminder" padded={false}>
          <SettingsRow
            label="Reminders"
            description="Daily reminders are available in the iOS and Android apps."
          />
        </SettingsSection>
      </>
    );
  return (
    <>
      <WatchSection view={view} />
      <SettingsChoiceList
        title="Remind me"
        value={view.value}
        disabled={view.disabled}
        onChange={view.onChange}
        options={view.choices}
        footer={REMINDER_FOOTER}
      />
      {view.blocked && (
        <SettingsSection padded={false}>
          <SettingsRow
            label="Notifications are off"
            description={BLOCKED_MESSAGE}
          />
          <SettingsActionRow
            label="Open Settings"
            onPress={view.onOpenSystemSettings}
          />
        </SettingsSection>
      )}
    </>
  );
}

function ConnectedReminderSettings() {
  return <ReminderPanel view={useReminderSettings()} />;
}

/** Settings → Your watch: the watch time and habit, and whether to be reminded. */
export function ReminderSettings({ preview = false }: { preview?: boolean }) {
  return preview ? (
    <ReminderPanel view={previewReminderSettings} />
  ) : (
    <ConnectedReminderSettings />
  );
}
