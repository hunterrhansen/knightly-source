import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccountLayout } from './account-layout';
import { AccountSettingsPage } from './account-settings-screen';
export function AccountPreviewScreen() {
  const router = useRouter();
  return (
    <AccountLayout
      preview
      accountName="Alex Morgan"
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/shell-lab')
      }
      onOpenPrivacy={() => router.push('/account-privacy-preview')}
      onOpenSettings={(section) =>
        router.push({
          pathname: '/account-settings-preview',
          params: { section },
        })
      }
    />
  );
}
export function AccountSettingsPreviewScreen() {
  const router = useRouter();
  const { section, choice } = useLocalSearchParams<{
    section?: string;
    choice?: string;
  }>();
  return (
    <AccountSettingsPage
      preview
      section={section ?? 'appearance'}
      choice={choice}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/account-preview')
      }
      onOpenChoice={(choice) =>
        router.push({
          pathname: '/account-settings-preview',
          params: { section: 'appearance', choice },
        })
      }
    />
  );
}
