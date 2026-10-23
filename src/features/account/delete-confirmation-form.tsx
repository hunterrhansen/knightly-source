import { Text } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Button, SettingsActionRow, TextField } from '../../ui';
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
  const styles = useStyles();
  return (
    <>
      {notice && <Text style={styles.quiet}>{notice}</Text>}
      <Text style={styles.label}>Delete your account permanently?</Text>
      <Text style={styles.quiet}>
        This deletes your games, analysis, learning history and Knightly
        sign-in. Chess.com and Lichess accounts are untouched. Download a copy
        first.
      </Text>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <TextField
        label="Type delete to confirm account deletion"
        accessibilityLabel="Type delete to confirm account deletion"
        placeholder="Type delete"
        autoCapitalize="none"
        autoCorrect={false}
        value={word}
        onChangeText={onWordChange}
        editable={!busy}
        autoFocus
      />
      <SettingsActionRow
        label="Delete everything permanently"
        destructive
        disabled={busy || word !== 'delete'}
        onPress={onConfirm}
      />
      <Button disabled={busy} onPress={onCancel}>
        Keep my account
      </Button>
    </>
  );
}
const useStyles = createStyles((theme) => ({
  label: {
    fontFamily: theme.typography.bold,
    fontSize: 16,
    color: theme.colors.ink,
  },
  quiet: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.inkMuted,
  },
  error: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.dangerText,
  },
}));
