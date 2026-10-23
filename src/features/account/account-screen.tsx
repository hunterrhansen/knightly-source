import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useFoundation } from '../../lib/auth/auth-provider';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { AccountLayout } from './account-layout';
export function AccountScreen() {
  const router = useRouter();
  const { signOut } = useSessionScope();
  const state = useFoundation();
  return (
    <AccountLayout
      accountName={state.account ?? 'Your account'}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      onOpenSettings={(section) =>
        router.push({ pathname: '/account-settings', params: { section } })
      }
      onOpenPrivacy={() =>
        router.push(Platform.OS === 'ios' ? '/account-privacy' : '/privacy')
      }
      onSignOut={() => void signOut()}
    />
  );
}
