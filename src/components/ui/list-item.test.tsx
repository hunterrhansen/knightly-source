import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ListItem } from './list-item';

test('static rows stay informational while interactive rows expose a complete accessible name', () => {
  const view = render(
    <>
      <ListItem label="Account" description="Connected" />
      <ListItem
        label="Review game"
        description="New lesson"
        leading={<Text>♞</Text>}
        onPress={() => {}}
      />
    </>,
  );
  expect(view.queryByRole('button', { name: /Account/ })).toBeNull();
  expect(view.getByText('Connected')).toBeTruthy();
  expect(view.getAllByRole('button')).toHaveLength(1);
  expect(
    view.getByRole('button', { name: 'Review game, New lesson' }),
  ).toBeTruthy();
});

test('disabled list actions cannot activate until enabled', () => {
  const onPress = jest.fn();
  const view = render(
    <ListItem label="Review game" disabled onPress={onPress} />,
  );
  const button = view.getByRole('button', { name: 'Review game' });
  expect(button).toBeDisabled();
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  view.rerender(<ListItem label="Review game" onPress={onPress} />);
  fireEvent.press(view.getByRole('button', { name: 'Review game' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
