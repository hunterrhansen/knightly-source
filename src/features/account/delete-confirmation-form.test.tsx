import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { DeleteConfirmationForm } from './delete-confirmation-form';

// Native field/keyboard behavior belongs to the device check, not the Jest bridge.
jest.mock('./delete-confirmation-form', () =>
  jest.requireActual('./delete-confirmation-form.tsx'),
);
function Harness({
  busy = false,
  confirm,
  cancel,
}: {
  busy?: boolean;
  confirm: () => void;
  cancel: () => void;
}) {
  const [word, setWord] = useState('');
  return (
    <DeleteConfirmationForm
      word={word}
      busy={busy}
      onWordChange={setWord}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
}
test('permanent deletion requires the exact confirmation word and is blocked while busy', () => {
  const confirm = jest.fn();
  const cancel = jest.fn();
  const view = render(<Harness confirm={confirm} cancel={cancel} />);
  const submit = () =>
    screen.getByRole('button', { name: 'Delete everything permanently' });
  expect(submit()).toBeDisabled();
  fireEvent.changeText(
    screen.getByLabelText('Type delete to confirm account deletion'),
    'DELETE',
  );
  expect(submit()).toBeDisabled();
  fireEvent.press(submit());
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.changeText(
    screen.getByLabelText('Type delete to confirm account deletion'),
    'delete',
  );
  expect(submit()).toBeEnabled();
  view.rerender(<Harness busy confirm={confirm} cancel={cancel} />);
  expect(submit()).toBeDisabled();
  fireEvent.press(submit());
  expect(confirm).not.toHaveBeenCalled();
  view.rerender(<Harness confirm={confirm} cancel={cancel} />);
  fireEvent.press(submit());
  expect(confirm).toHaveBeenCalledTimes(1);
});
test('keeping the account cancels confirmation without submitting deletion', () => {
  const confirm = jest.fn();
  const cancel = jest.fn();
  render(<Harness confirm={confirm} cancel={cancel} />);
  fireEvent.changeText(
    screen.getByLabelText('Type delete to confirm account deletion'),
    'delete',
  );
  fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).not.toHaveBeenCalled();
});
