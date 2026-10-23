import { Children, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';

/** Heading outside a grouped surface. Each child is one separated settings row. */
export function SettingsSection({
  title,
  description,
  children,
  padded = true,
  footer,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  footer?: string;
  /** ListItem already supplies row padding. */
  padded?: boolean;
}>) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      {!!title && (
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
      )}
      {!!description && <Text style={styles.description}>{description}</Text>}
      <View style={styles.surface}>
        {Children.toArray(children).map((child, index) => (
          <View
            key={
              (typeof child === 'object' && 'key' in child
                ? child.key
                : null) ?? index
            }
            style={styles.row(padded)}
          >
            {index > 0 && <View style={styles.separator} />}
            {child}
          </View>
        ))}
      </View>
      {!!footer && <Text style={styles.description}>{footer}</Text>}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  section: { gap: theme.spacing.sm },
  heading: {
    fontFamily: theme.typography.heading,
    fontSize: 14,
    color: theme.colors.inkMuted,
  },
  description: {
    fontFamily: theme.typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.inkMuted,
  },
  surface: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.line,
    marginStart: 16,
  },
  row: (padded: boolean) => ({
    minWidth: 0,
    padding: padded ? theme.spacing.sm : 0,
  }),
}));
