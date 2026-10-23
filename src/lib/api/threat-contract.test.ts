import { threatItemSchema } from './threat-contract';

const FEN = 'rnbqkbnr/ppp1pppp/8/8/3pP3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 3';
const item = {
  game_id: 2,
  ply: 5,
  kind: 'threat',
  color: 'white',
  fen_before: FEN,
  prev_uci: 'd5d4',
  fen_prev: null,
  threats: [{ uci: 'd4c3', san: 'dxc3', line: ['d4c3'], net: 3, mate: null }],
  opponent: null,
  played_at: null,
  played_san: 'Bc4',
  best_san: null,
  grades: null,
};
const today = (overrides: object) => ({ ...item, ...overrides });

test('accepts a threat the opponent can play if you passed, and rejects ones they cannot', () => {
  expect(threatItemSchema.safeParse(today({})).success).toBe(true);
  // c3 to d4 is White's move, not a threat of Black's.
  const illegal = { threats: [{ ...item.threats[0], uci: 'c3d5' }] };
  expect(threatItemSchema.safeParse(today(illegal)).success).toBe(false);
  // A calm item has no threats; a threat item must have one.
  expect(threatItemSchema.safeParse(today({ kind: 'calm' })).success).toBe(
    false,
  );
  expect(threatItemSchema.safeParse(today({ threats: [] })).success).toBe(
    false,
  );
  // The learner must be the side to move.
  expect(threatItemSchema.safeParse(today({ color: 'black' })).success).toBe(
    false,
  );
});

test('accepts what your move allowed and a loose piece to take, each from its own board', () => {
  // Served by the backend since the allows and vision drills; rejecting them
  // failed the whole deck whenever one was the next question.
  const allows = today({
    kind: 'allows',
    // After White's a3??: Black to move, the c3 knight hanging.
    fen_before: '6k1/5ppp/5q2/8/7B/P1N5/5PPP/6K1 b - - 0 1',
    prev_uci: 'a2a3',
    fen_prev: '6k1/5ppp/5q2/8/7B/2N5/P4PPP/6K1 w - - 0 1',
    threats: [{ uci: 'f6c3', san: 'Qxc3', line: ['f6c3'], net: 3, mate: null }],
  });
  expect(threatItemSchema.safeParse(allows).success).toBe(true);
  // Their reply is a move from that board, not from one where they passed.
  expect(
    threatItemSchema.safeParse({
      ...allows,
      threats: [{ ...allows.threats[0], uci: 'c3d5' }],
    }).success,
  ).toBe(false);
  const vision = today({
    kind: 'vision',
    fen_before: '3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1',
    threats: [
      { uci: 'd1d8', san: 'Qxd8#', line: ['d1d8'], net: 5, mate: null },
    ],
  });
  expect(threatItemSchema.safeParse(vision).success).toBe(true);
  // Your capture: their pieces don't move on your turn.
  expect(
    threatItemSchema.safeParse({
      ...vision,
      threats: [{ ...vision.threats[0], uci: 'd8d1' }],
    }).success,
  ).toBe(false);
});
