import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { Notice } from '../../components/ui/foundation';
import { CACHE_MAX_AGE, CACHE_VERSION } from '../query-cache';
import {
  createSessionScope,
  type SessionIdentity,
  type SessionScope,
} from './session-scope';

type Session = {
  identity: SessionIdentity;
  scope: SessionScope;
  signOut: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function useSessionScope(): Session {
  const session = useContext(Context);
  if (!session) throw new Error('An authenticated session is required.');
  return session;
}
type Props = PropsWithChildren<{
  identity: SessionIdentity | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}>;
export function SessionBoundary(props: Props) {
  const { identity } = props;
  const previous = useRef<{ key: string; scope: SessionScope } | null>(null);
  useLayoutEffect(() => {
    if (!identity && previous.current) {
      previous.current.scope.dispose();
      void previous.current.scope.cache.clear();
      previous.current = null;
    }
  }, [identity]);
  const opened = useCallback((key: string, scope: SessionScope) => {
    if (previous.current && previous.current.key !== key)
      void previous.current.scope.cache.clear();
    previous.current = { key, scope };
  }, []);
  if (!identity) return <>{props.children}</>;
  return (
    <ActiveSession
      key={JSON.stringify(identity)}
      {...props}
      identity={identity}
      opened={opened}
    />
  );
}
function ActiveSession({
  identity,
  getToken,
  signOut,
  children,
  opened,
}: Props & {
  identity: SessionIdentity;
  opened: (key: string, scope: SessionScope) => void;
}) {
  const { apiOrigin, userId, sessionId } = identity;
  const getter = useRef(getToken);
  getter.current = getToken;
  const [scope, setScope] = useState<SessionScope | null>(null);
  const [phase, setPhase] = useState<'ready' | 'closing' | 'failed'>('ready');
  const signOutRunning = useRef(false);
  useLayoutEffect(() => {
    const fresh = createSessionScope(
      {
        apiOrigin,
        userId,
        sessionId,
      },
      () => getter.current(),
    );
    opened(JSON.stringify({ apiOrigin, userId, sessionId }), fresh);
    setScope(fresh);
    return () => fresh.dispose();
  }, [apiOrigin, userId, sessionId, opened]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);
  async function close() {
    if (signOutRunning.current) return;
    signOutRunning.current = true;
    scope?.dispose();
    setPhase('closing');
    try {
      await scope?.cache.clear();
      await signOut();
    } catch {
      setPhase('failed');
    } finally {
      signOutRunning.current = false;
    }
  }
  if (phase === 'closing')
    return (
      <Notice title="Signing out…" message="Closing your account session." />
    );
  if (phase === 'failed')
    return (
      <Notice
        title="Sign-out could not finish"
        message="Your account content is hidden. Retry to finish signing out."
        action="Retry sign out"
        onAction={() => void close()}
      />
    );
  if (!scope?.isCurrent()) return <Notice title="Opening your account…" />;
  return (
    <Context.Provider value={{ identity, scope, signOut: close }}>
      <PersistQueryClientProvider
        client={scope.queryClient}
        onSuccess={() => {
          if (!scope.isCurrent()) scope.queryClient.clear();
        }}
        persistOptions={{
          persister: scope.cache.persister,
          buster: CACHE_VERSION,
          maxAge: CACHE_MAX_AGE,
          hydrateOptions: {
            defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } },
          },
          dehydrateOptions: {
            shouldDehydrateMutation: () => false,
            shouldDehydrateQuery: (query) => query.state.data !== undefined,
          },
        }}
      >
        {children}
      </PersistQueryClientProvider>
    </Context.Provider>
  );
}
