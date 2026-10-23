import { act, renderHook } from '@testing-library/react-native';
import { legalMoves } from '../move';
import { castleFen, promotionFen, startFen } from '../test-fixtures';
import type { BoardProps, MoveAttempt } from './board.types';
import { useBoardInput } from './use-board-input';

function propsFor(fen = startFen, attempts: MoveAttempt[] = []): BoardProps {
  return {
    position: { id: 'p1', fen },
    orientation: 'w',
    policy: {
      mode: 'movable',
      sides: ['w'],
      moves: legalMoves(fen),
      submissionEnabled: true,
    },
    presentation: { showDestinations: true, highlights: [], arrows: [] },
    onAttempt: (attempt) => {
      attempts.push(attempt);
    },
  };
}
test('selects, switches own piece and clears selection on illegal taps', () => {
  const { result } = renderHook(() => useBoardInput(propsFor()));
  act(() => result.current.activate('e2', 'activation'));
  expect(result.current.state).toEqual({ phase: 'selected', origin: 'e2' });
  act(() => result.current.activate('d2', 'activation'));
  expect(result.current.state).toEqual({ phase: 'selected', origin: 'd2' });
  act(() => result.current.activate('d5', 'activation'));
  expect(result.current.state.phase).toBe('idle');
  expect(result.current.message).toMatch(/not.*legal/i);
  act(() => result.current.activate('d2', 'activation'));
  act(() => result.current.activate('d2', 'activation'));
  expect(result.current.state.phase).toBe('idle');
});
test('a blocked own piece selects without moves, as on Lichess and Chess.com', () => {
  const props = propsFor();
  const { result, rerender } = renderHook(
    (board: BoardProps) => useBoardInput(board),
    {
      initialProps: props,
    },
  );
  act(() => result.current.activate('a1', 'activation'));
  expect(result.current.state).toEqual({ phase: 'selected', origin: 'a1' });
  // The opponent's pieces never select.
  act(() => result.current.activate('a1', 'activation'));
  act(() => result.current.activate('a8', 'activation'));
  expect(result.current.state.phase).toBe('idle');
  // Nor do the player's while it cannot move.
  rerender({
    ...props,
    policy: {
      ...props.policy,
      submissionEnabled: false,
    } as BoardProps['policy'],
  });
  act(() => result.current.activate('a1', 'activation'));
  expect(result.current.state.phase).toBe('idle');
});
test('two activations before rerender emit only one attempt', () => {
  const attempts: MoveAttempt[] = [];
  const { result } = renderHook(() =>
    useBoardInput(propsFor(startFen, attempts)),
  );
  act(() => {
    result.current.activate('e2', 'activation');
    result.current.activate('e4', 'activation');
    result.current.activate('d2', 'activation');
    result.current.activate('d4', 'activation');
  });
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    from: 'e2',
    to: 'e4',
    positionId: 'p1',
    source: 'activation',
  });
  expect(result.current.state.phase).toBe('awaiting');
});
test('illegal and outside drops do not submit; stale finish after flip cannot submit', () => {
  const attempts: MoveAttempt[] = [];
  let props = propsFor(startFen, attempts);
  const { result, rerender } = renderHook(() => useBoardInput(props));
  act(() => {
    result.current.beginDrag('e2');
    result.current.finishDrag('e5');
  });
  act(() => {
    result.current.beginDrag('e2');
    result.current.finishDrag(null);
  });
  act(() => result.current.beginDrag('e2'));
  const finish = result.current.finishDrag;
  props = { ...props, orientation: 'b' };
  rerender({});
  act(() => finish('e4'));
  expect(attempts).toHaveLength(0);
  expect(result.current.state.phase).toBe('idle');
});
test('drag underpromotion submits the chosen piece exactly once', () => {
  const promotion = 'n';
  const attempts: MoveAttempt[] = [];
  const { result } = renderHook(() =>
    useBoardInput(propsFor(promotionFen, attempts)),
  );
  act(() => {
    result.current.beginDrag('a7');
    result.current.finishDrag('a8');
  });
  expect(result.current.state.phase).toBe('promotion');
  expect(attempts).toHaveLength(0);
  act(() => {
    result.current.choosePromotion(promotion);
    result.current.choosePromotion(promotion);
  });
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    from: 'a7',
    to: 'a8',
    promotion,
    source: 'drag',
  });
});

test('cancel promotion emits nothing; same-FEN reset discards chooser and old choice', () => {
  const attempts: MoveAttempt[] = [];
  let props = propsFor(promotionFen, attempts);
  const { result, rerender } = renderHook(() => useBoardInput(props));
  act(() => {
    result.current.activate('a7', 'activation');
    result.current.activate('a8', 'activation');
    result.current.cancel();
  });
  expect(result.current.state.phase).toBe('idle');
  act(() => {
    result.current.activate('a7', 'activation');
    result.current.activate('a8', 'activation');
  });
  const choose = result.current.choosePromotion;
  props = { ...props, position: { ...props.position, id: 'p2' } };
  rerender({});
  act(() => choose('q'));
  expect(attempts).toHaveLength(0);
  expect(result.current.state.phase).toBe('idle');
});
test.each(['read-only', 'blocked', 'wrong-side', 'invalid-preview'] as const)(
  '%s cannot submit',
  (mode) => {
    const attempts: MoveAttempt[] = [];
    let props = propsFor(startFen, attempts);
    if (mode === 'read-only')
      props = { ...props, policy: { mode: 'read-only' } };
    if (mode === 'blocked' && props.policy.mode === 'movable')
      props = {
        ...props,
        policy: { ...props.policy, submissionEnabled: false },
      };
    if (mode === 'wrong-side' && props.policy.mode === 'movable')
      props = { ...props, policy: { ...props.policy, sides: ['b'] } };
    if (mode === 'invalid-preview')
      props = {
        ...props,
        presentation: {
          ...props.presentation,
          preview: { positionId: 'old', attemptId: 'a1', fen: startFen },
        },
      };
    const { result } = renderHook(() => useBoardInput(props));
    act(() => {
      result.current.activate('e2', 'activation');
      result.current.activate('e4', 'activation');
      result.current.beginDrag('e2');
      result.current.finishDrag('e4');
    });
    expect(attempts).toHaveLength(0);
  },
);
test.each(['rejected', 'resolved', 'failed', 'uncertain'] as const)(
  'pending blocks submission; %s releases it once and old feedback cannot release the next attempt',
  (outcome) => {
    const attempts: MoveAttempt[] = [];
    let props = propsFor(startFen, attempts);
    const { result, rerender } = renderHook(() => useBoardInput(props));
    act(() => {
      result.current.activate('e2', 'activation');
      result.current.activate('e4', 'activation');
    });
    const first = attempts[0];
    if (!first) throw new Error('missing attempt');
    props = {
      ...props,
      feedback: { ...first, outcome: 'pending', message: 'Checking' },
    };
    rerender({});
    act(() => {
      result.current.activate('d2', 'activation');
      result.current.activate('d4', 'activation');
    });
    expect(attempts).toHaveLength(1);
    props = {
      ...props,
      feedback: { ...first, outcome, message: 'Try again' },
    };
    rerender({});
    act(() => {
      result.current.activate('d2', 'activation');
      result.current.activate('d4', 'activation');
    });
    props = {
      ...props,
      feedback: { ...first, outcome, message: 'Replay' },
    };
    rerender({});
    act(() => {
      result.current.activate('c2', 'activation');
      result.current.activate('c4', 'activation');
    });
    expect(attempts).toHaveLength(2);
    expect(result.current.state.phase).toBe('awaiting');
  },
);

test('promotion only accepts the current eligible variant set', () => {
  const attempts: MoveAttempt[] = [];
  const props = propsFor(promotionFen, attempts);
  const { result } = renderHook(() =>
    useBoardInput({
      ...props,
      policy: {
        mode: 'movable',
        sides: ['w'],
        moves: [{ from: 'a7', to: 'a8', promotion: 'n' }],
        submissionEnabled: true,
      },
    }),
  );
  act(() => {
    result.current.activate('a7', 'activation');
    result.current.activate('a8', 'activation');
    result.current.choosePromotion('q');
  });
  expect(attempts).toHaveLength(0);
  expect(result.current.state.phase).toBe('promotion');
  act(() => result.current.choosePromotion('n'));
  expect(attempts[0]?.promotion).toBe('n');
});

test('callbacks captured before unmount cannot emit an attempt', () => {
  const attempts: MoveAttempt[] = [];
  const { result, unmount } = renderHook(() =>
    useBoardInput(propsFor(startFen, attempts)),
  );
  const stale = result.current.activate;
  act(() => stale('e2', 'activation'));
  unmount();
  act(() => stale('e4', 'activation'));
  expect(attempts).toHaveLength(0);
});

test('immediate mouse pickup preserves click selection, deselection and tap moves', () => {
  const attempts: MoveAttempt[] = [];
  const { result } = renderHook(() =>
    useBoardInput(propsFor(startFen, attempts)),
  );
  act(() => {
    result.current.beginMouseDrag('e2');
  });
  expect(result.current.state.phase).toBe('dragging');
  expect(attempts).toHaveLength(0);
  act(() => result.current.finishMouseDrag('e2', true));
  expect(result.current.state).toEqual({ phase: 'selected', origin: 'e2' });
  act(() => {
    result.current.beginMouseDrag('e2');
    result.current.finishMouseDrag('e2', true);
  });
  expect(result.current.state.phase).toBe('idle');
  act(() => {
    result.current.beginMouseDrag('e2');
    result.current.finishMouseDrag('e2', true);
  });
  act(() => {
    result.current.beginMouseDrag('e4');
    result.current.finishMouseDrag('e4', true);
    result.current.finishMouseDrag('e4', true);
  });
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    from: 'e2',
    to: 'e4',
    source: 'activation',
  });
});

test('mouse drag submits once while cancellation and outside drops emit nothing', () => {
  const attempts: MoveAttempt[] = [];
  const { result } = renderHook(() =>
    useBoardInput(propsFor(startFen, attempts)),
  );
  act(() => {
    result.current.beginMouseDrag('e2');
    result.current.cancelMouseDrag();
  });
  expect(result.current.state.phase).toBe('idle');
  act(() => {
    result.current.beginMouseDrag('e2');
    result.current.finishMouseDrag(null, false);
  });
  expect(attempts).toHaveLength(0);
  act(() => {
    result.current.beginMouseDrag('e2');
    result.current.finishMouseDrag('e4', false);
    result.current.finishMouseDrag('e4', false);
    result.current.cancelMouseDrag();
  });
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ from: 'e2', to: 'e4', source: 'drag' });
  expect(result.current.state.phase).toBe('awaiting');
});

test('mouse callbacks from before a reset cannot select or submit on the new position', () => {
  const attempts: MoveAttempt[] = [];
  let props = propsFor(startFen, attempts);
  const { result, rerender } = renderHook(() => useBoardInput(props));
  act(() => result.current.beginMouseDrag('e2'));
  const stale = result.current;
  props = { ...props, position: { ...props.position, id: 'p2' } };
  rerender({});
  act(() => {
    stale.finishMouseDrag('e4', true);
    stale.cancelMouseDrag();
  });
  expect(result.current.state.phase).toBe('idle');
  expect(attempts).toHaveLength(0);
});

test('dropping the king on its own rook castles; clicking the rook selects it', () => {
  const attempts: MoveAttempt[] = [];
  const { result } = renderHook(() =>
    useBoardInput(propsFor(castleFen, attempts)),
  );
  act(() => result.current.activate('e1', 'activation'));
  act(() => result.current.activate('h1', 'activation'));
  expect(result.current.state).toEqual({ phase: 'selected', origin: 'h1' });
  act(() => result.current.cancel());
  act(() => result.current.beginDrag('e1'));
  act(() => result.current.finishDrag('a1'));
  expect(attempts).toEqual([
    expect.objectContaining({ from: 'e1', to: 'c1', source: 'drag' }),
  ]);
});
