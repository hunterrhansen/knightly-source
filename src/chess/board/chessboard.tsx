import type { Square as ChessSquare } from 'chess.js';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { usePreferences } from '../../theme/preferences';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { indexOf, squareAt } from '../coordinates';
import type { ParsedPosition } from '../position';
import { squareDescription } from './announcements';
import type { BoardProps } from './board.types';
import { BoardAccessibility } from './board-accessibility';
import { BoardArrows, boardArrows } from './board-arrows';
import { BoardEffects } from './board-effects';
import { BoardErrorOverlay } from './board-error-overlay';
import { BoardOverlay, fastOverlaySupported } from './board-overlay';
import { boardStatus } from './board-status';
import { checkState } from './check-state';
import { useFastBoard } from './fast-board';
import { PIECE_FILL } from './geometry';
import { layeredSupported, PieceLayer } from './layered/piece-layer';
import { MotionPiece } from './motion-piece';
import { useBoardMotionSettings } from './motion-settings';
import { useEventSound, useMoveSounds } from './move-sounds';
import { OutsideFiles, OutsideRanks } from './outside-coordinates';
import { Piece } from './piece';
import { PromotionChooser } from './promotion-chooser';
import { Square } from './square';
import { resolvePresentation, type VisualPiece } from './transition';
import { useBoardAnnotations } from './use-board-annotations';
import { useBoardGestures } from './use-board-gestures';
import { useBoardInput } from './use-board-input';
import { useBoardMotion } from './use-board-motion';
import { useDrawingShortcut } from './use-drawing-shortcut';
import { useFastBoardSync } from './use-fast-board-sync';
import { useInstantMove } from './use-instant-move';

const noLabels: ReadonlyMap<ChessSquare, string> = new Map();

/**
 * Memoized: an owner's re-render that leaves the board's props unchanged (chat,
 * clocks, coaching) never redraws the board, as chessground keeps Lichess's
 * board apart from the page's redraws.
 */
export const Chessboard = memo(ChessboardView);
function ChessboardView(props: BoardProps): React.JSX.Element {
  const styles = useStyles();
  const {
    position,
    orientation,
    onRestorePosition,
    presentation,
    feedback,
    policy,
  } = props;
  const boardRef = useRef<View>(null);
  const drawingShortcut = useDrawingShortcut(boardRef);
  const {
    still: reducedMotion,
    moveDuration,
    travel,
    lift,
  } = useBoardMotionSettings();
  const {
    coordinates,
    sounds,
    legalMoves,
    lastMove,
    pieces: pieceSet,
  } = usePreferences().preferences;
  // Native draws every piece in one Skia atlas and animates them on the UI
  // thread (the layered renderer); web keeps one view per piece.
  const layered = layeredSupported;
  const { theme } = useTheme();
  // Display-thread selection, dots and travel on native, as Lichess's board
  // repaints them without rebuilding; JavaScript input stays in charge.
  const fastOn = fastOverlaySupported;
  const fast = useFastBoard();
  const handledSequence = useRef(0);
  const fastTraveled = useRef<{ from: string; to: string } | undefined>(
    undefined,
  );
  const input = useBoardInput(props, {
    // A move the display thread is sliding reaches the owner once it lands.
    deliverAfter: (attempt) =>
      fastTraveled.current?.from === attempt.from &&
      fastTraveled.current.to === attempt.to
        ? travel(attempt.from, attempt.to).duration
        : 0,
  });
  const [focusRequest, setFocusRequest] = useState<{
    square: ChessSquare;
    id: number;
  }>();
  const focusSequence = useRef(0);
  const focusSquare = (square: ChessSquare) =>
    setFocusRequest({ square, id: ++focusSequence.current });
  const cancelInput = () => {
    if ('origin' in input.state) focusSquare(input.state.origin);
    input.cancel();
  };
  const previousFocusContext = useRef({
    positionId: position.id,
    promotionOrigin: undefined as ChessSquare | undefined,
    requestId: focusRequest?.id,
  });
  useLayoutEffect(() => {
    const previous = previousFocusContext.current;
    if (
      previous.positionId !== position.id &&
      previous.promotionOrigin &&
      previous.requestId === focusRequest?.id
    )
      focusSquare(previous.promotionOrigin);
    previousFocusContext.current = {
      positionId: position.id,
      promotionOrigin:
        input.state.phase === 'promotion' ? input.state.origin : undefined,
      requestId: focusRequest?.id,
    };
  });
  const parsed = useMemo(
    () => resolvePresentation({ position, presentation, feedback, policy }),
    [position, presentation, feedback, policy],
  );
  const annotations = useBoardAnnotations(
    position.id,
    props.annotationsEnabled !== false &&
      parsed.ok &&
      input.state.phase !== 'promotion' &&
      !input.consumerError,
  );
  const arrows = boardArrows(presentation, annotations);
  const lastValid = useRef<ParsedPosition | undefined>(undefined);
  useEffect(() => {
    if (parsed.ok) lastValid.current = parsed.parsed;
  }, [parsed]);
  const {
    width,
    onLayout,
    gesture,
    dragStyle,
    haloStyle,
    hoverStyle,
    dragIndex,
    dragOrigins,
    dragX,
    dragY,
  } = useBoardGestures({
    positionId: position.id,
    orientation,
    parsed,
    input,
    annotations,
    annotationsEnabled: props.annotationsEnabled,
    fast,
    fastOn,
    handledSequence,
    fastTraveled,
    drawingShortcut,
    boardRef,
  });
  const activateSquare = (
    square: ChessSquare,
    source: Parameters<typeof input.activate>[1],
  ) => {
    annotations.clear();
    input.activate(square, source);
  };
  // Stable handlers for the memoized squares, reading the latest closures.
  const latestHandlers = useRef({ activateSquare, cancelInput });
  useLayoutEffect(() => {
    latestHandlers.current = { activateSquare, cancelInput };
  });
  const onSquareActivate = useCallback(
    (square: ChessSquare) =>
      latestHandlers.current.activateSquare(square, 'activation'),
    [],
  );
  const onSquareCancel = useCallback(
    () => latestHandlers.current.cancelInput(),
    [],
  );
  const instant = useInstantMove(
    parsed.ok ? input.submitted : undefined,
    position,
    fastTraveled,
  );
  const displayed = instant
    ? instant.parsed
    : parsed.ok
      ? parsed.parsed
      : lastValid.current;
  const shownTransition = instant?.transition ?? presentation.transition;
  const shownLastMove = instant?.lastMove ?? presentation.lastMove;
  const skipTravel = !!instant?.drag;
  const motion = useBoardMotion({
    pieces: displayed?.pieces ?? [],
    positionId: position.id,
    transition: parsed.ok ? shownTransition : undefined,
    orientation,
    width,
    reducedMotion,
    skipTravel,
    onComplete: props.onTransitionComplete,
  });
  const displayedFen = instant
    ? instant.fen
    : parsed.ok
      ? (presentation.preview?.fen ?? position.fen)
      : '';
  const check = useMemo(() => checkState(displayedFen), [displayedFen]);
  useMoveSounds(
    parsed.ok && shownTransition?.positionId === position.id
      ? shownTransition
      : undefined,
    displayedFen,
    sounds,
  );
  useEventSound(
    input.illegalAttempts ? String(input.illegalAttempts) : undefined,
    'illegal',
    sounds,
  );
  useEventSound(
    feedback?.outcome === 'rejected' && feedback.positionId === position.id
      ? feedback.attemptId
      : undefined,
    'incorrect',
    sounds,
  );
  useEventSound(presentation.correct?.id, 'correct', sounds);

  const pieces = new Map(
    displayed?.pieces.map((piece) => [piece.square, piece]),
  );
  const promotion = input.state.phase === 'promotion' ? input.state : undefined;
  const promotingPiece = promotion ? pieces.get(promotion.origin) : undefined;
  if (promotion && promotingPiece) {
    pieces.delete(promotion.origin);
    pieces.set(promotion.destination, {
      ...promotingPiece,
      square: promotion.destination,
    });
  }
  const origin = 'origin' in input.state ? input.state.origin : undefined;
  // The pieces the board draws itself: not the dragged one (the layered board
  // keeps it and hides it on the UI thread) or a promotion in progress (that
  // draws separately).
  const drawnElsewhere = (piece: VisualPiece) =>
    (!layered && input.state.phase === 'dragging' && piece.square === origin) ||
    (!!promotion &&
      (piece.square === promotion.origin ||
        piece.square === promotion.destination));
  // Web keeps those pieces mounted but invisible: unmounting would play the
  // fade a piece gets only when it really leaves the board.
  const shownPieces = layered
    ? motion.pieces.filter((piece) => !drawnElsewhere(piece))
    : motion.pieces;
  // Same pieces, same array, so the layered renderer's slots update only on change.
  const shownKey = shownPieces
    .map(
      (piece) =>
        `${piece.id}@${piece.square}${piece.kind}${piece.from ?? ''}${drawnElsewhere(piece) ? '!' : ''}`,
    )
    .join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by content
  const boardPieces = useMemo(() => shownPieces, [shownKey]);
  const draggingPiece =
    input.state.phase === 'dragging'
      ? layered
        ? undefined
        : pieces.get(input.state.origin)
      : undefined;
  // Squares a layered drag may lift at once: pieces in the atlas with a move.
  const dragOriginKey =
    layered &&
    policy.mode === 'movable' &&
    input.state.phase !== 'awaiting' &&
    input.state.phase !== 'promotion'
      ? [...new Set(input.eligibleMoves.map((move) => move.from))]
          .map((square) => indexOf(square, orientation))
          .join()
      : '';
  useLayoutEffect(() => {
    dragOrigins.set(dragOriginKey ? dragOriginKey.split(',').map(Number) : []);
  }, [dragOriginKey, dragOrigins]);
  // The lifted piece drops back into its slot when the drag ends: in the same
  // commit as the dropped move, so it never flashes at its origin.
  const dragging = input.state.phase === 'dragging';
  useLayoutEffect(() => {
    if (!dragging) dragIndex.set(-1);
  }, [dragging, dragIndex]);
  const layeredDrag = useMemo(
    () => ({ index: dragIndex, x: dragX, y: dragY }),
    [dragIndex, dragX, dragY],
  );
  const destinations = new Set(
    presentation.showDestinations &&
      legalMoves === 'on' &&
      origin &&
      policy.mode === 'movable'
      ? input.eligibleMoves
          .filter((move) => move.from === origin)
          .map((move) => move.to)
      : [],
  );
  const verdict = check?.mate
    ? `Checkmate. ${check.loser === 'w' ? 'Black' : 'White'} wins.`
    : check
      ? `${check.loser === 'w' ? 'White' : 'Black'} is in check.`
      : '';
  const label = parsed.ok
    ? `Chessboard.${presentation.lineMode ? ' Analysis line.' : ''} ${orientation === 'w' ? 'White' : 'Black'} at bottom. ${verdict || `${parsed.parsed.turn === 'w' ? 'White' : 'Black'} to move.`}`
    : 'Chessboard unavailable';
  const status = !parsed.ok
    ? { id: `${position.id}:invalid`, text: parsed.message, replaySafe: true }
    : boardStatus(
        props,
        input.state,
        input.message,
        displayed?.turn ?? 'w',
        input.revision,
      );
  const selected =
    input.state.phase === 'selected' ? input.state.origin : undefined;
  const blocked = !parsed.ok || input.consumerError || !!promotion;
  useFastBoardSync({
    fastOn,
    fast,
    handledSequence,
    travel,
    pieces,
    policy,
    movableInput:
      parsed.ok &&
      !input.consumerError &&
      (input.state.phase === 'idle' || input.state.phase === 'selected'),
    eligibleMoves: input.eligibleMoves,
    displayedFen,
    turn: displayed?.turn,
    selected,
    destinations,
    showDestinations: presentation.showDestinations && legalMoves === 'on',
  });
  // A grade gives way to an error highlight on the same square.
  const shownGrade =
    presentation.grade &&
    !presentation.highlights.some(
      (mark) =>
        mark.square === presentation.grade?.square && mark.tone === 'error',
    )
      ? presentation.grade
      : undefined;
  const describe = (square: ChessSquare) =>
    squareDescription(square, pieces.get(square), {
      grade: shownGrade?.square === square ? shownGrade.kind : undefined,
      hint: presentation.hint?.square === square,
      correct:
        presentation.correct?.square !== undefined &&
        presentation.correct.square === square,
      userMark: annotations.squares.find((mark) => mark.square === square)
        ?.color,
      check:
        check?.king === square
          ? check.mate
            ? 'checkmate, losing king'
            : 'in check'
          : check?.mate && check.winner === square
            ? 'winner'
            : undefined,
    });
  // Spoken square names: only the web board reads them (native squares carry
  // their own labels), so native skips building them on every render.
  const labels =
    Platform.OS !== 'web'
      ? noLabels
      : new Map(
          Array.from({ length: 64 }, (_, index) => {
            const square = squareAt(index, 'w');
            return [square, describe(square)] as const;
          }),
        );
  const outside = coordinates === 'outside';
  return (
    <View>
      <View style={outside ? styles.framed : undefined}>
        {outside && <OutsideRanks orientation={orientation} />}
        <View style={outside ? styles.boardColumn : undefined}>
          <View
            ref={boardRef}
            collapsable={false}
            testID="chessboard"
            accessible={false}
            accessibilityLabel={label}
            style={styles.board}
            onLayout={onLayout}
          >
            <GestureDetector
              gesture={gesture}
              enableContextMenu={false}
              touchAction="none"
            >
              <View
                collapsable={false}
                style={styles.grid}
                accessibilityElementsHidden={
                  !parsed.ok || input.consumerError || !!promotion
                }
                importantForAccessibility={
                  parsed.ok && !input.consumerError && !promotion
                    ? 'auto'
                    : 'no-hide-descendants'
                }
                aria-hidden={!parsed.ok || input.consumerError || !!promotion}
              >
                <BoardAccessibility
                  orientation={orientation}
                  positionId={position.id}
                  label={label}
                  labels={labels}
                  selected={selected}
                  hidden={blocked}
                  status={
                    verdict
                      ? `${verdict} ${check?.mate ? '' : status.text}`
                      : status.text
                  }
                  statusId={status.id}
                  statusReplaySafe={status.replaySafe}
                  focusRequest={focusRequest}
                  onActivate={activateSquare}
                  onCancel={cancelInput}
                  renderSquare={(square, focused) => {
                    const index = indexOf(square, orientation);
                    return (
                      <Square
                        key={square}
                        square={square}
                        userMarkColor={
                          annotations.squares.find(
                            (mark) => mark.square === square,
                          )?.color
                        }
                        piece={pieces.get(square)}
                        size={width / 8}
                        highlight={
                          presentation.highlights.find(
                            (mark) => mark.square === square,
                          )?.tone
                        }
                        label={describe(square)}
                        checkTone={
                          check?.king === square
                            ? 'king'
                            : check?.path.includes(square)
                              ? 'path'
                              : undefined
                        }
                        lastMoveTone={
                          lastMove === 'on' &&
                          (shownLastMove?.from === square ||
                            shownLastMove?.to === square)
                            ? presentation.lineMode
                              ? 'line'
                              : 'game'
                            : undefined
                        }
                        grade={
                          shownGrade?.square === square
                            ? shownGrade.kind
                            : undefined
                        }
                        selected={origin === square}
                        selectionShown={!fastOn}
                        focused={focused}
                        destination={!fastOn && destinations.has(square)}
                        captureTint={
                          destinations.has(square) && pieces.has(square)
                        }
                        hidePiece
                        focusRequest={
                          focusRequest?.square === square
                            ? focusRequest.id
                            : undefined
                        }
                        onActivate={onSquareActivate}
                        onCancel={selected ? onSquareCancel : undefined}
                        hint={
                          policy.mode === 'read-only' ||
                          !policy.submissionEnabled ||
                          input.state.phase === 'awaiting'
                            ? 'Explore the position. Move input is unavailable.'
                            : destinations.has(square)
                              ? 'Eligible destination. Activate to move here.'
                              : 'Activate to select a piece or destination.'
                        }
                        rankLabel={
                          coordinates === 'inside' && index % 8 === 0
                            ? square[1]
                            : undefined
                        }
                        fileLabel={
                          coordinates === 'inside' &&
                          Math.floor(index / 8) === 7
                            ? square[0]
                            : undefined
                        }
                      />
                    );
                  }}
                />
              </View>
            </GestureDetector>
            {width > 0 && (
              <View
                pointerEvents="none"
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                aria-hidden
                style={styles.pieceLayer}
              >
                {layered ? (
                  <PieceLayer
                    pieces={boardPieces}
                    orientation={orientation}
                    width={width}
                    set={pieceSet}
                    selected={selected}
                    {...(fastOn ? { fast } : {})}
                    travel={travel}
                    lift={lift}
                    finish={motion.finish}
                    drag={layeredDrag}
                    landing={presentation.landing}
                  />
                ) : (
                  boardPieces.map((piece) => (
                    <MotionPiece
                      key={piece.id}
                      piece={piece}
                      hidden={drawnElsewhere(piece)}
                      orientation={orientation}
                      size={width / 8}
                      finish={motion.finish}
                      selected={selected === piece.square}
                      arrivalId={
                        piece.from ||
                        (skipTravel &&
                          shownTransition?.motions.some(
                            (move) => move.to === piece.square,
                          ))
                          ? motion.arrivalId
                          : undefined
                      }
                      landed={skipTravel}
                      landing={presentation.landing}
                    />
                  ))
                )}
                {promotion && promotingPiece && (
                  <MotionPiece
                    key="provisional-pawn"
                    piece={{
                      ...promotingPiece,
                      square: promotion.destination,
                      id: 'provisional-pawn',
                    }}
                    orientation={orientation}
                    size={width / 8}
                    finish={motion.finish}
                  />
                )}
              </View>
            )}
            {fastOn && width > 0 && (
              <BoardOverlay
                fast={fast}
                size={width}
                orientation={orientation}
                set={pieceSet}
                selection={theme.colors.boardSelection}
                marker={theme.colors.boardMarker}
                markerAlpha={theme.boardMarkerAlpha}
              />
            )}
            {parsed.ok && width > 0 && arrows.length > 0 && (
              <BoardArrows
                arrows={arrows}
                width={width}
                orientation={orientation}
              />
            )}
            {parsed.ok && width > 0 && (
              <BoardEffects
                presentation={presentation}
                shownGrade={shownGrade}
                check={check}
                displayedFen={displayedFen}
                blocked={blocked}
                positionId={position.id}
                attemptId={feedback?.attemptId}
                orientation={orientation}
                width={width}
                landingDelay={
                  motion.pieces.some((piece) => piece.from) ? moveDuration : 0
                }
              />
            )}
            {presentation.lineMode && (
              <View
                pointerEvents="none"
                accessible={false}
                aria-hidden
                style={styles.lineBoard}
              />
            )}
            {input.state.phase === 'dragging' && width > 0 && (
              <Animated.View
                accessible={false}
                aria-hidden
                testID="drag-halo"
                style={[overlay, haloColour, haloStyle]}
              />
            )}
            {input.state.phase === 'dragging' && width > 0 && (
              <Animated.View
                accessible={false}
                aria-hidden
                testID="drag-target"
                style={[overlay, dragTargetColour, hoverStyle]}
              />
            )}
            {draggingPiece && width > 0 && (
              <Animated.View
                accessible={false}
                testID="dragged-piece"
                style={[overlay, dragStyle]}
              >
                <Piece
                  kind={draggingPiece.kind}
                  color={draggingPiece.color}
                  size={(width / 8) * PIECE_FILL}
                />
              </Animated.View>
            )}
            {promotion && promotingPiece && parsed.ok && (
              <PromotionChooser
                anchorRef={boardRef}
                variants={promotion.variants}
                color={promotingPiece.color}
                destination={promotion.destination}
                orientation={orientation}
                size={width}
                choose={(piece) => {
                  focusSquare(promotion.destination);
                  input.choosePromotion(piece);
                }}
                cancel={cancelInput}
              />
            )}
            {(!parsed.ok || input.consumerError) && (
              <BoardErrorOverlay
                title={
                  input.consumerError
                    ? 'Move unavailable'
                    : 'Position unavailable'
                }
                message={
                  parsed.ok
                    ? input.message
                    : `${parsed.message.replace(/^Position unavailable:\s*/i, '')} Restore a valid position to continue.`
                }
                onRestorePosition={onRestorePosition}
              />
            )}
          </View>
          {outside && <OutsideFiles orientation={orientation} />}
        </View>
      </View>
    </View>
  );
}

// Inline and absolutely positioned from the first frame, so the drag
// overlays never sit in the board's flow and squeeze the squares.
const overlay = {
  pointerEvents: 'none',
  position: 'absolute',
  top: 0,
  left: 0,
} as const;
const dragTargetColour = { borderColor: 'rgba(255, 255, 255, 0.75)' };
const haloColour = { backgroundColor: tokens.motion.grabHalo };

const useStyles = createStyles((theme) => ({
  // No clipping: a piece carried or lifted at an edge leans past the border
  // (the renderers keep an overhang for it) instead of being cut off.
  board: { width: '100%', aspectRatio: 1 },
  lineBoard: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 3,
    borderColor: theme.boardAnnotations.lineFrame,
  },
  grid: { flex: 1 },
  pieceLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  framed: { flexDirection: 'row' },
  boardColumn: { flex: 1 },
}));
