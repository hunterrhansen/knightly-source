import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { hide as hideSplash } from 'expo-splash-screen';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView as NativeGestureRoot } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaunchScreen } from '../components/ui/launch-screen';
import { fontAssets } from './fonts';
import { PreferencesProvider } from './preferences';
import { ThemeRoot, useTheme } from './theme';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeRoot>
      <AppFrame>{children}</AppFrame>
    </ThemeRoot>
  );
}

function AppFrame({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts(fontAssets);
  const { theme } = useTheme();
  return (
    // The first layout always holds the launch screen, which matches the native
    // splash, or ready content; either can replace the splash.
    <NativeGestureRoot
      style={{ flex: 1, backgroundColor: theme.colors.page }}
      onLayout={hideSplash}
    >
      <SafeAreaProvider>
        {error ? (
          <LaunchScreen
            systemFont
            error={{
              title: 'Fonts unavailable',
              message: 'Restart the app to retry.',
            }}
          />
        ) : loaded ? (
          <PreferencesProvider>
            <NavigationTheme>{children}</NavigationTheme>
          </PreferencesProvider>
        ) : (
          <LaunchScreen systemFont />
        )}
      </SafeAreaProvider>
    </NativeGestureRoot>
  );
}

function NavigationTheme({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  return (
    <ThemeProvider
      value={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.colors.brandText,
          background: theme.colors.page,
          card: theme.colors.page,
          text: theme.colors.ink,
          border: theme.colors.line,
          notification: theme.colors.dangerText,
        },
      }}
    >
      {children}
    </ThemeProvider>
  );
}
