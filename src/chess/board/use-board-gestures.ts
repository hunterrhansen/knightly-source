import type { Color, Square } from 'chess.js';
import type { RefObject } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, type View } from 'react-native';
import {
  Gesture,
  MouseButton,
  PointerType,
} from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { tokens } from '../../theme/tokens';
import { squareFromPoint } from '../coordinates';
import type { DrawingShortcut } from './drawing-colors';
import { type FastBoard, predictTap } from './fast-board';
import { DRAG_THRESHOLD, grabCenter } from './geometry';
import type { resolvePresentation } from './transition';
import type { useBoardAnnotations } from './use-board-annotations';
import type { useBoardInput } from './use-board-input';
import type { useDrawingShortcut } from './use-drawing-shortcut';
import { useMouseBoardInput } from './use-mouse-board-input';

/**
 * The board's pointer input: touch drag and tap, right-button drawing and
 * mouse drag, measured against the board's layout. Gesture callbacks run on
 * the UI thread and hand squares to the input state machine on JavaScript; an
 * epoch drops callbacks from before a position, orientation or layout change.
 */
export function useBoardGestures({
  positionId,
  orientation,
  parsed,
  input,
  annotations,
  annotationsEnabled,
  fast,
  fastOn,
  handledSequence,
  fastTraveled,
  drawingShortcut,
  boardRef,
}: {
  positionId: string;
  orientation: Color;
  parsed: ReturnType<typeof resolvePresentation>;
  input: ReturnType<typeof useBoardInput>;
  annotations: ReturnType<typeof useBoardAnnotations>;
  annotationsEnabled: boolean | undefined;
  fast: FastBoard;
  fastOn: boolean;
  /** The last display-thread tap sequence JavaScript has handled. */
  handledSequence: RefObject<number>;
  /** A tapped move the display thread is sliding, if any. */
  fastTraveled: RefObject<{ from: string; to: string } | undefined>;
  drawingShortcut: ReturnType<typeof useDrawingShortcut>;
  boardRef: RefObject<View | null>;
}) {
  const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const { width } = layout;
  const epoch = useSharedValue(0);
  const dragEpoch = useSharedValue(0);
  const tapEpoch = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const panActive = useSharedValue(false);
  const mouseActive = useSharedValue(false);
  // The layered board's drag, on the UI thread: the display index of the
  // dragged piece (-1 for none) and the indexes a drag may start from.
  const dragIndex = useSharedValue(-1);
  const dragOrigins = useSharedValue<number[]>([]);
  const mouseEpoch = useRef(0);
  const dragContext = useRef({ positionId: positionId, orientation, layout });
  useLayoutEffect(() => {
    const previous = dragContext.current;
    if (
      previous.positionId === positionId &&
      previous.orientation === orientation &&
      previous.layout === layout
    )
      return;
    dragContext.current = { positionId: positionId, orientation, layout };
    epoch.set(epoch.get() + 1);
    panActive.set(false);
    dragIndex.set(-1);
    annotations.cancel();
    // Layout changes cancel an active drag; awaiting/promotion remain discrete.
    if (input.state.phase === 'dragging') input.cancel();
  }, [
    positionId,
    orientation,
    layout,
    epoch,
    panActive,
    dragIndex,
    input.state.phase,
    input.cancel,
    annotations.cancel,
  ]);
  useLayoutEffect(
    () => () => {
      epoch.set(epoch.get() + 1);
      panActive.set(false);
    },
    [epoch, panActive],
  );
  const startDrag = (x: number, y: number, token: number) => {
    if (token !== epoch.get()) return;
    const square = squareFromPoint(x, y, width, orientation);
    if (square) {
      annotations.clear();
      input.beginDrag(square);
    }
  };
  const endDrag = (x: number, y: number, token: number) => {
    // A drag the input refused leaves no state change to clear the piece.
    if (input.state.phase !== 'dragging') dragIndex.set(-1);
    if (token === epoch.get())
      input.finishDrag(squareFromPoint(x, y, width, orientation));
  };
  const cancelDrag = (token: number) => {
    dragIndex.set(-1);
    if (token === epoch.get()) input.cancelDrag();
  };
  const tapSquare = (x: number, y: number, token: number, sequence: number) => {
    if (fastOn) {
      const travel = fast.travel.get();
      fastTraveled.current =
        travel && !travel.acked
          ? { from: travel.from, to: travel.to }
          : undefined;
    }
    handledSequence.current = sequence;
    if (token !== epoch.get()) return;
    const square = squareFromPoint(x, y, width, orientation);
    if (square) {
      annotations.clear();
      input.activate(square, 'activation');
    }
  };
  const pan = Gesture.Pan()
    .withTestId(`board-pan-${positionId}`)
    .enabled(parsed.ok && parsed.submissionEnabled && width > 0)
    .minDistance(DRAG_THRESHOLD)
    .maxPointers(1)
    .onBegin((event) => {
      startX.set(event.x);
      startY.set(event.y);
      dragEpoch.set(epoch.get());
    })
    .onStart((event) => {
      panActive.set(true);
      dragX.set(event.x);
      dragY.set(event.y);
      // The layered board lifts the piece now, before JavaScript confirms.
      const cell = width / 8;
      const column = Math.floor(startX.get() / cell);
      const row = Math.floor(startY.get() / cell);
      const index = row * 8 + column;
      if (
        column >= 0 &&
        column < 8 &&
        row >= 0 &&
        row < 8 &&
        dragOrigins.get().includes(index)
      )
        dragIndex.set(index);
      scheduleOnRN(startDrag, startX.get(), startY.get(), dragEpoch.get());
    })
    .onUpdate((event) => {
      dragX.set(event.x);
      dragY.set(event.y);
    })
    .onEnd((event, success) => {
      if (success) scheduleOnRN(endDrag, event.x, event.y, dragEpoch.get());
      if (success) panActive.set(false);
    })
    .onFinalize((_event, success) => {
      if (!success && panActive.get()) {
        dragIndex.set(-1);
        scheduleOnRN(cancelDrag, dragEpoch.get());
      }
      panActive.set(false);
    });
  const tap = Gesture.Tap()
    .withTestId(`board-tap-${positionId}`)
    .maxDistance(DRAG_THRESHOLD)
    .enabled(parsed.ok && width > 0)
    .onBegin(() => {
      tapEpoch.set(epoch.get());
    })
    .onEnd((event, success) => {
      // Web RNGH also synthesizes taps from Enter/Space; the grid owns keys.
      if (success && event.pointerType !== PointerType.KEY) {
        const sequence = fastOn
          ? predictTap(
              fast,
              squareFromPoint(event.x, event.y, width, orientation) ?? '',
            )
          : 0;
        scheduleOnRN(tapSquare, event.x, event.y, tapEpoch.get(), sequence);
      }
    });
  const drawingEpoch = useSharedValue(0);
  const drawingX = useSharedValue(0);
  const drawingY = useSharedValue(0);
  // The square the arrow last reached, so the JS side hears only of changes.
  const drawingSquare = useSharedValue<Square | null>(null);
  const beginDrawing = (
    x: number,
    y: number,
    token: number,
    shortcut: DrawingShortcut,
  ) => {
    if (token !== epoch.get()) return;
    const square = squareFromPoint(x, y, width, orientation);
    if (square && input.prepareDrawing()) {
      annotations.begin(square, shortcut);
    }
  };
  const updateDrawing = (square: Square | null, token: number) => {
    if (token === epoch.get()) annotations.update(square);
  };
  const finishDrawing = (x: number, y: number, token: number) => {
    if (token === epoch.get())
      annotations.finish(squareFromPoint(x, y, width, orientation));
  };
  const cancelDrawing = (token: number) => {
    if (token === epoch.get()) annotations.cancel();
  };
  const drawingEnabled =
    annotationsEnabled !== false &&
    parsed.ok &&
    !input.consumerError &&
    input.state.phase !== 'promotion' &&
    width > 0;
  const draw = Gesture.Pan()
    .withTestId(`board-draw-${positionId}`)
    .enabled(drawingEnabled)
    .mouseButton(MouseButton.RIGHT)
    .activateAfterLongPress(Platform.OS === 'web' ? 0 : 350)
    .minDistance(Platform.OS === 'web' ? DRAG_THRESHOLD : 0)
    .maxPointers(1)
    .onBegin((event) => {
      drawingEpoch.set(epoch.get());
      drawingX.set(event.x);
      drawingY.set(event.y);
    })
    .onStart(() => {
      drawingSquare.set(
        squareFromPoint(drawingX.get(), drawingY.get(), width, orientation),
      );
      scheduleOnRN(
        beginDrawing,
        drawingX.get(),
        drawingY.get(),
        drawingEpoch.get(),
        drawingShortcut.get(),
      );
    })
    .onUpdate((event) => {
      const square = squareFromPoint(event.x, event.y, width, orientation);
      if (square === drawingSquare.get()) return;
      drawingSquare.set(square);
      scheduleOnRN(updateDrawing, square, drawingEpoch.get());
    })
    .onEnd((event, success) => {
      if (success)
        scheduleOnRN(finishDrawing, event.x, event.y, drawingEpoch.get());
    })
    .onFinalize((_event, success) => {
      if (!success) scheduleOnRN(cancelDrawing, drawingEpoch.get());
    });
  const drawTap = Gesture.Tap()
    .withTestId(`board-mark-${positionId}`)
    .enabled(drawingEnabled && Platform.OS === 'web')
    .mouseButton(MouseButton.RIGHT)
    .maxDistance(DRAG_THRESHOLD)
    .onBegin(() => {
      drawingEpoch.set(epoch.get());
    })
    .onEnd((event, success) => {
      if (success && event.pointerType !== PointerType.KEY) {
        scheduleOnRN(
          beginDrawing,
          event.x,
          event.y,
          drawingEpoch.get(),
          drawingShortcut.get(),
        );
        scheduleOnRN(finishDrawing, event.x, event.y, drawingEpoch.get());
      }
    });
  // A finger carries the piece grown and raised clear of the fingertip, as
  // Chess.com does; a mouse keeps it life-size under the cursor.
  const dragStyle = useAnimatedStyle(() => {
    const cell = width / 8;
    const carried = grabCenter(cell, dragX.get(), dragY.get());
    const centre = mouseActive.get()
      ? { x: dragX.get(), y: dragY.get() }
      : carried;
    return {
      opacity: panActive.get() ? 1 : 0,
      width: cell,
      height: cell,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [
        { translateX: centre.x - cell / 2 },
        { translateY: centre.y - cell / 2 },
        { scale: mouseActive.get() ? 1 : tokens.motion.grabScale },
        { rotate: mouseActive.get() ? '0deg' : `${tokens.motion.grabTilt}deg` },
      ],
    };
  }, [panActive, mouseActive, dragX, dragY, width]);
  // The disc under a carried piece: flat, square-snapped, finger drags only.
  const haloStyle = useAnimatedStyle(() => {
    const cell = width / 8;
    const size = cell * 2 * tokens.motion.grabHaloRadius;
    const inside =
      cell > 0 &&
      dragX.get() >= 0 &&
      dragY.get() >= 0 &&
      dragX.get() < width &&
      dragY.get() < width;
    return {
      opacity: panActive.get() && inside && !mouseActive.get() ? 1 : 0,
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [
        {
          translateX: inside
            ? (Math.floor(dragX.get() / cell) + 0.5) * cell - size / 2
            : 0,
        },
        {
          translateY: inside
            ? (Math.floor(dragY.get() / cell) + 0.5) * cell - size / 2
            : 0,
        },
      ],
    };
  }, [panActive, mouseActive, dragX, dragY, width]);
  // Derived on the UI thread so dragging never re-renders per frame.
  const hoverStyle = useAnimatedStyle(() => {
    const cell = width / 8;
    const inside =
      cell > 0 &&
      dragX.get() >= 0 &&
      dragY.get() >= 0 &&
      dragX.get() < width &&
      dragY.get() < width;
    return {
      opacity: panActive.get() && inside ? 1 : 0,
      width: cell,
      height: cell,
      borderWidth: Math.max(2, cell * 0.05),
      transform: [
        { translateX: inside ? Math.floor(dragX.get() / cell) * cell : 0 },
        { translateY: inside ? Math.floor(dragY.get() / cell) * cell : 0 },
      ],
    };
  }, [panActive, dragX, dragY, width]);
  useMouseBoardInput({
    board: boardRef,
    enabled:
      parsed.ok &&
      parsed.submissionEnabled &&
      input.state.phase !== 'promotion' &&
      !input.consumerError &&
      width > 0,
    context: `${positionId}:${orientation}:${layout.x}:${layout.y}:${width}`,
    callbacks: {
      down: (x, y) => {
        mouseEpoch.current = epoch.get();
        annotations.clear();
        const square = squareFromPoint(x, y, width, orientation);
        mouseActive.set(true);
        dragX.set(x);
        dragY.set(y);
        panActive.set(!!square && input.beginMouseDrag(square));
      },
      // Every piece shows the hand, as on Chess.com, movable or not.
      grabbable: (x, y) => {
        const square = squareFromPoint(x, y, width, orientation);
        return (
          parsed.ok && parsed.parsed.pieces.some((p) => p.square === square)
        );
      },
      move: (x, y) => {
        if (mouseEpoch.current !== epoch.get()) return;
        dragX.set(x);
        dragY.set(y);
      },
      up: (x, y, click) => {
        panActive.set(false);
        mouseActive.set(false);
        if (mouseEpoch.current === epoch.get())
          input.finishMouseDrag(
            squareFromPoint(x, y, width, orientation),
            click,
          );
      },
      cancel: () => {
        panActive.set(false);
        mouseActive.set(false);
        if (mouseEpoch.current === epoch.get()) input.cancelMouseDrag();
      },
    },
  });
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const next = nativeEvent.layout;
    setLayout((previous) =>
      previous.x === next.x &&
      previous.y === next.y &&
      previous.width === next.width &&
      previous.height === next.height
        ? previous
        : { ...next, width: Math.max(0, next.width) },
    );
  };
  return {
    width,
    onLayout,
    gesture: Gesture.Exclusive(draw, drawTap, pan, tap),
    dragStyle,
    haloStyle,
    hoverStyle,
    dragIndex,
    dragOrigins,
    dragX,
    dragY,
  };
}
