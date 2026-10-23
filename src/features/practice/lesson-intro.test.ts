import { act, renderHook } from '@testing-library/react-native';
import type { MoveAttempt } from '../../chess/board';
import type { LessonIntro } from '../../lib/api/practice-contract';
import { isLineMove, linePositions, useLessonIntro } from './lesson-intro';

// Black's king steps to d8; White's knight forks from c7 (a one-move lesson).
const fork = {
  fen_prev: 'r3k3/8/8/1N6/8/8/8/4K3 b - - 0 1',
  prev_uci: 'e8d8',
  fen_before: 'r2k4/8/8/1N6/8/8/8/4K3 w - - 1 2',
  color: 'white' as const,
  line: ['b5c7'],
  line_key: 'fedcba9876543210',
};
const intro: LessonIntro = {
  lesson: 'double-attack',
  name: 'Double attack',
  example: fork,
  guided: fork,
};
const attempt = (from: string, to: string, positionId: string): MoveAttempt =>
  ({
    from,
    to,
    positionId,
    attemptId: `${from}${to}`,
    source: 'activation',
  }) as MoveAttempt;

test('a line passes through the opponent’s move in, then each of its moves', () => {
  const fens = linePositions(fork).map((p) => p.fen.split(' ')[0]);
  expect(fens).toEqual([
    'r3k3/8/8/1N6/8/8/8/4K3',
    'r2k4/8/8/1N6/8/8/8/4K3',
    'r2k4/2N5/8/8/8/8/8/4K3',
  ]);
});

test('only the line’s move counts, and a promotion must be the named one', () => {
  expect(isLineMove(['b5c7'], 0, { from: 'b5', to: 'c7' })).toBe(true);
  expect(isLineMove(['b5c7'], 0, { from: 'b5', to: 'd6' })).toBe(false);
  expect(
    isLineMove(['a7a8q'], 0, { from: 'a7', to: 'a8', promotion: 'q' }),
  ).toBe(true);
  expect(
    isLineMove(['a7a8q'], 0, { from: 'a7', to: 'a8', promotion: 'n' }),
  ).toBe(false);
  expect(isLineMove(['b5c7'], 1, { from: 'b5', to: 'c7' })).toBe(false);
});

test('the intro explains, demonstrates, then judges the learner’s try locally and finishes once', () => {
  jest.useFakeTimers();
  const finished = jest.fn();
  const { result } = renderHook(() => useLessonIntro(intro, finished, true));
  // Explain: the knight's line under the lesson's name, on the starting position.
  expect(result.current?.title).toBe('Double attack');
  expect(result.current?.body).toMatch(/two threats/);
  act(() => result.current?.actions[1]?.onPress());
  // Demonstrate: the line plays itself; Your turn waits for it.
  expect(result.current?.title).toBe('Watch from the wall');
  expect(result.current?.actions[1]?.disabled).toBe(true);
  // Each move is its own beat: the next is scheduled once the last has played.
  for (let i = 0; i < 3; i++) act(() => jest.advanceTimersByTime(300));
  expect(result.current?.actions[1]).toMatchObject({
    label: 'Your turn',
    disabled: false,
  });
  act(() => result.current?.actions[1]?.onPress());
  // The try: the opponent's move plays in, then the board takes White's move.
  act(() => jest.advanceTimersByTime(600));
  expect(result.current?.title).toBe('Your turn on watch');
  expect(result.current?.board.policy.mode).toBe('movable');
  // Think first: no hint until a moment has passed.
  expect(result.current?.board.presentation.hint).toBeUndefined();
  act(() => jest.advanceTimersByTime(2100));
  expect(result.current?.board.presentation.hint).toEqual({ square: 'b5' });
  const board = result.current?.board;
  act(() => board?.onAttempt(attempt('b5', 'c7', board.position.id)));
  expect(result.current?.title).toBe('That’s the move');
  expect(finished).not.toHaveBeenCalled();
  act(() => result.current?.actions[0]?.onPress());
  expect(finished).toHaveBeenCalledWith('double-attack');
  jest.useRealTimers();
});

test('a wrong try shows the answer rather than being retried or saved', () => {
  jest.useFakeTimers();
  const { result } = renderHook(() =>
    useLessonIntro({ ...intro, example: null }, jest.fn(), true),
  );
  // With no demonstration, "Watch from the wall" goes straight to the try.
  act(() => result.current?.actions[1]?.onPress());
  act(() => jest.advanceTimersByTime(600));
  const board = result.current?.board;
  act(() => board?.onAttempt(attempt('b5', 'd6', board.position.id)));
  expect(result.current?.title).toBe('Not this time');
  expect(result.current?.board.presentation.arrows).toEqual([
    { from: 'b5', to: 'c7', tone: 'best' },
  ]);
  jest.useRealTimers();
});
