import type { ImportStatus, Onboarding } from '../../lib/api/import-contract';

export function importPhase(progress: Onboarding, status?: ImportStatus) {
  if (!progress.accounts.length) return 'new';
  if (progress.working || status?.current_run || status?.queued.length)
    return 'processing';
  if (status?.last_run?.errors.length) return 'failed';
  if (progress.target > 0 && progress.analysed >= progress.target)
    return 'ready';
  if (!progress.games) return 'empty';
  return 'imported';
}
