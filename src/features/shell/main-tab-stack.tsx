import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable } from 'react-native';
import { useFoundation } from '../../lib/auth/auth-provider';
import {
  Avatar,
  stackArrivalLayout,
  useNavigationHeaderOptions,
} from '../../ui';
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
  const accountAvatar = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account & settings"
      onPress={openAccount}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {({ pressed }) => <Avatar name={accountName} pressed={pressed} />}
    </Pressable>
  );
  // The tab settles in when switched to; its own pushes animate natively
  // (or through the arrival layout on the web).
  return (
    <>
      <Stack
        screenLayout={stackArrivalLayout}
        screenOptions={{
          ...options,
          headerShown: Platform.OS !== 'web',
          headerRight: () => accountAvatar,
        }}
      >
        <Stack.Screen
          name="index"
          options={
            brand && !preview
              ? { headerLeft: () => <TodayStreakBadge /> }
              : undefined
          }
        />
      </Stack>
    </>
  );
}
