import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { pressHaptic } from '../../lib/haptics';
import { quadInOut } from '../../theme/css-easing';
import { createStyles, useTheme } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import {
  knightEye,
  knightPath,
  knightTransform,
  moon,
  moonCutout,
  tileDarkSquares,
} from './brand-mark-geometry';
import { usePressSquish } from './press-squish';

// Matches `imageWidth` of the native splash in app.config.ts.
const markSize = 200;
// Delays count from app start, so the screen can remount (fonts, then
// connection) without restarting them; a fast launch never shows either.
const launchedAt = Date.now();
const animateAfter = 600;
const connectingAfter = 2000;

function useSinceLaunch(ms: number) {
  const [reached, setReached] = useState(() => Date.now() - launchedAt >= ms);
  useEffect(() => {
    if (reached) return;
    const timer = setTimeout(
      () => setReached(true),
      ms - (Date.now() - launchedAt),
    );
    return () => clearTimeout(timer);
  }, [ms, reached]);
  return reached;
}

// The moon breathes while the app waits: a CSS loop, run by Reanimated
// natively, that stops (back to full) when the wait ends.
const moonGlow = {
  animationName: { from: { opacity: 1 }, to: { opacity: 0.55 } },
  animationDuration: 800,
  animationTimingFunction: quadInOut,
  animationDirection: 'alternate',
  animationIterationCount: 'infinite',
} as const;

/**
 * The full-screen brand hold shown while Knightly starts: the native splash's
 * board tile on brand green, then a connection problem with its recovery action.
 */
export function LaunchScreen({
  error,
  footer,
  systemFont = false,
}: {
  error?: {
    title: string;
    message?: string;
    action?: { label: string; onPress: () => void };
  };
  /** Links that stay reachable while the app cannot connect. */
  footer?: ReactNode;
  /** Before the app fonts load, text must use the platform font. */
  systemFont?: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useSystemReducedMotion();
  const animate = useSinceLaunch(animateAfter) && !reducedMotion && !error;
  const connecting = useSinceLaunch(connectingAfter);
  const moonStyle = animate ? moonGlow : undefined;
  const font = (family: string) => (systemFont ? undefined : family);
  return (
    <View
      style={styles.root}
      accessible={!error}
      accessibilityRole={error ? undefined : 'progressbar'}
      accessibilityLabel={error ? undefined : 'Loading Knightly'}
    >
      <StatusBar style="dark" />
      <View style={styles.group}>
        <View style={styles.mark}>
          <Svg
            width={markSize}
            height={markSize}
            viewBox="0 0 100 100"
            aria-hidden
          >
            {/* The same tile colours as the native splash and app icon. */}
            <Rect
              x="4"
              y="8"
              width="92"
              height="88"
              rx="22"
              fill={theme.colors.brandTileLedge}
            />
            <Rect
              x="4"
              y="4"
              width="92"
              height="88"
              rx="22"
              fill={theme.colors.brand}
            />
            {tileDarkSquares.map((d) => (
              <Path key={d} d={d} fill={theme.colors.brandSquare} />
            ))}
            <Path
              d={knightPath}
              transform={`translate(${knightTransform.x} ${knightTransform.y}) scale(${knightTransform.scale})`}
              fill={theme.colors.onBrand}
            />
            <Circle {...knightEye} fill={theme.colors.brand} />
          </Svg>
          <Animated.View style={[styles.moon, moonStyle]}>
            <Svg
              width={markSize}
              height={markSize}
              viewBox="0 0 100 100"
              aria-hidden
            >
              <Circle {...moon} fill={theme.boardAnnotations.hintGold} />
              <Circle {...moonCutout} fill={theme.colors.brandSquare} />
            </Svg>
          </Animated.View>
        </View>
        <View style={styles.status} accessibilityLiveRegion="polite">
          {error ? (
            <>
              <Text
                accessibilityRole="header"
                style={[
                  styles.title,
                  { fontFamily: font(theme.typography.bold) },
                ]}
              >
                {error.title}
              </Text>
              {error.message && (
                <Text
                  style={[
                    styles.message,
                    { fontFamily: font(theme.typography.body) },
                  ]}
                >
                  {error.message}
                </Text>
              )}
              {error.action && (
                <RetryButton
                  label={error.action.label}
                  onPress={error.action.onPress}
                  fontFamily={font(theme.typography.bold)}
                />
              )}
            </>
          ) : (
            connecting && (
              <Text
                style={[
                  styles.message,
                  { fontFamily: font(theme.typography.body) },
                ]}
              >
                Connecting…
              </Text>
            )
          )}
        </View>
      </View>
      {footer && (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + theme.spacing.sm },
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

function RetryButton({
  label,
  onPress,
  fontFamily,
}: {
  label: string;
  onPress: () => void;
  fontFamily: string | undefined;
}) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const squish = usePressSquish();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        pressHaptic();
        squish.onPressIn();
      }}
      onPressOut={squish.onPressOut}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={styles.buttonTarget}
    >
      <Animated.View
        style={[styles.button, focused && styles.focused, squish.style]}
      >
        <Text style={[styles.buttonLabel, { fontFamily }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  // Brand green, like the native splash.
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.brand,
  },
  // The mark and its status centre together on the full screen, so the mark
  // sits above the native splash's position once status text shows.
  group: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: markSize, height: markSize },
  moon: { ...StyleSheet.absoluteFill },
  status: {
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 20,
    color: theme.colors.onBrand,
    textAlign: 'center',
  },
  message: {
    maxWidth: 360,
    fontSize: theme.typography.size.body,
    lineHeight: 23,
    color: theme.colors.onBrand,
    textAlign: 'center',
  },
  buttonTarget: { marginTop: theme.spacing.sm },
  button: {
    minHeight: theme.layout.minControl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.onBrand,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: { borderColor: theme.colors.focus },
  buttonLabel: {
    fontSize: theme.typography.size.body,
    color: theme.colors.brand,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: theme.spacing.lg,
  },
}));
