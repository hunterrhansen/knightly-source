import type { Color } from 'chess.js';
import { useLayoutEffect, useRef } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { tokens } from '../../theme/tokens';
import { squareOrigin } from '../coordinates';
import { PIECE_FILL } from './geometry';
import {
  type LandingCurve,
  pieceFadeIn,
  pressLanding,
  useBoardMotionSettings,
} from './motion-settings';
import { Piece } from './piece';
import type { VisualPiece } from './transition';

// Web pieces, and the provisional pawn during a promotion on any platform;
// native boards draw their pieces in the layered renderer.
export function MotionPiece({
  piece,
  orientation,
  size,
  finish,
  selected = false,
  arrivalId,
  landed = false,
  hidden = false,
  landing,
}: {
  piece: VisualPiece;
  orientation: Color;
  size: number;
  finish: (id: string) => void;
  selected?: boolean;
  arrivalId?: string;
  landed?: boolean;
  /** Drawn elsewhere for now (dragged or promoting): kept mounted, unseen. */
  hidden?: boolean;
  /** How the piece lands (Presentation.landing). */
  landing?: LandingCurve;
}) {
  const bounce = landing ?? pressLanding;
  const { still: reduced, travel, lift } = useBoardMotionSettings();
  const { duration: moveDuration, bezier } = travel(
    piece.from ?? piece.square,
    piece.square,
  );
  const scale = useSharedValue(selected ? lift : 1);
  const previous = useRef({
    arrivalId: undefined as string | undefined,
    orientation,
    size,
    reduced,
    square: landed && arrivalId ? undefined : (piece.from ?? piece.square),
  });
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = {
      arrivalId,
      orientation,
      size,
      reduced,
      square: piece.square,
    };
    cancelAnimation(scale);
    const snap =
      reduced ||
      old.orientation !== orientation ||
      old.size !== size ||
      old.reduced !== reduced;
    if (snap) scale.set(selected ? lift : 1);
    else if (
      !selected &&
      (piece.from || landed) &&
      old.square !== piece.square &&
      arrivalId &&
      old.arrivalId !== arrivalId
    ) {
      scale.set(1);
      // Each step of the landing in turn, the first after the move lands.
      const steps = bounce.slice(1).map((point, i) =>
        withTiming(point.scale, {
          duration: point.at - (bounce[i]?.at ?? 0),
        }),
      );
      const [first, ...rest] = steps;
      if (first)
        scale.set(
          withSequence(
            withDelay(landed ? 0 : moveDuration, first, ReduceMotion.System),
            ...rest,
          ),
        );
    } else
      scale.set(
        withTiming(selected ? lift : 1, {
          duration: tokens.motion.pieceSelect,
        }),
      );
    return () => cancelAnimation(scale);
  }, [
    scale,
    selected,
    piece.from,
    piece.square,
    landed,
    arrivalId,
    orientation,
    size,
    reduced,
    moveDuration,
    lift,
    bounce,
  ]);
  const progress = useSharedValue(piece.from ? 0 : 1);
  const { x: fromX, y: fromY } = squareOrigin(
    piece.from ?? piece.square,
    orientation,
    size,
  );
  const { x: toX, y: toY } = squareOrigin(piece.square, orientation, size);
  const id = piece.id;
  // A piece a morph brings with no nearby counterpart fades in where it
  // stands; one arriving on an empty board also drops in, row by row.
  const opacity = useSharedValue(piece.appear && !reduced ? 0 : 1);
  const entering = !!piece.enter && !reduced;
  const drop = entering ? size * tokens.motion.enterDrop : 0;
  const delay = entering
    ? Math.round(toY / size) * tokens.motion.enterStagger
    : 0;
  useLayoutEffect(() => {
    if (opacity.get() < 1)
      opacity.set(
        withDelay(
          delay,
          withTiming(1, pieceFadeIn(entering)),
          ReduceMotion.System,
        ),
      );
  }, [opacity, delay, entering]);
  useLayoutEffect(() => {
    cancelAnimation(progress);
    if (!piece.from) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(
      withTiming(
        1,
        {
          duration: moveDuration,
          easing: Easing.bezier(...bezier),
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) scheduleOnRN(finish, id);
        },
      ),
    );
    return () => cancelAnimation(progress);
  }, [piece.from, progress, finish, id, moveDuration, bezier]);
  const style = useAnimatedStyle(
    () => ({
      zIndex: selected ? 3 : piece.from ? 2 : 1,
      opacity: hidden ? 0 : opacity.get(),
      transform: [
        { translateX: fromX + (toX - fromX) * progress.get() },
        {
          translateY:
            fromY + (toY - fromY) * progress.get() - drop * (1 - opacity.get()),
        },
        { scale: scale.get() },
      ],
    }),
    [
      progress,
      scale,
      opacity,
      hidden,
      selected,
      piece.from,
      piece.square,
      fromX,
      fromY,
      toX,
      toY,
      drop,
    ],
  );
  return (
    <Animated.View
      testID={`visual-piece-${piece.square}`}
      exiting={pieceOut}
      accessible={false}
      aria-hidden
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {piece.from &&
      piece.travelingKind &&
      piece.travelingKind !== piece.kind ? (
        <PromotionArtwork piece={piece} size={size} progress={progress} />
      ) : (
        <Piece kind={piece.kind} color={piece.color} size={size * PIECE_FILL} />
      )}
    </Animated.View>
  );
}

// A piece that leaves the board (a capture, or a morph's departure) fades
// where it stood, as the native renderer and Lichess fade captures.
const pieceOut = FadeOut.duration(tokens.motion.move).easing(
  Easing.in(Easing.quad),
);

function PromotionArtwork({
  piece,
  size,
  progress,
}: {
  piece: VisualPiece;
  size: number;
  progress: SharedValue<number>;
}) {
  const traveling = useAnimatedStyle(
    () => ({ opacity: progress.get() < 1 ? 1 : 0 }),
    [progress],
  );
  const replaced = useAnimatedStyle(
    () => ({ opacity: progress.get() >= 1 ? 1 : 0 }),
    [progress],
  );
  return (
    <>
      <Animated.View testID="promotion-travel-art" style={traveling}>
        <Piece
          kind={piece.travelingKind ?? piece.kind}
          color={piece.color}
          size={size * PIECE_FILL}
        />
      </Animated.View>
      <Animated.View
        testID="promotion-endpoint-art"
        style={[{ position: 'absolute' }, replaced]}
      >
        <Piece kind={piece.kind} color={piece.color} size={size * PIECE_FILL} />
      </Animated.View>
    </>
  );
}
