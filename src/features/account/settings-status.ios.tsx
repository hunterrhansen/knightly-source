import { ProgressView, Text } from '@expo/ui/swift-ui';
import {
  NativeSettingsActionRow,
  NativeSettingsForm,
  NativeSettingsRow,
  NativeSettingsSection,
} from '../../ui/native-settings';
export function SettingsStatus({
  title,
  message,
  action,
  onAction,
  disabled,
  loading,
}: {
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <NativeSettingsForm>
      <NativeSettingsSection title={title}>
        {loading ? (
          <ProgressView>
            <Text>{title}</Text>
          </ProgressView>
        ) : (
          <NativeSettingsRow label={message ?? title} />
        )}
        {action && onAction && (
          <NativeSettingsActionRow
            label={action}
            onPress={onAction}
            disabled={disabled}
          />
        )}
      </NativeSettingsSection>
    </NativeSettingsForm>
  );
}
