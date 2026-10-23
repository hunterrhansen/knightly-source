import { Platform } from 'react-native';
import { useTheme } from '../../theme/theme';

/** The path's `node` screen: a node's card as the platform's own sheet
 * over the path (iOS form sheet, Android bottom sheet), sized to the card.
 * Everything else is the system's: its corners, no grabber, swipe down to
 * close and, on iOS, its own sheet material behind the card. */
export function useNodeSheetOptions() {
  const { theme } = useTheme();
  // The web has no system sheet: the card is a dialog over the path, which
  // stays visible behind it (today's NodeDialog draws the backdrop).
  if (Platform.OS === 'web')
    return {
      presentation: 'transparentModal' as const,
      animation: 'none' as const,
      headerShown: false,
      title: '',
      contentStyle: { backgroundColor: 'transparent' },
    };
  return {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: 'fitToContents' as const,
    sheetGrabberVisible: false,
    // iOS shows a clear header for the native ✕ (the node screen's
    // toolbar); its title is set here so the route's name never flashes.
    headerShown: Platform.OS === 'ios',
    headerTransparent: true,
    headerStyle: { backgroundColor: 'transparent' },
    headerShadowVisible: false,
    title: '',
    contentStyle: {
      backgroundColor:
        Platform.OS === 'ios' ? 'transparent' : theme.colors.page,
    },
  };
}
