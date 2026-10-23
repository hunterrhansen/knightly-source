import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, useTheme } from '../../theme/theme';
import { useTextBlock } from '../../theme/use-text-block';
import { ActionIcon } from './action-icon';
import { Button } from './button';
import { PopIn } from './celebration-motion';
import { Shine, Sparkles } from './reward-effects';

const CHIP_DELAY = 80;
const CHIP_SHINE = CHIP_DELAY + 250;

const praise = [
  'Great find!',
  'That’s it!',
  'Well played!',
  'Excellent!',
  'Nicely done!',
  'Spot on!',
];
/** Rotating praise for a clean answer; the same seed always gives the same
 * words, so a re-render never changes them. */
export const praiseFor = (seed: string) =>
  praise[
    [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0) % praise.length
  ] ?? 'Great find!';

/** A lesson answer's verdict, pinned under the board: green when right, red
 * when not, with the step's two actions. */
export function VerdictSheet({
  tone,
  badge = true,
  title,
  evalText,
  body,
  secondary,
  primary,
  fill = false,
  children,
  points,
}: {
  tone: 'right' | 'wrong';
  /** ✓ or ✕ before the title; off for a neutral verdict (a shown solution). */
  badge?: boolean;
  title: string;
  evalText?: string;
  body?: string;
  secondary?: { label: string; onPress: () => void; shortcut?: string };
  primary: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    /** Moves on (Continue), so a forward arrow trails the label. */
    advances?: boolean;
    shortcut?: string;
  };
  /** Fills its slot with square corners (under an edge-to-edge board). */
  fill?: boolean;
  /** Extra content above the actions, such as a solution's ‹ › steps. */
  children?: ReactNode;
  /** The answer's pattern points, as gold chips beside the title. */
  points?: { base: number; bonus: number };
}) {
  const styles = useStyles();
  const wrong = tone === 'wrong';
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const text = useTextBlock();
  // One height for every verdict, so the sheet never grows or shrinks
  // between answers: room for the title, two body lines, the ‹ › steps and
  // the actions. Longer content (Why?'s move list) may still extend it.
  const gap = theme.spacing.sm;
  const reserve =
    Math.max(28, text.lineHeight(24)) +
    text.height(16, 2) +
    2 * theme.layout.minControl +
    3 * gap;
  // Edge to edge and down through the home indicator; the content stays
  // inside the safe area and reading width.
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.sheet,
        fill && styles.filled,
        wrong ? styles.wrongBorder : styles.rightBorder,
        {
          paddingLeft: insets.left + 16,
          paddingRight: insets.right + 16,
          paddingBottom: insets.bottom + 8,
        },
      ]}
    >
      {/* A solid base under the tint: the sheet covers the bar beneath it. */}
      <View
        pointerEvents="none"
        style={[
          styles.tint,
          fill && styles.square,
          wrong ? styles.wrongTint : styles.rightTint,
        ]}
      />
      <View
        style={[styles.inner, fill ? styles.innerFill : { minHeight: reserve }]}
      >
        <View style={styles.header}>
          {badge && (
            <View
              style={[
                styles.badge,
                wrong ? styles.wrongBadge : styles.rightBadge,
              ]}
            >
              <ActionIcon
                name={wrong ? 'close' : 'check'}
                color={theme.colors.surface}
                size={18}
              />
            </View>
          )}
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              wrong ? styles.wrongTitle : styles.rightTitle,
            ]}
          >
            {title}
          </Text>
          {!!evalText && <Text style={styles.eval}>{evalText}</Text>}
          {/* The chips pop in with sparkles and a shine on the answer's
              own success haptic and sound. */}
          {!!points?.base && (
            <PopIn delay={CHIP_DELAY}>
              <View style={styles.chip}>
                <Text style={styles.points}>{`+${points.base}`}</Text>
                <Shine fire={1} delay={CHIP_SHINE} />
              </View>
              <Sparkles fire={1} delay={CHIP_DELAY} color={theme.colors.gold} />
            </PopIn>
          )}
          {!!points?.bonus && (
            <PopIn delay={CHIP_DELAY + 120}>
              <View style={styles.chip}>
                <Text style={styles.bonus}>{`+${points.bonus} run bonus`}</Text>
                <Shine fire={1} delay={CHIP_SHINE + 120} />
              </View>
            </PopIn>
          )}
        </View>
        {!!body && <Text style={styles.body}>{body}</Text>}
        {children}
        {/* The actions sit where the screen's bottom bar keeps its primary
            button, however tall the sheet, as Duolingo keeps CONTINUE. */}
        <View style={[styles.actions, styles.actionsFill]}>
          {secondary && (
            <View style={styles.secondary}>
              <Button
                variant="secondary"
                onPress={secondary.onPress}
                shortcut={secondary.shortcut}
              >
                {secondary.label}
              </Button>
            </View>
          )}
          <View style={styles.primary}>
            <Button
              disabled={primary.disabled}
              onPress={primary.onPress}
              shortcut={primary.shortcut}
              icon={primary.advances ? 'forward' : undefined}
              iconPlacement="end"
            >
              {primary.label}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  sheet: {
    backgroundColor: theme.colors.page,
    paddingTop: theme.spacing.sm + 4,
    borderTopWidth: 2,
    borderTopLeftRadius: theme.radius.panel,
    borderTopRightRadius: theme.radius.panel,
  },
  inner: {
    gap: theme.spacing.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  // Fills its host at least, and never shrinks below its content: a host
  // anchored to the bottom then lets taller content (large text, a long
  // line) grow up over the board instead of pushing the actions off screen.
  filled: {
    flexGrow: 1,
    flexShrink: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  square: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  rightBorder: { borderColor: theme.colors.brand },
  wrongBorder: { borderColor: theme.boardAnnotations.danger },
  tint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: theme.radius.panel,
    borderTopRightRadius: theme.radius.panel,
  },
  rightTint: { backgroundColor: 'rgba(108, 194, 58, 0.16)' },
  wrongTint: { backgroundColor: 'rgba(255, 107, 94, 0.14)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
  },
  points: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    color: theme.colors.goldText,
    fontFamily: theme.typography.heading,
    fontSize: 16,
  },
  bonus: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    color: theme.colors.flame,
    fontFamily: theme.typography.bold,
    fontSize: 13,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBadge: { backgroundColor: theme.colors.brandText },
  wrongBadge: { backgroundColor: theme.colors.dangerText },
  title: {
    flex: 1,
    fontFamily: theme.typography.heading,
    fontSize: 24,
  },
  rightTitle: { color: theme.colors.brandText },
  wrongTitle: { color: theme.colors.dangerText },
  eval: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
  body: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: 22,
  },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  // Grows to fill the sheet but never below its content. `flex: 1` would set
  // a zero basis: native layout (Yoga) then sizes the sheet without its
  // content, so it never grows up over the board and the actions clip.
  innerFill: { flexGrow: 1 },
  actionsFill: { marginTop: 'auto' },
  secondary: { flex: 1 },
  primary: { flex: 1.4 },
}));
