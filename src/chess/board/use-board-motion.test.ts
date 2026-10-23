import { act, renderHook } from '@testing-library/react-native';
import { applyMove } from '../move';
import { parsePosition } from '../position';
import { castleFen, startFen } from '../test-fixtures';
import { createTransition } from './transition';
import { useBoardMotion } from './use-board-motion';

const pieces = (fen: string) => {
  const result = parsePosition(fen);
  if (!result.ok) throw new Error(result.message);
  return result.value.pieces;
};
const initial = {
  pieces: pieces(startFen),
  positionId: 'p1',
  orientation: 'w' as const,
  width: 320,
  reducedMotion: false,
};
test('explicit completion emits once; replaced and unmounted callbacks cannot emit', () => {
  const complete = jest.fn();
  const { result, rerender, unmount } = renderHook(useBoardMotion, {
    initialProps: {
      ...initial,
      transition: undefined as ReturnType<typeof createTransition> | undefined,
      onComplete: complete,
    },
  });
  const move = applyMove(startFen, { from: 'e2', to: 'e4' });
  rerender({
    ...initial,
    pieces: pieces(move.fen),
    positionId: 'p2',
    transition: createTransition(
      { id: 't1', positionId: 'p2', reason: 'confirmed' },
      move,
    ),
    onComplete: complete,
  });
  const stale = result.current;
  expect(stale.pieces.find((piece) => piece.square === 'e4')?.from).toBe('e2');
  rerender({
    ...initial,
    positionId: 'p3',
    transition: createTransition({
      id: 'reset',
      positionId: 'p3',
      reason: 'reset',
    }),
    onComplete: complete,
  });
  expect(complete).toHaveBeenCalledWith({
    transitionId: 'reset',
    positionId: 'p3',
  });
  act(() =>
    stale.finish(
      stale.pieces.find((piece) => piece.square === 'e4')?.id ?? 'missing',
    ),
  );
  expect(complete).toHaveBeenCalledTimes(1);
  rerender({
    ...initial,
    pieces: pieces(move.fen),
    positionId: 'p4',
    transition: createTransition(
      { id: 't2', positionId: 'p4', reason: 'opponent' },
      move,
    ),
    onComplete: complete,
  });
  const current = result.current;
  act(() =>
    current.finish(
      current.pieces.find((piece) => piece.square === 'e4')?.id ?? 'missing',
    ),
  );
  act(() =>
    current.finish(
      current.pieces.find((piece) => piece.square === 'e4')?.id ?? 'missing',
    ),
  );
  expect(complete).toHaveBeenCalledTimes(2);
  unmount();
  act(() => current.finish(current.pieces[0]?.id ?? 'missing'));
  expect(complete).toHaveBeenCalledTimes(2);
});
test('reduced motion completes an opponent transition immediately without timers', () => {
  const complete = jest.fn();
  const { result, rerender } = renderHook(useBoardMotion, {
    initialProps: {
      ...initial,
      reducedMotion: true,
      transition: undefined as ReturnType<typeof createTransition> | undefined,
      onComplete: complete,
    },
  });
  const move = applyMove(startFen, { from: 'e2', to: 'e4' });
  const next = {
    ...initial,
    reducedMotion: true,
    pieces: pieces(move.fen),
    positionId: 'p2',
    transition: createTransition(
      { id: 'reply', positionId: 'p2', reason: 'opponent' },
      move,
    ),
    onComplete: complete,
  };
  rerender(next);
  expect(result.current.pieces.some((piece) => piece.from)).toBe(false);
  expect(complete).toHaveBeenCalledTimes(1);
  rerender({ ...next });
  expect(complete).toHaveBeenCalledTimes(1);
});
test('castling waits for both pieces, and changing orientation cancels travel', () => {
  const complete = jest.fn();
  const base = {
    ...initial,
    pieces: pieces(castleFen),
    transition: undefined as ReturnType<typeof createTransition> | undefined,
    onComplete: complete,
  };
  const { result, rerender } = renderHook(useBoardMotion, {
    initialProps: { ...base, orientation: 'w' as 'w' | 'b' },
  });
  const move = applyMove(castleFen, { from: 'e1', to: 'g1' });
  const next = {
    ...base,
    pieces: pieces(move.fen),
    positionId: 'p2',
    transition: createTransition(
      { id: 'castle', positionId: 'p2', reason: 'confirmed' },
      move,
    ),
    orientation: 'w' as 'w' | 'b',
  };
  rerender(next);
  const moving = result.current.pieces.filter((piece) => piece.from);
  expect(moving).toHaveLength(2);
  act(() => result.current.finish(moving[0]?.id ?? 'missing'));
  expect(complete).not.toHaveBeenCalled();
  const old = result.current;
  rerender({ ...next, orientation: 'b' });
  expect(result.current.pieces.some((piece) => piece.from)).toBe(false);
  expect(complete).toHaveBeenCalledTimes(1);
  act(() => old.finish(moving[1]?.id ?? 'missing'));
  expect(complete).toHaveBeenCalledTimes(1);
});
test('a confirmed instant move keeps its travel running and then completes', () => {
  const complete = jest.fn();
  const move = applyMove(startFen, { from: 'e2', to: 'e4' });
  const { result, rerender } = renderHook(useBoardMotion, {
    initialProps: {
      ...initial,
      transition: undefined as ReturnType<typeof createTransition> | undefined,
      onComplete: complete,
    },
  });
  // The board shows its own attempt at once...
  rerender({
    ...initial,
    pieces: pieces(move.fen),
    transition: createTransition(
      { id: 'instant', positionId: 'p1', reason: 'attempt' },
      move,
    ),
    onComplete: complete,
  });
  const traveling = result.current.pieces.find((piece) => piece.from);
  const finish = result.current.finish;
  // ...then the owner confirms it mid-travel.
  rerender({
    ...initial,
    pieces: pieces(move.fen),
    positionId: 'p2',
    transition: createTransition(
      { id: 'confirmed', positionId: 'p2', reason: 'confirmed' },
      move,
    ),
    onComplete: complete,
  });
  // Pieces restart travel when their piece or `finish` changes; neither may.
  expect(result.current.pieces.find((piece) => piece.from)).toBe(traveling);
  expect(result.current.finish).toBe(finish);
  act(() => result.current.finish(traveling?.id ?? ''));
  expect(complete).toHaveBeenCalledWith({
    transitionId: 'confirmed',
    positionId: 'p2',
  });
});
