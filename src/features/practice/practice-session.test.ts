import { resolvePresentation } from '../../chess/board/transition';
import { ApiError } from '../../lib/api/api-error';
import type {
  Deck,
  PracticeCard,
  PracticeResult,
  PracticeStep,
} from '../../lib/api/practice-contract';
import type { ThreatAnswer } from '../../lib/api/threat-contract';
import { taughtAt } from '../today/today-api';
import { heldBoard, practiceBoard } from './practice-board';
import {
  ANSWER_TIMEOUT_MS,
  cardPrompt,
  PracticeSession,
  yourMoveVerdict,
} from './practice-session';

/** The board the screen shows for the session's state. */
const boardOf = (session: PracticeSession) =>
  practiceBoard(session.getSnapshot(), session);

const card = {
  game_id: 7,
  ply: 9,
  reviews: 0,
  fen_before: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
  color: 'white' as const,
  san: 'Re2',
  uci: 'e1e2',
  move_number: 5,
  classification: 'miss',
  opponent: 'Opponent',
  line_key: '0123456789abcdef',
};
const deck: Deck = {
  server_day: '2026-10-11',
  total: 1,
  mastered: 0,
  learning: 0,
  new: 1,
  today: { done: 0, total: 1 },
  card,
  results: [],
};
const correct: PracticeResult = {
  status: 'solved',
  step: 0,
  correct: true,
  quality: 'best',
  rating: 'good',
  best_uci: 'e1e8',
  best_san: 'Re8#',
  line: { uci: ['e1e8'], san: ['Re8#'] },
  due: '2026-10-15',
  mastered: false,
};
const wrong: PracticeResult = {
  ...correct,
  status: 'failed',
  correct: false,
  quality: 'wrong',
  rating: 'again',
};
/** Lets background saves and the prefetch after them settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function mockApi(deckValue: Deck = deck) {
  return {
    deck: jest.fn(async () => deckValue),
    extraWatch: jest.fn(async () => deckValue),
    answerLine: jest.fn(
      async (_body?: unknown, _signal?: AbortSignal): Promise<PracticeStep> =>
        correct,
    ),
    lineHint: jest.fn(async () => ({ best_uci: 'e1e8', from: 'e1' })),
    puzzleAnswer: jest.fn(
      async (_body?: unknown, _signal?: AbortSignal): Promise<PracticeStep> =>
        correct,
    ),
    puzzleHint: jest.fn(async () => ({ best_uci: 'e1e8', from: 'e1' })),
    unannouncedAnswer: jest.fn(
      async (_body?: unknown, _signal?: AbortSignal): Promise<PracticeStep> =>
        correct,
    ),
    threatAnswer: jest.fn(
      async (): Promise<ThreatAnswer> => ({
        correct: true,
        threats: [],
        rating: 'good',
        due: '2026-10-18',
      }),
    ),
  };
}
function setup() {
  let current = true;
  let clock = 1000;
  const api = mockApi();
  const saved = jest.fn();
  const session = new PracticeSession(
    api,
    () => current,
    undefined,
    () => clock,
    saved,
  );
  const move = (from = 'e1', to = 'e8') => ({
    from: from as 'e1',
    to: to as 'e8',
    source: 'activation' as const,
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'first',
  });
  return {
    api,
    session,
    saved,
    move,
    /** Time passing before the next press. */
    pause: (ms = 1000) => {
      clock += ms;
    },
    dispose: () => {
      current = false;
    },
  };
}
test('previews one attempt, blocks duplicate submissions and waits for a saved grade', async () => {
  const { api, session, move, saved } = setup();
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await session.load();
  const attempt = move();
  const pending = session.attempt(attempt);
  expect(boardOf(session)?.presentation.preview?.fen).toBe(
    '4R1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1',
  );
  expect(session.getSnapshot().message).toBe('Checking your move…');
  expect(saved).not.toHaveBeenCalled();
  await session.attempt(attempt);
  expect(api.answerLine).toHaveBeenCalledTimes(1);
  expect(api.answerLine).toHaveBeenCalledWith(
    expect.objectContaining({
      expected_day: '2026-10-11',
      game_id: 7,
      ply: 9,
      moves: ['e1e8'],
      line_key: '0123456789abcdef',
      hinted: false,
    }),
    expect.any(AbortSignal),
  );
  finish(correct);
  await pending;
  expect(session.getSnapshot().message).toBe('Found it! Progress saved.');
  expect(saved).toHaveBeenCalledTimes(1);
});
test('a miss retains its preview until explicit retry and rejects the old position identity', async () => {
  const { api, session, move } = setup();
  api.answerLine.mockResolvedValueOnce(wrong);
  await session.load();
  const old = move('e1', 'e2');
  await session.attempt(old);
  expect(boardOf(session)?.presentation.preview).toBeDefined();
  expect(boardOf(session)?.policy).toMatchObject({ submissionEnabled: false });
  session.retry();
  expect(boardOf(session)?.position.fen).toBe(card.fen_before);
  expect(boardOf(session)?.presentation.preview).toBeUndefined();
  expect(boardOf(session)?.position.id).not.toBe(old.positionId);
  await session.attempt(old);
  expect(api.answerLine).toHaveBeenCalledTimes(1);
});
test('a repeated Continue or Try again press does not reveal or hint the position that replaced it', async () => {
  // Continue and Try again sit over the bar's Hint and Solution: a second
  // press there must not mark the new position assisted before it is seen.
  let clock = 1000;
  const api = mockApi();
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => clock,
  );
  const move = (from = 'e1', to = 'e8') => ({
    from: from as 'e1',
    to: to as 'e8',
    source: 'activation' as const,
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: `${from}${to}`,
  });
  await session.load();
  await session.attempt(move());
  await session.next();
  clock += 300;
  await session.reveal();
  await session.hint();
  expect(session.getSnapshot().phase).toBe('ready');
  expect(session.getSnapshot().exercise?.hinted).toBe(false);
  expect(api.answerLine).toHaveBeenCalledTimes(1);
  api.answerLine.mockResolvedValueOnce(wrong);
  await session.attempt(move('e1', 'e2'));
  session.retry();
  clock += 300;
  await session.reveal();
  expect(session.getSnapshot().phase).toBe('ready');
  // A deliberate press a moment later still works.
  clock += 1000;
  await session.hint();
  expect(session.getSnapshot().exercise?.hintLevel).toBe(1);
  api.answerLine.mockResolvedValueOnce({ ...correct, quality: 'shown' });
  await session.reveal();
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ moves: ['0000'], hinted: true }),
    expect.any(AbortSignal),
  );
});
test('a lost first-answer response reconciles saved results without resending the mutation', async () => {
  const { api, session, move } = setup();
  await session.load();
  api.answerLine.mockRejectedValueOnce(new ApiError('network', 'Disconnected'));
  await session.attempt(move());
  session.retry();
  await session.reveal();
  await session.attempt(move());
  expect(session.getSnapshot().phase).toBe('uncertain');
  await session.checkSaved();
  expect(session.getSnapshot().phase).toBe('uncertain');
  api.deck.mockResolvedValue({
    ...deck,
    card: null,
    results: [
      {
        game_id: 7,
        ply: 9,
        correct: true,
        mark: 'found',
        san: 'Re2',
        opponent: 'Opponent',
      },
    ],
  });
  await session.checkSaved();
  expect(session.getSnapshot().phase).toBe('answered');
  expect(api.answerLine).toHaveBeenCalledTimes(1);
});
test('an unavailable hint does not penalize an unaided answer', async () => {
  const { api, session, move } = setup();
  await session.load();
  api.lineHint.mockRejectedValueOnce(
    new ApiError('network', 'Hint unavailable'),
  );
  await session.hint();
  expect(boardOf(session)?.presentation.hint).toBeUndefined();
  await session.attempt(move());
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ hinted: false }),
    expect.any(AbortSignal),
  );
  expect(session.getSnapshot().message).toBe('Found it! Progress saved.');
});
test('an existing result does not prove a lost retry response has committed', async () => {
  const { api, session, move } = setup();
  const prior: Deck = {
    ...deck,
    results: [
      {
        game_id: 7,
        ply: 9,
        correct: false,
        mark: 'missed',
        san: 'Re2',
        opponent: 'Opponent',
      },
    ],
  };
  api.deck.mockResolvedValue(prior);
  await session.load();
  api.answerLine.mockRejectedValueOnce(new ApiError('network', 'Disconnected'));
  await session.attempt(move());
  await session.checkSaved();
  expect(session.getSnapshot().phase).toBe('uncertain');
  expect(api.answerLine).toHaveBeenCalledTimes(1);
});
test('server day rollover invalidates the old position instead of replaying its answer', async () => {
  const { api, session, move } = setup();
  await session.load();
  api.answerLine.mockRejectedValueOnce(
    new ApiError('validation', 'New day', 409),
  );
  await session.attempt(move());
  expect(boardOf(session)).toBeUndefined();
  api.deck.mockResolvedValue({ ...deck, server_day: '2026-10-12' });
  await session.load();
  await session.attempt(move());
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ expected_day: '2026-10-12' }),
    expect.any(AbortSignal),
  );
});
test('account disposal prevents late grades from changing the visible session', async () => {
  const { api, session, move, dispose, saved } = setup();
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await session.load();
  const pending = session.attempt(move());
  dispose();
  finish(correct);
  await pending;
  expect(session.getSnapshot().phase).toBe('pending');
  expect(saved).not.toHaveBeenCalled();
});
test('a lost retry response stays uncertain despite its acknowledged first grade', async () => {
  const { api, session, move } = setup();
  await session.load();
  api.answerLine.mockResolvedValueOnce(wrong);
  await session.attempt(move('e1', 'e2'));
  session.retry();
  api.answerLine.mockRejectedValueOnce(new ApiError('network', 'Disconnected'));
  await session.attempt(move());
  api.deck.mockResolvedValue({
    ...deck,
    card: null,
    results: [
      {
        game_id: 7,
        ply: 9,
        correct: false,
        mark: 'missed',
        san: 'Re2',
        opponent: 'Opponent',
      },
    ],
  });
  await session.checkSaved();
  expect(session.getSnapshot().phase).toBe('uncertain');
  expect(api.answerLine).toHaveBeenCalledTimes(2);
});
test('promotion sends the chosen complete UCI', async () => {
  const { api, session } = setup();
  api.deck.mockResolvedValue({
    ...deck,
    card: { ...card, fen_before: '8/6P1/5KBk/8/8/8/8/8 w - - 0 1' },
  });
  api.answerLine.mockResolvedValue({
    ...correct,
    best_uci: 'g7g8n',
    best_san: 'g8=N#',
    line: { uci: ['g7g8n'], san: ['g8=N#'] },
  });
  await session.load();
  await session.attempt({
    from: 'g7',
    to: 'g8',
    promotion: 'n',
    source: 'activation',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'promotion',
  });
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ moves: ['g7g8n'] }),
    expect.any(AbortSignal),
  );
});

test('the opponent’s last move plays in before the position can be answered', async () => {
  const withSetup = {
    ...card,
    prev_uci: 'h8g8',
    fen_prev: '7k/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
  };
  const api = mockApi({ ...deck, card: withSetup });
  const pending: (() => void)[] = [];
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
    undefined,
    (_ms, run) => {
      pending.push(run);
      return () => {};
    },
  );
  await session.load();
  const before = boardOf(session);
  expect(before?.position.fen).toBe(withSetup.fen_prev);
  expect(before?.policy).toMatchObject({ submissionEnabled: false });
  await session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: before?.position.id ?? '',
    attemptId: 'early',
  });
  await session.hint();
  expect(api.answerLine).not.toHaveBeenCalled();
  expect(api.lineHint).not.toHaveBeenCalled();

  pending.shift()?.();
  const after = boardOf(session);
  expect(after?.position.fen).toBe(card.fen_before);
  expect(after?.presentation.transition).toMatchObject({
    reason: 'opponent',
    positionId: after?.position.id,
    motions: [expect.objectContaining({ from: 'h8', to: 'g8' })],
  });
  expect(after?.presentation.lastMove).toEqual({ from: 'h8', to: 'g8' });
  await session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: after?.position.id ?? '',
    attemptId: 'answer',
  });
  expect(api.answerLine).toHaveBeenCalledTimes(1);
  expect(boardOf(session)?.presentation).toMatchObject({
    correct: { square: 'e8', id: 'answer' },
    highlights: [
      { square: 'e1', tone: 'success' },
      { square: 'e8', tone: 'success' },
    ],
  });
  expect(boardOf(session)?.presentation.grade).toBeUndefined();
});

test('a setup move that does not lead to the card is skipped, not trusted', async () => {
  const api = mockApi({
    ...deck,
    card: {
      ...card,
      prev_uci: 'h8h7',
      fen_prev: '7k/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
    },
  });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  expect(boardOf(session)?.position.fen).toBe(card.fen_before);
  // Only the arrival morph between positions; no setup move is played.
  expect(boardOf(session)?.presentation.transition).toMatchObject({
    reason: 'morph',
    motions: [],
  });
});

// A three-move line: 1.Nf7+ Rxf7 2.Qxf7, from a position Black just entered.
const lineFen = 'r4r1k/6pp/8/6N1/2Q5/8/6PP/6K1 w - - 1 2';
const afterReply = 'r6k/5rpp/8/8/2Q5/8/6PP/6K1 w - - 0 3';
const lineCard = { ...card, fen_before: lineFen };
const solvedLine: PracticeResult = {
  ...correct,
  step: 1,
  best_uci: 'c4f7',
  best_san: 'Qxf7',
  line: { uci: ['g5f7', 'f8f7', 'c4f7'], san: ['Nf7+', 'Rxf7', 'Qxf7'] },
};
const continued: PracticeStep = {
  status: 'continue',
  step: 0,
  reply_uci: 'f8f7',
  reply_san: 'Rxf7',
};
function lineSetup(deckValue: Deck = { ...deck, card: lineCard }) {
  let current = true;
  let clock = 1000;
  const api = mockApi(deckValue);
  const timers: { ms: number; run: () => void }[] = [];
  const session = new PracticeSession(
    api,
    () => current,
    undefined,
    () => clock,
    undefined,
    (ms, run) => {
      timers.push({ ms, run });
      return () => {};
    },
  );
  const play = (from: string, to: string, attemptId = `${from}${to}`) =>
    session.attempt({
      from: from as 'g5',
      to: to as 'f7',
      source: 'activation',
      positionId: boardOf(session)?.position.id ?? '',
      attemptId,
    });
  return {
    api,
    session,
    timers,
    play,
    tick: (ms: number) => {
      clock += ms;
    },
    dispose: () => {
      current = false;
    },
  };
}
test('the opponent replies only after the server accepts the move, about 280 ms later', async () => {
  const { api, session, timers, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ moves: ['g5f7'], line_key: card.line_key }),
    expect.any(AbortSignal),
  );
  expect(session.getSnapshot().phase).toBe('replying');
  expect(boardOf(session)?.policy).toMatchObject({ submissionEnabled: false });
  expect(timers).toHaveLength(1);
  expect(timers[0]?.ms).toBe(280);
  await play('c4', 'f7');
  expect(api.answerLine).toHaveBeenCalledTimes(1);

  timers.shift()?.run();
  const board = boardOf(session);
  expect(board?.position.fen).toBe(afterReply);
  expect(board?.presentation.lastMove).toEqual({ from: 'f8', to: 'f7' });
  expect(board?.presentation.transition).toMatchObject({
    reason: 'opponent',
    positionId: board?.position.id,
    motions: [expect.objectContaining({ from: 'f8', to: 'f7' })],
  });
  api.answerLine.mockResolvedValueOnce(solvedLine);
  await play('c4', 'f7');
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ moves: ['g5f7', 'f8f7', 'c4f7'] }),
    expect.any(AbortSignal),
  );
  expect(session.getSnapshot()).toMatchObject({
    phase: 'answered',
    message: 'Found it! Progress saved.',
  });
});
test('a slow server response does not delay the reply further', async () => {
  const { api, session, timers, play, tick } = lineSetup();
  api.answerLine.mockImplementationOnce(async () => {
    tick(500);
    return continued;
  });
  await session.load();
  await play('g5', 'f7');
  expect(timers[0]?.ms).toBe(0);
});
test('a late reply after sign-out never changes the session', async () => {
  const { api, session, timers, play, dispose } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  dispose();
  timers.shift()?.run();
  expect(session.getSnapshot().phase).toBe('replying');
  expect(boardOf(session)?.position.fen).toBe(lineFen);
});
test('a wrong later move fails, and retry takes back only that move', async () => {
  const { api, session, timers, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  timers.shift()?.run();
  api.answerLine.mockResolvedValueOnce({
    ...solvedLine,
    status: 'failed',
    correct: false,
    quality: 'wrong',
    rating: 'again',
  });
  await play('c4', 'c8');
  expect(session.getSnapshot().phase).toBe('wrong');
  const failedId = boardOf(session)?.position.id;
  session.retry();
  const board = boardOf(session);
  expect(board?.position.fen).toBe(afterReply);
  expect(board?.position.id).not.toBe(failedId);
  expect(board?.presentation.preview).toBeUndefined();
  api.answerLine.mockResolvedValueOnce({ ...solvedLine, rating: null });
  await play('c4', 'f7');
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({ moves: ['g5f7', 'f8f7', 'c4f7'] }),
    expect.any(AbortSignal),
  );
  expect(session.getSnapshot().message).toBe(
    'Found it. Your original grade is unchanged.',
  );
});
test('show solution replays the whole line from the start, 800 ms a move, with input frozen', async () => {
  const { api, session, timers, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  timers.shift()?.run();
  api.answerLine.mockResolvedValueOnce({
    ...solvedLine,
    status: 'shown',
    correct: false,
    quality: 'shown',
    rating: 'again',
  });
  await session.reveal();
  expect(api.answerLine).toHaveBeenLastCalledWith(
    expect.objectContaining({
      moves: ['g5f7', 'f8f7', '0000'],
      hinted: true,
    }),
    expect.any(AbortSignal),
  );
  expect(session.getSnapshot().phase).toBe('revealing');
  expect(boardOf(session)?.position.fen).toBe(lineFen);
  expect(boardOf(session)?.policy).toMatchObject({ submissionEnabled: false });
  const fens = [];
  while (timers.length) {
    expect(timers[0]?.ms).toBe(800);
    timers.shift()?.run();
    fens.push(boardOf(session)?.position.fen);
  }
  expect(fens).toEqual([
    'r4r1k/5Npp/8/8/2Q5/8/6PP/6K1 b - - 2 2',
    afterReply,
    'r6k/5Qpp/8/8/8/8/6PP/6K1 b - - 0 3',
  ]);
  expect(session.getSnapshot().phase).toBe('answered');
});
test('after the answer, the line steps within its bounds', async () => {
  const { api, session, timers, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  timers.shift()?.run();
  api.answerLine.mockResolvedValueOnce(solvedLine);
  await play('c4', 'f7');
  session.step(1);
  expect(session.getSnapshot().exercise?.view).toBeUndefined();
  for (let i = 0; i < 5; i += 1) session.step(-1);
  expect(session.getSnapshot().exercise?.view).toBe(0);
  expect(boardOf(session)?.position.fen).toBe(lineFen);
  session.step(1);
  expect(boardOf(session)?.position.fen).toMatch(/^r4r1k\/5Npp\//);
  expect(boardOf(session)?.policy).toMatchObject({ submissionEnabled: false });
});
test('a lost mid-line response stays blocked and is never resent', async () => {
  const { api, session, timers, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  timers.shift()?.run();
  api.answerLine.mockRejectedValueOnce(new ApiError('network', 'Disconnected'));
  await play('c4', 'f7');
  expect(session.getSnapshot().phase).toBe('uncertain');
  await play('c4', 'f7', 'again');
  await session.checkSaved();
  expect(session.getSnapshot().phase).toBe('uncertain');
  expect(api.answerLine).toHaveBeenCalledTimes(2);
});
test.each([
  ['an illegal reply', { ...continued, reply_uci: 'a1a2' }],
  [
    'a line that does not replay',
    {
      ...solvedLine,
      step: 0,
      best_uci: 'g5g6',
      line: { uci: ['g5g6'], san: ['Ng6'] },
    },
  ],
])('%s is malformed success data, not a grade', async (_name, response) => {
  const { api, session, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(response as PracticeStep);
  await session.load();
  await play('g5', 'f7');
  expect(session.getSnapshot().phase).toBe('uncertain');
});
test('puzzles run through the same controller once the cards are done', async () => {
  const puzzle = {
    id: 'abc12',
    fen_prev: 'r4rk1/6pp/8/6N1/2Q5/8/6PP/6K1 b - - 0 1',
    prev_uci: 'g8h8',
    fen_before: lineFen,
    color: 'white' as const,
    themes: ['fork'],
    rating: 1350,
    line_key: 'fedcba9876543210',
  };
  const { api, session, timers, play } = lineSetup({
    ...deck,
    card: null,
    puzzle,
  });
  await session.load();
  timers.shift()?.run(); // the setup move
  api.puzzleAnswer.mockResolvedValueOnce(continued);
  await play('g5', 'f7');
  expect(api.puzzleAnswer).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: 'abc12',
      moves: ['g5f7'],
      line_key: 'fedcba9876543210',
    }),
    expect.any(AbortSignal),
  );
  timers.shift()?.run();
  await session.hint();
  expect(api.puzzleHint).toHaveBeenLastCalledWith({
    id: 'abc12',
    moves: ['g5f7', 'f8f7'],
    line_key: 'fedcba9876543210',
  });
  expect(api.answerLine).not.toHaveBeenCalled();
});
test('the daily lesson asks for the lesson deck and ends when the server says, even after a miss', async () => {
  const api = mockApi({
    ...deck,
    lesson: { done: 0, total: 1 },
  });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
    undefined,
    undefined,
    'lesson',
  );
  await session.load();
  expect(api.deck).toHaveBeenLastCalledWith(undefined, 'lesson');
  // An assisted answer: the lesson does not bring it back.
  await session.hint();
  await session.hint();
  api.deck.mockResolvedValue({
    ...deck,
    card: null,
    today: { done: 1, total: 1 },
    lesson: { done: 1, total: 1 },
  });
  api.answerLine.mockResolvedValueOnce({ ...correct, rating: 'again' });
  await session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'first',
  });
  await session.next();
  expect(session.getSnapshot()).toMatchObject({
    phase: 'complete',
    message: 'Lesson complete',
  });
});
test('an extra watch starts on the server, continues from the extra deck and ends when the server says, even after a miss', async () => {
  const api = mockApi({ ...deck, extra: { done: 0, total: 1, kept: 0 } });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
    undefined,
    undefined,
    'extra',
  );
  await session.load();
  expect(api.extraWatch).toHaveBeenCalledTimes(1);
  expect(api.deck).not.toHaveBeenCalled();
  // A miss: an extra watch, like the lesson, does not bring it back.
  await session.hint();
  await session.hint();
  api.deck.mockResolvedValue({
    ...deck,
    card: null,
    extra: { done: 1, total: 1, kept: 1 },
  });
  api.answerLine.mockResolvedValueOnce({ ...correct, rating: 'again' });
  await session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'first',
  });
  await session.next();
  expect(api.deck).toHaveBeenLastCalledWith(undefined, 'extra');
  expect(session.getSnapshot()).toMatchObject({
    phase: 'complete',
    message: 'Extra watch complete',
  });
  // Opening it again once finished starts the next extra watch.
  await session.load();
  expect(api.extraWatch).toHaveBeenCalledTimes(2);
});
test('the combo counts clean answers in a row and resets after a miss, a hint or a shown line', async () => {
  const { api, session, move, pause } = setup();
  await session.load();
  const combo = () => session.getSnapshot().combo ?? 0;
  const answer = async () => {
    await session.attempt(move());
    await session.next();
  };
  await answer();
  expect(combo()).toBe(1);
  await answer();
  expect(combo()).toBe(2);
  // A miss resets it, and finding the move on retry does not restore it.
  api.answerLine.mockResolvedValueOnce(wrong);
  await session.attempt(move('e1', 'e2'));
  expect(combo()).toBe(0);
  session.retry();
  await session.attempt(move());
  expect(combo()).toBe(0);
  await session.next();
  await answer();
  expect(combo()).toBe(1);
  // An answer found with a hint is not clean.
  pause();
  await session.hint();
  await session.attempt(move());
  expect(combo()).toBe(0);
  await session.next();
  await answer();
  expect(combo()).toBe(1);
  // Showing the solution is not clean either.
  api.answerLine.mockResolvedValueOnce({ ...correct, quality: 'shown' });
  pause();
  await session.reveal();
  expect(combo()).toBe(0);
});
test('points: 10 for a first try, 5 with help or on a retry, nothing for a shown line', async () => {
  const { api, session, move, pause } = setup();
  await session.load();
  const points = () => session.getSnapshot().points ?? 0;
  const answer = async () => {
    await session.attempt(move());
    await session.next();
  };
  await answer();
  expect(points()).toBe(10);
  // The shard takes off from the square the move landed on.
  expect(session.getSnapshot().award).toMatchObject({ base: 10, bonus: 0 });
  expect(session.getSnapshot().award?.square).toMatch(/^[a-h][1-8]$/);
  await answer();
  expect(points()).toBe(20);
  // A miss earns nothing; finding it on the retry earns half.
  api.answerLine.mockResolvedValueOnce(wrong);
  await session.attempt(move('e1', 'e2'));
  expect(points()).toBe(20);
  session.retry();
  await session.attempt(move());
  expect(points()).toBe(25);
  await session.next();
  // A hint also earns half.
  pause();
  await session.hint();
  await session.attempt(move());
  expect(points()).toBe(30);
  await session.next();
  // A shown solution earns nothing, and points never go down.
  api.answerLine.mockResolvedValueOnce({ ...correct, quality: 'shown' });
  pause();
  await session.reveal();
  expect(points()).toBe(30);
});
test('the board held while the next position loads is accepted, not shown as unavailable', async () => {
  const { session, move } = setup();
  await session.load();
  await session.attempt(move());
  const answered = boardOf(session);
  if (!answered) throw new Error('No board');
  expect(answered.presentation.preview).toBeDefined();
  const held = heldBoard(answered);
  expect(resolvePresentation(held)).toMatchObject({
    ok: true,
    position: { fen: answered.presentation.preview?.fen },
  });
});
test('the next position arrives with a morph from the board before it', async () => {
  const { session, move } = setup();
  await session.load();
  await session.attempt(move());
  await session.next();
  const board = boardOf(session);
  expect(board?.presentation.transition).toMatchObject({
    reason: 'morph',
    positionId: board?.position.id,
  });
});
test('a card shows the move played in the game as a red arrow until the next attempt', async () => {
  const { session, move } = setup();
  await session.load();
  expect(boardOf(session)?.presentation.arrows).toEqual([
    expect.objectContaining({ from: 'e1', to: 'e2', tone: 'danger' }),
  ]);
  await session.attempt(move());
  expect(boardOf(session)?.presentation.arrows).toEqual([]);
});
function setupServed(feedback: PracticeCard['feedback'] = null) {
  let current = true;
  const api = mockApi({
    ...deck,
    card: { ...card, line: ['e1e8'], feedback },
  });
  const saved = jest.fn();
  const session = new PracticeSession(
    api,
    () => current,
    undefined,
    () => 1000,
    saved,
  );
  const move = (from = 'e1', to = 'e8') => ({
    from: from as 'e1',
    to: to as 'e8',
    source: 'activation' as const,
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'first',
  });
  return { api, session, saved, move, dispose: () => (current = false) };
}
test('with a served solution, the verdict shows at once and the answer saves in the background', async () => {
  const { api, session, move, saved } = setupServed();
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  await session.load();
  void session.attempt(move());
  // Solved before the server has answered.
  expect(session.getSnapshot().phase).toBe('answered');
  expect(session.getSnapshot().message).toBe('Found it! Progress saved.');
  await Promise.resolve();
  expect(api.answerLine).toHaveBeenCalledWith(
    expect.objectContaining({ moves: ['e1e8'], hinted: false }),
    expect.any(AbortSignal),
  );
  expect(saved).not.toHaveBeenCalled();
  finish(correct);
  await session.next();
  expect(saved).toHaveBeenCalledTimes(1);
  expect(api.answerLine).toHaveBeenCalledTimes(1);
});
test('hints come from the served solution without a request', async () => {
  const { api, session } = setupServed();
  await session.load();
  await session.hint();
  expect(session.getSnapshot().exercise?.hint).toBe('e1e8');
  expect(api.lineHint).not.toHaveBeenCalled();
});
test('the server’s verdict replaces a provisional one it disagrees with', async () => {
  const { api, session, move } = setupServed({
    grades: { e1e2: 'excellent' },
    complete: false,
  });
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  await session.load();
  await session.attempt(move('e1', 'e2'));
  expect(session.getSnapshot().phase).toBe('answered');
  finish({ ...wrong, best_uci: 'e1e8' });
  await session.next();
  expect(session.getSnapshot().phase).toBe('wrong');
});
test('Continue waits for the save; a lost save shows recovery and is never resent', async () => {
  const { api, session, move } = setupServed();
  api.answerLine.mockRejectedValueOnce(new Error('offline'));
  await session.load();
  await session.attempt(move());
  await session.next();
  expect(session.getSnapshot().phase).toBe('uncertain');
  expect(api.answerLine).toHaveBeenCalledTimes(1);
  expect(api.deck).toHaveBeenCalledTimes(1);
});
test('a first move the grade map lacks is graded by the server, as before', async () => {
  const { api, session, move } = setupServed({ grades: {}, complete: false });
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  await session.load();
  const pending = session.attempt(move('e1', 'e2'));
  expect(session.getSnapshot().phase).toBe('pending');
  finish(wrong);
  await pending;
  expect(session.getSnapshot().phase).toBe('wrong');
});
test('after a save, Continue opens the next position from a prefetched deck', async () => {
  const { api, session, move } = setupServed();
  await session.load();
  await session.attempt(move());
  await flush();
  const phases: string[] = [];
  session.subscribe(() => phases.push(session.getSnapshot().phase));
  await session.next();
  // One load at the start, one prefetch after the save; Continue used it
  // straight away, with no loading frame between the two positions.
  expect(api.deck).toHaveBeenCalledTimes(2);
  expect(phases).not.toContain('loading');
  expect(session.getSnapshot().phase).toBe('ready');
});
test('a server-graded answer also prefetches the next deck once saved', async () => {
  // No served solution: the server grades the move.
  const { api, session, move } = setup();
  await session.load();
  await session.attempt(move());
  expect(api.answerLine).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot().phase).toBe('answered');
  await flush();
  const phases: string[] = [];
  session.subscribe(() => phases.push(session.getSnapshot().phase));
  await session.next();
  expect(api.deck).toHaveBeenCalledTimes(2);
  expect(phases).not.toContain('loading');
  expect(session.getSnapshot().phase).toBe('ready');
});

// Coaching (issue #88): a wrong first move gets the punishing reply, then why.
const explained = {
  reply_uci: 'g8f8',
  reply_san: 'Kf8',
  reason_kind: 'eval' as const,
  reason_text: 'That lets them take over after Kf8.',
};
function coachedSetup(
  feedback: PracticeCard['feedback'] = {
    grades: { e1e8: 'best', e1e2: 'wrong' },
    complete: false,
    explanations: { e1e2: explained },
    why: { why_kind: 'mate', why_text: 'Checkmate.' },
  },
) {
  let current = true;
  const api = mockApi({ ...deck, card: { ...card, line: ['e1e8'], feedback } });
  api.answerLine.mockResolvedValue(wrong);
  const timers: { ms: number; run: () => void }[] = [];
  const session = new PracticeSession(
    api,
    () => current,
    undefined,
    () => 1000,
    undefined,
    (ms, run) => {
      timers.push({ ms, run });
      return () => {};
    },
  );
  const move = (from = 'e1', to = 'e2') =>
    session.attempt({
      from: from as 'e1',
      to: to as 'e2',
      source: 'activation',
      positionId: boardOf(session)?.position.id ?? '',
      attemptId: `${from}${to}`,
    });
  return { api, session, timers, move, dispose: () => (current = false) };
}
test('a wrong first move plays the punishing reply about 280 ms later, then says why', async () => {
  const { session, timers, move } = coachedSetup();
  await session.load();
  await move();
  // The wrong move stays on the board; no verdict until the reply has played.
  expect(session.getSnapshot().phase).toBe('refuting');
  expect(boardOf(session)?.presentation.preview).toBeDefined();
  expect(timers[0]?.ms).toBe(280);
  timers.shift()?.run();
  expect(session.getSnapshot()).toMatchObject({
    phase: 'wrong',
    message: 'That lets them take over after Kf8.',
  });
  const board = boardOf(session);
  expect(board?.position.fen).toBe('5k2/5ppp/8/8/8/8/4RPPP/6K1 w - - 2 2');
  expect(board?.presentation.lastMove).toEqual({ from: 'g8', to: 'f8' });
  expect(board?.presentation.transition).toMatchObject({
    reason: 'opponent',
    positionId: board?.position.id,
    motions: [expect.objectContaining({ from: 'g8', to: 'f8' })],
  });
  expect(board?.policy).toMatchObject({ moves: [] });
  // Try again takes back the wrong move and the reply.
  session.retry();
  expect(boardOf(session)?.position.fen).toBe(card.fen_before);
  expect(session.getSnapshot().phase).toBe('ready');
});
test('a reply still playing after sign-out never changes the session', async () => {
  const { session, timers, move, dispose } = coachedSetup();
  await session.load();
  await move();
  dispose();
  timers.shift()?.run();
  expect(session.getSnapshot().phase).toBe('refuting');
  expect(boardOf(session)?.position.fen).toBe(card.fen_before);
});
test('an explanation whose reply is illegal here is dropped for the plain verdict', async () => {
  const { session, timers, move } = coachedSetup({
    grades: { e1e8: 'best', e1e2: 'wrong' },
    complete: false,
    explanations: {
      e1e2: { ...explained, reply_uci: 'a1a2', reply_san: 'Ra2' },
    },
  });
  await session.load();
  await move();
  expect(timers).toHaveLength(0);
  expect(session.getSnapshot()).toMatchObject({
    phase: 'wrong',
    message:
      'Your first attempt is saved. Try again, with a hint if you need one.',
  });
});
test('a solved answer carries the solution’s why', async () => {
  const { api, session, move } = coachedSetup();
  api.answerLine.mockResolvedValue(correct);
  await session.load();
  await move('e1', 'e8');
  expect(session.getSnapshot().phase).toBe('answered');
  expect(session.getSnapshot().exercise?.why).toBe('Checkmate.');
});
// Blunder causes: why the learner missed it, the habit, and the top moves.
const caused = {
  ...explained,
  cause: {
    cause_kind: 'loosePiece' as const,
    cause_text: 'Your rook on e2 has no defender there, so Kf8 takes it.',
    principle: 'loosePieces' as const,
  },
};
const [bestMove, otherMove] = [
  {
    uci: 'e1e8',
    san: 'Re8#',
    line: ['e1e8'],
    score_cp: 100000,
    mate: 1,
    reason_kind: 'mate',
    reason_text: 'Checkmate.',
    about_equal: false,
  },
  {
    uci: 'g1f1',
    san: 'Kf1',
    line: ['g1f1'],
    score_cp: 0,
    mate: null,
    reason_kind: 'eval',
    reason_text: 'Keeps it level (0.0).',
    about_equal: false,
  },
];
const topMoves = [bestMove, otherMove];
test('a cause replaces the reason in the bubble and names the habit', async () => {
  const { session, timers, move } = coachedSetup({
    grades: { e1e8: 'best', e1e2: 'wrong' },
    complete: false,
    explanations: { e1e2: caused },
    candidates: topMoves,
  });
  await session.load();
  await move();
  timers.shift()?.run();
  expect(session.getSnapshot()).toMatchObject({
    phase: 'wrong',
    message: 'Your rook on e2 has no defender there, so Kf8 takes it.',
  });
  expect(session.getSnapshot().exercise?.principle).toBe('loosePieces');
  // The top moves would give the answer away: not shown after a miss…
  expect(session.getSnapshot().exercise?.candidates).toBeUndefined();
  // …but they come with the solution.
  await session.reveal();
  expect(session.getSnapshot().exercise?.candidates?.map((c) => c.san)).toEqual(
    ['Re8#', 'Kf1'],
  );
});
test('the top moves appear once the position is solved, and only legal ones', async () => {
  const { api, session, move } = coachedSetup({
    grades: { e1e8: 'best', e1e2: 'wrong' },
    complete: false,
    candidates: topMoves,
  });
  api.answerLine.mockResolvedValue(correct);
  await session.load();
  expect(session.getSnapshot().exercise?.candidates).toBeUndefined();
  await move('e1', 'e8');
  expect(session.getSnapshot().exercise?.candidates?.map((c) => c.san)).toEqual(
    ['Re8#', 'Kf1'],
  );

  // A candidate that names the wrong SAN is dropped; one left is no comparison.
  const bad = coachedSetup({
    grades: { e1e8: 'best', e1e2: 'wrong' },
    complete: false,
    candidates: [bestMove, { ...otherMove, san: 'Kh1' }],
  });
  bad.api.answerLine.mockResolvedValue(correct);
  await bad.session.load();
  await bad.move('e1', 'e8');
  expect(bad.session.getSnapshot().exercise?.candidates).toBeUndefined();
});
test('tapping a top move plays its line on the board, 800 ms a move, and Line puts the solution back', async () => {
  const kingWalk = { ...otherMove, line: ['g1f1', 'g8f8', 'f1e2'] };
  const { api, session, timers, move } = coachedSetup({
    grades: { e1e8: 'best', e1e2: 'wrong' },
    complete: false,
    candidates: [bestMove, kingWalk],
  });
  api.answerLine.mockResolvedValue(correct);
  await session.load();
  await move('e1', 'e8');
  timers.length = 0;
  const placement = () => boardOf(session)?.position.fen.split(' ')[0];
  const solved = placement();

  session.playCandidate('g1f1');
  expect(placement()).toBe('6k1/5ppp/8/8/8/8/5PPP/4R1K1');
  const shown: (string | undefined)[] = [];
  while (timers.length) {
    const next = timers.shift();
    expect(next?.ms).toBe(800);
    next?.run();
    shown.push(placement());
  }
  expect(shown).toEqual([
    '6k1/5ppp/8/8/8/8/5PPP/4RK2',
    '5k2/5ppp/8/8/8/8/5PPP/4RK2',
    '5k2/5ppp/8/8/8/8/4KPPP/4R3',
  ]);
  expect(boardOf(session)?.presentation.lastMove).toEqual({
    from: 'f1',
    to: 'e2',
  });

  // Back to the line mid-play: the solution returns and the line stops.
  session.playCandidate('g1f1');
  session.playCandidate(undefined);
  expect(placement()).toBe(solved);
  timers.shift()?.run();
  expect(placement()).toBe(solved);
  expect(session.getSnapshot().phase).toBe('answered');
});
test('a wrong later move in a line keeps the plain verdict', async () => {
  const { api, session, timers, play } = lineSetup();
  api.answerLine.mockResolvedValueOnce(continued);
  await session.load();
  await play('g5', 'f7');
  timers.shift()?.run();
  api.answerLine.mockResolvedValueOnce({
    ...solvedLine,
    status: 'failed',
    correct: false,
    quality: 'wrong',
    rating: 'again',
    explanation: { ...explained, reply_uci: 'a8c8', reply_san: 'Rxc8' },
  });
  await play('c4', 'c8');
  expect(timers).toHaveLength(0);
  expect(session.getSnapshot().phase).toBe('wrong');
  expect(session.getSnapshot().message).not.toContain('Kf8');
});

const threatened = {
  ...card,
  threat: {
    threats: [{ uci: 'g7g6', san: 'g6', line: ['g7g6'], net: 3, mate: null }],
  },
};
test('a card that ignored a threat asks what they threaten first, then for the move', async () => {
  const api = mockApi({ ...deck, card: threatened });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  expect(session.getSnapshot().phase).toBe('threat');
  // The position if you passed: their pieces move.
  const asked = boardOf(session);
  expect(asked?.position.fen.split(' ')[1]).toBe('b');
  expect(asked?.policy).toMatchObject({ mode: 'movable', sides: ['b'] });
  await session.attempt({
    from: 'g7',
    to: 'g6',
    source: 'activation',
    positionId: asked?.position.id ?? '',
    attemptId: 'threat',
  });
  expect(session.getSnapshot()).toMatchObject({
    phase: 'threat-shown',
    message: 'Yes: g6 wins a piece.',
  });
  // Spotting it sounds and badges like a solved puzzle.
  expect(boardOf(session)?.presentation.correct).toMatchObject({
    square: 'g6',
  });
  expect(api.threatAnswer).toHaveBeenCalledWith(
    expect.objectContaining({
      game_id: 7,
      ply: 9,
      answer: 'g7g6',
      expected_day: '2026-10-11',
    }),
  );
  expect(api.answerLine).not.toHaveBeenCalled();
  expect(boardOf(session)?.presentation.arrows).toEqual([
    { from: 'g7', to: 'g6', tone: 'danger' },
  ]);
  // A card can't be skipped past its move.
  await session.next();
  expect(session.getSnapshot().phase).toBe('threat-shown');
  session.findMove();
  expect(session.getSnapshot().phase).toBe('ready');
  const board = boardOf(session);
  expect(board?.position.fen).toBe(card.fen_before);
  expect(board?.policy).toMatchObject({ sides: ['w'] });
  await session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: board?.position.id ?? '',
    attemptId: 'move',
  });
  expect(api.answerLine).toHaveBeenCalledTimes(1);
});

test('a calm position asked on its own: No threat is right, and Continue moves on once saved', async () => {
  const calm = {
    game_id: 3,
    ply: 4,
    kind: 'calm' as const,
    color: 'white' as const,
    fen_before: card.fen_before,
    prev_uci: null,
    fen_prev: null,
    threats: [],
    opponent: 'Opp',
    played_at: null,
    played_san: 'Kh1',
    best_san: null,
    grades: null,
  };
  const api = mockApi({ ...deck, card: null, threat_item: calm });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  expect(session.getSnapshot().phase).toBe('threat');
  session.answerThreat('none');
  expect(session.getSnapshot()).toMatchObject({
    phase: 'threat-shown',
    message: 'Right: nothing is threatened here.',
  });
  // A right "No threat" sounds like any right answer, with no square to badge.
  const right = boardOf(session)?.presentation.correct;
  expect(right?.id).toBeDefined();
  expect(right?.square).toBeUndefined();
  // No move of yours to find on a calm position.
  session.findMove();
  expect(session.getSnapshot().phase).toBe('threat-shown');
  api.deck.mockResolvedValueOnce({ ...deck, card: null, threat_item: null });
  await flush();
  const phases: string[] = [];
  session.subscribe(() => phases.push(session.getSnapshot().phase));
  await session.next();
  expect(session.getSnapshot().phase).toBe('complete');
  expect(api.threatAnswer).toHaveBeenCalledTimes(1);
  // The deck was fetched once the answer saved: Continue didn't wait for it.
  expect(api.deck).toHaveBeenCalledTimes(2);
  expect(phases).not.toContain('loading');
});

test('a wrong move says why it is not the threat before naming the threat', async () => {
  const api = mockApi({ ...deck, card: threatened });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  session.answerThreat('h7h6');
  expect(session.getSnapshot()).toMatchObject({
    phase: 'threat-shown',
    message: 'h6 doesn’t win anything yet. Their threat: g6 wins a piece.',
  });
});
const question = {
  game_id: 3,
  ply: 4,
  color: 'white' as const,
  prev_uci: null,
  fen_prev: null,
  opponent: 'Opp',
  played_at: null,
  best_san: null,
  grades: null,
};
test('what your move allowed is answered with their reply from after your move', async () => {
  const allows = {
    ...question,
    kind: 'allows' as const,
    // After White's a3??, the c3 knight and h4 bishop are loose.
    fen_before: '6k1/5ppp/5q2/8/7B/P1N5/5PPP/6K1 b - - 0 1',
    played_san: 'a3',
    threats: [{ uci: 'f6c3', san: 'Qxc3', line: ['f6c3'], net: 3, mate: null }],
  };
  const api = mockApi({ ...deck, card: null, threat_item: allows });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  expect(session.getSnapshot()).toMatchObject({
    phase: 'threat',
    message: 'What did your move allow?',
  });
  // Their turn on the real board: nobody passes.
  const asked = boardOf(session);
  expect(asked?.position.fen).toBe(allows.fen_before);
  expect(asked?.policy).toMatchObject({ mode: 'movable', sides: ['b'] });
  session.answerThreat('g8f8');
  expect(session.getSnapshot().message).toBe(
    'Kf8 doesn’t win anything yet. Their reply: Qxc3 wins a piece.',
  );
  expect(api.threatAnswer).toHaveBeenCalledWith(
    expect.objectContaining({ answer: 'g8f8' }),
  );
});
test('a loose piece is taken with your own move and shown as the best move', async () => {
  const vision = {
    ...question,
    kind: 'vision' as const,
    fen_before: '3r3k/5ppp/8/8/8/8/5PPP/3Q3K w - - 0 1',
    played_san: 'Qa1',
    threats: [
      { uci: 'd1d8', san: 'Qxd8#', line: ['d1d8'], net: 5, mate: null },
    ],
  };
  const api = mockApi({ ...deck, card: null, threat_item: vision });
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  expect(session.getSnapshot().message).toBe('Something is loose');
  const asked = boardOf(session);
  expect(asked?.position.fen).toBe(vision.fen_before);
  expect(asked?.policy).toMatchObject({ mode: 'movable', sides: ['w'] });
  session.answerThreat('d1a1');
  expect(session.getSnapshot().message).toBe('Missed: Qxd8# is mate.');
  expect(boardOf(session)?.presentation.arrows).toEqual([
    expect.objectContaining({ from: 'd1', to: 'd8', tone: 'best' }),
  ]);
});
test('a missed threat is shown and a failed save says the position will come back', async () => {
  const api = mockApi({ ...deck, card: threatened });
  api.threatAnswer.mockRejectedValueOnce(new Error('offline'));
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  session.answerThreat('none');
  expect(session.getSnapshot().message).toBe('Missed: g6 wins a piece.');
  expect(boardOf(session)?.presentation.correct).toBeUndefined();
  await Promise.resolve();
  await Promise.resolve();
  expect(session.getSnapshot().message).toBe(
    'Missed: g6 wins a piece. This answer didn’t save, so it will come back.',
  );
  expect(api.threatAnswer).toHaveBeenCalledTimes(1);
});
test('the day’s graded answer says when the position comes back; the saved date wins', async () => {
  const at = (due: string) => ({ due, mastered: false });
  const served = {
    ...deck,
    card: {
      ...card,
      line: ['e1e8'],
      feedback: null,
      mastered: false,
      next: {
        again: at('2026-10-12'),
        hard: at('2026-10-12'),
        good: at('2026-10-13'),
        easy: at('2026-10-19'),
      },
    },
  };
  const api = mockApi(served);
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  const session = new PracticeSession(
    api,
    () => true,
    undefined,
    () => 1000,
  );
  await session.load();
  void session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'first',
  });
  // Found at once: the served preview's Easy date, before the save returns.
  expect(session.getSnapshot().exercise?.nextReview).toBe('Back in 8 days.');
  await flush();
  expect(session.getSnapshot().exercise?.nextReview).toBe('Back in 8 days.');
  finish(correct); // saved as Good, due Oct 15
  await flush();
  expect(session.getSnapshot().exercise?.nextReview).toBe('Back in 4 days.');
});
test('a card served without a preview gets its line from the saved answer', async () => {
  const { api, session, move } = setupServed();
  let finish!: (answer: PracticeStep) => void;
  api.answerLine.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  );
  await session.load();
  void session.attempt(move());
  expect(session.getSnapshot().exercise?.nextReview).toBeUndefined();
  await flush();
  finish(correct);
  await flush();
  expect(session.getSnapshot().exercise?.nextReview).toBe('Back in 4 days.');
});
test('a stalled answer gives up as uncertain instead of checking forever, and is never resent', async () => {
  const { api, session, move } = setup();
  await session.load();
  // Like fetch: pending until the request's signal aborts.
  api.answerLine.mockImplementationOnce(
    (_body: unknown, signal?: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(new ApiError('cancelled', 'Request cancelled.')),
        );
      }),
  );
  jest.useFakeTimers();
  try {
    const answering = session.attempt(move());
    expect(session.getSnapshot().message).toBe('Checking your move…');
    jest.advanceTimersByTime(ANSWER_TIMEOUT_MS - 1);
    expect(session.getSnapshot().phase).toBe('pending');
    jest.advanceTimersByTime(1);
    await answering;
  } finally {
    jest.useRealTimers();
  }
  expect(session.getSnapshot().phase).toBe('uncertain');
  expect(api.answerLine).toHaveBeenCalledTimes(1);
});
test('the hint marks the piece only while no answer is on the board, as on Chess.com', async () => {
  const { api, session, move } = setup();
  await session.load();
  await session.hint();
  await session.hint();
  const hintArrow = { from: 'e1', to: 'e8', tone: 'hint' };
  expect(boardOf(session)?.presentation.hint).toEqual({ square: 'e1' });
  expect(boardOf(session)?.presentation.arrows).toContainEqual(hintArrow);
  api.answerLine.mockResolvedValueOnce(wrong);
  await session.attempt(move('e1', 'e2'));
  expect(session.getSnapshot().phase).toBe('wrong');
  // The hinted piece has moved: no ring or arrow on the square it left.
  expect(boardOf(session)?.presentation.hint).toBeUndefined();
  expect(boardOf(session)?.presentation.arrows).not.toContainEqual(hintArrow);
  session.retry();
  expect(boardOf(session)?.presentation.hint).toEqual({ square: 'e1' });
  expect(boardOf(session)?.presentation.arrows).toContainEqual(hintArrow);
});

test('a leech opens by pointing at their threats; other cards name the move you played', () => {
  expect(cardPrompt({ san: 'Bg4', leech: true, lapses: 5 })).toBe(
    "You've missed this 5 times. Look at what they threaten first.",
  );
  expect(cardPrompt({ san: 'Bg4', leech: false, lapses: 3 })).toBe(
    'You played Bg4 here. Find a better move.',
  );
  expect(cardPrompt({ san: 'Bg4' })).toBe(
    'You played Bg4 here. Find a better move.',
  );
});

test('"Your move" says nothing about the position, offers no hint and never schedules', async () => {
  const yourMove = { ...card, unannounced: 'calm' as const };
  const api = mockApi({
    ...deck,
    card: null,
    unannounced_item: yourMove,
  });
  const session = new PracticeSession(api, () => true);
  await session.load();
  expect(session.getSnapshot().message).toBe('Your move.');
  // No red arrow for the move played in the game: that would say where to look.
  expect(boardOf(session)?.presentation.arrows ?? []).toEqual([]);
  await session.hint();
  expect(session.getSnapshot().exercise?.hinted).toBe(false);
  api.deck.mockResolvedValue({ ...deck, card: null });
  await session.attempt({
    from: 'e1',
    to: 'e8',
    source: 'activation',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'e1e8',
  });
  await flush();
  expect(api.answerLine).not.toHaveBeenCalled();
  expect(api.unannouncedAnswer).toHaveBeenCalledWith(
    expect.objectContaining({
      game_id: card.game_id,
      ply: card.ply,
      moves: ['e1e8'],
    }),
    expect.any(AbortSignal),
  );
});

test('"Your move" says which kind of position it was only in the verdict', () => {
  expect(cardPrompt({ san: 'Bg4', unannounced: 'critical' })).toBe(
    'Your move.',
  );
  expect(yourMoveVerdict('critical', true).body).toBe(
    'There was something here, and you found it.',
  );
  expect(yourMoveVerdict('critical', false).body).toBe(
    'There was something here.',
  );
  expect(yourMoveVerdict('calm', true)).toEqual({
    title: 'Safe move',
    body: 'Quiet position: any safe move was fine.',
  });
  expect(yourMoveVerdict('calm', false).body).toBe(
    'Quiet position, but that move gives something away.',
  );
});

test('a puzzle keeps why it was served, and a taught one names its post and lesson', async () => {
  const puzzle = {
    id: 'abc12',
    fen_prev: 'r4rk1/6pp/8/6N1/2Q5/8/6PP/6K1 b - - 0 1',
    prev_uci: 'g8h8',
    fen_before: lineFen,
    color: 'white' as const,
    themes: ['fork'],
    rating: 1350,
    line_key: 'fedcba9876543210',
  };
  const ward = {
    key: 'double-attack',
    name: 'The double attack',
    index: 4,
    state: 'current' as const,
    lessons: [
      {
        key: 'double-attack',
        name: 'Double attack',
        track: 'tactic',
        step: '2',
        held: true,
        solves: 3,
        teachable: true,
      },
      {
        key: 'double-attack-king',
        name: 'Double attack with the king in it',
        track: 'tactic',
        step: '2',
        held: false,
        solves: 1,
        teachable: true,
      },
    ],
  };
  const taught = lineSetup({
    ...deck,
    card: null,
    puzzle,
    mode: 'taught',
    ward,
  });
  await taught.session.load();
  expect(taught.session.getSnapshot().exercise?.item).toMatchObject({
    kind: 'puzzle',
    mode: 'taught',
  });
  // The post and lesson it teaches: the post's first teachable lesson not yet held.
  expect(taughtAt(taught.session.getSnapshot().deck?.ward)).toEqual({
    place: 'The Lists',
    lesson: 'Double attack with the king in it',
  });
  // A puzzle served for another reason (a family, an extra watch) is not announced.
  const volume = lineSetup({
    ...deck,
    card: null,
    puzzle,
    mode: 'volume',
    ward,
  });
  await volume.session.load();
  expect(volume.session.getSnapshot().exercise?.item).toMatchObject({
    mode: 'volume',
  });
});
