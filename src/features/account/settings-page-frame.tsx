import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { ActionIcon, Screen, ScreenContent, ScreenHeader } from '../../ui';
export function SettingsPageFrame({
  title,
  onBack,
  children,
}: PropsWithChildren<{
  title: string;
  onBack: () => void;
  nativeForm?: boolean;
  modalRoot?: boolean;
}>) {
  const styles = useStyles();
  const { theme } = useTheme();
  return (
    <View style={styles.frame}>
      <ScreenHeader
        title={title}
        variant="bar"
        startAction={{
          label: 'Back',
          onPress: onBack,
          content: <ActionIcon name="back" color={theme.colors.brandText} />,
        }}
      />
      <Screen
        safeAreaEdges={['top', 'bottom']}
        avoidKeyboard
        scrollViewProps={{
          contentInsetAdjustmentBehavior: 'never',
          keyboardDismissMode: 'interactive',
        }}
      >
        <ScreenContent style={styles.content}>{children}</ScreenContent>
      </Screen>
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  frame: { flex: 1, backgroundColor: theme.colors.page },
  content: { gap: theme.spacing.lg },
}));
