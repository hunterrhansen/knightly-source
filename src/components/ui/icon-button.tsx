import { useState } from 'react';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { pressHaptic } from '../../lib/haptics';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { ActionIcon, type ActionIconName } from './action-icon';
import { usePressSquish } from './press-squish';
import { useShortcut } from './use-shortcut';

export type IconButtonTone = 'ink' | 'muted' | 'brand';

/**
 * The app's one icon-only button (✕, ‹ ›, the list toggle). It presses like
 * `Button`: a soft haptic on touch-down and the control squash. The target is
 * at least 44 points whatever the glyph size, web shows the focus ring, and
 * the spoken label is required because there is no visible one.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  tone = 'ink',
  iconSize = 24,
  compact = false,
  backdrop = 'none',
  shortcut,
}: {
  icon: ActionIconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** Glyph colour: `muted` for chrome such as a lesson's ✕. */
  tone?: IconButtonTone;
  iconSize?: number;
  /** A 44-point target instead of 48, for tight rows. */
  compact?: boolean;
  /** `surface` sits the glyph on a rounded tile; otherwise it is bare and round. */
  backdrop?: 'none' | 'surface';
  /** Its web keyboard shortcut, as `aria-keyshortcuts` names it ("L"). */
  shortcut?: string;
}) {
  const styles = useStyles();
  const keys = useShortcut(accessibilityLabel, shortcut);
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const squish = usePressSquish({ squash: tokens.motion.squash.control });
  const color = {
    ink: theme.colors.ink,
    muted: theme.colors.inkMuted,
    brand: theme.colors.brandText,
  }[tone];
  return (
    <Pressable
      ref={keys.ref}
      {...keys.props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      onPressIn={() => {
        pressHaptic();
        squish.onPressIn();
      }}
      onPressOut={squish.onPressOut}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.target(compact), disabled && styles.disabled]}
    >
      <Animated.View
        style={[styles.face(backdrop), focused && styles.focused, squish.style]}
      >
        <ActionIcon name={icon} size={iconSize} color={color} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  target: (compact: boolean) => ({
    width: compact ? 44 : theme.layout.minControl,
    height: compact ? 44 : theme.layout.minControl,
  }),
  face: (backdrop: 'none' | 'surface') => ({
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: backdrop === 'surface' ? theme.radius.control : 999,
    backgroundColor:
      backdrop === 'surface' ? theme.colors.surface : 'transparent',
    borderWidth: 2,
    borderColor: 'transparent',
  }),
  focused: { borderColor: theme.colors.focus },
  disabled: { opacity: 0.3 },
}));
