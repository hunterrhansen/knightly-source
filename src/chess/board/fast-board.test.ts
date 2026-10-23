import {
  coveredSquares,
  type FastBoard,
  type FastMove,
  predictTap,
} from './fast-board';

// Plain holders stand in for shared values: the logic uses `get`/`set`, the
// assertions read `.value`.
function held<T>(value: T) {
  const holder = {
    value,
    get: () => holder.value,
    set: (next: T) => {
      holder.value = next;
    },
  };
  return holder;
}
function board(
  moves: Record<string, Record<string, FastMove | null>>,
  occupied: Record<string, string>,
  selectable: string[],
): FastBoard {
  return {
    enabled: held(true),
    showDestinations: held(true),
    selected: held(''),
    dests: held<string[]>([]),
    captures: held<string[]>([]),
    moves: held(moves),
    occupied: held(occupied),
    selectable: held(selectable),
    travel: held(null),
    progress: held(1),
    sequence: held(0),
  } as unknown as FastBoard;
}

test('a tap selects with dots and rings, and the same tap clears it', () => {
  const fast = board(
    { e2: { e3: { duration: 180 }, d3: { duration: 180 } } },
    { e2: 'wp', d3: 'bp' },
    ['e2'],
  );
  predictTap(fast, 'e2');
  expect(fast.selected.value).toBe('e2');
  expect(fast.dests.value).toEqual(['e3']);
  expect(fast.captures.value).toEqual(['d3']);
  predictTap(fast, 'e2');
  expect(fast.selected.value).toBe('');
  expect(fast.dests.value).toEqual([]);
});

test('a legal destination slides at once; castling also slides the rook', () => {
  const fast = board(
    { e1: { g1: { duration: 180, rook: { from: 'h1', to: 'f1' } } } },
    { e1: 'wk', h1: 'wr' },
    ['e1', 'h1'],
  );
  predictTap(fast, 'e1');
  predictTap(fast, 'g1');
  expect(fast.travel.value?.motions).toEqual([
    { from: 'e1', to: 'g1', piece: 'wk' },
    { from: 'h1', to: 'f1', piece: 'wr' },
  ]);
  expect(fast.enabled.value).toBe(false);
  expect(coveredSquares(fast.travel.value).sort()).toEqual(
    ['e1', 'f1', 'g1', 'h1'].sort(),
  );
});

test('en passant covers the captured pawn', () => {
  const passant = board(
    { e5: { d6: { duration: 180, captured: 'd5' } } },
    { e5: 'wp', d5: 'bp' },
    ['e5'],
  );
  predictTap(passant, 'e5');
  predictTap(passant, 'd6');
  expect(coveredSquares(passant.travel.value)).toContain('d5');
});

test('a move that needs the promotion chooser, or a disabled board, never slides', () => {
  const chooser = board({ a7: { a8: null } }, { a7: 'wp' }, ['a7']);
  predictTap(chooser, 'a7');
  predictTap(chooser, 'a8');
  expect(chooser.travel.value).toBeNull();
  expect(chooser.selected.value).toBe('');
  const off = board({ e2: { e4: { duration: 180 } } }, { e2: 'wp' }, ['e2']);
  off.enabled.value = false;
  predictTap(off, 'e2');
  expect(off.selected.value).toBe('');
  // Every tap is still numbered, so JavaScript can tell when it has caught up.
  expect(off.sequence.value).toBe(1);
});
