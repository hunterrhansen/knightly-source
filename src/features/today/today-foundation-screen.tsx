import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useFoundation } from '../../lib/auth/auth-provider';
import { useImportProgress } from '../games/games-api';
import { EXTRA_WATCH_HREF } from '../practice/practice-api';
import { TodayScreen } from './today-screen';
import { todayState } from './today-state';
import { LiveStreakHistory } from './today-streak-calendar';
import { useDailyReview, useLearnMore } from './use-daily-review';

export function TodayFoundationScreen() {
  const review = useDailyReview();
  const { progress } = useImportProgress();
  const more = useLearnMore(() => router.push(EXTRA_WATCH_HREF));
  const { account } = useFoundation();
  const { unavailable } = useLocalSearchParams();
  const state = todayState(
    {
      review: review.data,
      error: review.error?.message,
      accounts: progress.data?.accounts.length,
      importing: progress.data?.working,
      importStep: progress.data?.step,
      checked: progress.data && {
        done: progress.data.analysed,
        total: progress.data.target,
      },
    },
    new Date(),
  );
  return (
    <LiveStreakHistory>
      <TodayScreen
        state={state}
        actions={{
          open: (href) => router.push(href as Href),
          connectGames: () => router.push('/connect-games'),
          retry: () => void review.refetch(),
        }}
        learnMore={{
          onPress: () => more.mutate(),
          busy: more.isPending,
          error: more.error?.message,
        }}
        notice={unavailable ? 'That feature is not available yet' : undefined}
        accountName={account ?? undefined}
      />
    </LiveStreakHistory>
  );
}
