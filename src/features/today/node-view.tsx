import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import type { JourneyMap } from '../../lib/api/journey-contract';
import { createStyles } from '../../theme/theme';
import { CardTone, IconButton } from '../../ui';
import {
  findCard,
  type KeptNightResource,
  NodeCard,
  type TodayActions,
  type TodayLearnMore,
  type TodayReminder,
  type Tonight,
} from './node-card';
import { pathModel } from './path-model';
import type { TodayState } from './today-state';

/**
 * A node's card on its own (docs/specs/2026-10-19-path-home-design.md, "The
 * node card"): the node screen shows it as the platform's sheet over the
 * path, sized to the card. `cardKey` is a node's key, `castle` a castle's.
 */
export function NodeView({
  cardKey,
  castle,
  state,
  journey,
  tonight,
  reminder,
  learnMore,
  night,
  actions,
  onClose,
}: {
  cardKey?: string;
  castle?: string;
  state: TodayState;
  journey?: JourneyMap;
  tonight?: Tonight;
  reminder?: TodayReminder;
  learnMore?: TodayLearnMore;
  night?: KeptNightResource;
  actions: TodayActions;
  /** Closes the sheet. iOS draws its ✕ in the native toolbar instead. */
  onClose: () => void;
}) {
  const styles = useStyles();
  const model = useMemo(() => pathModel(state, journey), [state, journey]);
  const open = findCard(model, { key: cardKey, castle });
  return (
    <View style={styles.body}>
      {/* The sheet is the surface: its cards drop their own frames. */}
      {open && (
        <CardTone value="plain">
          <NodeCard
            open={open}
            state={state}
            tonight={tonight}
            reminder={reminder}
            learnMore={learnMore}
            keptNight={night}
            journey={journey}
            actions={actions}
          />
        </CardTone>
      )}
      {/* Top right, as on Account; iOS has the native one over the sheet. */}
      {Platform.OS !== 'ios' && (
        <View style={styles.close}>
          <IconButton
            icon="close"
            accessibilityLabel="Close"
            onPress={onClose}
            backdrop="surface"
            compact
          />
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  body: {
    // The web shows a card as a page: it keeps to the reading width.
    width: '100%',
    maxWidth: theme.layout.readingMax,
    alignSelf: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    // iOS adds the home indicator's room below the sheet itself.
    paddingBottom: Platform.OS === 'ios' ? 0 : theme.spacing.md,
    // iOS shows the system sheet's own material behind the card.
    backgroundColor: Platform.OS === 'ios' ? undefined : theme.colors.page,
  },
  close: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },
}));
