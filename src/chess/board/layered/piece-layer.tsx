import {
  Atlas,
  Canvas,
  useColorBuffer,
  useRectBuffer,
  useRSXformBuffer,
} from '@shopify/react-native-skia';
import type { Color, Square } from 'chess.js';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { tokens } from '../../../theme/tokens';
import { indexOf, squareOrigin } from '../../coordinates';
import { coveredSquares, type FastBoard } from '../fast-board';
import { BOARD_OVERHANG, grabCenter, PIECE_FILL } from '../geometry';
import {
  type LandingCurve,
  landingDuration,
  landingScaleAt,
  pressLanding,
} from '../motion-settings';
import type { PieceSet } from '../piece-svg';
import type { VisualPiece } from '../transition';
import { type Bezier, cubic } from './easing';
import { type LayerRun, restartsTravel } from './layer-run';
import { atlasCell, pieceAtlas } from './piece-atlas';

/** 32 pieces plus room for pieces in flight (a capture, a promotion). */
const SLOTS = 34;
/** One more sprite, drawn last: the dragged piece, above every other. */
const SPRITES = SLOTS + 1;
type Travel = (
  from: Square,
  to: Square,
) => { duration: number; bezier: Bezier };
/** A drag the gesture drives on the UI thread: the board index (0–63, in
 * display order) of the dragged piece, or -1, and the finger in board points. */
type PieceDrag = Readonly<{
  index: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
}>;
type Slot = Readonly<{
  square: string;
  /** Display index (0–63) where it rests. */
  index: number;
  kind: 'static' | 'moving' | 'fading' | 'appearing';
  /** Atlas cells (texture pixels): the piece, and while travelling the kind it
   * travels as (a promoting pawn). */
  sx: number;
  sy: number;
  tsx: number;
  tsy: number;
  /** Board points: where it comes from and where it rests. */
  fx: number;
  fy: number;
  x: number;
  y: number;
  duration: number;
  /** Appearing only: ms before it starts, and how far (points) it drops. */
  delay: number;
  drop: number;
  lifted: boolean;
}>;

/**
 * Every piece on the board in one Skia draw (the layered renderer;
 * docs/specs/2026-10-15-layered-board-design.md). JavaScript writes the slot
 * table once per position or transition; one clock then drives every moving
 * piece, capture fade and landing on the UI thread, with no React work per
 * frame. Pieces under the fast board's tapped-move slide stay hidden.
 */
export function PieceLayer({
  pieces,
  orientation,
  width,
  set,
  selected,
  fast,
  travel,
  lift,
  finish,
  drag,
  landing,
}: {
  pieces: readonly VisualPiece[];
  orientation: Color;
  width: number;
  set: PieceSet;
  selected?: string;
  fast?: FastBoard;
  /** The motion preference: duration and curve for a move. */
  travel: Travel;
  /** How much a selected piece grows. */
  lift: number;
  /** Reports a moving piece's arrival, for the board's completion events. */
  finish: (id: string) => void;
  /** Hides the dragged piece in place and draws it under the finger. */
  drag?: PieceDrag;
  /** How a moved piece lands (Presentation.landing). */
  landing?: LandingCurve;
}) {
  const square = width / 8;
  // Room outside the board, so a piece carried or lifted at an edge is drawn
  // whole instead of cut off at the canvas's border.
  const over = square * BOARD_OVERHANG;
  const bounce = landing ?? pressLanding;
  const atlas = useMemo(() => pieceAtlas(set, square), [set, square]);
  const slots = useSharedValue<Slot[]>([]);
  const curve = useSharedValue<Bezier>([0, 0, 1, 1]);
  // Milliseconds since the transition started, and since its pieces landed.
  const elapsed = useSharedValue(Number.POSITIVE_INFINITY);
  const landed = useSharedValue(Number.POSITIVE_INFINITY);
  const previous = useRef<readonly VisualPiece[]>([]);
  const lastRun = useRef<LayerRun | undefined>(undefined);
  const latest = useRef({ travel, finish });
  useLayoutEffect(() => {
    latest.current = { travel, finish };
  });
  useLayoutEffect(() => {
    if (!atlas) return;
    const run: LayerRun = { pieces, orientation, square, atlas };
    if (!restartsTravel(lastRun.current, run)) {
      // Only the selection changed: lift or drop the tapped piece and leave
      // the clock alone, so the last move does not travel or land again.
      slots.set(
        slots
          .get()
          .map((slot) => ({ ...slot, lifted: slot.square === selected })),
      );
      return;
    }
    lastRun.current = run;
    const at = (sq: string) => {
      return {
        index: indexOf(sq as Square, orientation),
        ...squareOrigin(sq as Square, orientation, square),
      };
    };
    const slot = (
      piece: VisualPiece,
      kind: Slot['kind'],
      duration = 0,
    ): Slot => {
      const cell = atlasCell(atlas, piece.color, piece.kind);
      const travelling = atlasCell(
        atlas,
        piece.color,
        piece.travelingKind ?? piece.kind,
      );
      const rest = at(piece.square);
      const from = kind === 'moving' && piece.from ? at(piece.from) : rest;
      return {
        square: piece.square,
        index: rest.index,
        kind,
        sx: cell.x,
        sy: cell.y,
        tsx: travelling.x,
        tsy: travelling.y,
        fx: from.x,
        fy: from.y,
        x: rest.x,
        y: rest.y,
        duration,
        // Entering pieces drop row by row from the top of the board.
        delay:
          kind === 'appearing' && piece.enter
            ? Math.round(rest.y / square) * tokens.motion.enterStagger
            : 0,
        drop:
          kind === 'appearing' && piece.enter
            ? square * tokens.motion.enterDrop
            : 0,
        lifted: piece.square === selected,
      };
    };
    const moving = pieces.filter((piece) => piece.from);
    const ids = new Set(pieces.map((piece) => piece.id));
    // Pieces a morph brings with no nearby counterpart fade in where they stand.
    const fadeIn = pieces.some((piece) => piece.appear && !piece.from)
      ? Math.max(0, latest.current.travel('a1', 'a3').duration)
      : 0;
    // An empty board filling: each piece drops in after its row's turn
    // (none when motion is reduced, as the fade then has no duration).
    const entering = pieces.some((piece) => piece.enter) && fadeIn > 0;
    const enterTotal = entering
      ? tokens.motion.enter + 7 * tokens.motion.enterStagger
      : 0;
    // Captured pieces fade where they stood, only when something moves.
    const fading =
      moving.length || fadeIn
        ? previous.current.filter((piece) => !ids.has(piece.id))
        : [];
    const durations = moving.map((piece) =>
      Math.max(
        0,
        latest.current.travel(piece.from as Square, piece.square as Square)
          .duration,
      ),
    );
    const total = Math.max(0, fadeIn, enterTotal, ...durations);
    slots.set(
      [
        ...fading.map((piece) => slot(piece, 'fading', total)),
        ...pieces
          .filter((piece) => !piece.from)
          .map((piece) =>
            piece.appear
              ? slot(
                  piece,
                  'appearing',
                  piece.enter && entering ? tokens.motion.enter : fadeIn,
                )
              : slot(piece, 'static'),
          ),
        ...moving.map((piece, i) => slot(piece, 'moving', durations[i] ?? 0)),
      ].slice(0, SLOTS),
    );
    previous.current = pieces;
    cancelAnimation(elapsed);
    cancelAnimation(landed);
    landed.set(Number.POSITIVE_INFINITY);
    if (total <= 0) {
      elapsed.set(Number.POSITIVE_INFINITY);
      for (const piece of moving) latest.current.finish(piece.id);
      return;
    }
    const first = moving[0];
    if (first?.from)
      curve.set(
        latest.current.travel(first.from as Square, first.square as Square)
          .bezier,
      );
    const arrived = moving.map((piece) => piece.id);
    const report = () => {
      for (const id of arrived) latest.current.finish(id);
    };
    const settle = landingDuration(bounce);
    elapsed.set(0);
    elapsed.set(
      withTiming(total, { duration: total, easing: Easing.linear }, (done) => {
        if (!done) return;
        scheduleOnRN(report);
        landed.set(0);
        landed.set(
          withTiming(settle, { duration: settle, easing: Easing.linear }),
        );
      }),
    );
  }, [
    atlas,
    pieces,
    orientation,
    square,
    selected,
    slots,
    elapsed,
    landed,
    curve,
    bounce,
  ]);

  const cell = atlas?.cell ?? 0;
  const travelShown = fast?.travel;
  const dragIndex = drag?.index;
  const dragX = drag?.x;
  const dragY = drag?.y;
  // The resting slot under the drag, if any (the last sprite draws it).
  const dragged = (): Slot | undefined => {
    'worklet';
    const index = dragIndex ? dragIndex.get() : -1;
    if (index < 0) return undefined;
    return slots
      .get()
      .find((slot) => slot.kind !== 'fading' && slot.index === index);
  };
  const sprites = useRectBuffer(SPRITES, (rect, i) => {
    'worklet';
    const slot = i === SLOTS ? dragged() : slots.get()[i];
    if (!slot) {
      rect.setXYWH(0, 0, 0, 0);
      return;
    }
    const travelling = slot.kind === 'moving' && elapsed.get() < slot.duration;
    rect.setXYWH(
      travelling ? slot.tsx : slot.sx,
      travelling ? slot.tsy : slot.sy,
      cell,
      cell,
    );
  });
  const transforms = useRSXformBuffer(SPRITES, (xform, i) => {
    'worklet';
    if (i === SLOTS) {
      const slot = dragged();
      if (!slot || !cell || !dragX || !dragY) {
        xform.set(0, 0, 0, 0);
        return;
      }
      // Grown, tilted and raised clear of the fingertip, as Chess.com
      // carries a piece: the RSXform turns about the sprite's centre.
      const drawn = square * PIECE_FILL * tokens.motion.grabScale;
      const scale = drawn / cell;
      const turn = (tokens.motion.grabTilt * Math.PI) / 180;
      const scos = scale * Math.cos(turn);
      const ssin = scale * Math.sin(turn);
      const centre = grabCenter(square, dragX.get(), dragY.get());
      xform.set(
        scos,
        ssin,
        over + centre.x - ((scos - ssin) * cell) / 2,
        over + centre.y - ((ssin + scos) * cell) / 2,
      );
      return;
    }
    const slot = slots.get()[i];
    if (
      !slot ||
      !cell ||
      (dragIndex && slot.kind !== 'fading' && slot.index === dragIndex.get()) ||
      (slot.kind !== 'fading' &&
        travelShown &&
        coveredSquares(travelShown.get()).includes(slot.square))
    ) {
      xform.set(0, 0, 0, 0);
      return;
    }
    let x = slot.x;
    let y = slot.y;
    let scale = slot.lifted ? lift : 1;
    if (slot.kind === 'moving') {
      const linear =
        slot.duration > 0 ? Math.min(1, elapsed.get() / slot.duration) : 1;
      const p = linear >= 1 ? 1 : cubic(linear, curve.get());
      x = slot.fx + (slot.x - slot.fx) * p;
      y = slot.fy + (slot.y - slot.fy) * p;
      // The landing bounce: a press after arriving, then back.
      if (!slot.lifted) scale *= landingScaleAt(landed.get(), bounce);
    } else if (slot.kind === 'appearing' && slot.drop > 0) {
      const t =
        slot.duration > 0
          ? Math.min(
              1,
              Math.max(0, (elapsed.get() - slot.delay) / slot.duration),
            )
          : 1;
      // Ease-out cubic: falls fast, settles softly on its square.
      y -= slot.drop * (1 - t) ** 3;
    }
    const drawn = square * PIECE_FILL * scale;
    const offset = (square - drawn) / 2;
    xform.set(drawn / cell, 0, over + x + offset, over + y + offset);
  });
  const colors = useColorBuffer(SPRITES, (color, i) => {
    'worklet';
    const slot = i === SLOTS ? undefined : slots.get()[i];
    let alpha = 1;
    if (slot?.kind === 'fading') {
      const t =
        slot.duration > 0 ? Math.min(1, elapsed.get() / slot.duration) : 1;
      // Ease-in quad, as Lichess fades captures.
      alpha = 1 - t * t;
    } else if (slot?.kind === 'appearing') {
      const t =
        slot.duration > 0
          ? Math.min(
              1,
              Math.max(0, (elapsed.get() - slot.delay) / slot.duration),
            )
          : 1;
      alpha = 1 - (1 - t) * (1 - t);
    }
    color[0] = 1;
    color[1] = 1;
    color[2] = 1;
    color[3] = alpha;
  });
  if (!atlas) return null;
  return (
    <Canvas
      style={{
        position: 'absolute',
        top: -over,
        left: -over,
        right: -over,
        bottom: -over,
      }}
      pointerEvents="none"
    >
      <Atlas
        image={atlas.image}
        sprites={sprites}
        transforms={transforms}
        colors={colors}
        colorBlendMode="modulate"
      />
    </Canvas>
  );
}

export const layeredSupported = true;
