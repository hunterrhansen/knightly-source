import { type PropsWithChildren, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { createStyles } from '../../theme/theme';

type ScreenContentProps = PropsWithChildren<{
  /** Width limits include gutters and always shrink to fit the parent. */
  width?: 'reading' | 'wide' | 'full';
  /** Inner content layout; merged after the shared padding and width styles. */
  style?: StyleProp<ViewStyle>;
}>;

/** Composes with Screen: owns gutters and width, while children own their layout. */
export function ScreenContent({
  children,
  width = 'reading',
  style,
}: ScreenContentProps) {
  const styles = useStyles();
  const [availableWidth, setAvailableWidth] = useState(0);
  return (
    <View
      style={styles.measure}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      <View style={[styles.content(width, availableWidth), style]}>
        {children}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  measure: { width: '100%', minWidth: 0 },
  content: (width: 'reading' | 'wide' | 'full', availableWidth: number) => ({
    width: '100%',
    minWidth: 0,
    maxWidth:
      width === 'reading'
        ? theme.layout.readingMax
        : width === 'wide'
          ? theme.layout.contentMax
          : undefined,
    alignSelf: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal:
      availableWidth >= theme.layout.contentBreakpoint
        ? theme.spacing.lg
        : theme.spacing.md,
  }),
}));
