import {
  type Href,
  router,
  useIsFocused,
  useLocalSearchParams,
} from 'expo-router';
import { useFoundation } from '../../lib/auth/auth-provider';
import { useImportProgress } from '../games/games-api';
import { EXTRA_WATCH_HREF } from '../practice/practice-api';
import { useReminderPreference } from './daily-reminders';
import type {
  TodayActions,
  TodayLearnMore,
  TodayReminder,
  Tonight,
} from './node-card';
import { reminderTimeLabel } from './reminder-schedule';
import { TodayScreen } from './today-screen';
import { type TodayState, todayState } from './today-state';
import { LiveStreakHistory } from './today-streak-calendar';
import { tonightResults, tonightRows } from './tonight';
import {
  useDailyReview,
  useJourney,
  useLearnMore,
  useLessonDeck,
} from './use-daily-review';

/** The home's live data, shared by the path and the node screen over it, so a
 * node's card reads the same state as the node that opened it. */
export function useTodayHome(): {
  state: TodayState;
  now: Date;
  journey: ReturnType<typeof useJourney>['data'];
  tonight?: Tonight;
  learnMore: TodayLearnMore;
  reminder?: TodayReminder;
  actions: TodayActions;
} {
  const review = useDailyReview();
  const { progress } = useImportProgress();
  const reminder = useReminderPreference();
  const journey = useJourney();
  // Learn more adds new positions for today, then the extra watch opens.
  const more = useLearnMore(() => router.push(EXTRA_WATCH_HREF));
  const now = new Date();
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
    now,
  );
  // The daily review names tonight's moves; the lesson's deck results say
  // how the kept watch went, so it is only asked for once the watch is kept.
  const deck = useLessonDeck(
    !!review.data?.lesson.total && state.kind === 'done',
  );
  return {
    state,
    now,
    journey: journey.data,
    tonight: review.data && {
      rows: tonightRows(review.data, now),
      ...tonightResults(deck.data?.results, now),
    },
    learnMore: {
      onPress: () => more.mutate(),
      busy: more.isPending,
      error: more.error?.message,
    },
    actions: {
      open: (href) => router.push(href as Href),
      connectGames: () => router.push('/connect-games'),
      retry: () => void review.refetch(),
    },
    reminder:
      reminder.supported && reminder.ready
        ? {
            enabled: reminder.preference.enabled,
            time: reminderTimeLabel(
              review.data?.watch?.time ?? reminder.preference.time,
            ),
            disabled: reminder.busy,
            blocked: reminder.blocked,
            onToggle: (enabled: boolean) =>
              reminder.update({
                enabled,
                time: review.data?.watch?.time ?? reminder.preference.time,
              }),
            onOpenSystemSettings: reminder.openSystemSettings,
          }
        : undefined,
  };
}

export function TodayFoundationScreen() {
  const home = useTodayHome();
  const { account } = useFoundation();
  const { unavailable } = useLocalSearchParams();
  const focused = useIsFocused();
  return (
    <LiveStreakHistory>
      <TodayScreen
        state={home.state}
        now={home.now}
        journey={home.journey}
        actions={home.actions}
        notice={unavailable ? 'That feature is not available yet' : undefined}
        accountName={account ?? undefined}
        focused={focused}
      />
    </LiveStreakHistory>
  );
}
