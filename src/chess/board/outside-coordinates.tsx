import type { Color } from 'chess.js';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';

/** Rank numbers down the board's left edge, for outside coordinates. */
export function OutsideRanks({ orientation }: { orientation: Color }) {
  const styles = useStyles();
  const ranks =
    orientation === 'w' ? [...'87654321'] : [...'87654321'].reverse();
  return (
    <View aria-hidden accessible={false} style={styles.rankColumn}>
      {ranks.map((rank) => (
        <View key={rank} style={styles.rankLabel}>
          <Text style={[styles.outsideLabel, styles.rankText]}>{rank}</Text>
        </View>
      ))}
    </View>
  );
}

/** File letters along the board's bottom edge, for outside coordinates. */
export function OutsideFiles({ orientation }: { orientation: Color }) {
  const styles = useStyles();
  const files =
    orientation === 'w' ? [...'abcdefgh'] : [...'abcdefgh'].reverse();
  return (
    <View aria-hidden accessible={false} style={styles.fileRow}>
      {files.map((file) => (
        <Text key={file} style={styles.outsideLabel}>
          {file}
        </Text>
      ))}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  rankColumn: {
    width: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  fileRow: { height: theme.spacing.md, flexDirection: 'row' },
  outsideLabel: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 11,
    lineHeight: theme.spacing.md,
  },
  rankLabel: { flex: 1, justifyContent: 'center' },
  rankText: { flex: 0 },
}));
