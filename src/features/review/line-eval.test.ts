import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { addLine, gameTree, type LinePath } from '../../chess/line-tree';
import type { EngineLine } from '../../lib/engine/stockfish';
import { engineRequest, fromWhite, useLineEval } from './line-eval';

type Search = {
  request: { fen: string; moves?: readonly string[] };
  signal?: AbortSignal;
  update: (lines: EngineLine[]) => void;
  finish: (lines: EngineLine[]) => void;
};
const searches: Search[] = [];
jest.mock('../../lib/engine/stockfish', () => ({
  getStockfish: () => ({
    search: (
      request: Search['request'] & {
        onUpdate?: (lines: EngineLine[]) => void;
      },
      signal?: AbortSignal,
    ) =>
      new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('superseded');
          error.name = 'AbortError';
          reject(error);
        });
        searches.push({
          request,
          signal,
          update: (lines) => request.onUpdate?.(lines),
          finish: (lines) => resolve({ bestmove: null, lines }),
        });
      }),
  }),
}));

const line = (cp: number, depth = 14): EngineLine => ({
  multipv: 1,
  depth,
  score: { type: 'cp', value: cp },
  pv: ['g8f6'],
});
const game = gameTree(null, ['e4', 'e5', 'Nf3']);

test('the engine gets the position after the last capture or pawn move, then the moves since', () => {
  const tree =
    addLine(game, ['e2e4', 'e7e5'], ['g1f3', 'b8c6', 'f1b5'], 'user')?.tree ??
    game;
  expect(engineRequest(tree, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])).toEqual(
    {
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      moves: ['g1f3', 'b8c6', 'f1b5'],
    },
  );
});

test('scores read from White’s side whoever is to move', () => {
  // Black to move and 0.35 better for Black: White is 0.35 worse.
  expect(fromWhite(line(35), 'b', true)).toMatchObject({
    text: '−0.35',
    best: 'g8f6',
  });
  expect(fromWhite(line(0), 'w', true).white).toBe(50);
  expect(fromWhite(line(300), 'w', true).white).toBeGreaterThan(75);
  // Black to move and mating in 3.
  expect(
    fromWhite({ ...line(0), score: { type: 'mate', value: 3 } }, 'b', true),
  ).toMatchObject({ text: '−M3', white: 0 });
  // A shallow search draws no arrow yet.
  expect(fromWhite(line(20, 8), 'w', false).best).toBeUndefined();
});

test('a result for a position the board has left never shows', async () => {
  searches.length = 0;
  const first: LinePath = ['e2e4', 'e7e5', 'g1f3'];
  const second: LinePath = ['e2e4', 'e7e5'];
  const { result, rerender } = renderHook(
    ({ path }: { path: LinePath }) => useLineEval(game, path),
    { initialProps: { path: first } },
  );
  expect(result.current.status).toBe('thinking');
  rerender({ path: second });
  expect(searches[0]?.signal?.aborted).toBe(true);
  await act(async () => {
    searches[0]?.update([line(900)]);
    searches[1]?.finish([line(-20)]);
  });
  expect(result.current).toMatchObject({ status: 'ready', text: '−0.20' });
});

test('the search stops while the app is in the background and starts again on return', async () => {
  searches.length = 0;
  let change: (state: AppStateStatus) => void = () => {};
  const spy = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_, handler) => {
      change = handler;
      return { remove: () => {} };
    });
  const path: LinePath = ['e2e4', 'e7e5', 'g1f3'];
  renderHook(() => useLineEval(game, path));
  expect(searches).toHaveLength(1);
  act(() => change('background'));
  expect(searches[0]?.signal?.aborted).toBe(true);
  act(() => change('active'));
  expect(searches).toHaveLength(2);
  expect(searches[1]?.signal?.aborted).toBe(false);
  spy.mockRestore();
});
