import {
  NativeSettingsActionRow,
  NativeSettingsForm,
  NativeSettingsNavigationRow,
  NativeSettingsPickerRow,
  NativeSettingsRow,
  NativeSettingsSection,
} from '../../ui/native-settings';
import {
  BLOCKED_MESSAGE,
  previewReminderSettings,
  REMINDER_FOOTER,
  type ReminderSettingsView,
  useReminderSettings,
} from './reminder-settings-model';

function ReminderPanel({ view }: { view: ReminderSettingsView }) {
  return (
    <NativeSettingsForm>
      <NativeSettingsSection title="Your watch">
        <NativeSettingsNavigationRow
          label="Time and habit"
          value={view.watch.time}
          description={
            view.watch.anchor ?? 'Choose the habit your watch follows.'
          }
          onPress={view.onOpenWatch}
        />
      </NativeSettingsSection>
      <NativeSettingsSection title="Daily reminder" footer={REMINDER_FOOTER}>
        <NativeSettingsPickerRow
          label="Remind me"
          value={view.value}
          disabled={view.disabled}
          onChange={view.onChange}
          options={view.choices}
        />
      </NativeSettingsSection>
      {view.blocked && (
        <NativeSettingsSection>
          <NativeSettingsRow
            label="Notifications are off"
            description={BLOCKED_MESSAGE}
          />
          <NativeSettingsActionRow
            label="Open Settings"
            onPress={view.onOpenSystemSettings}
          />
        </NativeSettingsSection>
      )}
    </NativeSettingsForm>
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
