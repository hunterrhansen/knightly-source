import { preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { RootNavigator } from '../features/shell/root-navigator';
import { AuthProvider } from '../lib/auth/auth-provider';
import { AppProviders } from '../theme/app-providers';

// AppProviders hides the splash once the matching launch screen has laid out.
void preventAutoHideAsync();
export const unstable_settings =
  Platform.OS === 'ios' ? { anchor: '(main)' } : {};
export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </AppProviders>
  );
}
