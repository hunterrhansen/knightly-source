import { fireEvent, render } from '@testing-library/react-native';
import { LineSteps } from './line-steps';
import { stepDelta } from './step-keys';

const san = ['Nf7+', 'Rxf7', 'Qxf7'];
test('the step buttons move through the line and stop at its ends', () => {
  const onStep = jest.fn();
  const view = render(<LineSteps view={3} san={san} onStep={onStep} />);
  expect(view.getByText('3 / 3 · Qxf7')).toBeTruthy();
  const next = view.getByRole('button', { name: 'Next move' });
  expect(next).toBeDisabled();
  fireEvent.press(next);
  fireEvent.press(view.getByRole('button', { name: 'Previous move' }));
  expect(onStep.mock.calls).toEqual([[-1]]);
  view.rerender(<LineSteps view={0} san={san} onStep={onStep} />);
  expect(view.getByRole('button', { name: 'Previous move' })).toBeDisabled();
});
test('arrow keys step unless a control already handled them', () => {
  const key = (k: string, extra: object = {}) =>
    stepDelta({
      key: k,
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      target: null,
      ...extra,
    });
  expect([key('ArrowLeft'), key('ArrowRight'), key('ArrowUp')]).toEqual([
    -1,
    1,
    undefined,
  ]);
  // The board's square focus uses arrows and prevents their default.
  expect(key('ArrowLeft', { defaultPrevented: true })).toBeUndefined();
  expect(key('ArrowRight', { metaKey: true })).toBeUndefined();
  expect(
    key('ArrowRight', { target: { tagName: 'INPUT' } as never }),
  ).toBeUndefined();
});
