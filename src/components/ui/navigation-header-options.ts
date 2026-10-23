import { useTheme } from '../../theme/theme';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
/** Shared configuration for Apple's navigation bar and the Android native header. */
export function useNavigationHeaderOptions() {
  const { theme } = useTheme();
  const reducedMotion = useSystemReducedMotion();
  return {
    headerShown: true,
    headerLargeTitleEnabled: false,
    headerStyle: { backgroundColor: theme.colors.page },
    headerTintColor: theme.colors.brandText,
    headerShadowVisible: false,
    headerTitleStyle: {
      fontFamily: theme.typography.heading,
      fontSize: 20,
      color: theme.colors.ink,
    },
    headerBackButtonDisplayMode: 'generic' as const,
    gestureEnabled: true,
    // Reduced motion keeps a fade so the change of screen still reads.
    animation: reducedMotion ? ('fade' as const) : ('default' as const),
  };
}

/** The header over the screen's own art, with no bar of its own. */
export const transparentHeaderOptions = {
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
} as const;
