import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { SettingsActionRow, TextField } from '../../ui';
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
  const styles = useStyles();
  return (
    <View style={styles.content}>
      {notice && <Text style={styles.quiet}>{notice}</Text>}
      <Text accessibilityRole="header" style={styles.title}>
        Verify your identity
      </Text>
      <Text style={styles.quiet}>
        {secondFactor
          ? 'Complete your second factor before deleting account data.'
          : 'Verify your credentials before Knightly deletes any account data.'}
      </Text>
      {busy && (
        <Text accessibilityLiveRegion="polite" style={styles.quiet}>
          Checking…
        </Text>
      )}
      {method ? (
        <>
          <TextField
            label={method.label}
            accessibilityLabel={
              method.password ? 'Verification password' : 'Verification code'
            }
            placeholder={method.password ? 'Password' : 'Code'}
            secureTextEntry={method.password}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            textContentType={method.password ? 'password' : 'oneTimeCode'}
            value={credential}
            editable={!busy}
            onChangeText={onCredentialChange}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          <SettingsActionRow
            label="Verify identity"
            disabled={busy || !credential}
            onPress={onSubmit}
          />
          <SettingsActionRow
            label="Use another method"
            disabled={busy}
            onPress={onAnotherMethod}
          />
        </>
      ) : (
        methods.map((item) => (
          <SettingsActionRow
            key={item.key}
            label={item.label}
            disabled={busy}
            onPress={item.onSelect}
          />
        ))
      )}
      {!busy && !method && !methods.length && (
        <Text style={styles.quiet}>
          No supported verification method is available for this session.
          Account data will stay intact.
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <SettingsActionRow label="Cancel verification" onPress={onCancel} />
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  content: { gap: 12 },
  title: {
    fontFamily: theme.typography.heading,
    fontSize: 22,
    color: theme.colors.ink,
  },
  quiet: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.inkMuted,
  },

  error: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.dangerText,
  },
}));
