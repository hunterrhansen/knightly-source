import type { Color } from 'chess.js';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Piece } from '../position';
import type { BoardProps, Transition } from './board.types';
import { createTransitionGate, reconcilePieces } from './transition';

type MotionProps = {
  pieces: readonly Piece[];
  positionId: string;
  transition?: Transition;
  orientation: Color;
  width: number;
  reducedMotion: boolean;
  skipTravel?: boolean;
  onComplete?: BoardProps['onTransitionComplete'];
};
export function useBoardMotion(props: MotionProps) {
  const {
    pieces,
    positionId,
    transition,
    orientation,
    width,
    reducedMotion,
    skipTravel,
    onComplete,
  } = props;
  // Geometry changes settle immediately; no travel is inferred from FEN diffs.
  const key = JSON.stringify([
    positionId,
    pieces,
    transition,
    orientation,
    width,
    reducedMotion,
    skipTravel,
  ]);
  const [snapshot, setSnapshot] = useState(() => ({
    key,
    pieces: reconcilePieces(undefined, pieces, positionId),
    orientation,
    width,
    positionId,
    transition,
    arrivalId: transition?.id,
  }));
  const finished = useRef(new Set<string>());
  let current = snapshot;
  if (snapshot.key !== key && keepsAttempt(snapshot, props)) {
    // The owner confirmed the move the board is already showing: keep the
    // pieces (and any travel still running) and adopt the confirmation.
    current = { ...snapshot, key, positionId, transition };
    setSnapshot(current);
  } else if (snapshot.key !== key) {
    finished.current.clear();
    let next = reconcilePieces(snapshot.pieces, pieces, positionId, transition);
    if (
      reducedMotion ||
      skipTravel ||
      snapshot.orientation !== orientation ||
      snapshot.width !== width ||
      width <= 0
    )
      next = next.map(({ from: _from, ...piece }) => piece);
    current = {
      key,
      pieces: next,
      orientation,
      width,
      positionId,
      transition,
      arrivalId: transition?.id,
    };
    setSnapshot(current);
  }
  const gate = useRef(createTransitionGate());
  const notify = useRef(onComplete);
  useLayoutEffect(() => {
    notify.current = onComplete;
  }, [onComplete]);
  const active = useRef<{ key: string; pending: Set<string> } | undefined>(
    undefined,
  );
  // A stable callback: pieces restart their travel when `finish` changes, so a
  // re-render mid-travel (such as a confirmation) must not replace it.
  const shown = useRef(current);
  useLayoutEffect(() => {
    shown.current = current;
  });
  const finish = useCallback((id: string) => {
    finished.current.add(id);
    const current = shown.current;
    const state = active.current;
    if (
      !state ||
      state.key !== current.key ||
      !state.pending.delete(id) ||
      state.pending.size
    )
      return;
    const event = current.transition;
    if (event && gate.current.complete(event.id, current.positionId))
      notify.current?.({
        transitionId: event.id,
        positionId: current.positionId,
      });
  }, []);
  useLayoutEffect(() => {
    active.current = {
      key: current.key,
      pending: new Set(
        current.pieces
          .filter((piece) => piece.from && !finished.current.has(piece.id))
          .map((piece) => piece.id),
      ),
    };
    const event = current.transition;
    if (!event || event.positionId !== current.positionId) {
      gate.current.cancel();
      return;
    }
    gate.current.begin(event);
    if (
      !active.current.pending.size &&
      gate.current.complete(event.id, current.positionId)
    )
      notify.current?.({
        transitionId: event.id,
        positionId: current.positionId,
      });
    return () => {
      active.current = undefined;
      gate.current.cancel();
    };
  }, [current]);
  return { pieces: current.pieces, finish, arrivalId: current.arrivalId };
}

const sameLayout = (shown: readonly Piece[], next: readonly Piece[]) =>
  shown.length === next.length &&
  next.every((piece) =>
    shown.some(
      (old) =>
        old.square === piece.square &&
        old.kind === piece.kind &&
        old.color === piece.color,
    ),
  );
/** An owner update whose position the board already shows from its attempt. */
function keepsAttempt(
  shown: Readonly<{
    pieces: readonly Piece[];
    orientation: Color;
    width: number;
    transition?: Transition;
  }>,
  next: MotionProps,
) {
  // The owner may confirm with a transition, or just show the same position
  // (a preview); navigation and reset always redraw.
  const reason = next.transition?.reason;
  return (
    shown.transition?.reason === 'attempt' &&
    reason !== 'navigation' &&
    reason !== 'reset' &&
    shown.orientation === next.orientation &&
    shown.width === next.width &&
    sameLayout(shown.pieces, next.pieces)
  );
}
