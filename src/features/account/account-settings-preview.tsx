import { useState } from 'react';
import { SettingsConfirmation } from '../../ui';
import { DeleteConfirmationForm } from './delete-confirmation-form';
import { IdentityVerificationForm } from './identity-verification-form';
import { SettingsPanels } from './settings-panels';
export function AccountSettingsPreview({ section }: { section?: string }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [stage, setStage] = useState<
    'confirmation' | 'methods' | 'password' | 'code'
  >('confirmation');
  const [credential, setCredential] = useState('');
  const notice =
    'No account data is deleted and no credentials or verification requests are sent.';
  function cancel() {
    setOpen(false);
    setWord('');
    setCredential('');
    setStage('confirmation');
  }
  return (
    <>
      <SettingsPanels
        section={section}
        preview
        onDeleteAccount={() => setOpen(true)}
        settings={{
          accounts: [
            {
              source: 'chesscom',
              handle: 'AlexMorgan',
              synced_through: '2026/10',
            },
          ],
          running: false,
          last_run: {
            started_at: '2026-10-11T12:00:00Z',
            finished_at: '2026-10-11T12:04:00Z',
            status: 'ok',
            new_games: 2,
            games_analysed: 2,
            errors: [],
          },
          earlier_runs: [],
          current_run: null,
          engine: 'Stockfish',
          nodes: 500000,
          pace: 'standard',
          fsrs: {
            personal: false,
            reviews: 48,
            needed: 400,
            tuned_reviews: null,
          },
          your_data: {
            games: 126,
            analysed: 120,
            first_game: '2026-08-01T12:00:00Z',
            approx_bytes: 12582912,
          },
          limits: { history_months: 24, max_analysed: 1000, max_accounts: 4 },
        }}
      />
      {open && (
        <SettingsConfirmation title="Delete account preview" onCancel={cancel}>
          {stage === 'confirmation' ? (
            <DeleteConfirmationForm
              notice={notice}
              word={word}
              busy={false}
              onWordChange={setWord}
              onCancel={cancel}
              onConfirm={() => {
                if (word === 'delete') setStage('methods');
              }}
            />
          ) : (
            <IdentityVerificationForm
              notice={notice}
              secondFactor={false}
              busy={false}
              error=""
              credential={credential}
              onCredentialChange={setCredential}
              method={
                stage === 'password' || stage === 'code'
                  ? {
                      label: stage === 'password' ? 'Password' : 'Email code',
                      password: stage === 'password',
                      numeric: stage === 'code',
                    }
                  : null
              }
              methods={[
                {
                  key: 'password',
                  label: 'Password',
                  onSelect: () => setStage('password'),
                },
                {
                  key: 'email',
                  label: 'Email code',
                  onSelect: () => setStage('code'),
                },
              ]}
              onSubmit={cancel}
              onAnotherMethod={() => {
                setCredential('');
                setStage('methods');
              }}
              onCancel={cancel}
            />
          )}
        </SettingsConfirmation>
      )}
    </>
  );
}
