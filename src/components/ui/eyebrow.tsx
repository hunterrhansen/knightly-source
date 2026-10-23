import { Text } from 'react-native';
import { createStyles } from '../../theme/theme';

export type EyebrowTone = 'brand' | 'gold' | 'muted';

/** Small capitals over a card, a hero or a page's headline number. */
export function Eyebrow({
  children,
  tone = 'brand',
}: {
  children: string;
  tone?: EyebrowTone;
}) {
  const styles = useStyles();
  return <Text style={styles.eyebrow(tone)}>{children}</Text>;
}

const useStyles = createStyles((theme) => ({
  eyebrow: (tone: EyebrowTone) => ({
    color:
      tone === 'gold'
        ? theme.colors.goldText
        : tone === 'muted'
          ? theme.colors.inkMuted
          : theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.eyebrow,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  }),
}));
