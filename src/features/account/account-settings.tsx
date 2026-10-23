import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Text } from 'react-native';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { createStyles } from '../../theme/theme';
import { Button, SettingsActionRow, SettingsConfirmation } from '../../ui';
import { createAccountDeletion } from './account-deletion';
import { ConnectionForm } from './connection-form';
import { DeleteConfirmationForm } from './delete-confirmation-form';
import { SettingsPanels } from './settings-panels';
import { SettingsStatus } from './settings-status';
import { canExport, saveExport, useDeleteIdentity } from './user-data';

export function AccountSettingsPanels({ section }: { section?: string }) {
  const styles = useStyles();
  const { scope } = useSessionScope();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [message, setMessage] = useState('');
  const [remove, setRemove] = useState<{ source: string; handle: string }>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [word, setWord] = useState('');
  const [purged, setPurged] = useState(false);
  const identity = useDeleteIdentity();
  const deleteIdentity = identity.remove;
  const identityRef = useRef(deleteIdentity);
  const prepareRef = useRef(identity.prepare);
  prepareRef.current = identity.prepare;
  identityRef.current = deleteIdentity;
  const deletion = useMemo(
    () =>
      createAccountDeletion(
        () => scope.api.deleteAccount(),
        async () => {
          if (!identityRef.current)
            throw new Error('Account deletion is unavailable.');
          await identityRef.current();
        },
        scope.isCurrent,
        () => prepareRef.current(),
      ),
    [scope],
  );
  const query = useQuery({
    queryKey: [...scope.meKey, 'settings'],
    queryFn: ({ signal }) => scope.api.settings(signal),
    retry: false,
    enabled: !purged && !deleteOpen,
    refetchInterval: (q) => (q.state.data?.running ? 5000 : false),
  });
  async function action(operation: () => Promise<unknown>, refresh = true) {
    if (running.current || !scope.isCurrent()) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      await operation();
      if (!scope.isCurrent()) return;
      if (refresh)
        await scope.queryClient.invalidateQueries({ queryKey: scope.meKey });
    } catch (error) {
      if (scope.isCurrent())
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not finish. Try again.',
        );
    } finally {
      if (scope.isCurrent()) {
        setBusy(false);
        setPurged(deletion.dataDeleted);
      }
      running.current = false;
    }
  }
  if (purged)
    return (
      <>
        <SettingsStatus
          title="Finish deleting your account"
          message={
            message ||
            'Your Knightly data was deleted. Finish deleting your sign-in; the data purge will not repeat.'
          }
          action="Finish deleting sign-in"
          disabled={busy}
          onAction={() => void action(() => deletion.run(), false)}
        />
        {identity.verificationUI && (
          <SettingsConfirmation
            title="Verify identity"
            onCancel={identity.cancel}
          >
            {identity.verificationUI}
          </SettingsConfirmation>
        )}
      </>
    );
  if (!query.data)
    return query.error ? (
      <SettingsStatus
        title="Could not load settings"
        message={query.error.message}
        action="Retry settings"
        onAction={() => void query.refetch()}
      />
    ) : (
      <SettingsStatus title="Loading your settings…" loading />
    );
  return (
    <>
      {remove && (
        <SettingsConfirmation
          title={`Remove ${remove.handle}?`}
          onCancel={() => setRemove(undefined)}
          busy={busy}
        >
          <Text style={styles.quiet}>
            This stops syncing the account. Its imported games stay in Knightly.
          </Text>
          <SettingsActionRow
            label="Confirm removal"
            destructive
            disabled={busy}
            onPress={() =>
              void action(async () => {
                await scope.api.removeConnection(remove.source, remove.handle);
                if (scope.isCurrent()) setRemove(undefined);
              })
            }
          />
          <Button disabled={busy} onPress={() => setRemove(undefined)}>
            Keep connection
          </Button>
        </SettingsConfirmation>
      )}
      <SettingsPanels
        section={section}
        settings={query.data}
        connectionForm={
          <ConnectionForm
            disabled={busy || deleteOpen}
            onBusyChange={(value) => {
              running.current = value;
              setBusy(value);
            }}
          />
        }
        busy={busy || deleteOpen}
        message={message || query.error?.message}
        onAnalysis={(nodes) => void action(() => scope.api.setAnalysis(nodes))}
        onPace={(pace) => void action(() => scope.api.setPractice(pace))}
        onSync={() => void action(() => scope.api.sync())}
        onRemove={(source, handle) => {
          if (Platform.OS === 'ios')
            Alert.alert(
              `Remove ${handle}?`,
              'This stops syncing the account. Imported games stay in Knightly.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    void action(() =>
                      scope.api.removeConnection(source, handle),
                    ),
                },
              ],
            );
          else setRemove({ source, handle });
        }}
        onExport={
          canExport
            ? () =>
                void action(async () => {
                  const data = await scope.api.exportData();
                  if (scope.isCurrent())
                    await saveExport(data, scope.isCurrent);
                }, false)
            : undefined
        }
        onDeleteAccount={
          deleteIdentity
            ? () => {
                setMessage('');
                setDeleteOpen(true);
              }
            : undefined
        }
        deleteUnavailable={!deleteIdentity}
        onRetry={query.error ? () => void query.refetch() : undefined}
      />
      {deleteOpen && (
        <SettingsConfirmation
          title="Delete account"
          onCancel={() => {
            identity.cancel();
            setDeleteOpen(false);
            setWord('');
          }}
          busy={busy && !identity.verificationUI}
        >
          {identity.verificationUI ?? (
            <DeleteConfirmationForm
              word={word}
              busy={busy}
              error={message}
              onWordChange={setWord}
              onConfirm={() => {
                if (!busy && word === 'delete')
                  void action(() => deletion.run(), false);
              }}
              onCancel={() => {
                setDeleteOpen(false);
                setWord('');
              }}
            />
          )}
        </SettingsConfirmation>
      )}
    </>
  );
}
const useStyles = createStyles((theme) => ({
  quiet: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.inkMuted,
  },
}));
