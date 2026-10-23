import { Stack, useRouter } from 'expo-router';
import {
  transparentHeaderOptions,
  useNavigationHeaderOptions,
} from './navigation-header-options';
import type { NavigationHeaderProps } from './navigation-header-types';
export function NavigationHeader({
  title,
  titleView,
  onBack,
  transparent = false,
}: NavigationHeaderProps) {
  const router = useRouter();
  const options = useNavigationHeaderOptions();
  return (
    <>
      <Stack.Screen
        options={{
          ...options,
          ...(transparent && transparentHeaderOptions),
          title,
          ...(titleView && { headerTitle: titleView }),
        }}
      />
      {onBack && !router.canGoBack() && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="chevron.left"
            accessibilityLabel="Back"
            onPress={onBack}
          />
        </Stack.Toolbar>
      )}
    </>
  );
}
