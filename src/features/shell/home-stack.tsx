import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable } from 'react-native';
import { useFoundation } from '../../lib/auth/auth-provider';
import { createStyles } from '../../theme/theme';
import {
  Avatar,
  stackArrivalLayout,
  useNavigationHeaderOptions,
} from '../../ui';
import { TodayStreakBadge } from '../today/today-api';
import { useNodeSheetOptions } from './node-sheet-options';

/**
 * The one screen's stack (docs/specs/2026-10-19-path-home-design.md, "One
 * screen, no tab bar"): natively the streak at the top left and the avatar
 * (Account) at the top right of the path's header; the web has no native
 * header, so the path draws them itself. A node's card opens over it.
 */
export function HomeStack() {
  const options = useNavigationHeaderOptions();
  const nodeSheet = useNodeSheetOptions();
  const state = useFoundation();
  const router = useRouter();
  const styles = useStyles();
  const accountName = state.account ?? 'Your account';
  return (
    <Stack
      screenLayout={stackArrivalLayout}
      screenOptions={{ ...options, headerShown: Platform.OS !== 'web' }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerLeft: () => <TodayStreakBadge />,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Account & settings"
              onPress={() => router.push('/account')}
              style={styles.avatar}
            >
              {({ pressed }) => <Avatar name={accountName} pressed={pressed} />}
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="node" options={nodeSheet} />
    </Stack>
  );
}

const useStyles = createStyles(() => ({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
