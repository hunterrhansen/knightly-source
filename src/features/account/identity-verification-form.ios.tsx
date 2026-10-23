import { ProgressView, Text } from '@expo/ui/swift-ui';
import {
  NativeSettingsActionRow,
  NativeSettingsRow,
  NativeSettingsSection,
  NativeSettingsTextFieldRow,
} from '../../ui/native-settings';
import type { IdentityVerificationFormProps } from './identity-verification-form-types';
export function IdentityVerificationForm({
  notice,
  secondFactor,
  busy,
  error,
  credential,
  onCredentialChange,
  method,
  methods,
  onSubmit,
  onAnotherMethod,
  onCancel,
}: IdentityVerificationFormProps) {
  return (
    <NativeSettingsSection
      title="Verify your identity"
      footer={
        secondFactor
          ? 'Complete your second factor before deleting account data.'
          : 'Verify your credentials before Knightly deletes any account data.'
      }
    >
      {notice && (
        <NativeSettingsRow label="Preview only" description={notice} />
      )}
      {busy && (
        <ProgressView>
          <Text>Checking…</Text>
        </ProgressView>
      )}
      {method ? (
        <>
          <NativeSettingsRow label={method.label} />
          <NativeSettingsTextFieldRow
            label={
              method.password ? 'Verification password' : 'Verification code'
            }
            placeholder={method.password ? 'Password' : 'Code'}
            value={credential}
            onChange={onCredentialChange}
            secure={method.password}
            numeric={method.numeric}
            contentType={method.password ? 'password' : 'oneTimeCode'}
            disabled={busy}
            autoFocus
            onSubmit={onSubmit}
          />
          <NativeSettingsActionRow
            label="Verify identity"
            disabled={busy || !credential}
            onPress={onSubmit}
          />
          <NativeSettingsActionRow
            label="Use another method"
            disabled={busy}
            onPress={onAnotherMethod}
          />
        </>
      ) : (
        methods.map((item) => (
          <NativeSettingsActionRow
            key={item.key}
            label={item.label}
            disabled={busy}
            onPress={item.onSelect}
          />
        ))
      )}
      {!busy && !method && !methods.length && (
        <NativeSettingsRow
          label="No supported verification method is available for this session."
          description="Account data will stay intact."
        />
      )}
      {!!error && (
        <NativeSettingsRow label="Could not verify" description={error} />
      )}
      <NativeSettingsActionRow label="Cancel verification" onPress={onCancel} />
    </NativeSettingsSection>
  );
}
