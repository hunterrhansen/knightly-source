import type { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';

/** Static row containing independently accessible controls; never nests press targets. */
export function SettingsRow({
  label,
  value,
  description,
  leading,
  children,
}: PropsWithChildren<{
  label: string;
  value?: string;
  description?: string;
  leading?: ReactNode;
}>) {
  const styles = useStyles();
  return (
    <View
      style={styles.row}
      accessible={children == null}
      accessibilityLabel={
        children == null
          ? [label, value, description].filter(Boolean).join(', ')
          : undefined
      }
    >
      <View style={styles.header}>
        {leading != null && (
          <View
            accessible={false}
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {leading}
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          {!!description && (
            <Text style={styles.description}>{description}</Text>
          )}
        </View>
        {!!value && <Text style={styles.value}>{value}</Text>}
      </View>
      {children != null && <View style={styles.controls}>{children}</View>}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  row: {
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  text: { flex: 1, minWidth: 100, gap: theme.spacing.xs },
  label: {
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body,
    color: theme.colors.ink,
  },
  description: {
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
  },
  value: {
    flexShrink: 1,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    color: theme.colors.inkMuted,
  },
  controls: { minWidth: 0 },
}));
