import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { DailyReview } from '../../lib/api/today-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';

// Asking for the watch after the first watch
// (docs/specs/2026-10-18-watch-time-anchor-design.md#asking-for-the-watch).

/** Skips of the ask on this device. */
export type WatchAsk = { skips: number; last_skipped: string | null };
const NONE: WatchAsk = { skips: 0, last_skipped: null };
const askSchema = z.object({
  skips: z.number().int().nonnegative(),
  last_skipped: z.string().nullable(),
});
function parseAsk(raw: string | null): WatchAsk {
  if (!raw) return NONE;
  try {
    return askSchema.parse(JSON.parse(raw));
  } catch {
    return NONE;
  }
}

const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
};

/** Whether a session that extended the streak to `streakTo` asks for the
 * watch: only while none is set (an older server's unknown watch never asks),
 * first at once, then once more from three nights in a row and at least two
 * nights after the skip, and never after a second skip. */
export function watchAskDue(input: {
  watch: DailyReview['watch'];
  streakTo: number;
  day: string;
  ask: WatchAsk;
}) {
  const { watch, streakTo, day, ask } = input;
  if (watch !== null) return false;
  if (ask.skips === 0) return true;
  if (ask.skips > 1 || !ask.last_skipped) return false;
  return streakTo >= 3 && dayNumber(day) - dayNumber(ask.last_skipped) >= 2;
}

/** The watch time to preselect: when this watch was kept, to the nearest 15
 * minutes (ties go later, 23:53 becomes 00:00). */
export function keptWatchTime(at: Date) {
  const minutes = at.getHours() * 60 + at.getMinutes() + at.getSeconds() / 60;
  const rounded = (Math.floor(minutes / 15 + 0.5) * 15) % (24 * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(rounded / 60))}:${pad(rounded % 60)}`;
}

/** This device's skips of the ask for the signed-in account, and a way to
 * record one. */
export function useWatchAsk() {
  const { scope } = useSessionScope();
  const key = [...scope.meKey, 'watch-ask'];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => parseAsk(await scope.cache.item('watch-ask').get()),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return {
    ask: query.data,
    async skip(day: string) {
      const current = query.data ?? NONE;
      const next = { skips: current.skips + 1, last_skipped: day };
      scope.queryClient.setQueryData(key, next);
      await scope.cache.item('watch-ask').set(JSON.stringify(next));
    },
  };
}
