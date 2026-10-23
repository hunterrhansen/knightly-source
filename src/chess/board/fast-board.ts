import { useMemo } from 'react';
import {
  Easing,
  type SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** One piece's slide; castling slides the king and the rook. */
type FastMotion = Readonly<{ from: string; to: string; piece: string }>;
/** How a legal move slides, decided ahead of any tap by JavaScript. */
export type FastMove = Readonly<{
  duration: number;
  /** The rook's slide when castling. */
  rook?: Readonly<{ from: string; to: string }>;
  /** En passant's captured pawn, off the destination square. */
  captured?: string;
}>;
/** Pieces sliding on the display thread, ahead of JavaScript. */
type FastTravel = Readonly<{
  /** The move as tapped, to match JavaScript's attempt. */
  from: string;
  to: string;
  motions: readonly FastMotion[];
  captured?: string;
  /** JavaScript now shows the move, so the overlay can hand over. */
  acked: boolean;
}> | null;

/**
 * Board interaction mirrored on the display (UI) thread, as Lichess's board
 * repaints selection, destinations and travel without rebuilding anything. The
 * JavaScript input state stays authoritative: taps still reach it, and it
 * re-syncs these values; the display thread only draws its prediction first.
 */
export type FastBoard = Readonly<{
  /** Whether a tap may be predicted now (the player's turn, no chooser). */
  enabled: SharedValue<boolean>;
  showDestinations: SharedValue<boolean>;
  selected: SharedValue<string>;
  dests: SharedValue<string[]>;
  captures: SharedValue<string[]>;
  /**
   * Origin → destination → how it slides, or null when JavaScript must decide
   * (a promotion chooser).
   */
  moves: SharedValue<Record<string, Record<string, FastMove | null>>>;
  /** Square → piece code for every piece on the board. */
  occupied: SharedValue<Record<string, string>>;
  /** Squares whose piece may be selected now. */
  selectable: SharedValue<string[]>;
  travel: SharedValue<FastTravel>;
  progress: SharedValue<number>;
  /** Increments with each predicted tap; JavaScript echoes the last it handled. */
  sequence: SharedValue<number>;
}>;

/** The board's shared values, as one object that stays the same across
 * renders, so worklets and Skia mappers that capture it are not rebuilt. */
export function useFastBoard(): FastBoard {
  const enabled = useSharedValue(false);
  const showDestinations = useSharedValue(true);
  const selected = useSharedValue('');
  const dests = useSharedValue<string[]>([]);
  const captures = useSharedValue<string[]>([]);
  const moves = useSharedValue<Record<string, Record<string, FastMove | null>>>(
    {},
  );
  const occupied = useSharedValue<Record<string, string>>({});
  const selectable = useSharedValue<string[]>([]);
  const travel = useSharedValue<FastTravel>(null);
  const progress = useSharedValue(1);
  const sequence = useSharedValue(0);
  return useMemo(
    () => ({
      enabled,
      showDestinations,
      selected,
      dests,
      captures,
      moves,
      occupied,
      selectable,
      travel,
      progress,
      sequence,
    }),
    [
      enabled,
      showDestinations,
      selected,
      dests,
      captures,
      moves,
      occupied,
      selectable,
      travel,
      progress,
      sequence,
    ],
  );
}

/** Squares whose real pieces the overlay covers while it slides. */
export function coveredSquares(travel: FastTravel): string[] {
  'worklet';
  if (!travel) return [];
  const squares = travel.motions.flatMap((motion) => [motion.from, motion.to]);
  if (travel.captured) squares.push(travel.captured);
  return squares;
}

/** The square under a point on a board of `width`, or '' outside it. */
function select(fast: FastBoard, square: string) {
  'worklet';
  fast.selected.set(square);
  const targets = Object.keys(fast.moves.get()[square] ?? {});
  const occupied = fast.occupied.get();
  const show = fast.showDestinations.get();
  fast.dests.set(show ? targets.filter((to) => !occupied[to]) : []);
  fast.captures.set(show ? targets.filter((to) => !!occupied[to]) : []);
}
function clear(fast: FastBoard) {
  'worklet';
  fast.selected.set('');
  fast.dests.set([]);
  fast.captures.set([]);
}

/**
 * Predicts what JavaScript's `activate` will do with a tap, in the same order:
 * the selected square again clears; a selectable piece selects; a legal
 * destination moves (sliding now when the move is a plain one); anything else
 * clears. Returns the prediction's sequence number for JavaScript to echo.
 */
export function predictTap(fast: FastBoard, square: string): number {
  'worklet';
  fast.sequence.set(fast.sequence.get() + 1);
  if (!fast.enabled.get() || !square) return fast.sequence.get();
  const selected = fast.selected.get();
  if (selected === square) clear(fast);
  else if (fast.selectable.get().includes(square)) select(fast, square);
  else if (selected && fast.moves.get()[selected]?.[square] !== undefined) {
    const move = fast.moves.get()[selected]?.[square];
    clear(fast);
    const piece = fast.occupied.get()[selected];
    if (move && piece) {
      const motions: FastMotion[] = [{ from: selected, to: square, piece }];
      if (move.rook) motions.push({ ...move.rook, piece: `${piece[0]}r` });
      fast.enabled.set(false);
      fast.travel.set({
        from: selected,
        to: square,
        motions,
        ...(move.captured ? { captured: move.captured } : {}),
        acked: false,
      });
      fast.progress.set(0);
      fast.progress.set(
        withTiming(1, {
          duration: move.duration,
          easing: Easing.linear,
        }),
      );
    }
  } else clear(fast);
  return fast.sequence.get();
}
