import { type ReactNode, useState } from 'react';
import {
  Pressable,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { ScreenContent } from './screen-content';

type HeaderAction = {
  /** Accessible name; also the default visible text. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Optional icon or custom visual. The header owns the button and its label. */
  content?: ReactNode;
};

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  titleMode?: 'center' | 'flex';
  /** `bar`: a pushed screen's navigation bar, matching the native header: one
   * row with the title inline between icon buttons. `page`: a large title. */
  variant?: 'page' | 'bar';
  startAction?: HeaderAction;
  endAction?: HeaderAction;
  width?: 'reading' | 'wide' | 'full';
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

/** Ignite-inspired header; Screen/AppShell own safe areas and navigation behavior. */
export function ScreenHeader({
  title,
  subtitle,
  titleMode = 'center',
  variant = 'page',
  startAction,
  endAction,
  width = 'reading',
  style,
  titleStyle,
}: ScreenHeaderProps) {
  const styles = useStyles();
  const { theme } = useTheme();
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const bar = variant === 'bar';
  const compact =
    !bar &&
    Boolean(startAction || endAction) &&
    rowWidth !== null &&
    rowWidth < theme.layout.headerBreakpoint;
  const [startWidth, setStartWidth] = useState(0);
  const [endWidth, setEndWidth] = useState(0);
  const balancedWidth = Math.max(
    startAction ? startWidth : 0,
    endAction ? endWidth : 0,
  );
  const centered = titleMode === 'center' && !compact;
  const titleContent = (
    <View style={styles.titleContainer}>
      <Text
        accessibilityRole="header"
        numberOfLines={bar ? 1 : undefined}
        style={[styles.title, bar && styles.barTitle, titleStyle]}
      >
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <ScreenContent width={width} style={[styles.container, style]}>
      <View
        style={styles.row}
        onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      >
        <View style={styles.side(centered ? balancedWidth : 0, false)}>
          {startAction && (
            <View
              style={styles.measure(false)}
              onLayout={(event) =>
                setStartWidth(event.nativeEvent.layout.width)
              }
            >
              <Action action={startAction} />
            </View>
          )}
        </View>
        {compact ? <View style={styles.spacer} /> : titleContent}
        <View style={styles.side(centered ? balancedWidth : 0, true)}>
          {endAction && (
            <View
              style={styles.measure(true)}
              onLayout={(event) => setEndWidth(event.nativeEvent.layout.width)}
            >
              <Action action={endAction} />
            </View>
          )}
        </View>
      </View>
      {compact && titleContent}
    </ScreenContent>
  );
}

function Action({ action }: { action: HeaderAction }) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: Boolean(action.disabled) }}
      disabled={action.disabled}
      onPress={action.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.action,
        pressed && styles.pressed,
        focused && styles.focused,
        action.disabled && styles.disabled,
      ]}
    >
      {action.content ?? <Text style={styles.actionLabel}>{action.label}</Text>}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: { paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  spacer: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: theme.layout.minControl,
  },
  side: (width: number, end: boolean) => ({
    width: width || undefined,
    maxWidth: '30%',
    flexShrink: 0,
    alignItems: end ? 'flex-end' : 'flex-start',
  }),
  measure: (end: boolean) => ({
    alignSelf: end ? 'flex-end' : 'flex-start',
    maxWidth: '100%',
  }),
  titleContainer: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.title,
    textAlign: 'center',
  },
  // The native header's title: heading face, 20 pt.
  barTitle: { fontSize: 20 },
  subtitle: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    textAlign: 'center',
  },
  action: {
    minHeight: theme.layout.minControl,
    minWidth: theme.layout.minControl,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: theme.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    textAlign: 'center',
  },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  focused: { borderColor: theme.colors.focus },
  disabled: { opacity: 0.5 },
}));
