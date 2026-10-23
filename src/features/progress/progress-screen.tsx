import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import type { ProgressRange } from '../../lib/api/progress-contract';
import { useImportProgress } from '../games/games-api';
import { useDailyReview, useJourney } from '../today/today-api';
import { ProgressView } from './progress-view';
import { useDeckSummary, useHabit, useProgressRange } from './use-progress';

/** Whether a link stays inside Progress's own stack (`/progress/...`). */
const inside = (href: Href) =>
  (typeof href === 'string' ? href : href.pathname).startsWith('/progress');

/** `/progress`, the Progress modal over the path. Links inside it push in
 * its stack; the games, training and the daily plan open over the path once
 * it has closed (`leave`). */
export function ProgressScreen({
  onClose,
  leave,
}: {
  onClose: () => void;
  leave: (href: Href) => void;
}) {
  const router = useRouter();
  const { progress, status } = useImportProgress();
  const working =
    !!progress.data?.working ||
    !!status.data?.current_run ||
    !!status.data?.queued.length;
  const review = useDailyReview().data;
  const [range, setRange] = useState<ProgressRange>('90d');
  return (
    <ProgressView
      journey={useJourney()}
      streak={review?.streak}
      onTheirWay={review?.memory.learning}
      importWorking={working}
      range={range}
      onRange={setRange}
      {...useProgressRange(range)}
      habit={useHabit()}
      deck={useDeckSummary()}
      onOpen={(href) => (inside(href) ? router.push(href) : leave(href))}
      onClose={onClose}
    />
  );
}
