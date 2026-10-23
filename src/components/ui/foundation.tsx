import type { PropsWithChildren } from 'react';
import { Platform, Text } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { ActionIcon } from './action-icon';
import { Button } from './button';

import { Card } from './card';
import { NavigationHeader } from './navigation-header';
import { PageEntrance } from './page-entrance';
import { Screen } from './screen';
import { ScreenContent } from './screen-content';
import { ScreenHeader } from './screen-header';

/** App page composition; the shell owns insets unless this is a standalone route. */
export function Page({
  title,
  children,
  safeArea = false,
  avoidKeyboard = false,
  bounces = true,
  onBack,
}: PropsWithChildren<{
  title: string;
  safeArea?: boolean;
  avoidKeyboard?: boolean;
  /** false: no iOS bounce when the content already fits on screen. */
  bounces?: boolean;
  /** A pushed page's back action on web; native stacks draw their own. */
  onBack?: () => void;
}>) {
  const styles = useStyles();
  const { theme } = useTheme();
  return (
    <Screen
      safeAreaEdges={
        safeArea ? (Platform.OS === 'web' ? ['top', 'bottom'] : ['bottom']) : []
      }
      avoidKeyboard={avoidKeyboard}
      scrollViewProps={{
        contentInsetAdjustmentBehavior:
          Platform.OS !== 'web' ? 'automatic' : 'never',
        keyboardDismissMode: 'interactive',
        alwaysBounceVertical: bounces,
      }}
    >
      {Platform.OS === 'web' ? (
        <ScreenHeader
          title={title}
          titleMode="flex"
          startAction={
            onBack && {
              label: 'Back',
              onPress: onBack,
              content: (
                <ActionIcon name="back" color={theme.colors.brandText} />
              ),
            }
          }
        />
      ) : (
        <NavigationHeader title={title} />
      )}
      <ScreenContent style={styles.content}>
        <PageEntrance>{children}</PageEntrance>
      </ScreenContent>
    </Screen>
  );
}
export function Body({ children }: PropsWithChildren) {
  const styles = useStyles();
  return <Text style={styles.body}>{children}</Text>;
}
export function Notice({
  title,
  message,
  action,
  onAction,
}: {
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  return (
    <Card
      title={title}
      description={message}
      titleStyle={styles.heading}
      footer={
        action && onAction ? (
          <Button onPress={onAction}>{action}</Button>
        ) : undefined
      }
    />
  );
}
export const useFoundationStyles = createStyles((theme) => ({
  secondary: {
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
  label: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  link: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    minHeight: 44,
    paddingVertical: 12,
  },
}));
const useStyles = createStyles((theme) => ({
  content: { gap: theme.spacing.lg },
  heading: {
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  body: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
}));
