import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import type { SlipTone } from './games-presentation';

/** A slip state in the watch story's colours: on watch sky, held green,
 * stopped slipping gold; Clean and pending stay quiet. */
export function SlipChip({ tone, label }: { tone: SlipTone; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.chip(tone)}>
      <Text style={styles.label(tone)}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => {
  const fills: Record<SlipTone, string> = {
    watch: `${theme.colors.sky}29`,
    held: `${theme.colors.brand}29`,
    stopped: `${theme.colors.gold}29`,
    clean: theme.colors.surfaceMuted,
    pending: 'transparent',
  };
  const inks: Record<SlipTone, string> = {
    watch: theme.colors.ink,
    held: theme.colors.ink,
    stopped: theme.colors.goldText,
    clean: theme.colors.inkMuted,
    pending: theme.colors.inkMuted,
  };
  return {
    chip: (tone: SlipTone) => ({
      alignSelf: 'flex-start' as const,
      flexShrink: 1,
      paddingHorizontal: tone === 'pending' ? 0 : 8,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: fills[tone],
    }),
    label: (tone: SlipTone) => ({
      color: inks[tone],
      fontFamily: theme.typography.bold,
      fontSize: 12,
      lineHeight: 16,
    }),
  };
});
