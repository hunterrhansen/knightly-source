import {
  createContext,
  type PropsWithChildren,
  type ReactNode,
  useContext,
  useState,
} from 'react';
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
import { Eyebrow, type EyebrowTone } from './eyebrow';
import { usePressSquish } from './press-squish';

type CardTone = 'surface' | 'muted' | 'plain';

/** A container that is already a surface (a sheet) sets its cards to
 * `plain`: their content without a frame of their own. */
const CardToneContext = createContext<CardTone | undefined>(undefined);
export const CardTone = CardToneContext.Provider;

type CardProps = PropsWithChildren<{
  /** Caps label at the top ("YOUR DECK"); with it the card reads compact:
   * description in small text under the label row. */
  eyebrow?: string;
  eyebrowTone?: EyebrowTone;
  /** Quiet text at the end of the eyebrow row ("142 positions"). */
  meta?: string;
  title?: string;
  description?: string;
  footer?: ReactNode;
  footerPlacement?: 'flow' | 'bottom';
  /** `plain`: no background, border or padding (inside a sheet). */
  tone?: CardTone;
  /** Unpadded cards can contain grouped ListItems or custom full-width content. */
  padding?: 'default' | 'none';
  /** Sizes and places the card (flex, minHeight, margins). On a tappable card
   * it sits on the press target, outside the face that squashes. */
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
}> &
  (
    | {
        /** Whole-card actions require a complete accessible name. Children must be visual only. */
        onPress: () => void;
        accessibilityLabel: string;
        accessibilityHint?: string;
        disabled?: boolean;
      }
    | {
        onPress?: undefined;
        accessibilityLabel?: never;
        accessibilityHint?: never;
        disabled?: never;
      }
  );

/** Ignite-inspired heading/body/footer surface. Static cards can contain controls. */
export function Card({
  eyebrow,
  eyebrowTone,
  meta,
  title,
  description,
  children,
  footer,
  footerPlacement = 'flow',
  tone: ownTone,
  padding = 'default',
  style,
  titleStyle,
  descriptionStyle,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
}: CardProps) {
  const styles = useStyles();
  const sheetTone = useContext(CardToneContext);
  const tone = ownTone ?? sheetTone ?? 'surface';
  const [focused, setFocused] = useState(false);
  const squish = usePressSquish({ squash: tokens.motion.squash.surface });
  const content = (
    <>
      {eyebrow || title || description ? (
        <View style={styles.header(!!eyebrow)}>
          {eyebrow ? (
            <View style={styles.eyebrowRow}>
              <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
              {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            </View>
          ) : null}
          {title ? (
            <Text
              accessibilityRole={onPress ? undefined : 'header'}
              style={[styles.title, titleStyle]}
            >
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text
              style={[
                eyebrow ? styles.meta : styles.description,
                descriptionStyle,
              ]}
            >
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children != null && <View style={styles.body(padding)}>{children}</View>}
      {footer != null && (
        <View style={styles.footer(footerPlacement)}>
          {typeof footer === 'string' || typeof footer === 'number' ? (
            <Text style={styles.description}>{footer}</Text>
          ) : (
            footer
          )}
        </View>
      )}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
            styles.frame(tone, padding),
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
    <View style={[styles.frame(tone, padding), style]}>{content}</View>
  );
}

const useStyles = createStyles((theme) => ({
  frame: (tone: CardTone, padding: 'default' | 'none') => ({
    width: '100%',
    minWidth: 0,
    minHeight: theme.layout.minControl,
    backgroundColor:
      tone === 'plain'
        ? undefined
        : tone === 'muted'
          ? theme.colors.surfaceMuted
          : theme.colors.surface,
    borderWidth: tone === 'plain' ? 0 : 2,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.panel,
    padding: padding === 'none' || tone === 'plain' ? 0 : theme.spacing.lg,
    gap: theme.spacing.md,
  }),
  target: { width: '100%', minWidth: 0 },
  // Fills whatever size the caller's style gives the press target.
  face: { flexGrow: 1 },
  header: (compact: boolean) => ({
    minWidth: 0,
    gap: compact ? theme.spacing.xs : theme.spacing.sm,
  }),
  eyebrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  meta: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
  },
  body: (padding: 'default' | 'none') => ({
    minWidth: 0,
    gap: padding === 'none' ? 0 : theme.spacing.md,
  }),
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.cardTitle,
  },
  description: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
  footer: (placement: 'flow' | 'bottom') => ({
    minWidth: 0,
    marginTop: placement === 'bottom' ? 'auto' : 0,
  }),
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  focused: { borderColor: theme.colors.focus },
  disabled: { opacity: 0.5 },
}));
