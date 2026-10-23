import { useEffect, useState } from 'react';
import { PixelRatio, useWindowDimensions, View } from 'react-native';
import { type BoardProps, Chessboard } from '../../chess/board';
import { createStyles } from '../../theme/theme';

/** The largest size at or under `room` whose eighth is a whole pixel. */
function squareAligned(room: number) {
  const scale = PixelRatio.get();
  return Math.floor((room * scale) / 8) * (8 / scale);
}

/** The largest square board that fits the room left, at its top edge, so it
 * never moves and the screen never scrolls. Phones get it edge to edge. */
export function FittedBoard({
  board,
  beside,
  below,
  above,
  under,
  bandHeight = 0,
  reserve = 0,
  onBottom,
  overlay,
  maxSize = 560,
}: {
  board?: BoardProps;
  /** A bar drawn to the board's left at the board's height (All moves' eval). */
  beside?: React.ReactNode;
  /** Shown centred in the room left under the board (the move strip). */
  below?: React.ReactNode;
  /** Bands flush against the board's top and bottom edges, the board's
   * width and `bandHeight` tall (player rows with clocks). */
  above?: React.ReactNode;
  under?: React.ReactNode;
  bandHeight?: number;
  /** Height kept free under the board for `below`. */
  reserve?: number;
  /** Where the board's bottom edge sits in the parent, for a sheet below it. */
  onBottom?: (y: number) => void;
  /** Drawn over the board at its size (points flying off a square). */
  overlay?: (size: number) => React.ReactNode;
  /** The largest the board grows; the wide lesson lets it fill the height. */
  maxSize?: number;
}) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [room, setRoom] = useState<{
    width: number;
    height: number;
    y: number;
  }>();
  const phone = width < 600 && !beside;
  const gutter = beside ? 18 : 0;
  const across = phone ? width : Math.min(maxSize, (room?.width ?? 0) - gutter);
  const bands = (above ? bandHeight : 0) + (under ? bandHeight : 0);
  // Whole device pixels per square: 8 squares of an unequal size leave the
  // page showing through as hairlines between them (a 393pt board on a 3x
  // screen is 1179px, so three boundaries fall a pixel short).
  const size = room
    ? squareAligned(Math.min(across, room.height - reserve - bands))
    : 0;
  const bottom = room ? room.y + size + bands : undefined;
  useEffect(() => {
    if (bottom !== undefined) onBottom?.(bottom);
  }, [bottom, onBottom]);
  return (
    <View
      style={[styles.boardRoom, phone && styles.edgeToEdge]}
      onLayout={(e) =>
        setRoom({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
          y: e.nativeEvent.layout.y,
        })
      }
    >
      {board && size > 0 && (
        <View style={[styles.boardRow, { height: size + bands }]}>
          {beside && (
            // The bar spans the board only, not the bands.
            <View
              style={{
                paddingTop: above ? bandHeight : 0,
                paddingBottom: under ? bandHeight : 0,
              }}
            >
              {beside}
            </View>
          )}
          <View style={{ width: size }}>
            {above && <View style={{ height: bandHeight }}>{above}</View>}
            <View style={{ width: size, height: size }}>
              {/* Rounded corners, except edge to edge on a phone; the overlay
                  stays outside the clip so points can fly off the board. */}
              <View style={[styles.board, !phone && styles.rounded]}>
                <Chessboard {...board} />
              </View>
              {overlay?.(size)}
            </View>
            {under && <View style={{ height: bandHeight }}>{under}</View>}
          </View>
        </View>
      )}
      {below && size > 0 && <View style={styles.below}>{below}</View>}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  boardRoom: { flex: 1, alignItems: 'center', minHeight: 0 },
  // What's below hangs just under the board, as Chess.com's and Lichess's
  // puzzle info does, so it reads as the board's caption; spare room gathers
  // above the bottom bar instead of around it.
  below: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  // Phones: the board spans the screen edge to edge, outside the gutters
  // (the parent's horizontal padding is theme.spacing.md).
  edgeToEdge: {
    width: undefined,
    maxWidth: undefined,
    alignSelf: 'stretch',
    marginHorizontal: -theme.spacing.md,
  },
  boardRow: { flexDirection: 'row', gap: theme.spacing.xs + 2 },
  board: { flex: 1 },
  rounded: { borderRadius: 6, overflow: 'hidden' },
}));
