import { Stack } from 'expo-router';
import {
  transparentHeaderOptions,
  useNavigationHeaderOptions,
} from './navigation-header-options';
import type { NavigationHeaderProps } from './navigation-header-types';
export function NavigationHeader({
  title,
  titleView,
  transparent = false,
}: NavigationHeaderProps) {
  const options = useNavigationHeaderOptions();
  return (
    <Stack.Screen
      options={{
        ...options,
        ...(transparent && transparentHeaderOptions),
        title,
        ...(titleView && { headerTitle: titleView }),
      }}
    />
  );
}
