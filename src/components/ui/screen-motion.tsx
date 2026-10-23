import { useIsFocused } from 'expo-router';
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { tokens } from '../../theme/tokens';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';

// Screen changes share the touch springs (tokens.motion.springs): a screen
// fades in where it stands (it never moves up or down), a sheet or dialog pops. Native stacks animate pushes themselves;
// these cover what the platform leaves as a cut (web pushes, tab switches) and
// the app's own sheets. Under reduced motion everything appears at rest.

const { pop, settle } = tokens.motion.springs;
// A dialog's starting scale.
const DIALOG_SCALE = 0.92;
// A rising sheet is anchored to the screen's bottom edge, so its overshoot
// stretches it upward (scaleY from the bottom) instead of lifting it off the
// edge; this tames the stretch to a few percent.
const SHEET_STRETCH = 0.3;

/** Native-stack options for a pushed screen: it fades in where it stands
 * (Android, iOS). The swipe-back gesture keeps the native interactive pop.
 * Web stacks ignore these and use `stackArrivalLayout`. */
export function usePushTransition() {
  return {
    // Reduced motion keeps the fade: no movement, and the change still reads.
    animation: 'fade' as const,
    // iOS only; Android's fade has its own platform timing.
    animationDuration: settle.duration,
  };
}

/** A screen fading in on `settle`, in place, each time `play` turns true. */
function useArrival(play: boolean) {
  const reducedMotion = useSystemReducedMotion();
  // A screen that mounts arriving starts clear: the web applies shared
  // values a frame late, so setting them on mount would show one frame at
  // rest first.
  const fade = useSharedValue(play && !reducedMotion ? 0 : 1);
  useLayoutEffect(() => {
    if (!play || reducedMotion) return;
    fade.set(0);
    fade.set(withSpring(1, settle));
  }, [play, reducedMotion, fade]);
  return useAnimatedStyle(() => ({ opacity: fade.get() }));
}

function StackArrival({
  pushed,
  children,
}: {
  pushed: boolean;
  children: ReactNode;
}) {
  const style = useArrival(useIsFocused() && pushed);
  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

/**
 * A stack's `screenLayout` on the web, where the native stack cuts between
 * screens: a pushed screen (anything above its stack's first) fades in
 * whenever it gains focus. A stack's first screen stays still, so a page
 * load or a tab's root never replays it. Native stacks animate themselves.
 */
export const stackArrivalLayout =
  Platform.OS === 'web'
    ? ({
        children,
        navigation,
        route,
      }: {
        children: ReactElement;
        navigation: { getState: () => { routes: { key: string }[] } };
        route: { key: string };
      }) => (
        <StackArrival
          pushed={
            navigation.getState().routes.findIndex((r) => r.key === route.key) >
            0
          }
        >
          {children}
        </StackArrival>
      )
    : undefined;

/**
 * A bottom sheet rising from the screen's edge on `pop`: one small overshoot,
 * shown as a stretch up from the bottom edge so no gap opens beneath it.
 * Measures itself first, so it starts fully below the edge at any height.
 */
export function SheetRise({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useSystemReducedMotion();
  const height = useSharedValue(0);
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const started = useRef(reducedMotion);
  const onLayout = (event: LayoutChangeEvent) => {
    if (started.current) return;
    started.current = true;
    height.set(event.nativeEvent.layout.height);
    progress.set(withSpring(1, pop));
  };
  const animated = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      // Hidden only until the first layout tells it how far to start.
      opacity: p < 1 && height.get() === 0 ? 0 : 1,
      transform: [
        { translateY: Math.max(0, 1 - p) * height.get() },
        { scaleY: 1 + Math.max(0, p - 1) * SHEET_STRETCH },
      ],
    };
  });
  return (
    <Animated.View
      onLayout={onLayout}
      style={[style, styles.fromBottom, animated]}
    >
      {children}
    </Animated.View>
  );
}

/** A centred dialog popping in: scales up from slightly small on `pop` while
 * it fades in on `settle`. */
export function DialogPop({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useSystemReducedMotion();
  const scale = useSharedValue(reducedMotion ? 1 : 0);
  const fade = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    scale.set(withSpring(1, pop));
    fade.set(withSpring(1, settle));
  }, [reducedMotion, scale, fade]);
  const animated = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ scale: interpolate(scale.get(), [0, 1], [DIALOG_SCALE, 1]) }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** A modal's dimmed backdrop fading in on `settle`, as a layer behind its
 * sheet or dialog (which keep their own entrances). */
export function BackdropFade({ style }: { style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useSystemReducedMotion();
  const fade = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) fade.set(withSpring(1, settle));
  }, [reducedMotion, fade]);
  const animated = useAnimatedStyle(() => ({ opacity: fade.get() }));
  return <Animated.View style={[styles.backdrop, style, animated]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fromBottom: { transformOrigin: 'bottom' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
});
