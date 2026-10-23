import { Modal, Pressable, Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';
import type { SettingsConfirmationProps } from './settings-confirmation-types';

export function SettingsConfirmation({
  title,
  onCancel,
  busy = false,
  children,
}: SettingsConfirmationProps) {
  const styles = useStyles();
  const reducedMotion = useSystemReducedMotion();
  return (
    <Modal
      visible
      animationType={reducedMotion ? 'fade' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <Screen
        safeAreaEdges={['top', 'bottom']}
        avoidKeyboard
        scrollViewProps={{ keyboardDismissMode: 'interactive' }}
      >
        <ScreenContent style={styles.content}>
          <View
            role="dialog"
            accessibilityViewIsModal
            aria-modal
            style={styles.body}
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={onCancel}
                style={styles.cancel}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
            {children}
          </View>
        </ScreenContent>
      </Screen>
    </Modal>
  );
}
const useStyles = createStyles((theme) => ({
  content: { flex: 1 },
  body: { gap: theme.spacing.md },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    flex: 1,
    minWidth: 150,
    fontFamily: theme.typography.heading,
    fontSize: 24,
    color: theme.colors.ink,
  },
  cancel: { minHeight: 44, justifyContent: 'center' },
  cancelText: {
    fontFamily: theme.typography.body,
    fontSize: 16,
    color: theme.colors.brandText,
  },
}));
