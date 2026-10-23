import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { createStyles } from '../../theme/theme';
import {
  Body,
  Button,
  Card,
  ListItem,
  Notice,
  Page,
  TextField,
  useFoundationStyles,
} from '../../ui';
import { ImportProgress } from './import-progress';
import {
  useChessLookup,
  useImportActions,
  useImportProgress,
} from './use-games';
export function ConnectGamesScreen() {
  const styles = useStyles();
  const foundationStyles = useFoundationStyles();
  const [handle, setHandle] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [validation, setValidation] = useState('');
  const pending = useRef(false);
  const lookup = useChessLookup(submitted);
  const { progress, status } = useImportProgress();
  const { connect, sync } = useImportActions();
  const working =
    !!progress.data?.working ||
    !!status.data?.current_run ||
    !!status.data?.queued.length;
  function search() {
    const value = handle.trim();
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(value)) {
      setValidation('Enter your Chess.com username, not a profile URL.');
      return;
    }
    setValidation('');
    setSubmitted(value);
    if (submitted.toLowerCase() === value.toLowerCase()) void lookup.refetch();
  }
  async function confirm() {
    if (!lookup.data || pending.current) return;
    pending.current = true;
    try {
      await connect.mutateAsync(lookup.data.handle);
      setSubmitted('');
    } catch {
      /* The mutation error is shown below. */
    } finally {
      pending.current = false;
    }
  }
  return (
    <Page safeArea avoidKeyboard title="Connect Chess.com">
      <Body>
        Import your public games. Knightly never asks for your Chess.com
        password.
      </Body>
      {!progress.data ? (
        <Notice
          title={
            progress.error
              ? 'Could not load connected accounts'
              : 'Loading connected accounts…'
          }
          message={progress.error?.message}
          action={progress.error ? 'Retry' : undefined}
          onAction={() => void progress.refetch()}
        />
      ) : (
        <>
          {progress.data.accounts.length > 0 ? (
            <>
              {progress.data.accounts.map((a) => (
                <ListItem
                  key={`${a.source}:${a.handle}`}
                  label={a.source === 'chesscom' ? 'Chess.com' : 'Lichess'}
                  description={a.handle}
                />
              ))}
              <ImportProgress progress={progress.data} status={status.data} />
              <Button
                disabled={working || sync.isPending}
                onPress={() => sync.mutate()}
              >
                {sync.isPending ? 'Requesting sync…' : 'Sync games'}
              </Button>
              {sync.error && (
                <Notice
                  title="Could not start sync"
                  message={sync.error.message}
                />
              )}
            </>
          ) : (
            <>
              <Text style={styles.label}>Chess.com username</Text>
              <TextField
                label="Chess.com username"
                hideLabel
                variant="search"
                accessibilityLabel="Chess.com username"
                value={handle}
                onChangeText={(value) => {
                  setHandle(value);
                  setSubmitted('');
                  setValidation('');
                  connect.reset();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
                returnKeyType="search"
                onSubmitEditing={search}
                editable={!connect.isPending}
              />
              {validation && <Body>{validation}</Body>}
              <Button
                disabled={
                  connect.isPending || (!!submitted && lookup.isFetching)
                }
                onPress={search}
              >
                {submitted && lookup.isFetching
                  ? 'Finding account…'
                  : 'Find account'}
              </Button>
              {submitted && lookup.error && (
                <Notice
                  title="Could not find that account"
                  message={lookup.error.message}
                  action="Try again"
                  onAction={() => void lookup.refetch()}
                />
              )}
              {submitted && lookup.data && (
                <Card tone="muted">
                  <Text accessibilityRole="header" style={styles.label}>
                    Is this your account?
                  </Text>
                  <Body>{lookup.data.handle}</Body>
                  <Body>
                    {lookup.data.rating === null
                      ? 'No rating available'
                      : `${lookup.data.rating_kind ?? 'Chess'} rating: ${lookup.data.rating}`}{' '}
                    · {lookup.data.games} public games
                  </Body>
                  <Button
                    disabled={connect.isPending || lookup.isFetching}
                    onPress={() => void confirm()}
                  >
                    {connect.isPending ? 'Connecting…' : 'Yes, import my games'}
                  </Button>
                  <Button
                    disabled={connect.isPending}
                    onPress={() => {
                      setSubmitted('');
                      connect.reset();
                    }}
                  >
                    Use a different username
                  </Button>
                </Card>
              )}
              {connect.error && (
                <Notice
                  title="Could not connect account"
                  message={connect.error.message}
                />
              )}
            </>
          )}
          {progress.error && (
            <Notice
              title="Progress could not refresh"
              message={progress.error.message}
              action="Retry progress"
              onAction={() => void progress.refetch()}
            />
          )}
        </>
      )}
      {status.error && (
        <Notice
          title="Import status unavailable"
          message={status.error.message}
          action="Retry status"
          onAction={() => void status.refetch()}
        />
      )}
      <Link href="/games" asChild>
        <Text style={foundationStyles.link}>View games</Text>
      </Link>
      <Link href="/" asChild>
        <Text style={foundationStyles.link}>Back to Today</Text>
      </Link>
    </Page>
  );
}
const useStyles = createStyles((theme) => ({
  label: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
}));
