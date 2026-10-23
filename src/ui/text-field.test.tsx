import { fireEvent, render } from '@testing-library/react-native';
import { TextField } from './text-field';

test('fields expose a stable label and announce validation errors instead of help', () => {
  const view = render(
    <TextField
      label="Username"
      placeholder="Enter username"
      value=""
      helpText="Use your public username."
    />,
  );
  expect(view.getByLabelText('Username').props.accessibilityHint).toBe(
    'Use your public username.',
  );
  view.rerender(
    <TextField
      label="Username"
      placeholder="Enter username"
      value=""
      helpText="Use your public username."
      error="Enter a username."
    />,
  );
  expect(view.getByLabelText('Username').props.accessibilityHint).toBe(
    'Enter a username.',
  );
  expect(view.getByRole('alert').props.children).toBe('Enter a username.');
  expect(view.queryByText('Use your public username.')).toBeNull();
});

test('busy fields cannot edit credentials or submit again until enabled', () => {
  const change = jest.fn();
  const submit = jest.fn();
  const view = render(
    <TextField
      label="Password"
      value="secret"
      secureTextEntry
      editable={false}
      onChangeText={change}
      onSubmitEditing={submit}
    />,
  );
  let input = view.getByLabelText('Password');
  expect(input.props.secureTextEntry).toBe(true);
  expect(input).toBeDisabled();
  expect(input.props['aria-disabled']).toBe(true);
  fireEvent.changeText(input, 'replacement');
  fireEvent(input, 'submitEditing', { nativeEvent: { text: 'secret' } });
  expect(change).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  view.rerender(
    <TextField
      label="Password"
      value="secret"
      secureTextEntry
      onChangeText={change}
      onSubmitEditing={submit}
    />,
  );
  input = view.getByLabelText('Password');
  fireEvent.changeText(input, 'replacement');
  fireEvent(input, 'submitEditing', { nativeEvent: { text: 'replacement' } });
  expect(change).toHaveBeenCalledWith('replacement');
  expect(submit).toHaveBeenCalledTimes(1);
});

test('switching verification methods clears the previous controlled credential', () => {
  const change = jest.fn();
  const view = render(
    <TextField
      label="Verification code"
      value="123456"
      onChangeText={change}
      autoComplete="one-time-code"
    />,
  );
  const input = () => view.getByLabelText('Verification code');
  expect(input().props.autoComplete).toBe('one-time-code');
  fireEvent.changeText(input(), '654321');
  expect(change).toHaveBeenCalledWith('654321');
  view.rerender(
    <TextField
      label="Verification code"
      value=""
      onChangeText={change}
      autoComplete="one-time-code"
    />,
  );
  expect(input().props.value).toBe('');
});
