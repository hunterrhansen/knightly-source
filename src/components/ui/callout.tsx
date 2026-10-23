import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import { ActionIcon, type ActionIconName } from './action-icon';

/** A tinted line inside a card that says what changed: an icon and one
 * sentence. `brand` for good news; `muted` for neutral notes. */
export function Callout({
  icon,
  tone = 'brand',
  children,
}: {
  icon: ActionIconName;
  tone?: 'brand' | 'muted';
  /** Text, optionally with nested <Text> runs for emphasis. */
  children: ReactNode;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  return (
    <View style={styles.row(tone)}>
      <ActionIcon
        name={icon}
        size={18}
        strokeWidth={2.6}
        color={
          tone === 'brand' ? theme.colors.brandText : theme.colors.inkMuted
        }
      />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

/** Bold green emphasis inside a Callout's sentence. */
export function CalloutStrong({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.strong}>{children}</Text>;
}

const useStyles = createStyles((theme) => ({
  row: (tone: 'brand' | 'muted') => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.inset,
    backgroundColor:
      tone === 'brand' ? theme.colors.brandTint : theme.colors.surfaceMuted,
  }),
  text: {
    flex: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: theme.typography.lineHeight.small,
  },
  strong: { color: theme.colors.brandText, fontFamily: theme.typography.bold },
}));
