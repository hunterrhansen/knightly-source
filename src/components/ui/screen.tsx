import { type PropsWithChildren, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import { createStyles } from '../../theme/theme';

type BaseProps = PropsWithChildren<{
  /** Insets are opt-in: AppShell already owns its safe areas. */
  safeAreaEdges?: Edge[];
  /** Enable for forms; web keeps its browser keyboard behavior. */
  avoidKeyboard?: boolean;
  keyboardOffset?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}>;

type ScreenProps = BaseProps & {
  preset?: 'fixed' | 'scroll' | 'auto';
  /** Applies only to scroll/auto presets. */
  scrollViewProps?: Omit<
    ScrollViewProps,
    'children' | 'style' | 'contentContainerStyle' | 'scrollEnabled'
  >;
};

/** Ignite-inspired screen frame; navigation, titles and gutters belong to children. */
export function Screen({
  children,
  preset = 'scroll',
  safeAreaEdges = [],
  avoidKeyboard = false,
  keyboardOffset = 0,
  style,
  contentContainerStyle,
  scrollViewProps,
}: ScreenProps) {
  const styles = useStyles();
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const scrollEnabled =
    preset !== 'auto' ||
    viewportHeight === null ||
    contentHeight === null ||
    contentHeight > viewportHeight;

  return (
    <SafeAreaView edges={safeAreaEdges} style={[styles.frame, style]}>
      <KeyboardAvoidingView
        style={styles.fill}
        enabled={avoidKeyboard && Platform.OS !== 'web'}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {preset === 'fixed' ? (
          <View style={[styles.fill, contentContainerStyle]}>{children}</View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="never"
            // The app draws no system scroll bars.
            showsVerticalScrollIndicator={false}
            {...scrollViewProps}
            style={styles.fill}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={scrollEnabled}
            onLayout={(event) => {
              if (preset === 'auto') {
                setViewportHeight(event.nativeEvent.layout.height);
              }
              scrollViewProps?.onLayout?.(event);
            }}
          >
            <View
              style={contentContainerStyle}
              onLayout={(event) => {
                if (preset === 'auto') {
                  setContentHeight(event.nativeEvent.layout.height);
                }
              }}
            >
              {children}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  frame: { flex: 1, minWidth: 0, backgroundColor: theme.colors.page },
  fill: { flex: 1, minWidth: 0 },
  scrollContent: { flexGrow: 1 },
}));
