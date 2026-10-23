import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { invalidateAccount } from '../../lib/account-queries';
import type { SuspendReason } from '../../lib/api/practice-contract';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';

export const reasonLabels: Record<SuspendReason, string> = {
  engine_wrong: 'The engine is wrong',
  not_useful: 'Not useful to me',
  already_known: 'I already know this',
};

type Step = 'idle' | 'choosing' | 'saving' | 'hidden' | 'failed';

/** "Don't show this again" inside a card's verdict: pick why, and the position
 * leaves the deck with its schedule kept; Undo shows it again. Nothing is graded. */
export function HideCard({
  gameId,
  ply,
  prominent = false,
}: {
  gameId: number;
  ply: number;
  /** A leech's miss: offered as a button, not only a link (deck spec part 4). */
  prominent?: boolean;
}) {
  const styles = useStyles();
  const { scope } = useSessionScope();
  const [step, setStep] = useState<Step>('idle');
  const card = `${gameId}:${ply}`;
  const shown = useRef(card);
  // A new position starts with the plain link again.
  useEffect(() => {
    if (shown.current !== card) {
      shown.current = card;
      setStep('idle');
    }
  }, [card]);

  async function run(hide: boolean, reason?: SuspendReason) {
    setStep('saving');
    try {
      if (hide && reason) await scope.api.suspendCard(gameId, ply, reason);
      else await scope.api.unsuspendCard(gameId, ply);
      if (!scope.isCurrent() || shown.current !== card) return;
      setStep(hide ? 'hidden' : 'idle');
      void invalidateAccount(scope, 'hidden');
    } catch {
      if (scope.isCurrent() && shown.current === card) setStep('failed');
    }
  }

  if (step === 'choosing' || step === 'saving')
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Why hide this position?</Text>
        {(Object.keys(reasonLabels) as SuspendReason[]).map((reason) => (
          <Button
            key={reason}
            variant="secondary"
            disabled={step === 'saving'}
            onPress={() => void run(true, reason)}
          >
            {reasonLabels[reason]}
          </Button>
        ))}
        <Button
          variant="text"
          disabled={step === 'saving'}
          onPress={() => setStep('idle')}
        >
          Cancel
        </Button>
      </View>
    );
  if (step === 'hidden')
    return (
      <View style={styles.row}>
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Hidden. It won’t come back unless you show it again.
        </Text>
        <Button variant="text" onPress={() => void run(false)}>
          Undo
        </Button>
      </View>
    );
  return (
    <View style={styles.row}>
      {step === 'failed' && (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Couldn’t save that. Check your connection and try again.
        </Text>
      )}
      <Button
        variant={prominent ? 'secondary' : 'text'}
        onPress={() => setStep('choosing')}
      >
        Don’t show this again
      </Button>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  box: { gap: theme.spacing.xs },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
    textAlign: 'center',
  },
  note: {
    flexShrink: 1,
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
    textAlign: 'center',
  },
}));
