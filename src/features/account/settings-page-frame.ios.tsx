import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { NavigationHeader, Screen, ScreenContent } from '../../ui';
export function SettingsPageFrame({
  title,
  onBack,
  children,
  nativeForm = false,
  modalRoot = false,
}: PropsWithChildren<{
  title: string;
  onBack: () => void;
  nativeForm?: boolean;
  modalRoot?: boolean;
}>) {
  const styles = useStyles();
  return (
    <View style={styles.frame}>
      <NavigationHeader title={title} onBack={modalRoot ? undefined : onBack} />
      {nativeForm ? (
        children
      ) : (
        <Screen
          safeAreaEdges={['bottom']}
          avoidKeyboard
          scrollViewProps={{
            contentInsetAdjustmentBehavior: 'automatic',
            keyboardDismissMode: 'interactive',
          }}
        >
          <ScreenContent style={styles.content}>{children}</ScreenContent>
        </Screen>
      )}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  frame: { flex: 1, backgroundColor: theme.colors.page },
  content: { gap: theme.spacing.lg },
}));
