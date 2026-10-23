import { moveTag } from './mistake-layers';

test('a move is tagged with what went wrong and low clock, but not while it is still a puzzle', () => {
  expect(moveTag({ layer: 'theirThreat', time_trouble: true })).toBe(
    'Their threat · Low clock',
  );
  expect(moveTag({ layer: 'calculation', time_trouble: false })).toBe(
    'Calculation',
  );
  expect(moveTag({ layer: null, time_trouble: true })).toBe('Low clock');
  expect(moveTag({ layer: null, time_trouble: null })).toBeUndefined();
  expect(moveTag({})).toBeUndefined();
  // Solving a find step: "their threat" would point at the answer.
  expect(moveTag({ layer: 'theirThreat', time_trouble: true }, true)).toBe(
    undefined,
  );
});
