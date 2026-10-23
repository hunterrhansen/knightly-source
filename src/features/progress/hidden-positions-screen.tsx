import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import type { SuspendedCard } from '../../lib/api/practice-contract';
import { createStyles } from '../../theme/theme';
import { Button, Card, ListItem, Page } from '../../ui';
import { reasonLabels } from '../practice/practice-api';
import { SectionState } from './section-state';
import { useHiddenPositions } from './use-progress';

const moveName = (card: SuspendedCard) =>
  `${card.move_number}${card.color === 'white' ? '.' : '…'} ${card.san}`;

/** `/progress/hidden`: positions hidden with "Don't show this again", each
 * with why, and Show again to put it back on its old schedule. */
export function HiddenPositionsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { hidden, showAgain } = useHiddenPositions();
  const [busy, setBusy] = useState<string>();
  const [failed, setFailed] = useState(false);
  const cards = hidden.data;
  return (
    <Page
      title="Hidden positions"
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/progress')
      }
    >
      <SectionState
        resource={hidden}
        name="hidden positions"
        eyebrow="Hidden"
      />
      {failed && (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          Couldn’t show it again. Check your connection and try again.
        </Text>
      )}
      {cards && (
        <Card eyebrow="Hidden">
          {cards.length ? (
            cards.map((card, index) => {
              const key = `${card.game_id}:${card.ply}`;
              const reason = card.reason ? reasonLabels[card.reason] : 'Hidden';
              const against = card.opponent ? ` vs ${card.opponent}` : '';
              return (
                <ListItem
                  key={key}
                  label={`${moveName(card)}${against}`}
                  description={reason}
                  topSeparator={index > 0}
                  accessibilityLabel={`${moveName(card)}${against}. ${reason}`}
                  trailing={
                    <Button
                      variant="secondary"
                      disabled={busy === key}
                      accessibilityLabel={`Show ${moveName(card)} again`}
                      onPress={async () => {
                        setBusy(key);
                        setFailed(false);
                        try {
                          await showAgain(card.game_id, card.ply);
                        } catch {
                          setFailed(true);
                        } finally {
                          setBusy(undefined);
                        }
                      }}
                    >
                      Show again
                    </Button>
                  }
                />
              );
            })
          ) : (
            <Text style={styles.note}>
              Nothing is hidden. Positions you hide from practice appear here.
            </Text>
          )}
        </Card>
      )}
    </Page>
  );
}

const useStyles = createStyles((theme) => ({
  note: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
  },
}));
