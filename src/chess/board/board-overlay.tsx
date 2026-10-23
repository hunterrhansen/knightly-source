import {
  Canvas,
  Group,
  ImageSVG,
  Path,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
import type { Color, PieceSymbol, Square } from 'chess.js';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { squareOrigin } from '../coordinates';
import type { BoardOverlayProps } from './board-overlay.types';
import type { FastBoard } from './fast-board';
import { PIECE_FILL } from './geometry';
import { type PieceSet, pieceSvg } from './piece-svg';

const kinds: readonly PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const colors: readonly Color[] = ['w', 'b'];

/** Top-left of `square` on a board of `size`, as seen from `orientation`. */
const corner = (square: string, size: number, orientation: Color) => {
  'worklet';
  return squareOrigin(square as Square, orientation, size / 8);
};
// The overlay draws its piece until the handover clears the slide.
const sliding = (fast: FastBoard) => {
  'worklet';
  return fast.travel.get();
};
const HANDOVER_MS = 80;

/**
 * Skia layer for the display thread's half of the board (see `FastBoard`):
 * selection, destination dots and sliding pieces, redrawn without React.
 * Drawn over the board's squares and pieces; it never takes touches.
 */
export function BoardOverlay({
  fast,
  size,
  orientation,
  set,
  selection,
  marker,
  markerAlpha,
}: BoardOverlayProps) {
  const step = size / 8;
  // Hand over once the slide is done and JavaScript shows the move, plus a few
  // frames: the board's own piece needs that long to appear on the destination
  // (handing over at once flashes it on its old square).
  const handover = useSharedValue(0);
  useAnimatedReaction(
    () => {
      const travel = fast.travel.get();
      return travel?.acked && fast.progress.get() >= 1 ? travel : null;
    },
    (done) => {
      if (!done) return;
      handover.set(0);
      handover.set(
        withDelay(
          HANDOVER_MS,
          withTiming(1, { duration: 0 }, (finished) => {
            const travel = fast.travel.get();
            if (
              finished &&
              travel?.from === done.from &&
              travel.to === done.to &&
              travel.acked
            )
              fast.travel.set(null);
          }),
        ),
      );
    },
  );
  const selectedX = useDerivedValue(() =>
    fast.selected.get()
      ? corner(fast.selected.get(), size, orientation).x
      : -size,
  );
  const selectedY = useDerivedValue(() =>
    fast.selected.get()
      ? corner(fast.selected.get(), size, orientation).y
      : -size,
  );
  const dots = useDerivedValue(() => {
    const path = Skia.Path.Make();
    for (const square of fast.dests.get()) {
      const { x, y } = corner(square, size, orientation);
      path.addCircle(x + step / 2, y + step / 2, step * 0.125);
    }
    return path;
  });
  const rings = useDerivedValue(() => {
    const path = Skia.Path.Make();
    for (const square of fast.captures.get()) {
      const { x, y } = corner(square, size, orientation);
      path.addCircle(x + step / 2, y + step / 2, step * 0.45 - 1.5);
    }
    return path;
  });
  return (
    <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      <Rect
        x={selectedX}
        y={selectedY}
        width={step}
        height={step}
        color={selection}
        opacity={0.55}
      />
      <Path path={dots} color={marker} opacity={markerAlpha.dot} />
      <Path
        path={rings}
        color={marker}
        opacity={markerAlpha.ring}
        style="stroke"
        strokeWidth={3}
      />
      {colors.flatMap((color) =>
        kinds.map((kind) => (
          <SlidingPiece
            key={`${color}${kind}`}
            code={`${color}${kind}`}
            kind={kind}
            color={color}
            set={set}
            fast={fast}
            size={size}
            orientation={orientation}
          />
        )),
      )}
    </Canvas>
  );
}

function SlidingPiece({
  code,
  kind,
  color,
  set,
  fast,
  size,
  orientation,
}: {
  code: string;
  kind: PieceSymbol;
  color: Color;
  set: PieceSet;
  fast: FastBoard;
  size: number;
  orientation: Color;
}) {
  const step = size / 8;
  const art = pieceSvg(kind, color, set);
  const svg = useMemo(() => Skia.SVG.MakeFromString(art), [art]);
  // The motion this art draws; castling's king and rook are separate motions.
  const motion = useDerivedValue(() => {
    const travel = sliding(fast);
    if (!travel) return null;
    for (const item of travel.motions) if (item.piece === code) return item;
    return null;
  });
  const shown = useDerivedValue(() => (motion.get() ? 1 : 0));
  const x = useDerivedValue(() => {
    const item = motion.get();
    if (!item) return -size;
    const from = corner(item.from, size, orientation);
    const to = corner(item.to, size, orientation);
    return from.x + (to.x - from.x) * Math.min(1, fast.progress.get());
  });
  const y = useDerivedValue(() => {
    const item = motion.get();
    if (!item) return -size;
    const from = corner(item.from, size, orientation);
    const to = corner(item.to, size, orientation);
    return from.y + (to.y - from.y) * Math.min(1, fast.progress.get());
  });
  // Matches `Piece` at 96% of a square, centred.
  const inset = step * 0.02;
  const art96 = step * PIECE_FILL;
  const left = useDerivedValue(() => x.get() + inset);
  const top = useDerivedValue(() => y.get() + inset);
  return (
    <Group opacity={shown}>
      {svg ? (
        <ImageSVG svg={svg} x={left} y={top} width={art96} height={art96} />
      ) : null}
    </Group>
  );
}

/** Whether this platform draws the fast overlay (web keeps the React board). */
export const fastOverlaySupported = true;
