import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from 'react';
import { readApiOrigin } from '../app-config';
import { Bootstrap } from '../bootstrap';
import { clearReturnRoute } from './return-route';
import { SessionBoundary } from './session-boundary';

type FoundationState = {
  phase: 'loading' | 'error' | 'signed-out' | 'signed-in';
  message?: string;
  account?: string;
  contact?: string | null;
  retry: () => void;
};
const Context = createContext<FoundationState>({
  phase: 'loading',
  retry: () => {},
});
export function useFoundation() {
  return useContext(Context);
}
/**
 * Development builds only: `EXPO_PUBLIC_DEV_AUTH=local` skips Clerk and acts as the
 * backend's single "local" user (`npm run api:local`). Production bundles compile with
 * `__DEV__` false, so the flag has no effect there. Not sign-in evidence.
 */
export function localDevAuthEnabled(dev: boolean, flag: string | undefined) {
  return dev && flag === 'local';
}
export function AuthProvider({ children }: PropsWithChildren) {
  if (localDevAuthEnabled(__DEV__, process.env.EXPO_PUBLIC_DEV_AUTH))
    return <LocalDevSession>{children}</LocalDevSession>;
  return (
    <Bootstrap value={process.env.EXPO_PUBLIC_API_URL}>
      {(state) =>
        state.phase === 'ready' ? (
          <ClerkProvider
            publishableKey={state.config.clerk_publishable_key}
            tokenCache={tokenCache}
          >
            <ClerkSession
              apiOrigin={state.apiOrigin}
              contact={state.config.contact}
            >
              {children}
            </ClerkSession>
          </ClerkProvider>
        ) : (
          <Context.Provider
            value={{
              phase: state.phase,
              message: state.phase === 'error' ? state.message : undefined,
              retry: state.retry,
            }}
          >
            {children}
          </Context.Provider>
        )
      }
    </Bootstrap>
  );
}
function ClerkSession({
  apiOrigin,
  contact,
  children,
}: PropsWithChildren<{ apiOrigin: string; contact: string | null }>) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const state: FoundationState = {
    phase:
      !isLoaded || (isSignedIn && (!userId || !sessionId))
        ? 'loading'
        : isSignedIn
          ? 'signed-in'
          : 'signed-out',
    contact,
    account:
      user?.primaryEmailAddress?.emailAddress ??
      user?.username ??
      'Your Knightly account',
    retry: () => {},
  };
  const content = <Context.Provider value={state}>{children}</Context.Provider>;
  return (
    <SessionBoundary
      identity={
        isLoaded && isSignedIn && userId && sessionId
          ? { apiOrigin, userId, sessionId }
          : null
      }
      getToken={() => getToken()}
      signOut={async () => {
        clearReturnRoute();
        await clerk.signOut();
      }}
    >
      {content}
    </SessionBoundary>
  );
}

function localOrigin(): string {
  const origin = readApiOrigin(process.env.EXPO_PUBLIC_API_URL, true);
  const { hostname } = new URL(origin);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname))
    throw new Error('Local development sign-in only talks to a loopback API.');
  return origin;
}
function LocalDevSession({ children }: PropsWithChildren) {
  // "Sign out" starts a fresh local session (a new cache scope) for the same user.
  const [session, setSession] = useState(1);
  let apiOrigin: string;
  try {
    apiOrigin = localOrigin();
  } catch (error) {
    return (
      <Context.Provider
        value={{
          phase: 'error',
          message: error instanceof Error ? error.message : String(error),
          retry: () => {},
        }}
      >
        {children}
      </Context.Provider>
    );
  }
  return (
    <SessionBoundary
      identity={{
        apiOrigin,
        userId: 'local',
        sessionId: `local-dev-${session}`,
      }}
      getToken={async () => 'local-dev'}
      signOut={async () => {
        clearReturnRoute();
        setSession((n) => n + 1);
      }}
    >
      <Context.Provider
        value={{
          phase: 'signed-in',
          contact: null,
          account: 'Local developer',
          retry: () => {},
        }}
      >
        {children}
      </Context.Provider>
    </SessionBoundary>
  );
}
