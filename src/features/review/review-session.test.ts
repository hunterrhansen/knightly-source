import { ApiError } from '../../lib/api/api-error';
import type {
  CardFeedback,
  Deck,
  PracticeAnswer,
} from '../../lib/api/practice-contract';
import type { GameDetail } from '../../lib/api/review-contract';
import { reviewBoard } from './review-board';
import { buildLesson, replayGame } from './review-lesson';
import { liveEnginePath, ReviewSession } from './review-session';

/** The board the screen shows for the session's state. */
const boardOf = (session: ReviewSession) =>
  reviewBoard(session.getSnapshot(), session, session.play);

const game: GameDetail = {
  id: 7,
  white: 'Player',
  black: 'Opponent',
  color: 'white',
  analysed: true,
  start_fen: null,
  san: ['e4', 'e5', 'Nf3'],
  reviewed_at: null,
  review_marks: [],
  accuracy: 80,
  deck_plies: [1],
  plies: [
    {
      ply: 1,
      color: 'white',
      san: 'e4',
      uci: 'e2e4',
      classification: 'mistake',
      best_san: 'd4',
      best_uci: 'd2d4',
      win_pct_before: 50,
      win_pct_after: 40,
    },
    {
      ply: 2,
      color: 'black',
      san: 'e5',
      uci: 'e7e5',
      classification: 'blunder',
      best_san: 'd5',
      best_uci: 'd7d5',
      win_pct_before: 60,
      win_pct_after: 30,
    },
    {
      ply: 3,
      color: 'white',
      san: 'Nf3',
      uci: 'g1f3',
      classification: 'great',
      best_san: 'Nf3',
      best_uci: 'g1f3',
      win_pct_before: 70,
      win_pct_after: 70,
    },
  ],
};
const deck: Deck = {
  server_day: '2026-10-11',
  card: null,
  total: 1,
  mastered: 0,
  learning: 0,
  new: 1,
  today: { done: 0, total: 1 },
  results: [],
};
const answer: PracticeAnswer = {
  correct: true,
  quality: 'best',
  rating: 'good',
  best_uci: 'd2d4',
  best_san: 'd4',
  due: '2026-10-14',
  mastered: false,
};
// Local verdicts save in the background; this lets those saves land.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup(detail = game, queue?: { run: () => void; ms: number }[]) {
  let active = true;
  const api = {
    game: jest.fn(async () => detail),
    deck: jest.fn(async () => deck),
    answer: jest.fn(async () => answer),
    hint: jest.fn(async () => ({ best_uci: 'd2d4', from: 'd2' })),
    finishReview: jest.fn(async () => ({
      reviewed_at: '2026-10-11T16:00:00Z',
    })),
    cardFeedback: jest.fn(async (): Promise<CardFeedback | null> => null),
  };
  const saved = jest.fn();
  const session = new ReviewSession(
    api,
    7,
    () => active,
    saved,
    () => 1000,
    queue
      ? (ms, run) => {
          queue.push({ run, ms });
          return () => {};
        }
      : undefined,
  );
  const move = (from = 'd2', to = 'd4') => ({
    from: from as 'd2',
    to: to as 'd4',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'one',
    source: 'activation' as const,
  });
  return {
    api,
    session,
    saved,
    move,
    dispose: () => {
      active = false;
    },
  };
}
test('review selects your errors and one reply to their blunder, without duplicate praise', () => {
  const replay = replayGame(game);
  expect(
    buildLesson(game, replay).steps.map(({ ply, type }) => ({ ply, type })),
  ).toEqual([
    { ply: 1, type: 'find' },
    { ply: 3, type: 'praise' },
  ]);
  const mismatch = {
    ...game,
    plies: game.plies.map((m) => (m.ply === 1 ? { ...m, uci: 'e2e3' } : m)),
  };
  expect(buildLesson(mismatch, replay).blocked).toContain('does not match');
});
test('unanalysed and malformed recordings replay within bounds, explore freely and never save', async () => {
  const { session, api } = setup({
    ...game,
    analysed: false,
    san: ['e4', 'e5', 'not-a-move'],
    plies: [],
  });
  await session.load();
  session.select(100);
  expect(session.getSnapshot().replayIndex).toBe(2);
  expect(boardOf(session)?.position.fen).toBe(
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  );
  const attempt = {
    from: 'g1',
    to: 'f3',
    positionId: boardOf(session)?.position.id ?? '',
    attemptId: 'no',
    source: 'activation',
  } as const;
  await session.attempt(attempt);
  // The board's move explores a side line; nothing is graded.
  boardOf(session)?.onAttempt(attempt);
  expect(session.getSnapshot().line?.path).toEqual(['e2e4', 'e7e5', 'g1f3']);
  await session.finish();
  expect(api.answer).not.toHaveBeenCalled();
  expect(api.finishReview).not.toHaveBeenCalled();
});
// e4 is neither the stored best move nor graded by a map: the server judges.
test('a pending review attempt previews once and cannot advance or submit twice', async () => {
  const { session, api, move } = setup();
  let settle!: (value: PracticeAnswer) => void;
  api.answer.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  await session.load();
  const pending = session.attempt(move('e2', 'e4'));
  await Promise.resolve();
  expect(boardOf(session)?.presentation.preview?.fen).toBe(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  );
  session.continue();
  await session.attempt(move('e2', 'e4'));
  expect(session.getSnapshot().step).toBe(0);
  expect(api.answer).toHaveBeenCalledTimes(1);
  expect(api.answer).toHaveBeenCalledWith(
    expect.objectContaining({ expected_day: '2026-10-11', uci: 'e2e4' }),
  );
  settle(answer);
  await pending;
  expect(session.getSnapshot().phase).toBe('answered');
});
test('a wrong preview requires explicit retry; hint assistance and replay survive returning to the lesson', async () => {
  const { session, api, move } = setup();
  await session.load();
  api.answer.mockResolvedValueOnce({
    ...answer,
    correct: false,
    quality: 'wrong',
    rating: 'again',
  });
  const old = move('e2', 'e3');
  await session.attempt(old);
  expect(session.getSnapshot().phase).toBe('wrong');
  expect(boardOf(session)?.presentation.preview).toBeDefined();
  session.retry();
  await session.attempt(old);
  expect(api.answer).toHaveBeenCalledTimes(1);
  await session.hint();
  session.replay();
  session.select(2);
  session.lesson();
  expect(session.getSnapshot().step).toBe(0);
  expect(boardOf(session)?.presentation.hint).toEqual({ square: 'd2' });
  await session.attempt(move());
  await flush();
  session.continue();
  expect(session.getSnapshot().marks).toEqual([{ ply: 1, mark: 'helped' }]);
});
test('only Finish review saves the complete ordered marks, and repeated activation saves once', async () => {
  const { session, api, move, saved } = setup();
  await session.load();
  await session.finish();
  expect(api.finishReview).not.toHaveBeenCalled();
  await session.attempt(move());
  await flush();
  session.continue();
  session.continue();
  expect(api.finishReview).not.toHaveBeenCalled();
  const first = session.finish();
  await session.finish();
  await first;
  expect(api.finishReview).toHaveBeenCalledTimes(1);
  expect(api.finishReview).toHaveBeenCalledWith(7, {
    marks: [
      { ply: 1, mark: 'found' },
      { ply: 3, mark: 'praise' },
    ],
  });
  expect(session.getSnapshot().phase).toBe('complete');
  expect(saved).toHaveBeenCalledTimes(1);
});
test('lost completion only confirms matching marks with a changed timestamp, without a resend', async () => {
  const prior = {
    ...game,
    reviewed_at: '2026-10-10T16:00:00Z',
    review_marks: [
      { ply: 1, mark: 'found' as const },
      { ply: 3, mark: 'praise' as const },
    ],
  };
  const { session, api, move } = setup(prior);
  await session.load();
  session.restart();
  await session.attempt(move());
  session.continue();
  session.continue();
  api.finishReview.mockRejectedValueOnce(
    new ApiError('network', 'Disconnected'),
  );
  await session.finish();
  await session.finish();
  await session.checkFinish();
  expect(session.getSnapshot().phase).toBe('save-uncertain');
  api.game.mockResolvedValue({
    ...prior,
    reviewed_at: '2026-10-11T17:00:00Z',
    review_marks: [],
  });
  await session.checkFinish();
  expect(session.getSnapshot().phase).toBe('save-uncertain');
  api.game.mockResolvedValue({ ...prior, reviewed_at: '2026-10-11T17:00:00Z' });
  await session.checkFinish();
  expect(session.getSnapshot().phase).toBe('complete');
  expect(api.finishReview).toHaveBeenCalledTimes(1);
});
test('a lost answer confirms a newly saved first grade but cannot confirm an old retry result', async () => {
  const { session, api, move } = setup();
  await session.load();
  api.answer.mockRejectedValueOnce(new ApiError('network', 'Disconnected'));
  await session.attempt(move());
  await flush();
  session.retry();
  await session.reveal();
  const result = {
    game_id: 7,
    ply: 1,
    correct: false,
    mark: 'missed' as const,
    san: 'e4',
    opponent: 'Opponent',
  };
  api.deck.mockResolvedValue({ ...deck, results: [result] });
  await session.checkAnswer();
  expect(session.getSnapshot().phase).toBe('answered');
  expect(api.answer).toHaveBeenCalledTimes(1);
  const retry = setup();
  await retry.session.load();
  retry.api.answer.mockResolvedValueOnce({
    ...answer,
    correct: false,
    quality: 'wrong',
    rating: 'again',
  });
  await retry.session.attempt(retry.move('e2', 'e3'));
  retry.session.retry();
  retry.api.answer.mockRejectedValueOnce(
    new ApiError('network', 'Disconnected'),
  );
  await retry.session.attempt(retry.move());
  await flush();
  retry.api.deck.mockResolvedValue({ ...deck, results: [result] });
  await retry.session.checkAnswer();
  expect(retry.session.getSnapshot().phase).toBe('uncertain');
});
test('account disposal ignores a late accepted answer', async () => {
  const { session, api, move, dispose } = setup();
  let settle!: (value: PracticeAnswer) => void;
  api.answer.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  await session.load();
  const pending = session.attempt(move('e2', 'e4'));
  await Promise.resolve();
  dispose();
  settle(answer);
  await pending;
  expect(session.getSnapshot().phase).toBe('pending');
  expect(session.getSnapshot().marks).toEqual([]);
});
test('Show me submits assistance and records missed without changing review completion until Finish', async () => {
  const { session, api } = setup();
  await session.load();
  api.answer.mockResolvedValueOnce({
    ...answer,
    correct: false,
    quality: 'shown',
    rating: 'again',
  });
  await session.reveal();
  await flush();
  session.continue();
  expect(api.answer).toHaveBeenCalledWith(
    expect.objectContaining({ uci: '0000', hinted: true }),
  );
  expect(session.getSnapshot().marks).toEqual([{ ply: 1, mark: 'missed' }]);
  expect(api.finishReview).not.toHaveBeenCalled();
});

test('All moves hides only the active answer; revealing it marks the lesson answer assisted', async () => {
  const { session, api, move } = setup();
  await session.load();
  session.replay();
  session.select(1);
  expect(session.answerHidden(1)).toBe(true);
  expect(session.answerHidden(2)).toBe(false);
  session.lesson();
  await session.attempt(move());
  await flush();
  expect(api.answer).toHaveBeenLastCalledWith(
    expect.objectContaining({ hinted: false }),
  );

  const second = setup();
  await second.session.load();
  second.session.replay();
  second.session.select(1);
  second.session.revealAnswer();
  expect(second.session.answerHidden(1)).toBe(false);
  second.session.lesson();
  await second.session.attempt(second.move());
  await flush();
  second.session.continue();
  expect(second.api.answer).toHaveBeenLastCalledWith(
    expect.objectContaining({ hinted: true }),
  );
  expect(second.session.getSnapshot().marks).toEqual([
    { ply: 1, mark: 'helped' },
  ]);
});

test('Next stops on each notable move, waits for an unanswered find and saves at the end', async () => {
  const { session, api, move } = setup();
  await session.load();
  session.begin();
  expect(session.getSnapshot().moments).toEqual([1, 2, 3]);
  session.next();
  expect(session.getSnapshot().cursor).toBe(1);
  expect(boardOf(session)?.policy.mode).toBe('movable');
  session.next();
  expect(session.getSnapshot().cursor).toBe(1);
  await session.attempt(move());
  await flush();
  session.next();
  expect(session.getSnapshot().cursor).toBe(2);
  // A game move again, not a find: it takes moves only to explore.
  expect(boardOf(session)?.policy).toMatchObject({ sides: ['w', 'b'] });
  expect(boardOf(session)?.position.id).toBe('review-move:7:2');
  expect(boardOf(session)?.presentation.grade).toEqual({
    square: 'e5',
    kind: 'blunder',
  });
  session.next();
  expect(session.getSnapshot().cursor).toBe(3);
  expect(api.finishReview).not.toHaveBeenCalled();
  session.next();
  await flush();
  expect(api.finishReview).toHaveBeenCalledWith(7, {
    marks: [
      { ply: 1, mark: 'found' },
      { ply: 3, mark: 'praise' },
    ],
  });
});

test('stepping through moves grades nothing, and Next returns to the unfinished step', async () => {
  const { session, api } = setup();
  await session.load();
  session.begin();
  session.goTo(3);
  expect(boardOf(session)?.presentation.grade).toEqual({
    square: 'f3',
    kind: 'great',
  });
  session.stepBy(1);
  expect(session.getSnapshot().cursor).toBe(3);
  session.next();
  expect(session.getSnapshot().cursor).toBe(1);
  expect(session.atMoment()).toBe(true);
  session.stepBy(-1);
  expect(session.getSnapshot().cursor).toBe(0);
  expect(api.answer).not.toHaveBeenCalled();
  expect(session.getSnapshot().marks).toEqual([]);
});

test('one move at a time animates the piece; a jump cuts', async () => {
  const { session } = setup();
  await session.load();
  session.begin();
  session.goTo(2);
  session.stepBy(1);
  expect(boardOf(session)?.presentation.transition).toMatchObject({
    reason: 'replay',
    motions: [{ from: 'g1', to: 'f3' }],
  });
  session.stepBy(-1);
  expect(boardOf(session)?.presentation.transition).toMatchObject({
    motions: [{ from: 'f3', to: 'g1' }],
  });
  session.goTo(0);
  expect(boardOf(session)?.presentation.transition).toBeUndefined();
});

test('Next plays the moves before the next moment one at a time; Next again skips ahead', () => {
  const plies = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];
  const uci = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
  const long: GameDetail = {
    ...game,
    san: plies,
    deck_plies: [],
    plies: plies.map((san, i) => ({
      ply: i + 1,
      color: i % 2 ? 'black' : 'white',
      san,
      uci: uci[i] ?? '',
      classification: i === 4 ? 'mistake' : 'good',
      best_san: null,
      best_uci: null,
      win_pct_before: 50,
      win_pct_after: 50,
    })),
  };
  const queue: (() => void)[] = [];
  const session = new ReviewSession(
    {
      game: jest.fn(async () => long),
      deck: jest.fn(async () => deck),
      answer: jest.fn(async () => answer),
      hint: jest.fn(),
      finishReview: jest.fn(),
      cardFeedback: jest.fn(async () => null),
    },
    7,
    () => true,
    () => {},
    () => 1000,
    (_ms, run) => {
      queue.push(run);
      return () => queue.splice(queue.indexOf(run), 1);
    },
  );
  return session.load().then(() => {
    session.begin();
    session.next();
    // The first move plays at once, each later one on the clock.
    expect(session.getSnapshot().cursor).toBe(1);
    expect(boardOf(session)?.presentation.transition).toMatchObject({
      motions: [{ from: 'e2', to: 'e4' }],
    });
    queue.shift()?.();
    expect(session.getSnapshot().cursor).toBe(2);
    session.next();
    expect(session.getSnapshot().cursor).toBe(5);
    expect(queue).toHaveLength(0);
  });
});
test('the combo counts a clean find and resets after a miss; a retried find stays at zero, earning half points', async () => {
  const clean = setup();
  await clean.session.load();
  await clean.session.attempt(clean.move());
  expect(clean.session.getSnapshot().combo).toBe(1);
  expect(clean.session.getSnapshot().points).toBe(10);

  const { api, session, move } = setup();
  await session.load();
  api.answer.mockResolvedValueOnce({
    ...answer,
    correct: false,
    quality: 'wrong',
    rating: 'again',
  });
  await session.attempt(move('d2', 'd3'));
  expect(session.getSnapshot().combo).toBe(0);
  session.retry();
  await session.attempt(move());
  expect(session.getSnapshot().exercise?.mark).toBe('helped');
  expect(session.getSnapshot().combo).toBe(0);
  expect(session.getSnapshot().points).toBe(5);
});

test('a found move plays the correct sound and badge, as a solved practice puzzle does; a wrong one does not', async () => {
  const { api, session, move } = setup();
  await session.load();
  api.answer.mockResolvedValueOnce({
    ...answer,
    correct: false,
    quality: 'wrong',
    rating: 'again',
  });
  await session.attempt(move('d2', 'd3'));
  expect(boardOf(session)?.presentation.correct).toBeUndefined();
  session.retry();
  await session.attempt(move());
  expect(session.getSnapshot().phase).toBe('answered');
  expect(boardOf(session)?.presentation.correct).toEqual({
    square: 'd4',
    id: 'one',
  });
});

/** A served map: a2a3 is answered by a6, a move legal in both test positions. */
const map = (fen: string): CardFeedback => ({
  grades: {},
  complete: false,
  explanations: {
    a2a3: {
      reply_uci: 'a7a6',
      reply_san: 'a6',
      reason_kind: 'eval',
      reason_text: 'They answer a6.',
      cause: {
        cause_kind: 'missedThreat',
        cause_text: `Missed in ${fen.split(' ')[0]}`,
        principle: 'checkReplies',
      },
    },
  },
});
const wrong: PracticeAnswer = {
  ...answer,
  correct: false,
  quality: 'wrong',
  rating: 'again',
};
test('a wrong find move plays the reply from the served map after 280 ms, then says why it was missed', async () => {
  const queue: { run: () => void; ms: number }[] = [];
  const { api, session, move } = setup(game, queue);
  api.cardFeedback.mockImplementation(async () =>
    map('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  );
  api.answer.mockResolvedValue(wrong);
  await session.load();
  session.begin();
  session.next();
  await Promise.resolve();
  expect(api.cardFeedback).toHaveBeenCalledWith(7, 1, expect.anything());

  await session.attempt(move('a2', 'a3'));
  // The wrong move stands while their reply waits.
  expect(session.getSnapshot().phase).toBe('refuting');
  expect(boardOf(session)?.feedback?.outcome).toBe('pending');
  expect(queue.map((q) => q.ms)).toEqual([280]);

  queue.shift()?.run();
  const state = session.getSnapshot();
  expect(state.phase).toBe('wrong');
  expect(state.message).toBe(
    'Missed in rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
  );
  expect(state.exercise?.principle).toBe('checkReplies');
  const board = boardOf(session);
  expect(board?.position.fen).toBe(
    'rnbqkbnr/1ppppppp/p7/8/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 2',
  );
  expect(board?.presentation.lastMove).toEqual({ from: 'a7', to: 'a6' });

  // Try again returns to the find's own position.
  session.retry();
  expect(boardOf(session)?.position.fen).toBe(
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  );
  expect(session.getSnapshot().exercise?.principle).toBeUndefined();
});
test('a map arriving after its find closed, or after an account switch, is ignored', async () => {
  const twoFinds: GameDetail = {
    ...game,
    deck_plies: [1, 3],
    plies: game.plies.map((m) =>
      m.ply === 3
        ? { ...m, classification: 'mistake', best_san: 'Nc3', best_uci: 'b1c3' }
        : m,
    ),
  };
  const { api, session, move } = setup(twoFinds);
  let late: (value: CardFeedback) => void = () => {};
  api.cardFeedback
    .mockImplementationOnce(
      () =>
        new Promise<CardFeedback>((resolve) => {
          late = resolve;
        }),
    )
    .mockImplementationOnce(async () => null);
  await session.load();
  expect(session.getSnapshot().steps.map((s) => s.type)).toEqual([
    'find',
    'find',
  ]);
  await session.attempt(move());
  await flush();
  session.continue();
  expect(session.getSnapshot().steps[session.getSnapshot().step]?.ply).toBe(3);
  // The first find's map lands while the second is open.
  late(map('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  await Promise.resolve();
  api.answer.mockResolvedValueOnce(wrong);
  await session.attempt(move('a2', 'a3'));
  expect(session.getSnapshot().phase).toBe('wrong');
  expect(session.getSnapshot().exercise?.refutation).toBeUndefined();

  const other = setup();
  let afterSwitch: (value: CardFeedback) => void = () => {};
  other.api.cardFeedback.mockImplementationOnce(
    () =>
      new Promise<CardFeedback>((resolve) => {
        afterSwitch = resolve;
      }),
  );
  await other.session.load();
  await flush();
  const before = other.session.getSnapshot();
  other.dispose();
  afterSwitch(map('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  await Promise.resolve();
  expect(other.session.getSnapshot()).toBe(before);
});
test('a find shows its verdict before the server answers, and Continue waits for the save', async () => {
  const { session, api, move } = setup();
  let settle!: (value: PracticeAnswer) => void;
  api.answer.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  await session.load();
  await flush();
  // d4 is the stored best move: no waiting on the server to say so.
  await session.attempt(move());
  expect(session.getSnapshot().phase).toBe('answered');
  expect(session.getSnapshot().exercise?.mark).toBe('found');
  await flush();
  expect(api.answer).toHaveBeenCalledTimes(1);
  session.continue();
  session.continue();
  expect(session.getSnapshot().step).toBe(0);
  settle(answer);
  await flush();
  expect(session.getSnapshot().step).toBe(1);
  expect(session.getSnapshot().marks).toEqual([{ ply: 1, mark: 'found' }]);
});
test("a move the map grades is judged at once; the server's different verdict replaces it", async () => {
  const { session, api, move } = setup();
  api.cardFeedback.mockImplementation(async () => ({
    ...map('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    grades: { e2e4: 'good' },
  }));
  let settle!: (value: PracticeAnswer) => void;
  api.answer.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  await session.load();
  await flush();
  await session.attempt(move('e2', 'e4'));
  expect(session.getSnapshot().exercise?.mark).toBe('good');
  // A stale map: the server, which saves the answer, says otherwise.
  settle(wrong);
  await flush();
  expect(session.getSnapshot().phase).toBe('wrong');
  expect(session.getSnapshot().exercise?.mark).toBeUndefined();
});
test('Next carries on from where you stepped: moments you walked past count as seen, nothing replays', async () => {
  // No deck position here, so the mistake at ply 1 is shown, not asked.
  const { session, api } = setup({ ...game, deck_plies: [] });
  await session.load();
  session.begin();
  session.goTo(3);
  session.next();
  expect(session.getSnapshot().cursor).toBe(3);
  expect(session.getSnapshot().playingTo).toBeUndefined();
  expect(session.getSnapshot().marks).toEqual([{ ply: 1, mark: 'seen' }]);
  expect(session.atMoment()).toBe(true);
  session.next();
  await flush();
  expect(api.finishReview).toHaveBeenCalledWith(7, {
    marks: [
      { ply: 1, mark: 'seen' },
      { ply: 3, mark: 'praise' },
    ],
  });
});
test('a question you stepped past is asked, then Next returns to where you were without replaying', async () => {
  const { session, api, move } = setup();
  await session.load();
  await flush();
  session.begin();
  session.goTo(3);
  session.next();
  // One cut back to the question, not a run through the moves.
  expect(session.getSnapshot().cursor).toBe(1);
  expect(session.getSnapshot().playingTo).toBeUndefined();
  await session.attempt(move());
  await flush();
  session.next();
  expect(session.getSnapshot().cursor).toBe(3);
  expect(session.getSnapshot().playingTo).toBeUndefined();
  expect(session.atMoment()).toBe(true);
  session.next();
  await flush();
  expect(api.finishReview).toHaveBeenCalledWith(7, {
    marks: [
      { ply: 1, mark: 'found' },
      { ply: 3, mark: 'praise' },
    ],
  });
});

// Lichess's analysis board: a move on a game position steps along the game
// when it is the game's move and starts a side line otherwise.
test('a move on a game position starts a side line without answering, and Back to game returns', async () => {
  const { session, api, move } = setup();
  await session.load();
  session.begin();
  session.goTo(2);
  boardOf(session)?.onAttempt(move('b1', 'c3'));
  expect(session.getSnapshot().line?.path).toEqual(['e2e4', 'e7e5', 'b1c3']);
  expect(boardOf(session)?.position.fen).toBe(
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2',
  );
  expect(session.atMoment()).toBe(false);
  // Either side moves in a line.
  boardOf(session)?.onAttempt(move('b8', 'c6'));
  expect(session.getSnapshot().line?.path).toHaveLength(4);
  session.closeLine();
  expect(session.getSnapshot().line).toBeUndefined();
  expect(session.getSnapshot().cursor).toBe(2);
  // The game's own move steps forward instead of branching.
  boardOf(session)?.onAttempt(move('g1', 'f3'));
  expect(session.getSnapshot().line).toBeUndefined();
  expect(session.getSnapshot().cursor).toBe(3);
  expect(api.answer).not.toHaveBeenCalled();
  expect(session.getSnapshot().marks).toEqual([]);
});

test('a move from a position the board has left is ignored', async () => {
  const { session, move } = setup();
  await session.load();
  session.begin();
  session.goTo(2);
  const stale = move('b1', 'c3');
  session.goTo(3);
  boardOf(session)?.onAttempt(stale);
  expect(session.getSnapshot().line).toBeUndefined();
  const played = move('b8', 'c6');
  boardOf(session)?.onAttempt(played);
  // The same attempt again, now from the line's position, adds nothing.
  boardOf(session)?.onAttempt(played);
  expect(session.getSnapshot().line?.path).toEqual([
    'e2e4',
    'e7e5',
    'g1f3',
    'b8c6',
  ]);
});

test('the position of a find you have not answered takes no moves until it is answered or revealed', async () => {
  const { session, move } = setup();
  await session.load();
  // All moves on the find's position (before your move) stays read-only.
  session.browseAt(0);
  expect(boardOf(session)?.policy.mode).toBe('read-only');
  boardOf(session)?.onAttempt(move('d2', 'd4'));
  expect(session.getSnapshot().line).toBeUndefined();
  session.revealAnswer();
  session.browseAt(1);
  session.revealAnswer();
  session.browseAt(0);
  expect(boardOf(session)?.policy.mode).toBe('movable');
  boardOf(session)?.onAttempt(move('d2', 'd4'));
  expect(session.getSnapshot().line?.path).toEqual(['d2d4']);
});

test('stepping back past a line’s start returns to the game, and deleting the shown move steps back', async () => {
  const { session, move } = setup();
  await session.load();
  session.begin();
  session.goTo(2);
  boardOf(session)?.onAttempt(move('b1', 'c3'));
  boardOf(session)?.onAttempt(move('b8', 'c6'));
  session.lineStep(-1);
  expect(session.getSnapshot().line?.path).toEqual(['e2e4', 'e7e5', 'b1c3']);
  session.lineStep(1);
  expect(session.getSnapshot().line?.path).toHaveLength(4);
  session.deleteLine(['e2e4', 'e7e5', 'b1c3', 'b8c6']);
  expect(session.getSnapshot().line?.path).toEqual(['e2e4', 'e7e5', 'b1c3']);
  session.lineStep(-1);
  expect(session.getSnapshot().line).toBeUndefined();
  expect(session.getSnapshot().cursor).toBe(2);
  // The line is still in the tree: the list can reopen it.
  session.openPath(['e2e4', 'e7e5', 'b1c3']);
  expect(session.getSnapshot().line).toMatchObject({ start: 2 });
  // Deleting a game move does nothing.
  session.deleteLine(['e2e4', 'e7e5']);
  expect(session.getSnapshot().line?.path).toEqual(['e2e4', 'e7e5', 'b1c3']);
});

test('Best opens the stored line as a side line from before the move, and Next leaves it', async () => {
  const { session } = setup();
  await session.load();
  session.begin();
  session.goTo(2);
  expect(session.openLine(1, ['d7d5', 'e4d5'])).toBe(true);
  expect(session.getSnapshot().line).toMatchObject({
    path: ['e2e4', 'd7d5'],
    start: 1,
  });
  expect(session.getSnapshot().cursor).toBe(2);
  session.lineStep(1);
  expect(session.getSnapshot().line?.path).toEqual(['e2e4', 'd7d5', 'e4d5']);
  expect(session.openLine(1, ['e7e4'])).toBe(false);
  session.next();
  expect(session.getSnapshot().line).toBeUndefined();
});

test('the live engine skips a find’s position until it is answered or revealed', async () => {
  const { session } = setup();
  await session.load();
  // The first step finds a better first move: the start is its position.
  expect(liveEnginePath(session.getSnapshot(), 0)).toBeUndefined();
  expect(liveEnginePath(session.getSnapshot(), 2)).toEqual(['e2e4', 'e7e5']);
  session.browseAt(1);
  session.revealAnswer();
  expect(liveEnginePath(session.getSnapshot(), 0)).toEqual([]);
});
