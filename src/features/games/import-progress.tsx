import type { ImportStatus, Onboarding } from '../../lib/api/import-contract';
import { Body, Notice } from '../../ui';
import { importPhase } from './import-phase';
export function ImportProgress({
  progress,
  status,
}: {
  progress: Onboarding;
  status?: ImportStatus;
}) {
  const phase = importPhase(progress, status);
  if (phase === 'new') return null;
  return (
    <>
      <Notice
        title={
          phase === 'processing'
            ? 'Bringing in your games…'
            : phase === 'failed'
              ? 'Import needs attention'
              : phase === 'empty'
                ? 'No games found yet'
                : phase === 'ready'
                  ? 'Your newest games are analyzed'
                  : 'Your games are imported'
        }
        message={
          phase === 'processing'
            ? 'You can leave this screen. Import continues in the background.'
            : phase === 'failed'
              ? 'Some processing could not finish. Your imported games are kept; try syncing again.'
              : phase === 'empty'
                ? 'Play a game on Chess.com, then sync again.'
                : undefined
        }
      />
      <Body>
        {progress.games} games imported · {progress.analysed} analyzed
      </Body>
      {phase === 'processing' && progress.step && (
        <Body>
          Current step:{' '}
          {progress.step.startsWith('sync:')
            ? 'Importing games'
            : progress.step === 'analyze'
              ? 'Analyzing games'
              : 'Preparing your games'}
        </Body>
      )}
      {phase === 'processing' && !status?.current_run && (
        <Body>Waiting for the import worker.</Body>
      )}
    </>
  );
}
