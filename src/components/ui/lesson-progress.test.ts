import {
  lessonSegments,
  progressLabel,
  runLabel,
  runTier,
} from './lesson-progress';

test('one segment per item up to 40, with the current one marked until it is done', () => {
  const { segments, gap } = lessonSegments(3, 3, 8);
  expect(segments.map((s) => s.fill)).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
  expect(segments.findIndex((s) => s.current)).toBe(3);
  expect(gap).toBe(5);
  // A long session tightens the gap but keeps segments.
  expect(lessonSegments(0, 0, 30)).toMatchObject({ gap: 2 });
  expect(lessonSegments(0, 0, 30).segments).toHaveLength(30);
  // Finished: nothing is current.
  expect(lessonSegments(8, 8, 8).segments.some((s) => s.current)).toBe(false);
});

test('above 40 items the bar groups them into 20 segments that fill in steps', () => {
  const { segments } = lessonSegments(5, 5, 60);
  expect(segments).toHaveLength(20);
  // 3 items per segment: the first full, the second 2/3 full and current.
  expect(segments[0]?.fill).toBe(1);
  expect(segments[1]?.fill).toBeCloseTo(2 / 3);
  expect(segments[1]?.current).toBe(true);
  expect(segments[2]?.fill).toBe(0);
});

test('a run turns gold at 5 and flame at 7, labelled from 3', () => {
  expect([0, 4, 5, 6, 7, 12].map(runTier)).toEqual([
    'none',
    'none',
    'gold',
    'gold',
    'flame',
    'flame',
  ]);
  expect(runLabel(2)).toBeUndefined();
  expect(runLabel(3)).toBe('3 IN A ROW');
  expect(runLabel(7)).toBe('7 IN A ROW · ON FIRE');
});

test('screen readers hear done of total, and the run from 2', () => {
  expect(progressLabel(5, 8, 0)).toBe('5 of 8 done');
  expect(progressLabel(5, 8, 2)).toBe('5 of 8 done, 2 in a row');
  expect(progressLabel(9, 8, 0)).toBe('8 of 8 done');
  expect(progressLabel(0, 0, 0)).toBe('No steps');
});
