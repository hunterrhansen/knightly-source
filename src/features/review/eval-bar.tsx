import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';

/** White's share of the evaluation: a strip with the number printed across
 * the top of the lesson, or a thin bar beside the board. */
export function EvalBar({
  white,
  evalText,
  orientation = 'horizontal',
  whiteOnTop = false,
}: {
  /** White's win chance, 0–100. */
  white: number;
  evalText: string;
  orientation?: 'horizontal' | 'vertical';
  /** Beside a board shown from Black's side, White's share sits at the top. */
  whiteOnTop?: boolean;
}) {
  const styles = useStyles();
  const share = `${Math.max(0, Math.min(100, white))}%` as const;
  const label = `Evaluation ${evalText || 'unknown'}`;
  const whiteAhead = white >= 50;
  if (orientation === 'vertical')
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={label}
        style={[styles.vertical, whiteOnTop && styles.fromTop]}
      >
        <View style={[styles.whiteVertical, { height: share }]} />
        {/* As on Chess.com, the number sits at the leading side's end. */}
        <Text
          numberOfLines={1}
          style={[
            styles.verticalText,
            whiteAhead === whiteOnTop ? styles.atTop : styles.atBottom,
            whiteAhead ? styles.inkOnWhite : styles.inkOnBlack,
          ]}
        >
          {shortEval(evalText)}
        </Text>
      </View>
    );
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={styles.horizontal}
    >
      <View style={[styles.whiteHorizontal, { width: share }]} />
      <Text
        style={[
          styles.text,
          whiteAhead ? styles.textOnWhite : styles.textOnBlack,
        ]}
      >
        {evalText}
      </Text>
    </View>
  );
}

/** "+1.68" → "1.7": the bar's colour already says who is ahead. */
function shortEval(text: string) {
  const pawns = Number.parseFloat(text.replace('−', '-'));
  return Number.isNaN(pawns)
    ? text.replace(/^[+−]/, '')
    : Math.abs(pawns).toFixed(1);
}

const useStyles = createStyles((theme) => ({
  horizontal: {
    height: 24,
    borderRadius: 8,
    // Outlined so Black's share still reads against the dark page.
    borderWidth: 1,
    borderColor: theme.colors.line,
    overflow: 'hidden',
    backgroundColor: tokens.evaluation.black,
    justifyContent: 'center',
  },
  whiteHorizontal: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens.evaluation.white,
  },
  vertical: {
    // Fills its column: the board's height, between the player bands.
    flex: 1,
    width: 28,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignSelf: 'stretch',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: tokens.evaluation.black,
    justifyContent: 'flex-end',
  },
  fromTop: { justifyContent: 'flex-start' },
  verticalText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: theme.typography.bold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  inkOnWhite: { color: tokens.evaluation.onWhite },
  inkOnBlack: { color: tokens.evaluation.onBlack },
  atTop: { top: 4 },
  atBottom: { bottom: 4 },
  whiteVertical: { backgroundColor: tokens.evaluation.white },
  text: {
    position: 'absolute',
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small - 1,
    fontVariant: ['tabular-nums'],
  },
  textOnWhite: { left: theme.spacing.sm, color: tokens.evaluation.onWhite },
  textOnBlack: { right: theme.spacing.sm, color: tokens.evaluation.onBlack },
}));
