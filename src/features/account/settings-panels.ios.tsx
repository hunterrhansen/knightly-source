import {
  NativeSettingsActionRow,
  NativeSettingsForm,
  NativeSettingsPickerRow,
  NativeSettingsRow,
  NativeSettingsSection,
} from '../../ui/native-settings';
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
  connectionForm,
  preview = false,
  onRetry,
}: SettingsPanelsProps) {
  return (
    <NativeSettingsForm>
      {message && (
        <NativeSettingsSection title="Settings notice">
          <NativeSettingsRow label={message} />
        </NativeSettingsSection>
      )}
      {onRetry && (
        <NativeSettingsSection>
          <NativeSettingsActionRow
            label="Retry settings"
            onPress={onRetry}
            disabled={busy}
          />
        </NativeSettingsSection>
      )}
      {(!section || section === 'connections') && (
        <>
          <NativeSettingsSection
            title="Accounts"
            footer="Removing a connection keeps its imported games."
          >
            {settings.accounts.length ? (
              settings.accounts.flatMap((account) => [
                <NativeSettingsRow
                  key={`${account.source}:${account.handle}`}
                  label={account.handle}
                  description={`${account.source === 'chesscom' ? 'Chess.com' : account.source === 'lichess' ? 'Lichess' : account.source}${account.synced_through ? ` · Synced through ${account.synced_through}` : ''}`}
                />,
                ...(onRemove
                  ? [
                      <NativeSettingsActionRow
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
              <NativeSettingsRow
                label="No linked accounts"
                description="Connect a public chess account to import games."
              />
            )}
          </NativeSettingsSection>
          {connectionForm}
        </>
      )}
      {(!section || section === 'updates') && (
        <>
          <NativeSettingsSection
            title="Status"
            footer="Sync linked accounts and analyze new games. Daily scheduling is not configurable in this app yet."
          >
            <NativeSettingsRow
              label="Update status"
              value={
                settings.running
                  ? 'Queued or running'
                  : (settings.last_run?.status ?? 'No update yet')
              }
            />
            {settings.last_run && (
              <NativeSettingsRow
                label="Latest update"
                value={new Date(settings.last_run.started_at).toLocaleString()}
                description={`${settings.last_run.new_games ?? 0} new games · ${settings.last_run.games_analysed ?? 0} analyzed`}
              />
            )}
            {[...new Set(settings.last_run?.errors ?? [])].map((error) => (
              <NativeSettingsRow
                key={error}
                label="Update issue"
                description={error}
              />
            ))}
            {onSync && (
              <NativeSettingsActionRow
                label={settings.running ? 'Updating…' : 'Run update now'}
                disabled={busy || settings.running}
                onPress={onSync}
              />
            )}
          </NativeSettingsSection>
          {!!settings.earlier_runs.length && (
            <NativeSettingsSection title="Earlier updates">
              {settings.earlier_runs.map((run) => (
                <NativeSettingsRow
                  key={run.started_at}
                  label={new Date(run.started_at).toLocaleString()}
                  description={`${run.status} · ${run.new_games ?? 0} new games · ${run.games_analysed ?? 0} analyzed`}
                />
              ))}
            </NativeSettingsSection>
          )}
        </>
      )}
      {(!section || section === 'analysis') && (
        <>
          <NativeSettingsSection title="Engine & practice">
            <NativeSettingsRow
              label="Engine"
              value={settings.engine ?? 'Unavailable'}
            />
            <NativeSettingsRow
              label="Practice scheduling"
              description={
                settings.fsrs.personal
                  ? 'FSRS tuned to your answers'
                  : `${settings.fsrs.reviews} of ${settings.fsrs.needed} reviews toward personalized FSRS tuning`
              }
            />
          </NativeSettingsSection>
          <NativeSettingsSection
            title="Daily practice"
            footer={practicePaceFooter}
          >
            <NativeSettingsPickerRow
              label="New positions"
              value={settings.pace}
              disabled={busy || !onPace}
              onChange={(value) => onPace?.(value)}
              options={[...practicePaceOptions]}
            />
          </NativeSettingsSection>
          <NativeSettingsSection
            title="Analysis"
            footer="Depth applies to games analyzed from now on. Move classification uses the existing fixed bands."
          >
            <NativeSettingsPickerRow
              label="Analysis depth"
              value={String(settings.nodes)}
              disabled={busy || !onAnalysis}
              onChange={(value) => onAnalysis?.(Number(value))}
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
          </NativeSettingsSection>
        </>
      )}
      {(!section || section === 'data') && (
        <>
          <NativeSettingsSection
            title="Usage"
            footer="Your games, analysis and learning history."
          >
            <NativeSettingsRow
              label="Games"
              value={settings.your_data.games.toLocaleString()}
              description={`${settings.your_data.analysed.toLocaleString()} analyzed`}
            />
            <NativeSettingsRow
              label="Storage"
              value={`${(settings.your_data.approx_bytes / 1024 / 1024).toFixed(1)} MB`}
              description={
                settings.your_data.first_game
                  ? `Games since ${new Date(settings.your_data.first_game).toLocaleDateString()}`
                  : 'No games stored yet.'
              }
            />
            <NativeSettingsRow
              label="History"
              value={
                settings.limits.history_months === null
                  ? 'All available games'
                  : `${settings.limits.history_months} months`
              }
            />
            <NativeSettingsRow
              label="Analysis limit"
              value={
                settings.limits.max_analysed?.toLocaleString() ?? 'Unlimited'
              }
            />
            <NativeSettingsRow
              label="Connections limit"
              value={String(settings.limits.max_accounts)}
            />
          </NativeSettingsSection>
          <NativeSettingsSection
            title="Data management"
            footer="Export your PGN/CSV archive before deleting your account."
          >
            {onExport ? (
              <NativeSettingsActionRow
                label="Download your data"
                disabled={busy}
                onPress={onExport}
              />
            ) : (
              <NativeSettingsRow
                label="Export"
                description={
                  preview
                    ? 'Sign in to download your PGN/CSV archive.'
                    : 'Export is unavailable on this device.'
                }
              />
            )}
            {onDeleteAccount && (
              <NativeSettingsActionRow
                label="Delete account"
                destructive
                disabled={busy}
                onPress={onDeleteAccount}
              />
            )}
            {deleteUnavailable && (
              <NativeSettingsRow
                label="Account deletion"
                description="Account deletion is unavailable for this sign-in provider."
              />
            )}
          </NativeSettingsSection>
        </>
      )}
    </NativeSettingsForm>
  );
}
