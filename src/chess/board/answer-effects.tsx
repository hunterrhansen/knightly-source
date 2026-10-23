import type { Color, Square } from 'chess.js';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { indexOf } from '../coordinates';
import { cornerBadgeBox } from './answer-badge';

// The hint's pulse breathes out and back, a CSS loop Reanimated runs natively.
const hintPulse = {
  animationName: {
    from: { opacity: 0.55, transform: [{ scale: 1 }] },
    to: { opacity: 0, transform: [{ scale: 1.144 }] },
  },
  animationDuration: tokens.motion.hint / 2,
  animationTimingFunction: 'ease-in-out',
  animationDirection: 'alternate',
  animationIterationCount: 'infinite',
} as const;
const hiddenPulse = { opacity: 0 } as const;

// Original Knightly gold outline and a 1.6s outward, fading pulse.
export function HintEffect({
  square,
  orientation,
  cell,
}: {
  square: Square;
  orientation: Color;
  cell: number;
}) {
  const { theme } = useTheme();
  const reduced = useSystemReducedMotion();
  const pulse = reduced ? hiddenPulse : hintPulse;
  const index = indexOf(square, orientation);
  const left = (index % 8) * cell;
  const top = Math.floor(index / 8) * cell;
  // The ✓/✕ badges' corner, size and edge tuck, so every badge sits alike.
  const bulb = cornerBadgeBox(square, orientation, cell);
  return (
    <>
      <View
        testID={`hint-glow-${square}`}
        style={{
          position: 'absolute',
          left,
          top,
          width: cell,
          height: cell,
          borderWidth: cell * 0.056,
          borderColor: theme.boardAnnotations.hintGold,
        }}
      />
      <Animated.View
        testID={`hint-pulse-${square}`}
        style={[
          {
            position: 'absolute',
            left,
            top,
            width: cell,
            height: cell,
            borderWidth: cell * 0.056,
            borderColor: theme.boardAnnotations.hintGold,
          },
          pulse,
        ]}
      />
      <View
        testID={`hint-bulb-${square}`}
        style={{
          position: 'absolute',
          left: bulb.left,
          top: bulb.top,
          width: bulb.size,
          height: bulb.size,
          borderRadius: bulb.size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.boardAnnotations.hintGold,
          borderWidth: 2,
          borderColor: theme.colors.surface,
          boxShadow: `0px 2px 0px ${theme.boardAnnotations.hintGoldLedge}`,
        }}
      >
        <Svg width="70%" height="70%" viewBox="0 0 24 24">
          <Path
            fill={theme.boardAnnotations.onHintGold}
            d="M9 18h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 19.5z M12 2.5a7 7 0 0 0-4.2 12.6c.7.5 1.2 1.3 1.2 2.2V17h6v-.7c0-.9.5-1.7 1.2-2.2A7 7 0 0 0 12 2.5z"
          />
        </Svg>
      </View>
    </>
  );
}
