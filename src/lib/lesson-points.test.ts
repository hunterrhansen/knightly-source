import {
  breakdownRows,
  landingSquare,
  PointsLedger,
  pointsFor,
} from './lesson-points';

test('a first try earns 10, help 5 and a miss nothing', () => {
  expect(pointsFor('clean', 1)).toEqual({ base: 10, bonus: 0 });
  expect(pointsFor('helped', 1)).toEqual({ base: 5, bonus: 0 });
  expect(pointsFor('none', 0)).toEqual({ base: 0, bonus: 0 });
});

test('the run bonus pays once at 5 and once at 10 in a row, only for a clean answer', () => {
  expect([4, 5, 6, 9, 10, 11].map((n) => pointsFor('clean', n).bonus)).toEqual([
    0, 10, 0, 0, 20, 0,
  ]);
  expect(pointsFor('helped', 5).bonus).toBe(0);
});

test('one award per position: a re-judged answer replaces its points instead of adding', () => {
  const ledger = new PointsLedger();
  const first = ledger.record('a', { base: 10, bonus: 0 }, 'e4');
  expect(first).toMatchObject({ base: 10, bonus: 0, square: 'e4' });
  expect(ledger.record('b', { base: 10, bonus: 10 })).toMatchObject({
    bonus: 10,
  });
  expect(ledger.total).toBe(30);
  // The server judged "a" assisted after all: 5 replaces 10.
  const rejudged = ledger.record('a', { base: 5, bonus: 0 });
  expect(rejudged?.id).not.toBe(first?.id);
  expect(ledger.total).toBe(25);
  // The same verdict again shows nothing new.
  expect(ledger.record('a', { base: 5, bonus: 0 })).toBeUndefined();
  // A miss records nothing to show.
  expect(ledger.record('c', { base: 0, bonus: 0 })).toBeUndefined();
  expect(ledger.total).toBe(25);
});

test('the shard takes off from the landing square of a played move only', () => {
  expect(landingSquare('e2e4')).toBe('e4');
  expect(landingSquare('e7e8q')).toBe('e8');
  expect(landingSquare('0000')).toBeUndefined();
  expect(landingSquare(undefined)).toBeUndefined();
});

test('a perfect session needs at least five answers, every one a first try', () => {
  const perfect = new PointsLedger();
  for (const id of ['a', 'b', 'c', 'd', 'e'])
    perfect.record(id, pointsFor('clean', 1));
  expect(perfect.summary()).toMatchObject({
    firstTries: 5,
    perfect: 20,
    total: 70,
  });

  const short = new PointsLedger();
  for (const id of ['a', 'b', 'c', 'd'])
    short.record(id, pointsFor('clean', 1));
  expect(short.summary().perfect).toBe(0);

  // A miss, recorded as 0, keeps the session from being perfect.
  const missed = new PointsLedger();
  for (const id of ['a', 'b', 'c', 'd', 'e'])
    missed.record(id, pointsFor('clean', 1));
  missed.record('f', pointsFor('none', 0));
  expect(missed.summary()).toMatchObject({ perfect: 0, total: 50 });
});

test('the breakdown names what the points were made of and skips empty rows', () => {
  const ledger = new PointsLedger();
  for (const [id, n] of [
    ['a', 1],
    ['b', 2],
    ['c', 3],
    ['d', 4],
    ['e', 5],
  ] as const)
    ledger.record(id, pointsFor('clean', n));
  ledger.record('f', pointsFor('helped', 0));
  expect(breakdownRows(ledger.summary())).toEqual([
    { label: '5 first tries', value: '+50' },
    { label: '1 with help', value: '+5' },
    { label: 'Run bonus', value: '+10' },
  ]);
});
