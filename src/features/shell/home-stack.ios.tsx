import { Stack, useRouter } from 'expo-router';
import { useFoundation } from '../../lib/auth/auth-provider';
import { useNavigationHeaderOptions } from '../../ui';
import { NativeAvatarButton } from '../../ui/native-settings';
import { TodayStreakBadge } from '../today/today-api';
import { useNodeSheetOptions } from './node-sheet-options';

/**
 * The one screen's stack (docs/specs/2026-10-19-path-home-design.md, "One
 * screen, no tab bar"): the path, with the streak at the top left and the
 * avatar (Account) at the top right, and a node's card as a sheet over it.
 * Games, Progress and Account open over it from the root stack.
 */
export function HomeStack() {
  const options = useNavigationHeaderOptions();
  const nodeSheet = useNodeSheetOptions();
  const state = useFoundation();
  const router = useRouter();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index">
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.View hidesSharedBackground>
            <TodayStreakBadge />
          </Stack.Toolbar.View>
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.View hidesSharedBackground>
            <NativeAvatarButton
              name={state.account ?? 'Your account'}
              label="Account & settings"
              onPress={() => router.push('/account')}
            />
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="node" options={nodeSheet} />
    </Stack>
  );
}
