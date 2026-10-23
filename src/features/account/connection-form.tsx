import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { Button, Card, TextField, ToggleGroup } from '../../ui';
import { useConnectionForm } from './use-connection-form';
export function ConnectionForm({
  disabled,
  onBusyChange,
}: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const styles = useStyles();
  const {
    source,
    setSource,
    handle,
    setHandle,
    submitted,
    setSubmitted,
    message,
    setMessage,
    busy,
    lookup,
    confirm,
    findAccount,
  } = useConnectionForm({ disabled, onBusyChange });
  return (
    <View style={styles.form}>
      <Text style={styles.label}>Add a game account</Text>
      <ToggleGroup
        label="Game site"
        value={source}
        disabled={disabled || busy}
        onChange={(value) => {
          setSource(value);
          setSubmitted('');
          setMessage('');
        }}
        options={[
          { value: 'chesscom', label: 'Chess.com' },
          { value: 'lichess', label: 'Lichess' },
        ]}
      />
      <TextField
        label="Game account username"
        accessibilityLabel="Game account username"
        placeholder="Username"
        value={handle}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={findAccount}
        editable={!disabled && !busy}
        onChangeText={(value) => {
          setHandle(value);
          setSubmitted('');
          setMessage('');
        }}
      />
      <Text style={styles.quiet}>
        Connect public games. Knightly never asks for your chess-site password.
      </Text>
      <Button
        disabled={disabled || busy || lookup.isFetching}
        onPress={findAccount}
      >
        Find account
      </Button>
      {lookup.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {lookup.error.message}
        </Text>
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      )}
      {lookup.data && !!submitted && (
        <Card
          title={`Connect ${lookup.data.handle}?`}
          description={`${source === 'chesscom' ? 'Chess.com' : 'Lichess'} · ${lookup.data.games.toLocaleString()} public games. Confirming imports this account’s games.`}
        >
          <Button
            disabled={disabled || busy || lookup.isFetching}
            onPress={() => void confirm()}
          >
            Confirm connection
          </Button>
          <Button disabled={busy} onPress={() => setSubmitted('')}>
            Cancel
          </Button>
        </Card>
      )}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  form: {
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
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
