import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { ProgressRange } from '../../lib/api/progress-contract';
import { useImportProgress } from '../games/games-api';
import { useDailyReview, useJourney } from '../today/today-api';
import { ProgressView } from './progress-view';
import { useDeckSummary, useHabit, useProgressRange } from './use-progress';

/** Progress is a main tab; training and game review open above the tabs. */
export function ProgressScreen() {
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
      onOpen={(href) => router.push(href)}
    />
  );
}
