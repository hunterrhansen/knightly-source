import { fireEvent, render } from '@testing-library/react-native';
import { SettingsPicker } from './settings-picker';

test('unavailable pickers and unknown selections cannot change an appearance preference', () => {
  const change = jest.fn();
  const options = [
    { value: 'sage', label: 'Sage' },
    { value: 'calm', label: 'Calm' },
  ];
  const view = render(
    <SettingsPicker
      label="Board colors"
      value="sage"
      options={options}
      onChange={change}
      disabled
    />,
  );
  const control = () => view.getByRole('combobox', { name: 'Board colors' });
  expect(control()).toBeDisabled();
  fireEvent(control(), 'valueChange', 'calm');
  expect(change).not.toHaveBeenCalled();
  view.rerender(
    <SettingsPicker
      label="Board colors"
      value="sage"
      options={options}
      onChange={change}
    />,
  );
  fireEvent(control(), 'valueChange', 'missing');
  expect(change).not.toHaveBeenCalled();
  fireEvent(control(), 'valueChange', 'calm');
  expect(change).toHaveBeenCalledWith('calm');
  expect(change).toHaveBeenCalledTimes(1);
});
