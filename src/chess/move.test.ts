import { Chess } from 'chess.js';
import {
  applyMove,
  describeMove,
  legalMoves,
  moveFromUci,
  playUci,
  uciOf,
} from './move';
import {
  captureFen,
  castleFen,
  enPassantFen,
  promotionFen,
  startFen,
} from './test-fixtures';

test('legal moves expose complete plain variants without chess instances', () => {
  expect(legalMoves(startFen)).toContainEqual({ from: 'e2', to: 'e4' });
  expect(legalMoves(promotionFen).filter((move) => move.to === 'a8')).toEqual(
    expect.arrayContaining(
      ['q', 'r', 'b', 'n'].map((promotion) => ({
        from: 'a7',
        to: 'a8',
        promotion,
      })),
    ),
  );
  expect(
    legalMoves(promotionFen).filter((move) => move.to === 'a8'),
  ).toHaveLength(4);
});
test('applying e2-e4 returns a new FEN and explicit pawn motion', () => {
  expect(applyMove(startFen, { from: 'e2', to: 'e4' })).toEqual({
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    motions: [{ from: 'e2', to: 'e4', color: 'w', kind: 'p' }],
  });
});
test.each([
  ['g1', 'h1', 'f1'],
  ['c1', 'a1', 'd1'],
] as const)(
  'castling to %s moves king and rook together',
  (to, rookFrom, rookTo) => {
    expect(applyMove(castleFen, { from: 'e1', to }).motions).toEqual([
      { from: 'e1', to, color: 'w', kind: 'k' },
      { from: rookFrom, to: rookTo, color: 'w', kind: 'r' },
    ]);
  },
);
test('black castling metadata uses the black home rank', () => {
  expect(
    applyMove(castleFen.replace(' w ', ' b '), { from: 'e8', to: 'c8' })
      .motions,
  ).toEqual([
    { from: 'e8', to: 'c8', color: 'b', kind: 'k' },
    { from: 'a8', to: 'd8', color: 'b', kind: 'r' },
  ]);
});
test('en passant identifies the captured square separately from destination', () => {
  expect(applyMove(enPassantFen, { from: 'e5', to: 'd6' })).toEqual({
    fen: '4k3/8/3P4/8/8/8/8/4K3 b - - 0 1',
    motions: [{ from: 'e5', to: 'd6', color: 'w', kind: 'p' }],
    capturedSquare: 'd5',
  });
});
test('ordinary capture identifies destination as captured square', () => {
  expect(applyMove(captureFen, { from: 'e2', to: 'd3' }).capturedSquare).toBe(
    'd3',
  );
});
test('underpromotion keeps the moving pawn and records its replacement', () => {
  expect(
    applyMove(promotionFen, { from: 'a7', to: 'a8', promotion: 'n' }),
  ).toEqual({
    fen: 'N3k3/8/8/8/8/8/8/4K3 b - - 0 1',
    motions: [{ from: 'a7', to: 'a8', color: 'w', kind: 'p', promotedTo: 'n' }],
  });
});
test.each([
  [startFen, { from: 'e2', to: 'e5' }],
  [startFen, { from: 'e2', to: 'e4', promotion: 'q' }],
  [promotionFen, { from: 'a7', to: 'a8' }],
] as const)('rejects illegal or incomplete move input', (fen, move) => {
  expect(() => applyMove(fen, move)).toThrow(/illegal move/i);
  expect(() => describeMove(fen, move)).toThrow(/illegal move/i);
});
test('invalid helper FEN throws a clear programming error', () => {
  expect(() => legalMoves('invalid')).toThrow(/invalid.*position/i);
});
test.each([
  [startFen, { from: 'e2', to: 'e4' }, 'White pawn from e2 to e4'],
  [castleFen, { from: 'e1', to: 'g1' }, 'White castles kingside'],
  [castleFen, { from: 'e1', to: 'c1' }, 'White castles queenside'],
  [
    enPassantFen,
    { from: 'e5', to: 'd6' },
    'White pawn from e5 to d6, captures black pawn on d5 en passant',
  ],
  [
    captureFen,
    { from: 'e2', to: 'd3' },
    'White pawn from e2 to d3, captures black pawn on d3',
  ],
  [
    promotionFen,
    { from: 'a7', to: 'a8', promotion: 'n' },
    'White pawn from a7 to a8, promotes to knight',
  ],
] as const)('describes moves in readable words', (fen, move, description) => {
  expect(describeMove(fen, move)).toBe(description);
});

test('UCI moves keep their promotion piece in both directions', () => {
  expect(moveFromUci('e2e4')).toEqual({ from: 'e2', to: 'e4' });
  expect(moveFromUci('a7a8n')).toEqual({
    from: 'a7',
    to: 'a8',
    promotion: 'n',
  });
  expect(uciOf({ from: 'a7', to: 'a8', promotion: 'n' })).toBe('a7a8n');
  const board = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  expect(playUci(board, 'a7a8n').san).toBe('a8=N');
  expect(() => playUci(board, 'e1e3')).toThrow();
});
