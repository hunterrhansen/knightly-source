import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { ActionTiles } from './action-bar';
import { FittedBoard } from './fitted-board';
import type { LessonFrameProps } from './lesson-frame-types';
import { WallLessonFrame } from './lesson-wall-frame';
import { PointsFlight, PointsFlightProvider } from './points-flight';
import { SheetRise } from './screen-motion';

/** The lesson layout shared by practice and Game review: the top bars, the
 * coach over a board fitted to the room left (never scrolling), the bottom
 * action bar and a verdict sheet sliding over it. The caller's container
 * holds the safe-area top; the bar keeps the bottom inset, so a sheet can run
 * to the edge. `watch` draws the same lesson from the castle wall. */
export function LessonFrame(props: LessonFrameProps) {
  return props.watch ? (
    <WallLessonFrame {...props} />
  ) : props.side ? (
    <WideFrame {...props} side={props.side} />
  ) : (
    <PlainFrame {...props} />
  );
}

/** Room for the board beside a side panel: desktop browsers and landscape
 * tablets. Lichess splits board and tools from 800 px; the panel here needs
 * ~400 of it, so the board keeps at least ~500. */
export function useWideLesson() {
  const { width, height } = useWindowDimensions();
  return width >= 960 && height >= 560;
}

function WideFrame({
  bars,
  coach,
  board,
  fallback,
  orientation,
  award,
  bands,
  sheet,
  actions,
  fadeSheet = false,
  side,
}: LessonFrameProps & { side: NonNullable<LessonFrameProps['side']> }) {
  const styles = useLessonStyles();
  const insets = useSafeAreaInsets();
  const shown = sheet?.(false);
  return (
    <PointsFlightProvider>
      <View style={[styles.wide, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.wideBoard}>
          {!board && fallback ? (
            fallback
          ) : (
            <FittedBoard
              board={board}
              {...bands}
              beside={side.beside}
              maxSize={Number.POSITIVE_INFINITY}
              overlay={(size) => (
                <PointsFlight
                  award={award}
                  orientation={orientation}
                  size={size}
                />
              )}
            />
          )}
        </View>
        <View style={styles.panel}>
          <ActionTiles>
            {bars}
            <View style={styles.panelBody}>
              {coach}
              <View style={styles.panelFill}>{side.panel}</View>
            </View>
            <View style={styles.panelActions}>{actions}</View>
            {shown && (
              <Animated.View
                exiting={fadeSheet ? sheetOut : undefined}
                style={motion.sheet}
              >
                <SheetRise>{shown}</SheetRise>
              </Animated.View>
            )}
          </ActionTiles>
        </View>
      </View>
    </PointsFlightProvider>
  );
}

function PlainFrame({
  bars,
  coach,
  board,
  fallback,
  orientation,
  award,
  bands,
  reserve,
  below,
  sheet,
  actions,
  compact = false,
  fadeSheet = false,
}: LessonFrameProps) {
  const styles = useLessonStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [bodyY, setBodyY] = useState(0);
  const [boardBottom, setBoardBottom] = useState<number>();
  const filled = width < 600 && boardBottom !== undefined;
  const shown = sheet?.(filled);
  return (
    <PointsFlightProvider>
      {bars}
      {!board && fallback ? (
        fallback
      ) : (
        <View
          style={[styles.content, styles.body, compact && styles.compact]}
          onLayout={(event) => setBodyY(event.nativeEvent.layout.y)}
        >
          {coach}
          <FittedBoard
            board={board}
            {...bands}
            reserve={reserve}
            onBottom={setBoardBottom}
            overlay={(size) => (
              <PointsFlight
                award={award}
                orientation={orientation}
                size={size}
              />
            )}
            below={
              below && (
                <View
                  style={[styles.below, shown ? styles.hidden : undefined]}
                  pointerEvents={shown ? 'none' : 'auto'}
                  importantForAccessibility={
                    shown ? 'no-hide-descendants' : 'auto'
                  }
                  accessibilityElementsHidden={!!shown}
                >
                  {below}
                </View>
              )
            }
          />
        </View>
      )}
      <View style={[styles.pinned, { paddingBottom: insets.bottom + 8 }]}>
        {actions}
      </View>
      {shown && (
        <Animated.View
          exiting={fadeSheet ? sheetOut : undefined}
          style={[
            motion.sheet,
            // Phones: square, from the board's bottom edge to the screen's,
            // growing upward over the board when its content needs more.
            filled && motion.sheetFill,
            filled && { top: bodyY + (boardBottom ?? 0) },
          ]}
        >
          {/* Rises from the bottom edge with one small overshoot. */}
          <SheetRise style={filled && motion.riseFill}>{shown}</SheetRise>
        </Animated.View>
      )}
    </PointsFlightProvider>
  );
}

// System reduced motion drops the fade.
const sheetOut = FadeOut.duration(tokens.motion.move);
// Theme-independent styles for the animated verdict sheet.
const motion = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheetFill: { justifyContent: 'flex-end' },
  // Lets a filled sheet still fill its slot, and grow up past it, inside the rise.
  riseFill: { flexGrow: 1, flexShrink: 0, justifyContent: 'flex-end' },
});

/** The lesson body's layout, for lesson views outside the frame. */
export const useLessonStyles = createStyles((theme) => ({
  fill: { flex: 1 },
  content: {
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  body: { flex: 1, paddingBottom: 0 },
  compact: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  below: { gap: theme.spacing.sm },
  hidden: { opacity: 0 },
  pinned: {
    paddingHorizontal: theme.spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  // Wide: the board's column takes what the panel leaves.
  wide: {
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
  },
  wideBoard: { flex: 1, minWidth: 0 },
  panel: {
    width: '36%',
    minWidth: 380,
    maxWidth: 560,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  panelBody: {
    flex: 1,
    minHeight: 0,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingBottom: 0,
  },
  panelFill: { flex: 1, minHeight: 0, gap: theme.spacing.sm },
  panelActions: { padding: theme.spacing.md },
}));
