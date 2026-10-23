import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useRef, useState } from 'react';
import { Body, Button } from '../../ui';
export function SignInAction() {
  const { startHostedAuth } = useHostedAuth();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function start(mode: 'sign-in' | 'sign-up') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await startHostedAuth({ mode });
    } catch {
      setError('Sign-in could not finish. Try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Body>{error}</Body>}
      <Button disabled={busy} onPress={() => void start('sign-in')}>
        {busy ? 'Opening sign-in…' : 'Sign in to Knightly'}
      </Button>
      <Button
        variant="secondary"
        disabled={busy}
        onPress={() => void start('sign-up')}
      >
        Create an account
      </Button>
    </>
  );
}
