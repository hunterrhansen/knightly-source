import { gradeLocally, trustedLine } from './local-grade';

// After 1.e4 e5 2.Nf3: Black's line 2...Nc6 3.Bb5 a6 (learner, reply, learner).
const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const line = ['b8c6', 'f1b5', 'a7a6'];
const grade = (moves: string[], extra = {}) =>
  gradeLocally({ fen, line, moves, hinted: false, kind: 'puzzle', ...extra });

test('the line’s move continues with the reply, and its last move solves', () => {
  expect(grade(['b8c6'])).toEqual({
    status: 'continue',
    step: 0,
    reply_uci: 'f1b5',
    reply_san: 'Bb5',
  });
  expect(grade(['b8c6', 'f1b5', 'a7a6'])).toMatchObject({
    status: 'solved',
    step: 1,
    correct: true,
    quality: 'best',
    best_san: 'a6',
    line: { uci: line, san: ['Nc6', 'Bb5', 'a6'] },
  });
});

test('off the line, a puzzle fails, a mate solves, and Show solution is shown', () => {
  expect(grade(['g8f6'])).toMatchObject({ status: 'failed', quality: 'wrong' });
  expect(grade(['0000'])).toMatchObject({ status: 'shown', quality: 'shown' });
  const mateFen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
  expect(
    gradeLocally({
      fen: mateFen,
      line: ['e1e2'],
      moves: ['e1e8'],
      hinted: false,
      kind: 'puzzle',
    }),
  ).toMatchObject({ status: 'solved', quality: 'best', correct: true });
});

test('a card’s other first moves take the grade map; one it lacks goes to the server', () => {
  const card = {
    kind: 'card' as const,
    grades: { g8f6: 'excellent' as const, a7a6: 'wrong' as const },
  };
  expect(grade(['g8f6'], card)).toMatchObject({
    status: 'solved',
    quality: 'excellent',
  });
  expect(grade(['a7a6'], card)).toMatchObject({
    status: 'failed',
    quality: 'wrong',
  });
  expect(grade(['d7d6'], card)).toBeUndefined();
  expect(grade(['d7d6'], { kind: 'card' })).toBeUndefined();
});

test('a move list the line can’t have produced, or an untrusted line, is left to the server', () => {
  expect(grade(['b8c6', 'f1c4', 'a7a6'])).toBeUndefined();
  expect(grade(['b8c6', 'f1b5'])).toBeUndefined();
  expect(trustedLine(fen, ['b8c6', 'f1b5'])).toBeUndefined();
  expect(trustedLine(fen, ['e2e4'])).toBeUndefined();
  expect(trustedLine(fen, line)).toEqual(line);
});

test('a hinted correct answer is rated Again, as the server rates it', () => {
  expect(grade(['b8c6', 'f1b5', 'a7a6'], { hinted: true })).toMatchObject({
    correct: true,
    rating: 'again',
  });
});
