import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { BackdropFade, Button, DialogPop, ListItem } from '../../ui';
import type { GamesFilterPopupProps } from './games-filter-popup-types';

export function GamesFilterPopup(props: GamesFilterPopupProps) {
  return (
    // The backdrop fades in while the panel pops up from slightly small.
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={props.onCancel}
    >
      <PopupContent {...props} />
    </Modal>
  );
}

function PopupContent({
  children,
  onCancel,
  onApply,
  onReset,
}: GamesFilterPopupProps) {
  const styles = useStyles();
  const [cancelFocused, setCancelFocused] = useState(false);
  return (
    <View style={styles.backdrop}>
      <BackdropFade style={styles.dim} />
      <Pressable
        onPress={onCancel}
        accessible={false}
        aria-hidden
        focusable={false}
        style={styles.dismissArea}
      />
      <DialogPop style={styles.pop}>
        <View
          role="dialog"
          aria-label="Filters"
          aria-modal
          accessibilityViewIsModal
          style={styles.panel}
        >
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>
                Filters
              </Text>
              <Text style={styles.description}>
                Choose which games to show.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              onFocus={() => setCancelFocused(true)}
              onBlur={() => setCancelFocused(false)}
              style={[styles.cancel, cancelFocused && styles.focused]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.filters}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          <View style={styles.footer}>
            <Button onPress={onApply}>Apply filters</Button>
            <ListItem
              label="Reset filters"
              onPress={onReset}
              labelStyle={styles.resetLabel}
            />
          </View>
        </View>
      </DialogPop>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  backdrop: {
    flex: 1,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  // Carries the panel's size limits, so the panel inside can fill it.
  pop: { width: '100%', maxWidth: 480, maxHeight: '92%' },
  panel: {
    flexShrink: 1,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.page,
    borderWidth: 1,
    borderColor: theme.colors.line,
    overflow: 'hidden',
  },
  dismissArea: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  header: {
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  heading: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  title: {
    fontFamily: theme.typography.heading,
    fontSize: 24,
    color: theme.colors.ink,
  },
  description: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    color: theme.colors.inkMuted,
  },
  cancel: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cancelText: {
    fontFamily: theme.typography.bold,
    fontSize: 14,
    color: theme.colors.brandText,
  },
  focused: { borderColor: theme.colors.focus },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    _web: {
      scrollbarWidth: 'thin',
      scrollbarColor: `${theme.colors.line} ${theme.colors.page}`,
    },
  },
  filters: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
  resetLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: theme.colors.brandText,
  },
}));
