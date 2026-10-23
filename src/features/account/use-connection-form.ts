import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSessionScope } from '../../lib/auth/session-boundary';
export type ConnectionFormProps = {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
};
export function useConnectionForm({
  disabled,
  onBusyChange,
}: ConnectionFormProps) {
  const { scope } = useSessionScope();
  const [source, setSource] = useState<'chesscom' | 'lichess'>('chesscom');
  const [handle, setHandle] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const lookup = useQuery({
    queryKey: [...scope.meKey, 'settings-lookup', source, submitted],
    queryFn: ({ signal }) => scope.api.lookup(submitted, signal, source),
    enabled: !!submitted,
    retry: false,
  });
  async function confirm() {
    const account = lookup.data;
    if (!account || disabled || pending.current || !scope.isCurrent()) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage('');
    try {
      await scope.api.connect(account.handle, undefined, source);
      if (!scope.isCurrent()) return;
      setSubmitted('');
      setHandle('');
      await scope.queryClient.invalidateQueries({ queryKey: scope.meKey });
    } catch (error) {
      if (scope.isCurrent())
        setMessage(
          error instanceof Error ? error.message : 'Could not connect.',
        );
    } finally {
      pending.current = false;
      if (scope.isCurrent()) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  function findAccount() {
    if (disabled || busy || lookup.isFetching) return;

    const value = handle.trim();
    if (!/^[A-Za-z0-9_-]{2,40}$/.test(value)) {
      setMessage('Enter a username, not a profile URL.');
      return;
    }
    setMessage('');
    setSubmitted(value);
    if (submitted === value) void lookup.refetch();
  }
  return {
    source,
    setSource,
    handle,
    setHandle,
    submitted,
    setSubmitted,
    message,
    setMessage,
    busy,
    lookup,
    confirm,
    findAccount,
  };
}
