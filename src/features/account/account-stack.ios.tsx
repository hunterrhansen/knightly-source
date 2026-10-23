import { Stack, useNavigation, useRouter } from 'expo-router';
import { useNavigationHeaderOptions } from '../../ui';
/** One navigation stack inside the root modal; Close dismisses its parent, not a detail. */
export function AccountStack({ preview = false }: { preview?: boolean }) {
  const options = useNavigationHeaderOptions();
  const root = useNavigation('/');
  const router = useRouter();
  const names = preview
    ? ['account-preview', 'account-settings-preview', 'account-privacy-preview']
    : ['account', 'account-settings', 'account-privacy'];
  function close() {
    if (root.canGoBack()) root.goBack();
    else router.replace('/');
  }
  return (
    <Stack screenOptions={options}>
      {names.map((name, index) => (
        <Stack.Screen
          key={name}
          name={name}
          options={index === 0 ? { headerBackVisible: false } : undefined}
        >
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="xmark"
              accessibilityLabel="Close settings"
              onPress={close}
            />
          </Stack.Toolbar>
        </Stack.Screen>
      ))}
    </Stack>
  );
}
