import { Text } from 'react-native';
import { createStyles } from '../../theme/theme';
import {
  SettingsActionRow,
  SettingsChoiceList,
  SettingsRow,
  SettingsSection,
} from '../../ui';
import { practicePaceFooter, practicePaceOptions } from './practice-pace';
import type { SettingsPanelsProps } from './settings-panels-types';

export function SettingsPanels({
  section,
  settings,
  busy = false,
  message,
  onAnalysis,
  onPace,
  onSync,
  onRemove,
  onExport,
  onDeleteAccount,
  deleteUnavailable,
  onRetry,
  connectionForm,
  preview = false,
}: SettingsPanelsProps) {
  const styles = useStyles();
  return (
    <>
      {!!message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      )}
      {onRetry && (
        <SettingsActionRow
          label="Retry settings"
          onPress={onRetry}
          disabled={busy}
        />
      )}
      {(!section || section === 'connections') && (
        <SettingsSection
          title="Accounts"
          padded={false}
          footer="Removing a connection keeps its imported games."
        >
          {settings.accounts.length ? (
            settings.accounts.flatMap((account) => [
              <SettingsRow
                key={`${account.source}:${account.handle}`}
                label={account.handle}
                description={`${account.source === 'chesscom' ? 'Chess.com' : account.source === 'lichess' ? 'Lichess' : account.source}${account.synced_through ? ` · Synced through ${account.synced_through}` : ''}`}
              />,
              ...(onRemove
                ? [
                    <SettingsActionRow
                      key={`remove:${account.source}:${account.handle}`}
                      label="Remove"
                      accessibilityLabel={`Remove ${account.handle}`}
                      destructive
                      disabled={busy}
                      onPress={() => onRemove(account.source, account.handle)}
                    />,
                  ]
                : []),
            ])
          ) : (
            <SettingsRow
              label="No linked accounts"
              description="Connect a public chess account to import games."
            />
          )}
          {connectionForm && (
            <SettingsRow label="Connect an account">
              {connectionForm}
            </SettingsRow>
          )}
        </SettingsSection>
      )}
      {(!section || section === 'updates') && (
        <SettingsSection
          title="Status"
          padded={false}
          footer="Sync linked accounts and analyze new games. Daily scheduling is not configurable in this app yet."
        >
          <SettingsRow
            label="Update status"
            value={
              settings.running
                ? 'Queued or running'
                : (settings.last_run?.status ?? 'No update yet')
            }
          />
          {settings.last_run && (
            <SettingsRow
              label="Latest update"
              value={new Date(settings.last_run.started_at).toLocaleString()}
              description={`${settings.last_run.new_games ?? 0} new games · ${settings.last_run.games_analysed ?? 0} analyzed`}
            />
          )}
          {[...new Set(settings.last_run?.errors ?? [])].map((error) => (
            <SettingsRow key={error} label="Update issue" description={error} />
          ))}
          {onSync && (
            <SettingsActionRow
              label={settings.running ? 'Updating…' : 'Run update now'}
              disabled={busy || settings.running}
              onPress={onSync}
            />
          )}
          {settings.earlier_runs.map((run) => (
            <SettingsRow
              key={run.started_at}
              label={new Date(run.started_at).toLocaleString()}
              description={`${run.status} · ${run.new_games ?? 0} new games · ${run.games_analysed ?? 0} analyzed`}
            />
          ))}
        </SettingsSection>
      )}
      {(!section || section === 'analysis') && (
        <>
          <SettingsSection title="Engine & practice" padded={false}>
            <SettingsRow
              label="Engine"
              value={settings.engine ?? 'Unavailable'}
            />
            <SettingsRow
              label="Practice scheduling"
              description={
                settings.fsrs.personal
                  ? 'FSRS tuned to your answers'
                  : `${settings.fsrs.reviews} of ${settings.fsrs.needed} reviews toward personalized FSRS tuning`
              }
            />
          </SettingsSection>
          <SettingsChoiceList
            title="Daily practice"
            value={settings.pace}
            disabled={busy || !onPace}
            onChange={(value) => onPace?.(value)}
            footer={practicePaceFooter}
            options={practicePaceOptions}
          />
          <SettingsChoiceList
            title="Analysis depth"
            value={String(settings.nodes)}
            disabled={busy || !onAnalysis}
            onChange={(value) => onAnalysis?.(Number(value))}
            footer="Depth applies to games analyzed from now on. Move classification uses the existing fixed bands."
            options={[
              { value: '200000', label: 'Fast' },
              { value: '500000', label: 'Standard' },
              { value: '1000000', label: 'Deep' },
              ...([200000, 500000, 1000000].includes(settings.nodes)
                ? []
                : [
                    {
                      value: String(settings.nodes),
                      label: `Custom (${settings.nodes.toLocaleString()} nodes)`,
                    },
                  ]),
            ]}
          />
        </>
      )}
      {(!section || section === 'data') && (
        <>
          <SettingsSection
            title="Usage"
            padded={false}
            footer="Your games, analysis and learning history."
          >
            <SettingsRow
              label="Games"
              value={settings.your_data.games.toLocaleString()}
              description={`${settings.your_data.analysed.toLocaleString()} analyzed`}
            />
            <SettingsRow
              label="Storage"
              value={`${(settings.your_data.approx_bytes / 1024 / 1024).toFixed(1)} MB`}
              description={
                settings.your_data.first_game
                  ? `Games since ${new Date(settings.your_data.first_game).toLocaleDateString()}`
                  : 'No games stored yet.'
              }
            />
            <SettingsRow
              label="History"
              value={
                settings.limits.history_months === null
                  ? 'All available games'
                  : `${settings.limits.history_months} months`
              }
            />
            <SettingsRow
              label="Analysis limit"
              value={
                settings.limits.max_analysed?.toLocaleString() ?? 'Unlimited'
              }
            />
            <SettingsRow
              label="Connections limit"
              value={String(settings.limits.max_accounts)}
            />
          </SettingsSection>
          <SettingsSection
            title="Data management"
            padded={false}
            footer="Export your PGN/CSV archive before deleting your account."
          >
            {onExport ? (
              <SettingsActionRow
                label="Download your data"
                disabled={busy}
                onPress={onExport}
              />
            ) : (
              <SettingsRow
                label="Export"
                description={
                  preview
                    ? 'Sign in to download your PGN/CSV archive.'
                    : 'Download your PGN/CSV archive from Knightly on web.'
                }
              />
            )}
            {onDeleteAccount && (
              <SettingsActionRow
                label="Delete account"
                destructive
                disabled={busy}
                onPress={onDeleteAccount}
              />
            )}
            {deleteUnavailable && (
              <SettingsRow
                label="Account deletion"
                description="Account deletion is unavailable for this sign-in provider."
              />
            )}
          </SettingsSection>
        </>
      )}
    </>
  );
}
const useStyles = createStyles((theme) => ({
  error: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.dangerText,
  },
}));
