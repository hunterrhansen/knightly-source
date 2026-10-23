import {
  addLine,
  deleteFrom,
  gamePath,
  gamePlies,
  gameTree,
  lineEnd,
  nodeAt,
} from './line-tree';

const game = gameTree(null, ['e4', 'e5', 'Nf3', 'Nc6']);
const sans = (children: readonly { san: string }[] | undefined) =>
  children?.map((c) => c.san);

test('playing the game’s own move steps into it instead of adding a line', () => {
  const played = addLine(game, ['e2e4'], ['e7e5'], 'user');
  expect(played?.path).toEqual(['e2e4', 'e7e5']);
  expect(played?.tree).toBe(game);
  expect(gamePlies(game, played?.path ?? [])).toBe(2);
});

test('a new move becomes a side line after the game’s move, which stays first', () => {
  const first = addLine(game, ['e2e4'], ['c7c5'], 'user');
  const second = first && addLine(first.tree, ['e2e4'], ['e7e6'], 'user');
  expect(sans(nodeAt(second?.tree ?? game, ['e2e4'])?.children)).toEqual([
    'e5',
    'c5',
    'e6',
  ]);
  expect(second?.path).toEqual(['e2e4', 'e7e6']);
  expect(gamePlies(second?.tree ?? game, second?.path ?? [])).toBe(1);
});

test('replaying a side line’s move steps into it rather than duplicating it', () => {
  const first = addLine(game, ['e2e4'], ['c7c5', 'g1f3'], 'user');
  const again = first && addLine(first.tree, ['e2e4'], ['c7c5'], 'user');
  expect(again?.tree).toBe(first?.tree);
  expect(sans(nodeAt(again?.tree ?? game, ['e2e4'])?.children)).toEqual([
    'e5',
    'c5',
  ]);
  expect(lineEnd(again?.tree ?? game, ['e2e4', 'c7c5'])).toEqual([
    'e2e4',
    'c7c5',
    'g1f3',
  ]);
});

test('an illegal move or an unknown path adds nothing', () => {
  expect(addLine(game, ['e2e4'], ['e7e4'], 'user')).toBeUndefined();
  expect(addLine(game, ['d2d4'], ['d7d5'], 'user')).toBeUndefined();
});

test('deleting removes a side line from that move on but never a game move', () => {
  const line = addLine(game, ['e2e4'], ['c7c5', 'g1f3', 'd7d6'], 'user');
  const tree = line?.tree ?? game;
  const cut = deleteFrom(tree, ['e2e4', 'c7c5', 'g1f3']);
  expect(lineEnd(cut, ['e2e4', 'c7c5'])).toEqual(['e2e4', 'c7c5']);
  expect(deleteFrom(cut, ['e2e4', 'e7e5'])).toBe(cut);
  expect(gamePath(cut, 4)).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
});
