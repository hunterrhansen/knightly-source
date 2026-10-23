import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { accountKey, invalidateAccount } from '../../lib/account-queries';
import type { DailyReview, Watch } from '../../lib/api/today-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { createStyles, useTheme } from '../../theme/theme';
import {
  Body,
  Button,
  Card,
  Notice,
  Page,
  TextField,
  ToggleGroup,
} from '../../ui';
import { useReminderPreference } from './daily-reminders';
import {
  DEFAULT_WATCH_TIME,
  reminderTimeLabel,
  WATCH_TIMES,
} from './reminder-schedule';
import { useDailyReview } from './use-daily-review';
import {
  ANCHOR_MAX,
  anchorProblem,
  anchorSuggestions,
  cleanAnchor,
} from './watch-model';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Your watch: when the learner keeps it and the habit it follows ("After I finish
 * dinner, I will keep my watch"). Saved to the account; only after the save is
 * acknowledged does Remind me ask this device for notification permission.
 */
export function WatchScreen() {
  return (
    <Page safeArea avoidKeyboard title="Your watch" onBack={leave}>
      <Body>
        A few minutes a day with your own mistakes. Tie it to something you
        already do and it sticks.
      </Body>
      <WatchForm onDone={leave} />
    </Page>
  );
}

/**
 * The watch's time, habit and reminder, and Keep my watch. `preselect` (the
 * time a watch was just kept) leads the times as its own choice; a saved
 * watch is shown as saved. `onDone` runs once it is saved (and, natively,
 * the reminder applied or refused and acknowledged).
 */
export function WatchForm({
  preselect,
  onDone,
}: {
  preselect?: string;
  onDone: () => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const { scope } = useSessionScope();
  const review = useDailyReview();
  const reminder = useReminderPreference();
  const saved = review.data?.watch ?? undefined;
  const [time, setTime] = useState<string>(preselect ?? DEFAULT_WATCH_TIME);
  const [anchor, setAnchor] = useState('');
  const [remind, setRemind] = useState(true);
  const [touched, setTouched] = useState(false);
  const [refused, setRefused] = useState(false);
  const seeded = useRef(false);
  // Start from what is saved: the watch, and whether this device reminds.
  useEffect(() => {
    if (seeded.current || review.isPending || !reminder.ready) return;
    seeded.current = true;
    if (saved) {
      setTime(saved.time);
      setAnchor(saved.anchor);
      setRemind(reminder.preference.enabled);
    }
  }, [review.isPending, reminder.ready, reminder.preference.enabled, saved]);

  const cleaned = cleanAnchor(anchor);
  const problem = anchorProblem(cleaned);
  const save = useMutation({
    mutationFn: (watch: Pick<Watch, 'time' | 'anchor'>) =>
      scope.api.setWatch(watch),
    onSuccess: async (watch) => {
      if (!scope.isCurrent()) return;
      scope.queryClient.setQueryData<DailyReview>(
        accountKey(scope, 'daily-review'),
        (current) => current && { ...current, watch },
      );
      void invalidateAccount(scope, 'watch');
      if (reminder.supported) {
        const applied = await reminder.apply({
          enabled: remind,
          time: watch.time,
        });
        if (remind && !applied) {
          setRefused(true);
          return;
        }
      }
      if (scope.isCurrent()) onDone();
    },
  });

  const standard = (value: string) =>
    WATCH_TIMES.includes(value as (typeof WATCH_TIMES)[number]);
  const times =
    preselect && !standard(preselect)
      ? [preselect, ...WATCH_TIMES.filter((value) => value !== preselect)]
      : standard(time)
        ? WATCH_TIMES
        : [...WATCH_TIMES, time].sort();
  const busy = save.isPending || reminder.busy;
  return (
    <>
      {refused ? (
        <Notice
          title="Your watch is saved"
          message="Notifications are off for Knightly, so there will be no reminder. Turn them on in system settings to get one."
          action="Done"
          onAction={onDone}
        />
      ) : null}
      <Card eyebrow="When" title="When will you keep your watch?">
        <ToggleGroup
          label="Watch time"
          variant="pills"
          value={time}
          options={times.map((value) => ({
            value,
            label: reminderTimeLabel(value),
          }))}
          onChange={setTime}
          disabled={busy}
        />
      </Card>
      <Card eyebrow="After what" title="After I …">
        <TextField
          label="After I"
          accessibilityLabel="The habit your watch follows"
          value={anchor}
          maxLength={ANCHOR_MAX + 10}
          onChangeText={(value) => {
            setAnchor(value);
            setTouched(true);
          }}
          placeholder={anchorSuggestions(time)[0]}
          helpText=", I will keep my watch."
          error={touched && anchor && problem ? problem : undefined}
          editable={!busy}
        />
        <View style={styles.suggestions}>
          {anchorSuggestions(time).map((suggestion) => (
            <Button
              key={suggestion}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setAnchor(suggestion);
                setTouched(true);
              }}
            >
              {suggestion}
            </Button>
          ))}
        </View>
      </Card>
      {reminder.supported && (
        <View style={styles.remind}>
          <View style={styles.remindText}>
            <Text style={styles.remindTitle}>Remind me</Text>
            <Text style={styles.quiet}>
              One reminder at this time, only on days you haven’t kept your
              watch.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Remind me"
            value={remind}
            disabled={busy}
            onValueChange={setRemind}
            trackColor={{ true: theme.colors.brand }}
          />
        </View>
      )}
      {save.error && (
        <Notice
          title="Couldn’t save your watch"
          message={save.error.message}
          action="Retry"
          onAction={() => save.mutate({ time, anchor: cleaned })}
        />
      )}
      <Button
        disabled={busy || !!problem}
        onPress={() => save.mutate({ time, anchor: cleaned })}
      >
        Keep my watch
      </Button>
    </>
  );
}

const useStyles = createStyles((theme) => ({
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  remind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  remindText: { flex: 1, gap: 2 },
  remindTitle: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
}));
