import { type ReactNode, useEffect, useState } from 'react';
import { ApiError } from './api/api-error';
import { loadPublicConfig } from './api/client';
import type { ReadyConfig } from './api/response-schemas';
import { readApiOrigin } from './app-config';
import {
  readPublicConfig,
  removePublicConfig,
  savePublicConfig,
} from './public-config-cache';

type BootstrapResult =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; apiOrigin: string; config: ReadyConfig };
export type BootstrapState = BootstrapResult & { retry: () => void };
const defaultFetcher: typeof fetch = (...args) => fetch(...args);
export function Bootstrap({
  value,
  fetcher = defaultFetcher,
  children,
}: {
  value: string | undefined;
  fetcher?: typeof fetch;
  children: (state: BootstrapState) => ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    value: typeof value;
    result: BootstrapResult;
  }>({ value, result: { phase: 'loading' } });
  useEffect(() => {
    // A retry starts a fresh request even when the origin is unchanged.
    void attempt;
    const controller = new AbortController();
    const setResult = (result: BootstrapResult) =>
      setSnapshot({ value, result });
    async function load() {
      const apiOrigin = readApiOrigin(value, __DEV__);
      const cached = await readPublicConfig(apiOrigin);
      if (controller.signal.aborted) return;
      if (cached) setResult({ phase: 'ready', apiOrigin, config: cached });
      try {
        const config = await loadPublicConfig(
          apiOrigin,
          controller.signal,
          fetcher,
        );
        if (controller.signal.aborted) return;
        setResult({ phase: 'ready', apiOrigin, config });
        await savePublicConfig(apiOrigin, config);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.kind === 'invalid-response') {
          await removePublicConfig(apiOrigin);
          throw error;
        }
        if (!cached) throw error;
      }
    }
    void load().catch((error) => {
      if (!controller.signal.aborted)
        setResult({
          phase: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Could not connect to Knightly.',
        });
    });
    return () => controller.abort();
  }, [value, attempt, fetcher]);
  const result =
    snapshot.value === value ? snapshot.result : { phase: 'loading' as const };
  return children({ ...result, retry: () => setAttempt((a) => a + 1) });
}
