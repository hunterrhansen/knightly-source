import { parsePosition } from './position';

const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('plain position data', () => {
  test('parses the initial position into 32 coordinate-labelled pieces', () => {
    const result = parsePosition(start);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.turn).toBe('w');
    expect(result.value.pieces).toHaveLength(32);
    expect(result.value.pieces).toContainEqual({
      square: 'e1',
      color: 'w',
      kind: 'k',
    });
    expect(result.value.pieces).toContainEqual({
      square: 'b8',
      color: 'b',
      kind: 'n',
    });
  });
  test('returns the supplied side to move without retaining a chess instance', () => {
    expect(parsePosition('4k3/8/8/8/8/8/8/4K3 b - - 0 1')).toEqual({
      ok: true,
      value: {
        turn: 'b',
        pieces: [
          { square: 'e8', color: 'b', kind: 'k' },
          { square: 'e1', color: 'w', kind: 'k' },
        ],
      },
    });
  });
  test.each(['invalid', '', '8/8/8/8/8/8/8/8 w - - 0 1'])(
    'reports invalid FEN without throwing: %s',
    (fen) => {
      expect(parsePosition(fen)).toEqual({
        ok: false,
        message: expect.stringMatching(/position unavailable/i),
      });
    },
  );
});
