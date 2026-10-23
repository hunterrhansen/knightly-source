import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';

/**
 * The squash-and-stretch press for tappable surfaces, as in Supercell games:
 * on touch-down the surface drops by `drop` and squashes (wider, shorter); on
 * release it springs back past rest, briefly stretching taller, and settles.
 * Flat surfaces with no ledge pass no `drop` and the gentler
 * `tokens.motion.squash.surface`. Spread the handlers onto the Pressable and
 * the style onto an Animated.View face inside it; layout (flex, size,
 * margins) stays on the Pressable so the transform never moves neighbours.
 * Under reduced motion Reanimated's springs jump straight to their target, so
 * the surface still shows pressed and released states without the bounce.
 */
export function usePressSquish({
  drop = 0,
  squash = tokens.motion.squash.control,
}: {
  /** Points the surface travels down when pressed (a ledge's height). */
  drop?: number;
  /** Fraction it widens and flattens when pressed. */
  squash?: number;
} = {}) {
  // 0 at rest, 1 fully pressed; the release spring dips below 0.
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => {
    const p = pressed.get();
    return {
      transform: [
        // Never lift above rest by more than a point: the ledge stays seated.
        { translateY: Math.max(drop * p, -1) },
        { scaleX: 1 + squash * p },
        { scaleY: 1 - squash * p },
      ],
    };
  }, [pressed, drop, squash]);
  return {
    onPressIn: () => pressed.set(withSpring(1, tokens.motion.springs.press)),
    onPressOut: () => pressed.set(withSpring(0, tokens.motion.springs.release)),
    style,
  };
}
