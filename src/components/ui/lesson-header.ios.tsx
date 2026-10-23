import { Stack } from 'expo-router';
import type { LessonHeaderProps } from './lesson-header-types';
import { useNavigationHeaderOptions } from './navigation-header-options';

/** The native navigation bar: the title with system toolbar buttons. */
export function LessonHeader({
  title,
  onClose,
  closeLabel = 'Exit review, progress is saved',
  onBack,
  onList,
  hidden = false,
}: LessonHeaderProps) {
  const options = useNavigationHeaderOptions();
  if (hidden)
    return <Stack.Screen options={{ ...options, title, headerShown: false }} />;
  return (
    <>
      <Stack.Screen options={{ ...options, title }} />
      {(onBack || onClose) && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon={onBack ? 'chevron.left' : 'xmark'}
            accessibilityLabel={onBack ? 'Back' : closeLabel}
            onPress={onBack ?? onClose}
          />
        </Stack.Toolbar>
      )}
      {onList && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="list.bullet"
            accessibilityLabel="All moves"
            onPress={onList}
          />
        </Stack.Toolbar>
      )}
    </>
  );
}
