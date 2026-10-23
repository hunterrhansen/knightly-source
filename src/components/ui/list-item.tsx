import { type ReactNode, useState } from 'react';
import {
  Pressable,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { usePressSquish } from './press-squish';

type ListItemProps = {
  label: string;
  description?: string;
  /** Visual accessories only; interactive rows own one press target. */
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Include meaningful accessory values here for interactive rows. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Match a grouped card's outer corners; omit for a standalone rounded row. */
  groupPosition?: 'only' | 'first' | 'middle' | 'last';
  topSeparator?: boolean;
  bottomSeparator?: boolean;
  /** Sizes and places the row; on a tappable row it sits on the press target. */
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
};

/** Ignite-inspired row: plain content stays static; onPress opts into a button. */
export function ListItem({
  label,
  description,
  leading,
  trailing,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  groupPosition,
  topSeparator = false,
  bottomSeparator = false,
  style,
  labelStyle,
  descriptionStyle,
}: ListItemProps) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const squish = usePressSquish({ squash: tokens.motion.squash.surface });
  const content = (
    <>
      {leading != null && (
        <View
          style={styles.leading}
          accessible={false}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {leading}
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, descriptionStyle]}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing != null && <View style={styles.trailing}>{trailing}</View>}
    </>
  );

  return (
    <View style={styles.separators(topSeparator, bottomSeparator)}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ??
            [label, description].filter(Boolean).join(', ')
          }
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          onPressIn={squish.onPressIn}
          onPressOut={squish.onPressOut}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.target, style]}
        >
          {({ pressed }) => (
            <Animated.View
              style={[
                styles.row,
                styles.corners(groupPosition),
                styles.face,
                pressed && styles.pressed,
                focused && styles.focused,
                disabled && styles.disabled,
                squish.style,
              ]}
            >
              {content}
            </Animated.View>
          )}
        </Pressable>
      ) : (
        <View style={[styles.row, styles.corners(groupPosition), style]}>
          {content}
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  separators: (top: boolean, bottom: boolean) => ({
    width: '100%',
    minWidth: 0,
    borderTopWidth: top ? 1 : 0,
    borderBottomWidth: bottom ? 1 : 0,
    borderColor: theme.colors.line,
  }),
  target: { width: '100%', minWidth: 0 },
  // Fills whatever size the caller's style gives the press target.
  face: { flexGrow: 1 },
  row: {
    width: '100%',
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  corners: (position?: 'only' | 'first' | 'middle' | 'last') => ({
    borderTopLeftRadius:
      position === undefined
        ? theme.radius.control
        : position === 'only' || position === 'first'
          ? theme.radius.panel
          : 0,
    borderTopRightRadius:
      position === undefined
        ? theme.radius.control
        : position === 'only' || position === 'first'
          ? theme.radius.panel
          : 0,
    borderBottomLeftRadius:
      position === undefined
        ? theme.radius.control
        : position === 'only' || position === 'last'
          ? theme.radius.panel
          : 0,
    borderBottomRightRadius:
      position === undefined
        ? theme.radius.control
        : position === 'only' || position === 'last'
          ? theme.radius.panel
          : 0,
  }),
  content: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  leading: { maxWidth: '20%', flexShrink: 1, minWidth: 0 },
  trailing: { maxWidth: '30%', flexShrink: 1, minWidth: 0 },
  label: {
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
  },
  description: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  focused: { borderColor: theme.colors.focus },
  disabled: { opacity: 0.5 },
}));
