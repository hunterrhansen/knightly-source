import {
  NativeSettingsActionRow,
  NativeSettingsRow,
  NativeSettingsSection,
  NativeSettingsTextFieldRow,
} from '../../ui/native-settings';
import type { DeleteConfirmationFormProps } from './delete-confirmation-form-types';
export function DeleteConfirmationForm({
  notice,
  word,
  busy,
  error,
  onWordChange,
  onConfirm,
  onCancel,
}: DeleteConfirmationFormProps) {
  return (
    <>
      <NativeSettingsSection title="Before you continue">
        {notice && (
          <NativeSettingsRow label="Preview only" description={notice} />
        )}
        <NativeSettingsRow
          label="Delete your account permanently?"
          description="This deletes your games, analysis, learning history and Knightly sign-in. Chess.com and Lichess accounts are untouched. Download a copy first."
        />
      </NativeSettingsSection>
      <NativeSettingsSection
        title="Confirmation"
        footer="Type delete to confirm account deletion."
      >
        <NativeSettingsTextFieldRow
          label="Type delete to confirm account deletion"
          placeholder="Type delete"
          value={word}
          onChange={onWordChange}
          disabled={busy}
          autoFocus
        />
        {error && (
          <NativeSettingsRow
            label="Could not delete account"
            description={error}
          />
        )}
        <NativeSettingsActionRow
          label="Delete everything permanently"
          destructive
          disabled={busy || word !== 'delete'}
          onPress={onConfirm}
        />
        <NativeSettingsActionRow
          label="Keep my account"
          disabled={busy}
          onPress={onCancel}
        />
      </NativeSettingsSection>
    </>
  );
}
