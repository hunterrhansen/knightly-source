import { useEffect, useRef, useState } from 'react';
import type { DailyReview } from '../../lib/api/today-contract';
import { usePreferences } from '../../theme/preferences';
import { addDays } from '../../ui';
import type { RankUp, StreakExtension } from './session-end-beats';
import { useStreakHistory } from './today-streak-calendar';
import { useDailyReview } from './use-daily-review';
import type { PostMoment } from './ward-path';
import { useWatchAsk, watchAskDue } from './watch-ask';

export type SessionEnd = {
  /** Null unless this session extended the streak. */
  streak: StreakExtension | null;
  /** Positions this session moved into long-term memory. */
  mastered: number;
  /** Null unless this session's stars carried the learner to a new rank. */
  rankUp: RankUp | null;
  /** Positions due tomorrow, from the read after the session; 0 unknown. */
  tomorrowDue: number;
  /** Posts this session cleared on the ward path, and where it moved on to. */
  posts?: PostMoment | null;
};

/** What a session changed, from the server's daily review read before it
 * (`before`) and after its last save (`after`). Only the same day counts, and
 * the streak counts as extended only when the server says today became safe
 * and the count grew; nothing is inferred on the client. */
export function sessionEnd(
  before: DailyReview | undefined,
  after: DailyReview | undefined,
): SessionEnd {
  if (!before || !after || before.day !== after.day)
    return {
      streak: null,
      mastered: 0,
      rankUp: null,
      tomorrowDue: after?.tomorrow_due ?? 0,
    };
  const extended =
    !before.streak.safe_today &&
    after.streak.safe_today &&
    after.streak.count > before.streak.count;
  const mastered =
    (after.memory.mastered_today ?? 0) - (before.memory.mastered_today ?? 0);
  // A new rank between before and after is this session's: ranks come only
  // from clearing posts, which this session's answers did.
  const was = before.journey;
  const now = after.journey;
  const rankUp =
    was && now && now.rank !== was.rank
      ? {
          rank: now.rank,
          stars: now.stars,
          nextRank: now.next_rank,
          nextPost: now.next_post,
        }
      : null;
  return {
    rankUp,
    streak: extended
      ? {
          from: before.streak.count,
          to: after.streak.count,
          day: after.day,
          week: after.streak.week,
        }
      : null,
    mastered: Math.max(0, mastered),
    tomorrowDue: after.tomorrow_due,
  };
}

/** The session's end beats' data: the daily review as first read after the
 * session screen mounted, against a fresh read once `finished`. `pending`
 * while the fresh read is outstanding; a failed read shows no extra beats. */
export function useSessionEnd(finished: boolean): SessionEnd & {
  pending: boolean;
} {
  const review = useDailyReview({ refetchOnMount: 'always' });
  // The baseline must be read after mounting; a cached plan may be stale.
  const baseline = useRef<DailyReview | undefined>(undefined);
  if (
    !baseline.current &&
    review.isFetchedAfterMount &&
    review.status === 'success'
  )
    baseline.current = review.data;
  const [after, setAfter] = useState<DailyReview | null>();
  // When the watch was kept: the session's end, as its last save is read.
  const [keptAt, setKeptAt] = useState<Date>();
  const { ask } = useWatchAsk();
  const { refetch } = review;
  useEffect(() => {
    if (!finished) {
      setAfter(undefined);
      return;
    }
    let alive = true;
    void refetch().then((result) => {
      if (!alive) return;
      setAfter(result.isSuccess ? result.data : null);
      setKeptAt(new Date());
    });
    return () => {
      alive = false;
    };
  }, [finished, refetch]);
  const end = sessionEnd(baseline.current, after ?? undefined);
  // A Sunday-first week starts the day before the summary's Monday-first one.
  const { weekStart } = usePreferences().preferences;
  const monday = end.streak?.week[0]?.date;
  const sunday = weekStart === 'sunday' && monday && addDays(monday, -1);
  const earlier = useStreakHistory(
    sunday ? { from: sunday, to: sunday } : undefined,
  );
  return {
    ...end,
    streak: end.streak && {
      ...end.streak,
      earlier: earlier?.days,
      earlierNights: earlier?.nights,
      askWatch:
        after &&
        keptAt &&
        ask &&
        watchAskDue({
          watch: after.watch,
          streakTo: end.streak.to,
          day: end.streak.day,
          ask,
        })
          ? { keptAt }
          : undefined,
    },
    // Results wait only for the fresh daily summary, not a removed journey.
    pending: finished && after === undefined,
  };
}
