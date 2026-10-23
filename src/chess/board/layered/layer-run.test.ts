import type { VisualPiece } from '../transition';
import { type LayerRun, restartsTravel } from './layer-run';

// The opponent's last move: the queen came from d1 and still says so.
const afterMove: readonly VisualPiece[] = [
  { id: 'p:t1:h5', square: 'h5', kind: 'q', color: 'w', from: 'd1' },
  { id: 'p:t1:e1', square: 'e1', kind: 'k', color: 'w' },
] as readonly VisualPiece[];
const atlas = {};
const run = (over: Partial<LayerRun> = {}): LayerRun => ({
  pieces: afterMove,
  orientation: 'w',
  square: 48,
  atlas,
  ...over,
});

test('tapping a piece after a move never replays that move', () => {
  // Same pieces, geometry and atlas: only the selection changed.
  expect(restartsTravel(run(), run())).toBe(false);
});

test('a new position or transition starts its travel', () => {
  expect(restartsTravel(undefined, run())).toBe(true);
  const next = [
    { id: 'p:t2:f7', square: 'f7', kind: 'q', color: 'w', from: 'h5' },
    afterMove[1],
  ] as readonly VisualPiece[];
  expect(restartsTravel(run(), run({ pieces: next }))).toBe(true);
});

test('a new board size, orientation or piece set redraws', () => {
  expect(restartsTravel(run(), run({ square: 40 }))).toBe(true);
  expect(restartsTravel(run(), run({ orientation: 'b' }))).toBe(true);
  expect(restartsTravel(run(), run({ atlas: {} }))).toBe(true);
});
