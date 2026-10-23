import { createApi } from './client';

const options = {
  baseUrl: 'https://api.example',
  getToken: async () => 'token',
  isCurrent: () => true,
};
test('rejects malformed real deck positions before they can reach the board', async () => {
  const api = createApi({
    ...options,
    fetcher: async () =>
      new Response(
        JSON.stringify({
          server_day: '2026-10-11',
          total: 1,
          mastered: 0,
          learning: 0,
          new: 1,
          today: { done: 0, total: 1 },
          results: [],
          card: {
            game_id: 1,
            ply: 1,
            reviews: 0,
            fen_before: 'invalid',
            color: 'white',
            san: 'e4',
            uci: 'e2e4',
            move_number: 1,
            classification: 'mistake',
            opponent: null,
          },
        }),
      ),
  });
  await expect(api.deck()).rejects.toMatchObject({ kind: 'invalid-response' });
});
test('answer writes use current authentication and never retry an ambiguous network failure', async () => {
  const seen: Request[] = [];
  const api = createApi({
    ...options,
    fetcher: async (input) => {
      seen.push(new Request(input));
      throw new TypeError('network');
    },
  });
  const body = {
    game_id: 4,
    ply: 5,
    uci: 'a7a8n',
    expected_day: '2026-10-11',
    hinted: false,
    redo: false,
  };
  await expect(api.answer(body)).rejects.toMatchObject({ kind: 'network' });
  expect(seen).toHaveLength(1);
  expect(seen[0]?.headers.get('Authorization')).toBe('Bearer token');
  expect(seen[0]?.method).toBe('POST');
  expect(await seen[0]?.json()).toEqual(body);
});
const respond = (body: unknown) =>
  createApi({
    ...options,
    fetcher: async () => new Response(JSON.stringify(body)),
  });
const solved = {
  status: 'solved',
  step: 1,
  correct: true,
  quality: 'best',
  rating: 'good',
  best_uci: 'c4f7',
  best_san: 'Qxf7',
  line: { uci: ['g5f7', 'f8f7', 'c4f7'], san: ['Nf7+', 'Rxf7', 'Qxf7'] },
  due: '2026-10-15',
  mastered: false,
};
const lineBody = {
  game_id: 4,
  ply: 5,
  moves: ['g5f7', 'f8f7', 'c4f7'],
  hinted: false,
  redo: false,
};
test('a finished line answer must be a consistent, complete line', async () => {
  await expect(respond(solved).answerLine(lineBody)).resolves.toEqual(solved);
  for (const broken of [
    { ...solved, line: { uci: ['g5f7', 'f8f7'], san: ['Nf7+', 'Rxf7'] } },
    { ...solved, line: { ...solved.line, san: ['Nf7+'] } },
    { ...solved, status: 'failed' },
    { ...solved, best_uci: 'g5f7' },
  ])
    await expect(respond(broken).answerLine(lineBody)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
});
test('a puzzle whose setup move does not lead to its position is rejected', async () => {
  const deck = {
    server_day: '2026-10-11',
    total: 0,
    mastered: 0,
    learning: 0,
    new: 0,
    today: { done: 0, total: 0 },
    results: [],
    card: null,
    puzzle: {
      id: 'abc12',
      fen_prev: 'r4rk1/6pp/8/6N1/2Q5/8/6PP/6K1 b - - 0 1',
      prev_uci: 'g8h8',
      fen_before: 'r4r1k/6pp/8/6N1/2Q5/8/6PP/6K1 w - - 1 2',
      color: 'white',
      themes: ['fork'],
      rating: 1350,
      line_key: '0123456789abcdef',
    },
  };
  await expect(respond(deck).deck()).resolves.toMatchObject({
    puzzle: { id: 'abc12' },
  });
  await expect(
    respond({ ...deck, puzzle: { ...deck.puzzle, prev_uci: 'g8f7' } }).deck(),
  ).rejects.toMatchObject({ kind: 'invalid-response' });
});
test('malformed coaching is dropped without rejecting the answer it came with', async () => {
  const reason = {
    reply_uci: 'f8f7',
    reply_san: 'Rxf7',
    reason_kind: 'material',
    reason_text: 'That drops your knight to Rxf7.',
  };
  const coached = {
    ...solved,
    explanation: reason,
    why: {
      why_kind: 'fork',
      why_text: 'Fork: the knight hits king and queen.',
    },
  };
  await expect(respond(coached).answerLine(lineBody)).resolves.toEqual(coached);
  await expect(
    respond({
      ...solved,
      explanation: { ...reason, reason_kind: 'invented' },
      why: { why_kind: 'fork', why_text: 'x'.repeat(500) },
    }).answerLine(lineBody),
  ).resolves.toMatchObject({ status: 'solved', explanation: null, why: null });
});
