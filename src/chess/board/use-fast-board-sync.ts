import type { Color } from 'chess.js';
import type { RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';
import type { Piece } from '../position';
import type { MoveVariant, Policy } from './board.types';
import type { FastBoard, FastMove } from './fast-board';
import type { useBoardMotionSettings } from './motion-settings';

/**
 * Keeps the display thread's copy of the board (legal moves, occupancy,
 * selection and destination dots) in step with JavaScript, so a tap can
 * select and slide on the UI thread before JavaScript handles it.
 */
export function useFastBoardSync({
  fastOn,
  fast,
  handledSequence,
  travel,
  pieces,
  policy,
  movableInput,
  eligibleMoves,
  displayedFen,
  turn,
  selected,
  destinations,
  showDestinations,
}: {
  fastOn: boolean;
  fast: FastBoard;
  handledSequence: RefObject<number>;
  travel: ReturnType<typeof useBoardMotionSettings>['travel'];
  pieces: ReadonlyMap<string, Piece>;
  policy: Policy;
  /** The position is valid and input is idle or selecting, without an error. */
  movableInput: boolean;
  eligibleMoves: readonly MoveVariant[];
  displayedFen: string;
  turn: Color | undefined;
  selected: string | undefined;
  destinations: ReadonlySet<string>;
  /** Destination dots are wanted by the feature and the preference. */
  showDestinations: boolean;
}) {
  // How each legal move slides on the display thread; a promotion, which needs
  // the chooser (null), stays with JavaScript.
  const fastMove = (
    move: MoveVariant,
    seen: FastMove | null | undefined,
  ): FastMove | null => {
    const piece = pieces.get(move.from);
    if (seen === null || !piece) return null;
    if (move.promotion) return null;
    const duration = travel(move.from, move.to).duration;
    const files = move.to.charCodeAt(0) - move.from.charCodeAt(0);
    if (piece.kind === 'k' && Math.abs(files) === 2) {
      const rank = move.from[1];
      return {
        duration,
        rook:
          files > 0
            ? { from: `h${rank}`, to: `f${rank}` }
            : { from: `a${rank}`, to: `d${rank}` },
      };
    }
    if (piece.kind === 'p' && files !== 0 && !pieces.has(move.to))
      return { duration, captured: `${move.to[0]}${move.from[1]}` };
    return { duration };
  };
  // The motion preference, as values the sync can compare.
  const travelKey = `${travel('a1', 'a2').duration}:${travel('a1', 'h8').duration}`;
  const fastInputs = useRef<unknown[]>(undefined);
  // Keep the display thread's copy in step with JavaScript, unless it has
  // predicted taps that JavaScript has not handled yet.
  useLayoutEffect(() => {
    if (!fastOn) return;
    const caughtUp = handledSequence.current === fast.sequence.get();
    const inFlight = fast.travel.get();
    if (inFlight && !inFlight.acked && caughtUp)
      fast.travel.set({ ...inFlight, acked: true });
    if (!caughtUp) return;
    const movable =
      policy.mode === 'movable' && movableInput && policy.submissionEnabled;
    // Rebuild and resend only when what the overlay reads has changed.
    const inputs = [
      displayedFen,
      eligibleMoves,
      movable,
      policy.mode === 'movable' ? policy.sides.join() : '',
      selected ?? '',
      [...destinations].join(),
      showDestinations,
      !!(inFlight && !inFlight.acked),
      travelKey,
    ];
    const last = fastInputs.current;
    if (last && inputs.every((value, i) => value === last[i])) return;
    fastInputs.current = inputs;
    const moves: Record<string, Record<string, FastMove | null>> = {};
    if (movable)
      for (const move of eligibleMoves) {
        const targets = moves[move.from] ?? {};
        moves[move.from] = targets;
        targets[move.to] = fastMove(move, targets[move.to]);
      }
    const occupied: Record<string, string> = {};
    for (const [square, piece] of pieces)
      occupied[square] = `${piece.color}${piece.kind}`;
    fast.moves.set(moves);
    fast.occupied.set(occupied);
    fast.selectable.set(
      movable && policy.mode === 'movable'
        ? [...pieces.values()]
            .filter(
              (piece) =>
                policy.sides.includes(piece.color) && piece.color === turn,
            )
            .map((piece) => piece.square)
        : [],
    );
    fast.showDestinations.set(showDestinations);
    fast.selected.set(selected ?? '');
    fast.dests.set([...destinations].filter((square) => !pieces.has(square)));
    fast.captures.set([...destinations].filter((square) => pieces.has(square)));
    fast.enabled.set(movable && !(inFlight && !inFlight.acked));
  });
}
