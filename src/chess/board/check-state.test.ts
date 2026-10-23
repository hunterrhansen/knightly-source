import { Chess } from 'chess.js';
import { checkState } from './check-state';

const chess = new Chess();
for (const move of ['f3', 'e5', 'g4']) chess.move(move);
const before = chess.fen();
chess.move('Qh4#');
const mate = chess.fen();
test('mate identifies loser, winner and full checker path', () => {
  expect(checkState(mate)).toEqual({
    king: 'e1',
    path: ['h4', 'g3', 'f2'],
    winner: 'e8',
    loser: 'w',
    mate: true,
  });
  expect(checkState(before)).toBeUndefined();
  expect(checkState('invalid')).toBeUndefined();
});
test('knight checks tint only their source square', () => {
  expect(checkState('4k3/8/8/8/8/5n2/8/4K3 w - - 0 1')?.path).toEqual(['f3']);
});
