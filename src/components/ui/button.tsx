import { useState } from 'react';
import {
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { pressHaptic } from '../../lib/haptics';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { ActionIcon, type ActionIconName } from './action-icon';
import { usePressSquish } from './press-squish';
import { useShortcut } from './use-shortcut';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'text' | 'ghost';

/**
 * The app's one button. Every labelled action uses it, so they all share the
 * same press: a soft haptic on touch-down and the squash-and-stretch spring.
 * Primary and secondary sit on a ledge the face drops onto; text has no
 * ledge or fill, for quiet alternatives such as "Not now" or "See details";
 * ghost is the same in quiet ink, for a bar's side actions beside its primary.
 * Gold is a primary for the one urgent moment: saving a streak at risk.
 */
export function Button({
  children,
  onPress,
  disabled = false,
  textScale = 1,
  variant = 'primary',
  icon,
  iconPlacement = 'start',
  accessibilityLabel,
  style,
  paint,
  shortcut,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  textScale?: number;
  /** One primary action per group; alternatives are secondary or text. */
  variant?: ButtonVariant;
  icon?: ActionIconName;
  /** `top` stacks the icon over a smaller label, for a row of bar actions;
   * `end` trails the label, for an arrow that moves on ("Continue →"). */
  iconPlacement?: 'start' | 'top' | 'end';
  /** When the short visible label needs more words to be clear when spoken. */
  accessibilityLabel?: string;
  /** Sizes and places the button (flex, width, margins) from outside. */
  style?: StyleProp<ViewStyle>;
  /** A secondary button's own colours: a stone button on the watch's wall. */
  paint?: Readonly<{ fill: string; ledge: string; edge: string; ink: string }>;
  /** Its web keyboard shortcut, as `aria-keyshortcuts` names it ("B"). */
  shortcut?: string;
}) {
  const styles = useStyles();
  const keys = useShortcut(children, shortcut);
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const text = variant === 'text' || variant === 'ghost';
  const stacked = !!icon && iconPlacement === 'top';
  const squish = usePressSquish(
    text
      ? { squash: tokens.motion.squash.surface }
      : { drop: tokens.layout.ledge },
  );
  const ink =
    variant === 'primary'
      ? theme.colors.onBrand
      : variant === 'gold'
        ? theme.colors.onGold
        : variant === 'text'
          ? theme.colors.brandText
          : variant === 'ghost'
            ? theme.colors.inkMuted
            : (paint?.ink ?? theme.colors.ink);
  return (
    <Pressable
      ref={keys.ref}
      {...keys.props}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        pressHaptic();
        squish.onPressIn();
      }}
      onPressOut={squish.onPressOut}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.ledge(variant),
        paint && { backgroundColor: paint.ledge },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.face(variant),
          paint && { backgroundColor: paint.fill, borderColor: paint.edge },
          stacked && styles.stackedFace,
          focused && styles.focused,
          squish.style,
        ]}
      >
        <View style={[styles.content, stacked && styles.stackedContent]}>
          {icon && iconPlacement !== 'end' && (
            <ActionIcon name={icon} color={ink} />
          )}
          <Text
            style={[
              styles.label(textScale * (stacked ? 0.875 : 1)),
              { color: ink },
            ]}
          >
            {children}
          </Text>
          {icon && iconPlacement === 'end' && (
            <ActionIcon name={icon} color={ink} />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  ledge: (variant: ButtonVariant) => ({
    backgroundColor:
      variant === 'primary'
        ? theme.colors.brandLedge
        : variant === 'gold'
          ? theme.colors.goldLedge
          : variant === 'secondary'
            ? theme.colors.line
            : 'transparent',
    borderRadius: theme.radius.control,
    paddingBottom:
      variant === 'text' || variant === 'ghost' ? 0 : theme.layout.ledge,
  }),
  face: (variant: ButtonVariant) => ({
    flexGrow: 1,
    minHeight: theme.layout.minControl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal:
      variant === 'text' || variant === 'ghost'
        ? theme.spacing.md
        : theme.spacing.lg,
    borderRadius: theme.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      variant === 'primary'
        ? theme.colors.brand
        : variant === 'gold'
          ? theme.colors.gold
          : variant === 'secondary'
            ? theme.colors.surfaceMuted
            : 'transparent',
    borderWidth: 2,
    borderColor: 'transparent',
  }),
  stackedFace: {
    minHeight: 56,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stackedContent: { flexDirection: 'column', gap: 2 },
  focused: { borderColor: theme.colors.focus },
  disabled: { opacity: 0.5 },
  label: (scale: number) => ({
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body * scale,
    textAlign: 'center',
  }),
}));
