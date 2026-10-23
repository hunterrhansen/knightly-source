import { Host, type UniversalHostProps } from '@expo/ui';
import { Platform } from 'react-native';
import { useTheme } from '../theme/theme';

/** Pin native controls to the dark scheme and bind web control colors to Knightly's theme. */
export function ControlHost({ style, ...props }: UniversalHostProps) {
  const { theme } = useTheme();
  const webColors =
    Platform.OS === 'web'
      ? {
          '--expo-ui-background': theme.colors.surface,
          '--expo-ui-foreground': theme.colors.ink,
          '--expo-ui-gray-200': theme.colors.line,
          '--expo-ui-gray-500': theme.colors.inkMuted,
          '--expo-ui-gray-700': theme.colors.inkMuted,
          '--expo-ui-gray-900': theme.colors.ink,
          '--expo-ui-primary-500': theme.colors.focus,
        }
      : {};
  return (
    <Host
      {...props}
      colorScheme="dark"
      seedColor={theme.colors.brandText}
      style={[style, { width: '100%', ...webColors }]}
    />
  );
}
