import { capturedBy } from './material';

test('the side that took a piece shows it and leads by its value', () => {
  // 1. e4 d5 2. exd5: White has taken a pawn.
  const fen = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
  expect(capturedBy(fen, 'w')).toEqual({ taken: ['p'], lead: 1 });
  expect(capturedBy(fen, 'b')).toEqual({ taken: [], lead: 0 });
});

test('trades show on both sides with no lead', () => {
  // Each side is missing a knight and a pawn.
  const fen = 'r1bqkbnr/ppp1pppp/8/8/8/8/PPPP1PPP/R1BQKBNR w KQkq - 0 5';
  expect(capturedBy(fen, 'w')).toEqual({ taken: ['p', 'n'], lead: 0 });
  expect(capturedBy(fen, 'b')).toEqual({ taken: ['p', 'n'], lead: 0 });
});

test('a promoted piece counts toward the lead', () => {
  // White's a-pawn took on b7 and a8 and promoted: Black has lost a pawn,
  // a knight and a rook; White plays on with two queens.
  const fen = 'Q1bqkbnr/p1pppppp/8/8/8/8/1PPPPPPP/RNBQKBNR b KQk - 0 9';
  expect(capturedBy(fen, 'w')).toEqual({ taken: ['p', 'n', 'r'], lead: 17 });
  expect(capturedBy(fen, 'b').lead).toBe(0);
});
