import {
  createAnnouncementGate,
  squareDescription,
  squareLabel,
} from './announcements';

test('square labels include empty and opponent pieces without expected answers', () => {
  expect(squareLabel('e4')).toBe('e4, empty');
  expect(squareLabel('e7', { square: 'e7', color: 'b', kind: 'p' })).toBe(
    'e7, Black pawn',
  );
  expect(squareLabel('a8', { square: 'a8', color: 'w', kind: 'n' })).toBe(
    'a8, White knight',
  );
});
test('a square describes its grade, hints, user highlight colour and check in one order', () => {
  expect(
    squareDescription(
      'e1',
      { square: 'e1', color: 'w', kind: 'k' },
      {
        grade: 'blunder',
        hint: true,
        correct: true,
        userMark: 'green',
        check: 'in check',
      },
    ),
  ).toBe(
    'e1, White king, Blunder move, hint: piece to move, correct answer, user highlight, green, in check',
  );
  expect(squareDescription('e4', undefined, { hint: false })).toBe('e4, empty');
});
test('semantic event identities announce once, including old feedback replay', () => {
  const gate = createAnnouncementGate();
  expect(gate.claim('p1:a1:pending')).toBe(true);
  expect(gate.claim('p1:a1:pending')).toBe(false);
  expect(gate.claim('p1:a1:rejected')).toBe(true);
  expect(gate.claim('p1:a2:pending')).toBe(true);
  expect(gate.claim('p1:a1:rejected')).toBe(false);
  expect(gate.claim('p2:position')).toBe(true);
});

test('orientation announcements can repeat after a distinct orientation', () => {
  const gate = createAnnouncementGate();
  expect(gate.claim('p1:orientation:w', false)).toBe(true);
  expect(gate.claim('p1:orientation:w', false)).toBe(false);
  expect(gate.claim('p1:orientation:b', false)).toBe(true);
  expect(gate.claim('p1:orientation:w', false)).toBe(true);
});
