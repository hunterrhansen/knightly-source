import { fireEvent, render } from '@testing-library/react-native';
import { Button } from './button';
import { Card } from './card';

test('a static card preserves its independent footer action', () => {
  const onPress = jest.fn();
  const view = render(
    <Card
      title="Daily practice"
      footer={<Button onPress={onPress}>Start practice</Button>}
    />,
  );
  expect(view.getByRole('header', { name: 'Daily practice' })).toBeTruthy();
  expect(view.getAllByRole('button')).toHaveLength(1);
  fireEvent.press(view.getByRole('button', { name: 'Start practice' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('a whole-card action has an explicit name and cannot activate while disabled', () => {
  const onPress = jest.fn();
  const view = render(
    <Card
      title="Review a game"
      onPress={onPress}
      accessibilityLabel="Open game review"
      disabled
    />,
  );
  const button = view.getByRole('button', { name: 'Open game review' });
  expect(button).toBeDisabled();
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  view.rerender(
    <Card
      title="Review a game"
      onPress={onPress}
      accessibilityLabel="Open game review"
    />,
  );
  fireEvent.press(view.getByRole('button', { name: 'Open game review' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
