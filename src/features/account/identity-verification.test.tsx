import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../../ui';
import { useDeleteIdentity } from './identity-verification';

// Verify controller safeguards through the real RN form; SwiftUI is checked on-device.
jest.mock('./identity-verification-form', () =>
  jest.requireActual('./identity-verification-form.tsx'),
);

const first = {
  status: 'needs_first_factor',
  supportedFirstFactors: [
    {
      strategy: 'email_code',
      emailAddressId: 'email-a',
      safeIdentifier: 'h***@example.com',
    },
  ],
  supportedSecondFactors: [],
};
const second = {
  status: 'needs_second_factor',
  supportedFirstFactors: [],
  supportedSecondFactors: [{ strategy: 'totp' }],
};
let mockSession: Record<string, unknown>;
jest.mock('@clerk/expo', () => ({
  useSession: () => ({ session: mockSession }),
  useUser: () => ({ user: { id: 'user-a', deleteSelfEnabled: true } }),
}));
function Harness({
  complete,
  cancel,
}: {
  complete: () => void;
  cancel: () => void;
}) {
  const identity = useDeleteIdentity();
  return (
    <>
      <Button
        onPress={() => {
          void identity.prepare().then(complete, cancel);
        }}
      >
        Begin verification
      </Button>
      {identity.verificationUI}
    </>
  );
}
beforeEach(() => {
  mockSession = {
    id: 'session-a',
    user: { id: 'user-a' },
    startVerification: jest.fn().mockResolvedValue(first),
    prepareFirstFactorVerification: jest.fn().mockResolvedValue(first),
    attemptFirstFactorVerification: jest
      .fn()
      .mockResolvedValue({ status: 'complete' }),
    attemptSecondFactorVerification: jest
      .fn()
      .mockResolvedValue({ status: 'complete' }),
    getToken: jest.fn().mockResolvedValue('verified-token'),
  };
});
async function email() {
  fireEvent.press(screen.getByRole('button', { name: 'Begin verification' }));
  fireEvent.press(
    await screen.findByRole('button', {
      name: 'Email code · h***@example.com',
    }),
  );
  await screen.findByLabelText('Verification code');
}
test('a rejected code never completes identity verification; a verified code refreshes the session', async () => {
  const complete = jest.fn();
  (
    mockSession.attemptFirstFactorVerification as jest.Mock
  ).mockRejectedValueOnce(new Error('Incorrect code'));
  render(<Harness complete={complete} cancel={jest.fn()} />);
  await email();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '111111');
  fireEvent.press(screen.getByRole('button', { name: 'Verify identity' }));
  await screen.findByText('Incorrect code');
  expect(complete).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '424242');
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Verify identity' }));
  });
  expect(complete).toHaveBeenCalledTimes(1);
  expect(mockSession.getToken).toHaveBeenCalledWith({ skipCache: true });
});
test('a required second factor must finish before verification completes', async () => {
  const complete = jest.fn();
  (mockSession.attemptFirstFactorVerification as jest.Mock).mockResolvedValue(
    second,
  );
  render(<Harness complete={complete} cancel={jest.fn()} />);
  await email();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '424242');
  fireEvent.press(screen.getByRole('button', { name: 'Verify identity' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Authenticator code' }),
  );
  await screen.findByLabelText('Verification code');
  expect(complete).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Verify identity' }));
  });
  expect(complete).toHaveBeenCalledTimes(1);
  expect(mockSession.attemptSecondFactorVerification).toHaveBeenCalledWith({
    strategy: 'totp',
    code: '123456',
  });
});
test('cancellation rejects the pending proof without completing it', async () => {
  const complete = jest.fn();
  const cancel = jest.fn();
  render(<Harness complete={complete} cancel={cancel} />);
  fireEvent.press(screen.getByRole('button', { name: 'Begin verification' }));
  await screen.findByRole('button', { name: 'Email code · h***@example.com' });
  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: 'Cancel verification' }),
    );
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(complete).not.toHaveBeenCalled();
  expect(mockSession.getToken).not.toHaveBeenCalled();
});
