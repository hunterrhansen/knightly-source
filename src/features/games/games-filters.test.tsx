import { fireEvent, render } from '@testing-library/react-native';
import { GamesFilters } from './games-filters';

// Verify the owned dialog workflow here; SwiftUI presentation is checked on iOS.
jest.mock('./games-filters', () => jest.requireActual('./games-filters.tsx'));
jest.mock('../../components/ui/settings-confirmation', () =>
  jest.requireActual('../../components/ui/settings-confirmation.tsx'),
);

test('cancel discards draft changes and apply commits only the selected draft', () => {
  const apply = jest.fn();
  const cancel = jest.fn();
  const view = render(
    <GamesFilters
      value={{ color: 'black' }}
      onApply={apply}
      onCancel={cancel}
    />,
  );
  fireEvent.press(view.getByRole('button', { name: 'Speed, Any speed' }));
  fireEvent.press(view.getByRole('radio', { name: 'Speed: Rapid' }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
  view.unmount();
  const reopened = render(
    <GamesFilters
      value={{ color: 'black' }}
      onApply={apply}
      onCancel={cancel}
    />,
  );
  fireEvent.press(reopened.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenLastCalledWith({ color: 'black' });
  fireEvent.press(reopened.getByRole('button', { name: 'Reset filters' }));
  expect(apply).toHaveBeenCalledTimes(1);
  fireEvent.press(reopened.getByRole('button', { name: 'Apply filters' }));
  expect(apply).toHaveBeenLastCalledWith({});
});
