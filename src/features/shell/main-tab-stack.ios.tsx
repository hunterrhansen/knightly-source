import { Stack, useRouter } from 'expo-router';
import { useFoundation } from '../../lib/auth/auth-provider';
import { useNavigationHeaderOptions } from '../../ui';
import { NativeAvatarButton } from '../../ui/native-settings';
import { TodayStreakBadge } from '../today/today-api';
/**
 * A tab's stack; Today may show the streak beside its native title.
 * `preview` shows the sample account and opens the Account preview instead.
 */
export function MainTabStack({
  brand = false,
  preview = false,
}: {
  brand?: boolean;
  preview?: boolean;
}) {
  const options = useNavigationHeaderOptions();
  const state = useFoundation();
  const router = useRouter();
  const accountName = preview
    ? 'Alex Morgan'
    : (state.account ?? 'Your account');
  const openAccount = () =>
    router.push(preview ? '/account-preview' : '/account');
  // Each destination owns its native stack and Account action.
  return (
    <>
      <Stack screenOptions={options}>
        <Stack.Screen name="index">
          {brand && !preview && (
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.View hidesSharedBackground>
                <TodayStreakBadge />
              </Stack.Toolbar.View>
            </Stack.Toolbar>
          )}
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.View hidesSharedBackground>
              <NativeAvatarButton
                name={accountName}
                label="Account & settings"
                onPress={openAccount}
              />
            </Stack.Toolbar.View>
          </Stack.Toolbar>
        </Stack.Screen>
      </Stack>
    </>
  );
}
