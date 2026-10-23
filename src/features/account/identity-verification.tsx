import { useSession, useUser } from '@clerk/expo';
import type {
  SessionVerificationFirstFactor,
  SessionVerificationResource,
  SessionVerificationSecondFactor,
} from '@clerk/expo/types';
import { useEffect, useRef, useState } from 'react';
import { IdentityVerificationForm } from './identity-verification-form';

type Factor = SessionVerificationFirstFactor | SessionVerificationSecondFactor;
type Pending = {
  sessionId: string;
  resolve: () => void;
  reject: (error: Error) => void;
};
const supported = new Set([
  'password',
  'email_code',
  'phone_code',
  'totp',
  'backup_code',
  'passkey',
]);
function factorLabel(factor: Factor) {
  const names: Record<string, string> = {
    password: 'Password',
    email_code: 'Email code',
    phone_code: 'Text message code',
    totp: 'Authenticator code',
    backup_code: 'Backup code',
    passkey: 'Passkey',
  };
  return `${names[factor.strategy] ?? factor.strategy}${'safeIdentifier' in factor ? ` · ${factor.safeIdentifier}` : ''}`;
}
/** Reverify before backend deletion; no web-only Clerk UI is required. */
export function useDeleteIdentity() {
  const { user } = useUser();
  const { session } = useSession();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pending = useRef<Pending | null>(null);
  const [verification, setVerification] =
    useState<SessionVerificationResource | null>(null);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operating = useRef<Pending | null>(null);
  function cancel() {
    const request = pending.current;
    pending.current = null;
    request?.reject(new Error('Identity verification cancelled.'));
    operating.current = null;
    setVerification(null);
    setFactor(null);
    setCredential('');
    setError('');
    setBusy(false);
  }
  useEffect(() => {
    const owner = session?.id;
    return () => {
      const request = pending.current;
      if (request && request.sessionId === owner) {
        request.reject(new Error('Identity verification cancelled.'));
        pending.current = null;
      }
    };
  }, [session?.id]);
  function current(request: Pending) {
    return (
      pending.current === request &&
      sessionRef.current?.id === request.sessionId
    );
  }
  async function accept(result: SessionVerificationResource, request: Pending) {
    if (!current(request)) return;
    if (result.status === 'complete') {
      const token = await sessionRef.current?.getToken({ skipCache: true });
      if (!current(request)) return;
      if (!token)
        throw new Error('Could not refresh your verified session. Try again.');
      pending.current = null;
      setVerification(null);
      setFactor(null);
      setCredential('');
      request.resolve();
    } else {
      setVerification(result);
      setFactor(null);
      setCredential('');
    }
  }
  async function start(request: Pending) {
    try {
      const active = sessionRef.current;
      if (!active || active.id !== request.sessionId)
        throw new Error('Your account session changed.');
      const result = await active.startVerification({
        level: 'multi_factor',
      });
      await accept(result, request);
    } catch (failure) {
      if (current(request)) {
        pending.current = null;
        setVerification(null);
        request.reject(
          failure instanceof Error
            ? failure
            : new Error('Could not verify your identity.'),
        );
      }
    } finally {
      if (current(request) || !pending.current) setBusy(false);
    }
  }
  function prepare() {
    const active = sessionRef.current;
    if (!active)
      return Promise.reject(
        new Error('Sign in again to verify your identity.'),
      );
    if (pending.current)
      return Promise.reject(
        new Error('Identity verification is already open.'),
      );
    setBusy(true);
    setError('');
    setVerification(null);
    setFactor(null);
    setCredential('');
    return new Promise<void>((resolve, reject) => {
      const request = { sessionId: active.id, resolve, reject };
      pending.current = request;
      void start(request);
    });
  }
  async function select(selected: Factor) {
    const request = pending.current;
    const active = sessionRef.current;
    if (!request || !active || !verification || operating.current) return;
    operating.current = request;
    setBusy(true);
    setError('');
    try {
      let result = verification;
      const first = verification.status === 'needs_first_factor';
      if (selected.strategy === 'passkey') {
        result = await active.verifyWithPasskey();
        await accept(result, request);
        return;
      }
      if (selected.strategy === 'email_code')
        result = await active.prepareFirstFactorVerification({
          strategy: 'email_code',
          emailAddressId: selected.emailAddressId,
        });
      if (selected.strategy === 'phone_code')
        result = first
          ? await active.prepareFirstFactorVerification({
              strategy: 'phone_code',
              phoneNumberId: selected.phoneNumberId,
            })
          : await active.prepareSecondFactorVerification({
              strategy: 'phone_code',
              phoneNumberId: selected.phoneNumberId,
            });
      if (!current(request)) return;
      setVerification(result);
      setFactor(selected);
      setCredential('');
    } catch (failure) {
      if (current(request))
        setError(
          failure instanceof Error
            ? failure.message
            : 'Verification could not start.',
        );
    } finally {
      if (operating.current === request) operating.current = null;
      if (current(request) || !pending.current) setBusy(false);
    }
  }
  async function submit() {
    const request = pending.current;
    const active = sessionRef.current;
    if (
      !request ||
      !active ||
      !verification ||
      !factor ||
      !credential ||
      operating.current
    )
      return;
    operating.current = request;
    setBusy(true);
    setError('');
    try {
      let result: SessionVerificationResource;
      if (verification.status === 'needs_first_factor') {
        if (factor.strategy === 'password')
          result = await active.attemptFirstFactorVerification({
            strategy: 'password',
            password: credential,
          });
        else if (
          factor.strategy === 'email_code' ||
          factor.strategy === 'phone_code'
        )
          result = await active.attemptFirstFactorVerification({
            strategy: factor.strategy,
            code: credential.trim(),
          });
        else throw new Error('Select another verification method.');
      } else if (
        factor.strategy === 'phone_code' ||
        factor.strategy === 'totp' ||
        factor.strategy === 'backup_code'
      )
        result = await active.attemptSecondFactorVerification({
          strategy: factor.strategy,
          code: credential.trim(),
        });
      else throw new Error('Select another verification method.');
      await accept(result, request);
    } catch (failure) {
      if (current(request))
        setError(
          failure instanceof Error
            ? failure.message
            : 'The code could not be verified.',
        );
    } finally {
      if (operating.current === request) operating.current = null;
      if (current(request) || !pending.current) setBusy(false);
    }
  }
  const factors =
    (verification?.status === 'needs_first_factor'
      ? verification.supportedFirstFactors
      : verification?.supportedSecondFactors
    )?.filter((item) => supported.has(item.strategy)) ?? [];
  const verificationUI = pending.current ? (
    <IdentityVerificationForm
      secondFactor={verification?.status === 'needs_second_factor'}
      busy={busy}
      error={error}
      credential={credential}
      onCredentialChange={setCredential}
      method={
        factor
          ? {
              label: factorLabel(factor),
              password: factor.strategy === 'password',
              numeric: ['email_code', 'phone_code', 'totp'].includes(
                factor.strategy,
              ),
            }
          : null
      }
      methods={factors.map((item) => ({
        key: `${item.strategy}:${'emailAddressId' in item ? item.emailAddressId : 'phoneNumberId' in item ? item.phoneNumberId : ''}`,
        label: factorLabel(item),
        onSelect: () => void select(item),
      }))}
      onSubmit={() => void submit()}
      onAnotherMethod={() => {
        setFactor(null);
        setCredential('');
        setError('');
      }}
      onCancel={cancel}
    />
  ) : null;
  return {
    remove: user?.deleteSelfEnabled
      ? async () => {
          if (!user || sessionRef.current?.user.id !== user.id)
            throw new Error('Sign in again to finish deletion.');
          await user.delete();
        }
      : undefined,
    prepare,
    cancel,
    verificationUI,
  };
}
