import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { useTextBlock } from '../../theme/use-text-block';
import { CaptainHealth, WallViewRaiders } from '../kit/raiders';
import {
  useSprite,
  useWallView,
  useWatchSurface,
  WatchSurfaces,
} from '../kit/registry';
import { SpriteView } from '../kit/sprite';
import type { Raid } from '../kit/types';
import { WallViewFar, WallViewNear, wallViewKnight } from '../kit/wall-view';
import { FittedBoard } from './fitted-board';
import type { LessonFrameProps } from './lesson-frame-types';
import { PointsFlight, PointsFlightProvider } from './points-flight';
import { SheetRise } from './screen-motion';

/** The lesson's widest column; the scene runs the full width around it. */
const COLUMN = 640;
// Extra sky over the treeline on phones at least this tall (points).
const ART_ROOM = 48;
const TALL_PHONE = 740;

/**
 * The lesson seen from the castle wall (docs/specs/2026-10-18-watch-story-design.md,
 * "During the watch: looking out from the wall"): the bars over the night sky
 * and the treeline (with the position's plaque), the board full width and
 * flat as the field (the learner's own pieces and board colours), then the
 * battlements with the knight behind them, the
 * coach's parchment beside him and stone buttons on the wall. The verdict
 * sheet rises over the wall from the board's bottom edge.
 *
 * The board never moves: the bars, the plaque's slot, the reserved room
 * under the board and the wall's words and buttons keep fixed heights for
 * the whole lesson, so the board's top and size stay put.
 */
export function WallLessonFrame({
  bars,
  plaque,
  coach,
  board,
  fallback,
  orientation,
  award,
  reserve,
  below,
  sheet,
  actions,
  fadeSheet = false,
  raid,
}: LessonFrameProps) {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const text = useTextBlock();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const artRoom = windowHeight >= TALL_PHONE ? ART_ROOM : 0;
  const view = useWallView('scene.wallView');
  const plaqueSurface = useWatchSurface('ui.plaque');
  const [frameWidth, setFrameWidth] = useState(0);
  const [farHeight, setFarHeight] = useState(0);
  const [nearHeight, setNearHeight] = useState(0);
  const [coachHeight, setCoachHeight] = useState(0);
  const [bodyY, setBodyY] = useState(0);
  const [boardBottom, setBoardBottom] = useState<number>();
  const [boardSize, setBoardSize] = useState(0);
  const filled = windowWidth < 600 && boardBottom !== undefined;
  const shown = sheet?.(filled);
  const columnWidth = Math.min(frameWidth, COLUMN);
  const column = { left: (frameWidth - columnWidth) / 2, width: columnWidth };
  // The plaque's slot holds one line of small text, whatever it shows.
  const plaqueRoom = text.height(theme.typography.size.small, 1) + 20;
  // Stone buttons keep one height whichever actions show (or none).
  const actionsHeight =
    Math.max(
      theme.layout.minControl,
      text.height(theme.typography.size.body, 1) + 2 * theme.spacing.sm + 4,
    ) + theme.layout.ledge;
  // The wall's own breathing room, tighter than a page's: what it gives up here
  // the board takes, and on a phone those points are the difference between a
  // board that reaches both edges and one with a strip of night either side.
  const WALL_GAP = theme.spacing.xs;
  const nearPadding = {
    paddingTop: WALL_GAP,
    paddingBottom: insets.bottom + WALL_GAP,
  };
  // The wall's least height: the coach's words, then the buttons. The board
  // keeps this free under its reserved room, and waits for the words' fixed
  // height before it is drawn, so it never resizes.
  const nearMin =
    nearPadding.paddingTop +
    coachHeight +
    WALL_GAP +
    actionsHeight +
    nearPadding.paddingBottom;
  // The wall runs from under the board's room to the bottom edge, the knight
  // and his words at its top and the stone buttons at its foot.
  const wallTop =
    board && boardBottom !== undefined
      ? bodyY + boardBottom + reserve
      : undefined;
  const knight = wallViewKnight(view, columnWidth);
  // Without a board the fallback shows the coach; the wall keeps the knight
  // and the buttons.
  const near = (
    <WatchSurfaces>
      <View
        style={[
          styles.near,
          nearPadding,
          // Over the board's room, never in its flow, so the room's height
          // is the same before and after the wall finds its place.
          board && [styles.nearOver, { top: wallTop ?? 0 }],
          board && wallTop === undefined && styles.hidden,
        ]}
        onLayout={(event) => setNearHeight(event.nativeEvent.layout.height)}
      >
        {nearHeight > 0 && (
          <WallViewNear view={view} height={nearHeight} column={column} />
        )}
        <View style={[styles.column, styles.nearColumn]}>
          {board ? (
            <View
              style={[
                styles.coach,
                { paddingLeft: knight.inset + theme.spacing.sm },
              ]}
              onLayout={(event) =>
                setCoachHeight(event.nativeEvent.layout.height)
              }
            >
              {coach}
            </View>
          ) : (
            <View style={{ height: knight.bottom - nearPadding.paddingTop }} />
          )}
          <View style={[styles.actions, { height: actionsHeight }]}>
            {actions}
          </View>
        </View>
      </View>
    </WatchSurfaces>
  );
  return (
    <PointsFlightProvider>
      <View
        style={[styles.frame, { backgroundColor: view.ground }]}
        onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
      >
        <View
          style={[styles.far, { paddingTop: insets.top }]}
          onLayout={(event) => setFarHeight(event.nativeEvent.layout.height)}
        >
          {farHeight > 0 && (
            <WallViewFar
              view={view}
              height={farHeight}
              raiders={
                raid && board && boardSize > 0
                  ? (height) => (
                      <WallViewRaiders
                        raid={raid}
                        height={height}
                        // The board sits centred under the band.
                        board={{
                          left: (frameWidth - boardSize) / 2,
                          width: boardSize,
                        }}
                      />
                    )
                  : undefined
              }
            />
          )}
          {bars}
          {/* Sky for the treeline and its raiders, as in the design, where
              the phone is tall enough to spare it without shrinking the board. */}
          <View style={styles.artRoom(artRoom)} />
          <View style={[styles.plaqueSlot, { height: plaqueRoom }]}>
            {plaque && (
              <View
                style={[
                  styles.plaque,
                  plaqueSurface && surfaceStyle(plaqueSurface),
                ]}
              >
                {plaque}
              </View>
            )}
            {raid?.captain && board ? (
              <CaptainPlaque
                captain={raid.captain}
                style={plaqueSurface && surfaceStyle(plaqueSurface)}
              />
            ) : (
              raid?.named &&
              board && (
                <View
                  style={[
                    styles.plaque,
                    styles.captain,
                    plaqueSurface && surfaceStyle(plaqueSurface),
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.captainName,
                      plaqueSurface?.ink
                        ? { color: plaqueSurface.ink }
                        : undefined,
                    ]}
                  >
                    {raid.named}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>
        {!board && fallback ? (
          // The watch's own surfaces, so words with no board under them are
          // the wall's parchment and the knight stays the scene's.
          <WatchSurfaces>
            <View style={styles.fill}>{fallback}</View>
          </WatchSurfaces>
        ) : (
          <View
            style={[styles.body, styles.column, styles.bodyOverSky]}
            onLayout={(event) => setBodyY(event.nativeEvent.layout.y)}
          >
            <FittedBoard
              board={board && coachHeight > 0 ? board : undefined}
              reserve={reserve + nearMin}
              onBottom={setBoardBottom}
              overlay={(size) => (
                <>
                  <PointsFlight
                    award={award}
                    orientation={orientation}
                    size={size}
                  />
                  <ReportSize size={size} onSize={setBoardSize} />
                </>
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
        {near}
        {shown && (
          <Animated.View
            exiting={fadeSheet ? sheetOut : undefined}
            style={[
              motion.sheet,
              filled && motion.sheetFill,
              filled && { top: bodyY + (boardBottom ?? 0) },
            ]}
          >
            <SheetRise style={filled && motion.riseFill}>{shown}</SheetRise>
          </Animated.View>
        )}
      </View>
    </PointsFlightProvider>
  );
}

/** Tells the frame the board's size, for the raiders over its files. */
function ReportSize({
  size,
  onSize,
}: {
  size: number;
  onSize: (size: number) => void;
}) {
  useEffect(() => onSize(size), [size, onSize]);
  return null;
}

type PlaqueSurface = NonNullable<ReturnType<typeof useWatchSurface>>;
const surfaceStyle = (surface: PlaqueSurface) => ({
  backgroundColor: surface.fill,
  borderColor: surface.edge,
  boxShadow: `0 3px 0 ${surface.ledge}`,
});

/** The raid captain's plaque at the treeline: its crown, whose piece it is
 * and its health, one segment per move of the line. */
function CaptainPlaque({
  captain,
  style,
}: {
  captain: NonNullable<Raid['captain']>;
  style?: ReturnType<typeof surfaceStyle>;
}) {
  const styles = useStyles();
  const crown = useSprite('character.raider.captain');
  const ink = useWatchSurface('ui.plaque')?.ink;
  return (
    <View
      accessible
      accessibilityLabel={`Raid captain, ${captain.name}: ${captain.cracked} of ${captain.segments} ${captain.segments === 1 ? 'hit' : 'hits'} landed`}
      style={[styles.plaque, styles.captain, style]}
    >
      <SpriteView sprite={crown} size={10} />
      <Text
        numberOfLines={1}
        style={[styles.captainName, ink ? { color: ink } : undefined]}
      >
        {captain.name}
      </Text>
      <CaptainHealth segments={captain.segments} cracked={captain.cracked} />
    </View>
  );
}

// System reduced motion drops the fade.
const sheetOut = FadeOut.duration(tokens.motion.move);
// Theme-independent styles for the animated verdict sheet.
const motion = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 4 },
  sheetFill: { justifyContent: 'flex-end' },
  riseFill: { flexGrow: 1, flexShrink: 0, justifyContent: 'flex-end' },
});

const useStyles = createStyles((theme) => ({
  frame: { flex: 1 },
  fill: { flex: 1 },
  far: { zIndex: 1 },
  // Over the far band, so a shard flying from its square to the counter
  // crosses the sky instead of disappearing behind it; the wall and the
  // verdict sheet stay over the board's room in turn.
  bodyOverSky: { zIndex: 2 },
  artRoom: (height: number) => ({ height }),
  plaqueSlot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  plaque: {
    borderWidth: 2,
    borderRadius: theme.radius.inset,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 2,
  },
  captain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 1,
    marginLeft: 'auto',
  },
  captainName: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
  },
  column: {
    width: '100%',
    maxWidth: COLUMN,
    alignSelf: 'center',
  },
  // The board starts at the treeline; phones get it edge to edge.
  body: { flex: 1, paddingHorizontal: theme.spacing.md },
  below: { gap: theme.spacing.sm },
  hidden: { opacity: 0 },
  near: { overflow: 'hidden', zIndex: 3 },
  nearOver: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  nearColumn: { flexGrow: 1 },
  coach: { paddingRight: theme.spacing.md },
  actions: {
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginTop: 'auto',
  },
}));
