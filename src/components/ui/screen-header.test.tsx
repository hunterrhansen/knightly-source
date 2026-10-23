import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScreenHeader } from './screen-header';

test('icon actions expose their names and disabled actions cannot activate', () => {
  const close = jest.fn();
  const save = jest.fn();
  const view = render(
    <ScreenHeader
      title="Game review"
      startAction={{
        label: 'Close review',
        content: <Text>×</Text>,
        onPress: close,
      }}
      endAction={{ label: 'Save review', disabled: true, onPress: save }}
    />,
  );
  expect(view.getByRole('header', { name: 'Game review' })).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Close review' }));
  expect(close).toHaveBeenCalledTimes(1);
  const disabled = view.getByRole('button', { name: 'Save review' });
  expect(disabled).toBeDisabled();
  fireEvent.press(disabled);
  expect(save).not.toHaveBeenCalled();
});
