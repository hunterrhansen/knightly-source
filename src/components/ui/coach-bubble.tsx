import { StyleSheet as NativeStyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { GradeBadge, type MoveGrade } from '../../chess/board';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { useTextBlock } from '../../theme/use-text-block';
import { useWatchSurface } from '../kit/registry';
import { KnightMascot, type KnightMood } from './knight-mascot';

/** The coach's speech bubble above a lesson board: a title with the move's
 * grade and evaluation, and a line of explanation. Its tail points at the
 * knight, so the words read as his. On the watch's wall it is parchment and
 * the knight is the scene's, so it draws none of its own. */
export function CoachBubble({
  title,
  grade,
  evalText,
  body,
  tag,
  tone = 'plain',
  lines,
  mood,
}: {
  title: string;
  /** The knight's mood, when not the one the tone implies (thinking while
   * a lesson loads). */
  mood?: KnightMood;
  /** A short label leading the body, such as what kind of mistake it was. */
  tag?: string;
  grade?: MoveGrade;
  evalText?: string;
  body?: string;
  tone?: 'plain' | 'right' | 'wrong';
  /** Body lines to reserve. With it the bubble keeps one height, so a board
   * below never moves: the title takes one line and the body is clamped. */
  lines?: number;
}) {
  const styles = useStyles();
  const text = useTextBlock();
  const fixed = lines !== undefined;
  const titleSize = 18;
  const bodySize = 15;
  const parchment = useWatchSurface('ui.parchment');
  const { ring, tail } = useToneBorder(tone, parchment?.edge);
  return (
    <View style={styles.row}>
      {/* The knight reacts to the coach's verdict, replaying on each new one. */}
      {!parchment && (
        <KnightMascot
          size={44}
          mood={
            mood ??
            (tone === 'right'
              ? 'cheer'
              : tone === 'wrong'
                ? 'encourage'
                : 'idle')
          }
          play={title}
        />
      )}
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.bubble,
          parchment && {
            backgroundColor: parchment.fill,
            // The parchment's drop shadow, as the wall's plaques have.
            boxShadow: `0 4px 0 ${parchment.ledge}`,
          },
          fixed && {
            height:
              text.height(titleSize, 1) + text.height(bodySize, lines) + 20,
          },
        ]}
      >
        <Animated.View pointerEvents="none" style={[motion.border, ring]} />
        {/* Drawn over the ring, so it opens the bubble's edge into the tail. */}
        <Animated.View
          pointerEvents="none"
          style={[
            motion.tail,
            styles.tail,
            parchment && { backgroundColor: parchment.fill },
            tail,
          ]}
        />
        {/* New words fade in, so a verdict replaces the prompt softly. */}
        <Animated.View
          key={`${title}\n${tag ?? ''}\n${body ?? ''}`}
          entering={wordsIn}
          style={motion.words}
        >
          <View style={styles.header}>
            {grade && <GradeBadge grade={grade} size={22} />}
            <Text
              style={[
                styles.title,
                parchment && { color: parchment.ink },
                fixed && { lineHeight: text.lineHeight(titleSize) },
              ]}
              numberOfLines={fixed ? 1 : 2}
            >
              {title}
            </Text>
            {!!evalText && <Text style={styles.eval}>{evalText}</Text>}
          </View>
          {!!(body || tag) && (
            <Text
              style={[
                styles.body,
                parchment && { color: parchment.inkMuted },
                fixed && { lineHeight: text.lineHeight(bodySize) },
              ]}
              numberOfLines={lines}
            >
              {!!tag && (
                <Text style={styles.tag}>
                  {tag}
                  {body ? '. ' : ''}
                </Text>
              )}
              {body}
            </Text>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const wordsIn = FadeIn.duration(tokens.motion.move);
const TAIL = 14;
// Theme-independent styles for the animated overlay.
const motion = NativeStyleSheet.create({
  // Over the bubble's own transparent border, matching its radius.
  border: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderWidth: 2,
  },
  words: { gap: 2 },
  // A square turned to a point, outlined on its two outer sides only; its
  // centre sits on the bubble's left edge, level with the knight's face.
  tail: {
    position: 'absolute',
    left: -2 - TAIL / 2,
    top: 22 - 2 - TAIL / 2,
    width: TAIL,
    height: TAIL,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
});

/** The bubble's border eases between plain, right and wrong: a state flip,
 * so a CSS transition rather than a driven value. */
function useToneBorder(tone: 'plain' | 'right' | 'wrong', plain?: string) {
  const { theme } = useTheme();
  const reduced = useSystemReducedMotion();
  const borderColor =
    tone === 'right'
      ? theme.colors.brand
      : tone === 'wrong'
        ? theme.boardAnnotations.danger
        : (plain ?? theme.colors.line);
  const transition = {
    transitionProperty: 'borderColor',
    transitionDuration: reduced ? 0 : tokens.motion.move,
  } as const;
  return {
    ring: { borderRadius: theme.radius.control, borderColor, ...transition },
    tail: { borderColor, ...transition },
  };
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: 'row',
    // Room for the tail between the knight and the bubble.
    gap: theme.spacing.sm + 6,
    alignItems: 'flex-start',
  },
  bubble: {
    flex: 1,
    gap: 2,
    // The border itself is drawn by the animated overlay above it.
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  tail: { backgroundColor: theme.colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
  },
  title: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body + 2,
  },
  tag: { fontFamily: theme.typography.bold },
  eval: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    fontVariant: ['tabular-nums'],
  },
  body: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body - 1,
    lineHeight: 21,
  },
}));
