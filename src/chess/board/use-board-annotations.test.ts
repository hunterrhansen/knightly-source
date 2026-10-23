import { act, renderHook } from '@testing-library/react-native';
import { useBoardAnnotations } from './use-board-annotations';

test('drawings toggle, cancelled/off-board gestures add nothing and reset rejects stale callbacks', () => {
  const { result, rerender } = renderHook(
    ({ id, enabled }: { id: string; enabled: boolean }) =>
      useBoardAnnotations(id, enabled),
    { initialProps: { id: 'p1', enabled: true } },
  );
  const drawSquare = () =>
    act(() => {
      result.current.begin('e4');
      result.current.finish('e4');
    });
  drawSquare();
  expect(result.current.squares).toEqual([{ square: 'e4', color: 'red' }]);
  drawSquare();
  expect(result.current.squares).toEqual([]);
  act(() => {
    result.current.begin('e2');
    result.current.update('e4');
    result.current.finish('e4');
  });
  expect(result.current.arrows).toEqual([
    { from: 'e2', to: 'e4', color: 'yellow' },
  ]);
  act(() => {
    result.current.begin('e2');
    result.current.finish('e4');
    result.current.begin('d2');
    result.current.cancel();
    result.current.finish('d4');
    result.current.begin('a2');
    result.current.finish(null);
  });
  expect(result.current.arrows).toEqual([]);
  drawSquare();
  const stale = result.current;
  rerender({ id: 'p2', enabled: true });
  act(() => {
    stale.begin('e2');
    stale.finish('e4');
  });
  expect(result.current.squares).toEqual([]);
  expect(result.current.arrows).toEqual([]);
  drawSquare();
  rerender({ id: 'p2', enabled: false });
  expect(result.current.squares).toEqual([]);
});

test('recoloring replaces a mark, repeats toggle it off, and draft colors remain stable', () => {
  const { result } = renderHook(() => useBoardAnnotations('p1', true));
  act(() => {
    result.current.begin('d4', 'alt');
    result.current.update('f5');
  });
  expect(result.current.draft).toMatchObject({ color: 'blue' });
  act(() => result.current.finish('f5'));
  expect(result.current.arrows).toEqual([
    { from: 'd4', to: 'f5', color: 'blue' },
  ]);
  act(() => {
    result.current.begin('d4', 'shift');
    result.current.finish('f5');
  });
  expect(result.current.arrows).toEqual([
    { from: 'd4', to: 'f5', color: 'green' },
  ]);
  act(() => {
    result.current.begin('d4', 'shift');
    result.current.finish('f5');
  });
  expect(result.current.arrows).toEqual([]);
  act(() => {
    result.current.begin('e4', 'ctrl');
    result.current.finish('e4');
  });
  expect(result.current.squares).toEqual([{ square: 'e4', color: 'yellow' }]);
  act(() => {
    result.current.begin('e4');
    result.current.finish('e4');
  });
  expect(result.current.squares).toEqual([{ square: 'e4', color: 'red' }]);
});
