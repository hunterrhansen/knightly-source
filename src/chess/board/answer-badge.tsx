import type { Color, Square } from 'chess.js';
import { useLayoutEffect, useRef } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { indexOf } from '../coordinates';
import { BadgeDisc, ShadowedGlyph } from './grade-badge';
import { badgeGlyphColor, moveGrades } from './move-grade';

// Measured from Chess.com's puzzle board: a disc on the square's top-right
// corner, 0.40 of a square, overhanging both edges by 0.14 of a square, tucked
// inside the board on the top rank and right file. Two-layer drop shadows.
export const answerColors = {
  correct: {
    disc: moveGrades.best.color,
    glyph: badgeGlyphColor('best'),
    tint: '#acce59',
  },
  incorrect: {
    disc: moveGrades.miss.color,
    glyph: badgeGlyphColor('miss'),
    tint: moveGrades.miss.color,
  },
};
const BOX = 0.4;
const LEFT = 0.74;
const TOP = -0.14;
const TUCK = 0.16;
const FADE_MS = 150;

/** Where a corner badge sits for `square`, in board pixels. */
export function cornerBadgeBox(
  square: Square,
  orientation: Color,
  cell: number,
) {
  const index = indexOf(square, orientation);
  const column = index % 8;
  const row = Math.floor(index / 8);
  return {
    left: (column + LEFT - (column === 7 ? TUCK : 0)) * cell,
    top: (row + TOP + (row === 0 ? TUCK : 0)) * cell,
    size: BOX * cell,
  };
}

const glyphs = {
  correct: 'M4.3 9.2 7.5 12.4 13.7 6.2',
  incorrect: 'M5.6 5.6 12.4 12.4 M12.4 5.6 5.6 12.4',
};

export function AnswerBadge({
  kind,
  square,
  orientation,
  cell,
  delay = 0,
  testID,
}: {
  kind: 'correct' | 'incorrect';
  square: Square;
  orientation: Color;
  cell: number;
  /** Wait for the moving piece to land before appearing. */
  delay?: number;
  testID?: string;
}) {
  const reduced = useSystemReducedMotion();
  const initialDelay = useRef(delay).current;
  const opacity = useSharedValue(reduced ? 1 : 0);
  useLayoutEffect(() => {
    cancelAnimation(opacity);
    if (reduced) {
      opacity.set(1);
      return;
    }
    opacity.set(0);
    opacity.set(
      withDelay(
        initialDelay,
        withTiming(1, {
          duration: FADE_MS,
          easing: Easing.bezier(0, 0, 0.4, 1),
        }),
      ),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduced, initialDelay]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }), [opacity]);
  const { left, top, size } = cornerBadgeBox(square, orientation, cell);
  const colors = answerColors[kind];
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[
        { position: 'absolute', left, top, width: size, height: size },
        style,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 18 19">
        <BadgeDisc color={colors.disc} />
        <G
          fill="none"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ShadowedGlyph
            color={colors.glyph}
            draw={(color) => <Path d={glyphs[kind]} stroke={color} />}
          />
        </G>
      </Svg>
    </Animated.View>
  );
}
