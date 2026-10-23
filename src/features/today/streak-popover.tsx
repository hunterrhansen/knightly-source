import {
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { DailyReview } from '../../lib/api/today-contract';
import { createStyles } from '../../theme/theme';
import { BackdropFade, DialogPop } from '../../ui';
import { StreakDetails } from './streak-details';

/** Where the pill sits on screen, from `measureInWindow`. */
export type PopoverAnchor = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const GAP = 8;
const MAX_WIDTH = 360;
const ARROW = 14;

/**
 * The streak as a popover under its pill: the page stays where it is behind a
 * light dim, and a tap outside, Done or the system back closes it.
 */
export function StreakPopover({
  streak,
  anchor,
  onClose,
}: {
  streak: DailyReview['streak'];
  anchor: PopoverAnchor;
  onClose: () => void;
}) {
  const styles = useStyles();
  const window = useWindowDimensions();
  const width = Math.min(window.width - 32, MAX_WIDTH);
  const left = Math.min(Math.max(16, anchor.x), window.width - 16 - width);
  const top = anchor.y + anchor.height + GAP;
  // The arrow points at the pill's middle, kept inside the card's corners.
  const arrowLeft = Math.min(
    Math.max(20, anchor.x + anchor.width / 2 - left - ARROW / 2),
    width - 20 - ARROW,
  );
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      {/* A modal is its own root: the calendar's gestures need one inside it. */}
      <GestureHandlerRootView style={styles.root}>
        <BackdropFade style={styles.dim} />
        <Pressable
          accessibilityLabel="Close streak"
          style={styles.root}
          onPress={onClose}
        />
        <DialogPop
          style={[
            styles.card,
            { top, left, width, maxHeight: window.height - top - 32 },
          ]}
        >
          <View style={[styles.arrow, { left: arrowLeft }]} />
          <View
            role="dialog"
            aria-modal
            aria-label="Your streak"
            accessibilityViewIsModal
            style={styles.clip}
          >
            <ScrollView bounces={false}>
              <StreakDetails streak={streak} onDone={onClose} />
            </ScrollView>
          </View>
        </DialogPop>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1 },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  card: {
    position: 'absolute',
    transformOrigin: 'top left',
    borderRadius: theme.radius.panel,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.page,
  },
  clip: { borderRadius: theme.radius.panel, overflow: 'hidden' },
  arrow: {
    position: 'absolute',
    top: -ARROW / 2 - 1,
    width: ARROW,
    height: ARROW,
    transform: [{ rotate: '45deg' }],
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.page,
  },
}));
