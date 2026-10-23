import {
  type Href,
  router,
  Stack,
  useGlobalSearchParams,
  usePathname,
} from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useFoundation } from '../../lib/auth/auth-provider';
import {
  consumeReturnRoute,
  rememberReturnRoute,
} from '../../lib/auth/return-route';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import { stackArrivalLayout, usePushTransition } from '../../ui';
import {
  cancelDailyReminders,
  DailyReminders,
  TimezoneSync,
} from '../today/today-api';
import { isDestinationAvailable } from './destinations';
export function RootNavigator() {
  const state = useFoundation();
  const reducedMotion = useSystemReducedMotion();
  const push = usePushTransition();
  const path = usePathname();
  const { section, choice, mode } = useGlobalSearchParams<{
    section?: string;
    choice?: string;
    mode?: string;
  }>();
  const modal = {
    presentation:
      Platform.OS === 'ios' ? ('modal' as const) : ('card' as const),
    // iOS: the system sheet with its own spring.
    ...(Platform.OS === 'ios' && {
      animation: reducedMotion ? ('fade' as const) : ('default' as const),
    }),
  };
  // Games holds the board: on iOS it opens full screen, not as the sheet, so
  // the board keeps its full size and no swipe-down competes with a drag.
  const fullScreen = {
    ...modal,
    ...(Platform.OS === 'ios' && { presentation: 'fullScreenModal' as const }),
  };
  const captured = useRef(false);
  const restored = useRef(false);
  if (!captured.current) {
    if (
      ![
        '/sign-in',
        '/privacy',
        '/board-lab',
        '/shell-lab',
        '/account-preview',
        '/account-settings-preview',
        '/account-privacy-preview',
      ].includes(path)
    )
      rememberReturnRoute(
        path === '/account-settings' && typeof section === 'string'
          ? `${path}?section=${section}${typeof choice === 'string' ? `&choice=${choice}` : ''}`
          : mode === 'lesson' || mode === 'extra'
            ? `${path}?mode=${mode}`
            : path,
      );
    captured.current = true;
  }
  useEffect(() => {
    if (state.phase === 'signed-in' && !restored.current) {
      restored.current = true;
      const next = consumeReturnRoute();
      if (next !== '/' && isDestinationAvailable(next))
        router.replace(next as Href);
    }
    if (state.phase === 'signed-out') {
      restored.current = false;
      // Covers a sign-out the app did not live through (e.g. killed mid-sign-out).
      cancelDailyReminders();
    }
  }, [state.phase]);
  return (
    <>
      {state.phase === 'signed-in' && (
        <>
          <TimezoneSync />
          <DailyReminders />
        </>
      )}
      {/* Pushed screens rise and fade in: natively through the stack's own
          animation, on the web through the arrival layout. */}
      <Stack
        screenOptions={{ headerShown: false, ...push }}
        screenLayout={stackArrivalLayout}
      >
        <Stack.Protected guard={state.phase !== 'signed-in'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={state.phase === 'signed-in'}>
          <Stack.Screen name="(main)" />
          {/* Account and Progress open over the path as iOS's full-height
              sheet; Games, with its board, full screen. Elsewhere each is a
              pushed page. */}
          <Stack.Screen name="(account)" options={modal} />
          <Stack.Screen name="games" options={fullScreen} />
          <Stack.Screen name="progress" options={modal} />
          <Stack.Screen name="practice" />
          <Stack.Screen name="review/[gameId]" />
          <Stack.Screen name="connect-games" />
          <Stack.Screen name="watch" />
          <Stack.Screen name="lesson-intro" options={modal} />
        </Stack.Protected>
        <Stack.Screen name="privacy" />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="board-lab" />
          <Stack.Screen name="shell-lab" />
          <Stack.Screen name="(account-preview)" options={modal} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
