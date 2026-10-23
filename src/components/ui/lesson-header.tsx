import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from '../../theme/theme';
import { ActionIcon, type ActionIconName } from './action-icon';
import { IconButton } from './icon-button';
import type { LessonHeaderProps } from './lesson-header-types';
import { useNavigationHeaderOptions } from './navigation-header-options';
import { ScreenHeader } from './screen-header';

/** A full-screen lesson's header (review, practice): the native header on
 * Android (title with header buttons) and the matching ScreenHeader on the
 * web. */
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
    return Platform.OS === 'web' ? null : (
      <Stack.Screen options={{ ...options, title, headerShown: false }} />
    );
  const start = onBack ?? onClose;
  const startIcon: ActionIconName = onBack ? 'back' : 'close';
  const startLabel = onBack ? 'Back' : closeLabel;
  if (Platform.OS !== 'web')
    return (
      <Stack.Screen
        options={{
          ...options,
          title,
          headerLeft: start
            ? () => (
                <IconButton
                  icon={startIcon}
                  tone="brand"
                  accessibilityLabel={startLabel}
                  onPress={start}
                />
              )
            : undefined,
          headerRight: onList
            ? () => (
                <IconButton
                  icon="list"
                  tone="brand"
                  accessibilityLabel="All moves"
                  onPress={onList}
                />
              )
            : undefined,
        }}
      />
    );
  return (
    <ScreenHeader
      title={title}
      variant="bar"
      width="full"
      startAction={
        start
          ? {
              label: startLabel,
              onPress: start,
              content: <HeaderIconContent icon={startIcon} />,
            }
          : undefined
      }
      endAction={
        onList
          ? {
              label: 'All moves',
              onPress: onList,
              content: <HeaderIconContent icon="list" />,
            }
          : undefined
      }
    />
  );
}

function HeaderIconContent({ icon }: { icon: ActionIconName }) {
  const { theme } = useTheme();
  return <ActionIcon name={icon} color={theme.colors.brandText} />;
}
