import {
  act,
  fireEvent,
  render as nativeRender,
  screen,
} from '@testing-library/react-native';
import { type ReactElement, StrictMode, useState } from 'react';
import { AccessibilityInfo, Modal } from 'react-native';
import {
  GestureHandlerRootView,
  PointerType,
} from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import { applyMove, legalMoves } from '../move';
import { promotionFen, startFen } from '../test-fixtures';
import type { BoardProps, MoveAttempt } from './board.types';
import { Chessboard } from './chessboard';
import { createTransition } from './transition';

const render = (ui: ReactElement) =>
  nativeRender(ui, { wrapper: GestureHandlerRootView });
const movable = {
  mode: 'movable',
  sides: ['w'],
  moves: legalMoves(startFen),
  submissionEnabled: true,
} as const;
const activate = (square: string) =>
  fireEvent(
    screen.getByTestId(`square-${square}`, { includeHiddenElements: true }),
    'accessibilityTap',
  );

test('Strict Mode mounting and duplicate destination activations submit only once', () => {
  const attempts: MoveAttempt[] = [];
  render(
    <StrictMode>
      <Chessboard
        {...props}
        policy={movable}
        onAttempt={(a) => attempts.push(a)}
      />
    </StrictMode>,
  );
  expect(attempts).toHaveLength(0);
  act(() => {
    activate('e2');
    activate('e4');
    activate('e4');
  });
  expect(attempts).toHaveLength(1);
});
test.each(['q', 'n', 'r', 'b'] as const)(
  'promotion chooser renders provisional pawn and submits %s once',
  (promotion) => {
    const attempts: MoveAttempt[] = [];
    render(
      <Chessboard
        {...props}
        position={{ id: 'promote', fen: promotionFen }}
        policy={{ ...movable, moves: legalMoves(promotionFen) }}
        onAttempt={(a) => attempts.push(a)}
      />,
    );
    activate('a7');
    activate('a8');
    expect(screen.getByTestId('promotion-stack')).toBeOnTheScreen();
    expect(
      screen.getByTestId('square-a8', { includeHiddenElements: true }).props
        .accessibilityLabel,
    ).toMatch(/pawn/i);
    const button = screen.getByRole('button', {
      name: `Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[promotion]}`,
    });
    act(() => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.promotion).toBe(promotion);
  },
);
test('promotion Cancel and same-FEN reset remove chooser without emitting', () => {
  const attempts: MoveAttempt[] = [];
  const base = {
    ...props,
    position: { id: 'p1', fen: promotionFen },
    policy: { ...movable, moves: legalMoves(promotionFen) },
    onAttempt: (a: MoveAttempt) => attempts.push(a),
  };
  const { rerender } = render(<Chessboard {...base} />);
  activate('a7');
  activate('a8');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel promotion' }));
  expect(screen.queryByText('Choose promotion')).toBeNull();
  activate('a7');
  activate('a8');
  rerender(<Chessboard {...base} position={{ ...base.position, id: 'p2' }} />);
  expect(screen.queryByText('Choose promotion')).toBeNull();
  expect(attempts).toHaveLength(0);
});
test('synchronous parent confirmation releases the gate for a new position', () => {
  const attempts: MoveAttempt[] = [];
  function Consumer() {
    const [position, setPosition] = useState(props.position);
    const [feedback, setFeedback] = useState<BoardProps['feedback']>();
    return (
      <Chessboard
        {...props}
        position={position}
        feedback={feedback}
        policy={{
          ...movable,
          sides: ['w', 'b'],
          moves: legalMoves(position.fen),
        }}
        onAttempt={(attempt) => {
          attempts.push(attempt);
          setFeedback({ ...attempt, outcome: 'resolved', message: 'Done' });
          setPosition({
            id: `p${attempts.length + 1}`,
            fen: applyMove(position.fen, attempt).fen,
          });
        }}
      />
    );
  }
  render(<Consumer />);
  activate('e2');
  activate('e4');
  activate('e7');
  activate('e5');
  expect(attempts.map((a) => a.positionId)).toEqual(['p1', 'p2']);
  expect(new Set(attempts.map((a) => a.attemptId)).size).toBe(2);
});
test('a move shows at once, before the owner confirms it, and confirmation keeps it', () => {
  const attempts: MoveAttempt[] = [];
  const piece = (square: string) =>
    screen.queryByTestId(`visual-piece-${square}`, {
      includeHiddenElements: true,
    });
  const board = (extra: Partial<BoardProps> = {}) => (
    <Chessboard
      {...props}
      policy={movable}
      onAttempt={(attempt) => attempts.push(attempt)}
      {...extra}
    />
  );
  const { rerender } = render(board());
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320 } },
  });
  expect(piece('e2')).not.toBeNull();
  act(() => {
    activate('e2');
    activate('e4');
  });
  // The owner has not answered, yet the pawn is already on e4.
  expect(piece('e4')).not.toBeNull();
  expect(piece('e2')).toBeNull();
  expect(attempts).toHaveLength(1);
  const [attempt] = attempts as [MoveAttempt];
  const applied = applyMove(startFen, attempt);
  rerender(
    board({
      position: { id: 'p2', fen: applied.fen },
      policy: { ...movable, moves: [], submissionEnabled: false },
      feedback: { ...attempt, outcome: 'resolved', message: 'Played' },
      presentation: {
        ...props.presentation,
        transition: createTransition(
          { id: 'confirmed', positionId: 'p2', reason: 'confirmed' },
          applied,
        ),
      },
    }),
  );
  expect(piece('e4')).not.toBeNull();
  expect(piece('e2')).toBeNull();
  expect(attempts).toHaveLength(1);
});
test('drag emits once; subsequent tap cannot duplicate the drop', async () => {
  const attempts: MoveAttempt[] = [];
  render(
    <Chessboard
      {...props}
      policy={movable}
      onAttempt={(a) => attempts.push(a)}
    />,
  );
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  // RNGH publishes its updated native handler configuration in a microtask.
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireGestureHandler(getByGestureTestId('board-pan-p1'), [
      { x: 180, y: 260 },
      { x: 180, y: 220 },
      { x: 180, y: 180 },
    ]);
  });
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ from: 'e2', to: 'e4', source: 'drag' });
  activate('e4');
  expect(attempts).toHaveLength(1);
});

const props = {
  position: { id: 'p1', fen: startFen },
  orientation: 'w',
  policy: { mode: 'read-only' },
  presentation: { showDestinations: false, highlights: [], arrows: [] },
  onAttempt: () => {},
} satisfies BoardProps;
test('destination hints include only legal moves allowed by the current policy', () => {
  const attempts: MoveAttempt[] = [];
  const base = {
    ...props,
    presentation: { ...props.presentation, showDestinations: true },
    policy: {
      ...movable,
      moves: [
        { from: 'e2', to: 'e4' },
        { from: 'e2', to: 'e5' },
      ],
    },
    onAttempt: (attempt: MoveAttempt) => attempts.push(attempt),
  } satisfies BoardProps;
  const { rerender } = render(<Chessboard {...base} />);
  activate('e2');
  expect(screen.getByTestId('square-e4').props.accessibilityHint).toMatch(
    /Eligible destination/,
  );
  // e3 is legal chess, but excluded by the consumer; e5 is illegal chess.
  for (const square of ['e3', 'e5'])
    expect(
      screen.getByTestId(`square-${square}`).props.accessibilityHint,
    ).not.toMatch(/Eligible destination/);
  activate('e5');
  expect(attempts).toHaveLength(0);
  expect(
    screen.getByTestId('square-e2').props.accessibilityState.selected,
  ).toBe(false);
  activate('e2');
  rerender(
    <Chessboard
      {...base}
      policy={{ ...movable, moves: [{ from: 'e2', to: 'e3' }] }}
    />,
  );
  expect(screen.getByTestId('square-e3').props.accessibilityHint).toMatch(
    /Eligible destination/,
  );
  expect(screen.getByTestId('square-e4').props.accessibilityHint).not.toMatch(
    /Eligible destination/,
  );
});
test('consumer failure keeps submission locked and exposes the reset action', () => {
  const attempts: MoveAttempt[] = [];
  render(
    <Chessboard
      {...props}
      policy={movable}
      onRestorePosition={() => {}}
      onAttempt={(attempt) => {
        attempts.push(attempt);
        throw new Error('consumer failed');
      }}
    />,
  );
  activate('e2');
  activate('e4');
  activate('d2');
  activate('d4');
  expect(attempts).toHaveLength(1);
  expect(screen.getByRole('alert')).toHaveTextContent(/reset.*retry/i);
  expect(
    screen.getByRole('button', { name: 'Restore position' }),
  ).toBeOnTheScreen();
});

test('same-size layout relocation invalidates queued drag completion', async () => {
  const attempts: MoveAttempt[] = [];
  render(
    <Chessboard
      {...props}
      policy={movable}
      onAttempt={(a) => attempts.push(a)}
    />,
  );
  const board = screen.getByTestId('chessboard');
  fireEvent(board, 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  await act(async () => {
    await Promise.resolve();
  });
  act(() => {
    fireGestureHandler(getByGestureTestId('board-pan-p1'), [
      { x: 180, y: 260 },
      { x: 180, y: 220 },
      { x: 180, y: 180 },
    ]);
    fireEvent(board, 'layout', {
      nativeEvent: { layout: { width: 320, height: 320, x: 20, y: 0 } },
    });
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(attempts).toHaveLength(0);
});

test('outside promotion press cancels without changing confirmed position', () => {
  const attempts: MoveAttempt[] = [];
  render(
    <Chessboard
      {...props}
      position={{ id: 'promotion', fen: promotionFen }}
      policy={{ ...movable, moves: legalMoves(promotionFen) }}
      onAttempt={(a) => attempts.push(a)}
    />,
  );
  activate('a7');
  activate('a8');
  fireEvent.press(
    screen.getByRole('button', { name: 'Dismiss promotion picker' }),
  );
  expect(screen.queryByTestId('promotion-stack')).toBeNull();
  expect(screen.getByTestId('square-a7').props.accessibilityLabel).toMatch(
    /pawn/i,
  );
  expect(attempts).toHaveLength(0);
});

test('blocked and read-only boards expose all 64 square controls for exploration', () => {
  const attempts: MoveAttempt[] = [];
  const { rerender } = render(
    <Chessboard {...props} onAttempt={(a) => attempts.push(a)} />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(64);
  expect(
    screen.getByRole('button', { name: 'e7, Black pawn' }),
  ).toBeOnTheScreen();
  rerender(
    <Chessboard
      {...props}
      policy={{ ...movable, submissionEnabled: false }}
      onAttempt={(a) => attempts.push(a)}
    />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(64);
  activate('e2');
  activate('e4');
  expect(attempts).toHaveLength(0);
});
test('selecting shows no cancel button or status text, and tapping elsewhere deselects', () => {
  const attempts: MoveAttempt[] = [];
  render(
    <Chessboard
      {...props}
      policy={movable}
      onAttempt={(a) => attempts.push(a)}
    />,
  );
  activate('e2');
  expect(screen.queryByRole('button', { name: 'Cancel selection' })).toBeNull();
  expect(screen.queryByText('Selected e2. Choose a destination.')).toBeNull();
  activate('h5');
  activate('e4');
  expect(attempts).toHaveLength(0);
});

test.each(['cancel', 'choose'] as const)(
  'promotion %s requests native focus return once',
  (action) => {
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    render(
      <Chessboard
        {...props}
        position={{ id: 'promotion', fen: promotionFen }}
        policy={{ ...movable, moves: legalMoves(promotionFen) }}
      />,
    );
    activate('a7');
    activate('a8');
    focus.mockClear();
    fireEvent.press(
      screen.getByRole('button', {
        name: action === 'cancel' ? 'Cancel promotion' : 'Promote to knight',
      }),
    );
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    focus.mockRestore();
  },
);
test('feedback is announced once per identity and pending squares stay discoverable', () => {
  const speak = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {});
  const attempts: MoveAttempt[] = [];
  const base = {
    ...props,
    policy: movable,
    onAttempt: (a: MoveAttempt) => attempts.push(a),
  };
  const { rerender } = render(<Chessboard {...base} />);
  activate('e2');
  activate('e4');
  const attempt = attempts[0];
  if (!attempt) throw new Error('missing attempt');
  speak.mockClear();
  const pending = {
    ...attempt,
    outcome: 'pending' as const,
    message: 'Checking move',
  };
  rerender(<Chessboard {...base} feedback={pending} />);
  rerender(<Chessboard {...base} feedback={{ ...pending }} />);
  expect(screen.getAllByRole('button')).toHaveLength(64);
  expect(speak).toHaveBeenCalledTimes(1);
  rerender(
    <Chessboard
      {...base}
      feedback={{ ...pending, outcome: 'rejected', message: 'Try again' }}
    />,
  );
  expect(speak).toHaveBeenCalledTimes(2);
  rerender(
    <Chessboard
      {...base}
      feedback={{ ...pending, outcome: 'rejected', message: 'Try again' }}
    />,
  );
  expect(speak).toHaveBeenCalledTimes(2);
  speak.mockRestore();
});

test('Gesture Handler keyboard taps cannot duplicate the keyboard adapter', async () => {
  const attempts: MoveAttempt[] = [];
  render(
    <Chessboard
      {...props}
      policy={movable}
      onAttempt={(a) => attempts.push(a)}
    />,
  );
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  await act(async () => {
    await Promise.resolve();
  });
  activate('e2');
  await act(async () => {
    fireGestureHandler(getByGestureTestId('board-tap-p1'), [
      { x: 180, y: 180, pointerType: PointerType.KEY },
    ]);
  });
  expect(attempts).toHaveLength(0);
  expect(screen.getByTestId('square-e2')).toHaveProp('accessibilityState', {
    selected: true,
  });
});

test('native modal back dismisses promotion without submitting', () => {
  const attempts: MoveAttempt[] = [];
  const view = render(
    <Chessboard
      {...props}
      position={{ id: 'promotion', fen: promotionFen }}
      policy={{ ...movable, moves: legalMoves(promotionFen) }}
      onAttempt={(attempt) => attempts.push(attempt)}
    />,
  );
  activate('a7');
  activate('a8');
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(screen.queryByTestId('promotion-stack')).toBeNull();
  expect(attempts).toHaveLength(0);
});

test('resetting an open promotion returns focus once; passive updates do not', () => {
  const focus = jest
    .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
    .mockImplementation(() => {});
  const base = {
    ...props,
    position: { id: 'promotion', fen: promotionFen },
    policy: { ...movable, moves: legalMoves(promotionFen) },
  };
  const { rerender } = render(<Chessboard {...base} />);
  activate('a7');
  activate('a8');
  focus.mockClear();
  rerender(
    <Chessboard {...base} position={{ id: 'reset', fen: promotionFen }} />,
  );
  expect(screen.queryByTestId('promotion-stack')).toBeNull();
  expect(focus).toHaveBeenCalledTimes(1);
  focus.mockClear();
  rerender(
    <Chessboard {...base} position={{ id: 'passive', fen: promotionFen }} />,
  );
  expect(focus).not.toHaveBeenCalled();
  focus.mockRestore();
});

test('promotion capture preview shows only the provisional pawn at destination', () => {
  const fen = '1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1';
  render(
    <Chessboard
      {...props}
      position={{ id: 'capture-promotion', fen }}
      policy={{ ...movable, moves: legalMoves(fen) }}
    />,
  );
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  activate('a7');
  activate('b8');
  expect(
    screen.getAllByTestId('visual-piece-b8', { includeHiddenElements: true }),
  ).toHaveLength(1);
  fireEvent.press(screen.getByRole('button', { name: 'Cancel promotion' }));
  expect(
    screen.getAllByTestId('visual-piece-b8', { includeHiddenElements: true }),
  ).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: 'b8, Black rook' }),
  ).toBeOnTheScreen();
});

test('hint and correct feedback have square descriptions and clear with feature metadata', () => {
  const { rerender } = render(
    <Chessboard
      {...props}
      presentation={{
        ...props.presentation,
        hint: { square: 'e2' },
        correct: { square: 'e4', id: 'answer-1' },
      }}
    />,
  );
  expect(
    screen.getByTestId('square-e2', { includeHiddenElements: true }).props
      .accessibilityLabel,
  ).toContain('hint: piece to move');
  expect(
    screen.getByTestId('square-e4', { includeHiddenElements: true }).props
      .accessibilityLabel,
  ).toContain('correct answer');
  rerender(<Chessboard {...props} />);
  expect(
    screen.getByTestId('square-e2', { includeHiddenElements: true }).props
      .accessibilityLabel,
  ).not.toContain('hint:');
  expect(
    screen.getByTestId('square-e4', { includeHiddenElements: true }).props
      .accessibilityLabel,
  ).not.toContain('correct answer');
});

test('drawings on a read-only board keep feature annotations, never submit, and clear when a move is shown', async () => {
  const onAttempt = jest.fn();
  const base = {
    ...props,
    onAttempt,
    presentation: {
      ...props.presentation,
      highlights: [{ square: 'd4', tone: 'hint' }],
      arrows: [{ from: 'd2', to: 'd4', tone: 'best' }],
    },
  } satisfies BoardProps;
  const { rerender } = render(<Chessboard {...base} />);
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireGestureHandler(getByGestureTestId('board-draw-p1'), [
      { x: 140, y: 180 },
      { x: 180, y: 160 },
      { x: 220, y: 140 },
    ]);
  });
  expect(
    screen.getByTestId('arrow-d4-f5-analysis', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByTestId('arrow-body-d4-f5-analysis', {
      includeHiddenElements: true,
    }).props.d,
  ).toBe(
    // Right two, then up one: the outer mitre is the bend's lower right.
    'M3.86 4.61 5.61 4.61 5.61 3.86 5.76 3.86 5.5 3.5 5.24 3.86 5.39 3.86 5.39 4.39 3.86 4.39z',
  );
  rerender(<Chessboard {...base} orientation="b" />);
  expect(
    screen.getByTestId('arrow-body-d4-f5-analysis', {
      includeHiddenElements: true,
    }).props.d,
  ).toBe(
    // The same arrow turned half round with the board.
    'M4.14 3.39 2.39 3.39 2.39 4.14 2.24 4.14 2.5 4.5 2.76 4.14 2.61 4.14 2.61 3.61 4.14 3.61z',
  );
  expect(
    screen.getByTestId('arrow-d4-f5-analysis', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  // A move shown on the board clears the drawings; there is no button for it.
  rerender(
    <Chessboard
      {...base}
      orientation="b"
      position={{
        id: 'p2',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      }}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Clear drawings' })).toBeNull();
  expect(
    screen.queryByTestId('arrow-d4-f5-analysis', {
      includeHiddenElements: true,
    }),
  ).toBeNull();
  expect(
    screen.getByTestId('arrow-d2-d4-best', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(
    screen.getByTestId('highlight-d4-hint', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  expect(onAttempt).not.toHaveBeenCalled();
});

test('drawing while a move awaits confirmation cannot release the submission guard', async () => {
  const onAttempt = jest.fn();
  render(<Chessboard {...props} policy={movable} onAttempt={onAttempt} />);
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  activate('e2');
  activate('e4');
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireGestureHandler(getByGestureTestId('board-draw-p1'), [
      { x: 140, y: 260 },
      { x: 140, y: 220 },
      { x: 140, y: 180 },
    ]);
  });
  expect(
    screen.getByTestId('arrow-d2-d4-analysis', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  activate('d2');
  activate('d4');
  expect(onAttempt).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByTestId('arrow-d2-d4-analysis', {
      includeHiddenElements: true,
    }),
  ).toBeNull();
});
test('dragging a piece clears the drawings, though the position awaits confirmation', async () => {
  render(<Chessboard {...props} policy={movable} onAttempt={() => {}} />);
  fireEvent(screen.getByTestId('chessboard'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 320, x: 0, y: 0 } },
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    fireGestureHandler(getByGestureTestId('board-draw-p1'), [
      { x: 140, y: 260 },
      { x: 140, y: 220 },
      { x: 140, y: 180 },
    ]);
  });
  expect(
    screen.getByTestId('arrow-d2-d4-analysis', { includeHiddenElements: true }),
  ).toBeOnTheScreen();
  await act(async () => {
    fireGestureHandler(getByGestureTestId('board-pan-p1'), [
      { x: 180, y: 260 },
      { x: 180, y: 220 },
      { x: 180, y: 180 },
    ]);
  });
  expect(
    screen.queryByTestId('arrow-d2-d4-analysis', {
      includeHiddenElements: true,
    }),
  ).toBeNull();
});
