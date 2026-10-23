import {
  type Onboarding,
  onboardingSchema,
} from '../../lib/api/import-contract';
import { importPhase } from './import-phase';

const base: Onboarding = {
  accounts: [{ source: 'chesscom', handle: 'me' }],
  games: 2,
  analysed: 0,
  target: 2,
  working: false,
  step: null,
  findings: [],
  summary: { blunders: 0, mistakes: 0, misses: 0, positions: 0, pattern: null },
};
test('does not claim readiness for no games or incomplete analysis', () => {
  expect(importPhase({ ...base, accounts: [] })).toBe('new');
  expect(importPhase({ ...base, games: 0, target: 0 })).toBe('empty');
  expect(importPhase(base)).toBe('imported');
  expect(importPhase({ ...base, analysed: 2 })).toBe('ready');
});
test('queued work and errors take precedence over an old successful batch', () => {
  const ready = { ...base, analysed: 2 };
  expect(
    importPhase(ready, {
      queued: ['update'],
      current_run: null,
      last_run: null,
    }),
  ).toBe('processing');
  expect(
    importPhase(ready, {
      queued: [],
      current_run: null,
      last_run: { status: 'failed', errors: ['source unavailable'] },
    }),
  ).toBe('failed');
  expect(
    onboardingSchema.safeParse({ ...base, working: 'false' }).success,
  ).toBe(false);
});
