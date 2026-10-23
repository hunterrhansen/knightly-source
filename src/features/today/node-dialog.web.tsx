import { type ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';

/** The dialog's width on a wide window: Duolingo-like, room for the card's
 * hero and move rows without stretching them. */
const DIALOG_MAX = 480;

/**
 * A node's card on the web (hunterrhansen/knightly#289): the path stays
 * visible behind it (the route is a `transparentModal`). A wide window shows
 * a centred dialog; a narrow one, a sheet docked to the bottom as on a phone.
 * The backdrop, Escape and the card's own ✕ close it; it stays a route, so
 * Back closes it too and `/node?key=` still links straight to it.
 */
export function NodeDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= theme.layout.contentBreakpoint;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <View style={[styles.overlay, wide ? styles.centred : styles.docked]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View
        role="dialog"
        aria-modal
        accessibilityViewIsModal
        style={[styles.dialog, wide ? styles.dialogWide : styles.dialogSheet]}
      >
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  docked: { justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  dialog: {
    overflow: 'hidden',
    backgroundColor: theme.colors.page,
    borderWidth: 2,
    borderColor: theme.colors.line,
  },
  dialogWide: {
    width: '100%',
    maxWidth: DIALOG_MAX,
    maxHeight: '90%',
    borderRadius: theme.radius.panel,
  },
  dialogSheet: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: theme.radius.panel,
    borderTopRightRadius: theme.radius.panel,
    borderBottomWidth: 0,
  },
}));
