import type { Color, Square } from 'chess.js';
import { useLayoutEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { createStyles } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { indexOf } from '../coordinates';
import { cornerBadgeBox } from './answer-badge';
import { GradeBadge, GradeDisc, GradeGlyph } from './grade-badge';
import { type MoveGrade, moveGrades } from './move-grade';

// Chess.com's classification timeline: the glyph grows in the square's middle
// with a label (0.3s), holds, then slides to the corner while its disc fades
// in and the label shrinks away (1.0–1.3s). Other classes fade in on the
// corner over 0.15s.
const GROW = 300;
const HOLD_END = 1000;
const END = 1300;
const FADE = 150;
const ICON = 0.7;

export function GradeEffect({
  grade,
  square,
  orientation,
  cell,
  delay,
}: {
  grade: MoveGrade;
  square: Square;
  orientation: Color;
  cell: number;
  /** Wait for the moving piece to land. */
  delay: number;
}) {
  const styles = useStyles();
  const reduced = useSystemReducedMotion();
  const mark = moveGrades[grade];
  const flash = !reduced && 'flash' in mark;
  const initialDelay = useRef(delay).current;
  const t = useSharedValue(reduced ? END : 0);
  useLayoutEffect(() => {
    cancelAnimation(t);
    if (reduced) {
      t.set(END);
      return;
    }
    t.set(0);
    t.set(
      withDelay(
        initialDelay,
        withTiming(flash ? END : FADE, {
          duration: flash ? END : FADE,
          easing: Easing.linear,
        }),
      ),
    );
    return () => cancelAnimation(t);
  }, [t, reduced, flash, initialDelay]);

  const corner = cornerBadgeBox(square, orientation, cell);
  const index = indexOf(square, orientation);
  const column = index % 8;
  const row = Math.floor(index / 8);
  const icon = ICON * cell;
  const startX = (column + 0.5) * cell;
  const startY = (row + 0.625) * cell;
  const endX = corner.left + corner.size / 2;
  const endY = corner.top + corner.size / 2;
  const endScale = corner.size / icon;

  const fadeStyle = useAnimatedStyle(
    () => ({ opacity: Math.min(1, t.get() / FADE) }),
    [t],
  );
  const iconStyle = useAnimatedStyle(() => {
    const now = t.get();
    // Ease in-out (smoothstep) for the slide to the corner.
    const x = interpolate(now, [HOLD_END, END], [0, 1], 'clamp');
    const slide = x * x * (3 - 2 * x);
    const grow = interpolate(now, [0, GROW], [0.4, 1], 'clamp');
    return {
      opacity: interpolate(now, [0, GROW], [0, 1], 'clamp'),
      transform: [
        { translateX: (endX - startX) * slide },
        { translateY: (endY - startY) * slide },
        { scale: grow + (endScale - 1) * slide },
      ],
    };
  }, [t, startX, startY, endX, endY, endScale]);
  const discStyle = useAnimatedStyle(
    () => ({ opacity: interpolate(t.get(), [HOLD_END, END], [0, 1], 'clamp') }),
    [t],
  );
  const tintStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        t.get(),
        [0, GROW, HOLD_END, END],
        [0, 0.64, 0.64, 0],
        'clamp',
      ),
    }),
    [t],
  );
  const pillStyle = useAnimatedStyle(() => {
    const now = t.get();
    return {
      opacity: interpolate(
        now,
        [0, GROW, HOLD_END, END],
        [0, 1, 1, 0],
        'clamp',
      ),
      transform: [
        { translateY: interpolate(now, [0, GROW], [cell * 0.08, 0], 'clamp') },
        { scaleX: interpolate(now, [HOLD_END, END], [1, 0], 'clamp') },
      ],
    };
  }, [t, cell]);

  if (!flash)
    return (
      <Animated.View
        pointerEvents="none"
        testID={`grade-badge-${square}-${grade}`}
        style={[
          styles.absolute,
          {
            left: corner.left,
            top: corner.top,
            width: corner.size,
            height: corner.size,
          },
          fadeStyle,
        ]}
      >
        <GradeBadge grade={grade} size={corner.size} />
      </Animated.View>
    );

  const pillHeight = (30 / 82.5) * cell;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.absolute,
          {
            left: column * cell,
            top: row * cell,
            width: cell,
            height: cell,
            backgroundColor: mark.color,
          },
          tintStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        testID={`grade-badge-${square}-${grade}`}
        style={[
          styles.absolute,
          {
            left: startX - icon / 2,
            top: startY - icon / 2,
            width: icon,
            height: icon,
          },
          iconStyle,
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, discStyle]}>
          <GradeDisc grade={grade} />
        </Animated.View>
        {/* Positioned too, so the web paints it over the disc's layer. */}
        <View style={StyleSheet.absoluteFill}>
          <GradeGlyph grade={grade} />
        </View>
      </Animated.View>
      <View
        pointerEvents="none"
        style={[
          styles.absolute,
          {
            top: row === 0 ? 0 : row * cell - pillHeight / 2,
            ...(column === 7
              ? { right: 0, alignItems: 'flex-end' }
              : {
                  left: (column + 1) * cell - 4 * cell,
                  width: 8 * cell,
                  alignItems: 'center',
                }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.pill,
            {
              height: pillHeight,
              paddingHorizontal: (14 / 82.5) * cell,
              borderRadius: pillHeight / 2,
            },
            pillStyle,
          ]}
        >
          <Text
            accessible={false}
            allowFontScaling={false}
            style={[
              styles.pillText,
              {
                color: mark.color,
                fontSize: (18 / 82.5) * cell,
                lineHeight: pillHeight,
              },
            ]}
          >
            {'flash' in mark ? mark.flash : ''}
          </Text>
        </Animated.View>
      </View>
    </>
  );
}
const useStyles = createStyles((theme) => ({
  absolute: { position: 'absolute' },
  pill: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    boxShadow: '0px 1px 0px rgba(0, 0, 0, 0.35)',
  },
  pillText: { fontFamily: theme.typography.bold },
}));
