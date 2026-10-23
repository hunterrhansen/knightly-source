import { createApi } from './client';
import { engineLinesSchema, gameDetailSchema } from './review-contract';

const game = {
  id: 7,
  white: 'Player',
  black: 'Opponent',
  color: 'white',
  analysed: false,
  start_fen: null,
  san: ['e4'],
  reviewed_at: null,
  review_marks: [],
  accuracy: null,
  deck_plies: [],
  plies: [],
};
test('a response for another game cannot enter the requested account review', async () => {
  const api = createApi({
    baseUrl: 'https://api.example',
    getToken: async () => 'token',
    isCurrent: () => true,
    fetcher: async () => new Response(JSON.stringify(game)),
  });
  await expect(api.game(8)).rejects.toMatchObject({ kind: 'invalid-response' });
});
test('invalid saved timestamps and illegal engine continuations are rejected', () => {
  expect(
    gameDetailSchema.safeParse({ ...game, reviewed_at: 'saved' }).success,
  ).toBe(false);
  expect(
    engineLinesSchema.safeParse({
      best: {
        start_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
        moves: ['e1f2'],
        summary: 'A line',
      },
    }).success,
  ).toBe(false);
});
test('Finish review sends exact marks with current auth and does not resend a lost response', async () => {
  const requests: Request[] = [];
  const api = createApi({
    baseUrl: 'https://api.example',
    getToken: async () => 'token',
    isCurrent: () => true,
    fetcher: async (input) => {
      requests.push(new Request(input));
      throw new TypeError('Disconnected');
    },
  });
  await expect(
    api.finishReview(7, { marks: [{ ply: 1, mark: 'missed' }] }),
  ).rejects.toMatchObject({ kind: 'network' });
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe('https://api.example/api/games/7/review');
  expect(requests[0]?.headers.get('Authorization')).toBe('Bearer token');
  expect(await requests[0]?.json()).toEqual({
    marks: [{ ply: 1, mark: 'missed' }],
  });
});
test('a game move keeps its cause and principle; an unreadable cause is dropped, not the move', () => {
  const ply = {
    ply: 1,
    color: 'white',
    san: 'e4',
    uci: 'e2e4',
    classification: 'blunder',
    best_san: 'd4',
    best_uci: 'd2d4',
    win_pct_before: 50,
    win_pct_after: 20,
    layer: 'theirThreat',
    cause: {
      cause_kind: 'missedThreat',
      cause_text:
        'They were already threatening dxe4. Your move didn’t stop it.',
      reply_uci: 'd5e4',
      reply_san: 'dxe4',
    },
    principle: 'blunderCheck',
  };
  const parsed = gameDetailSchema.parse({ ...game, plies: [ply] });
  expect(parsed.plies[0]?.cause?.cause_kind).toBe('missedThreat');
  expect(parsed.plies[0]?.principle).toBe('blunderCheck');
  const odd = gameDetailSchema.parse({
    ...game,
    plies: [{ ...ply, cause: { cause_kind: 'guess' }, principle: 'luck' }],
  });
  expect(odd.plies[0]).toMatchObject({
    san: 'e4',
    cause: null,
    principle: null,
  });
});

test("a game's stored lines keep every valid move and drop only an illegal one", async () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const api = createApi({
    baseUrl: 'https://api.example',
    getToken: async () => 'token',
    isCurrent: () => true,
    fetcher: async () =>
      new Response(
        JSON.stringify({
          '1': { best: { start_fen: start, moves: ['e2e4'], summary: null } },
          '2': { best: { start_fen: start, moves: ['e2e5'], summary: null } },
          next: { best: { start_fen: start, moves: ['d2d4'], summary: null } },
        }),
      ),
  });
  const lines = await api.gameLines(7);
  expect([...lines.keys()]).toEqual([1]);
  expect(lines.get(1)?.best?.moves).toEqual(['e2e4']);
});
