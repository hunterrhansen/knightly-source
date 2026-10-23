import { whyNotThreat } from './threat-why';

// Each position is the one the question is answered from: Black, the opponent,
// to move as if White passed.
describe('why a move is not their threat', () => {
  test('a capture that is taken straight back wins nothing', () => {
    // The f3 pawn guards the knight: Bxe4 fxe4 is a trade.
    expect(whyNotThreat('4k3/8/6b1/8/4N3/5P2/8/4K3 b - - 0 1', 'g6e4')).toBe(
      'Bxe4 is taken straight back: fxe4.',
    );
  });
  test('taking a loose pawn is below what counts as a threat', () => {
    expect(whyNotThreat('r3k3/8/8/8/8/8/P7/4K3 b - - 0 1', 'a8a2')).toBe(
      'Rxa2 only wins a pawn.',
    );
  });
  test('a pawn grab is not called "taken back" when taking back loses more', () => {
    // Qxd4 would hand the queen to exd4.
    expect(whyNotThreat('4k3/8/8/2p1p3/3P4/8/8/3QK3 b - - 0 1', 'c5d4')).toBe(
      'cxd4 only wins a pawn.',
    );
  });
  test('a check that wins nothing says so', () => {
    expect(whyNotThreat('r3k3/8/8/8/8/8/8/4K3 b - - 0 1', 'a8a1')).toBe(
      'Ra1+ is a check, but it wins nothing.',
    );
  });
  test('a capture that wins on the square but fails elsewhere is not called free', () => {
    expect(whyNotThreat('4k3/8/8/3q4/8/8/6N1/4K3 b - - 0 1', 'd5g2')).toBe(
      'Qxg2 looks like it wins material, but it walks into something worse for them.',
    );
  });
  test('a quiet move wins nothing yet', () => {
    expect(whyNotThreat('4k3/8/8/8/8/8/8/4K3 b - - 0 1', 'e8d7')).toBe(
      'Kd7 doesn’t win anything yet.',
    );
  });
});
