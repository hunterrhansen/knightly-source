import { Text, View } from 'react-native';
import { Button } from '../../components/ui/button';
import { createStyles } from '../../theme/theme';

/** Covers the board when its position is invalid or the owner rejected input. */
export function BoardErrorOverlay({
  title,
  message,
  onRestorePosition,
}: {
  title: string;
  message: string | undefined;
  onRestorePosition?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.overlay}>
      <View style={styles.errorCard}>
        <View accessible accessibilityRole="alert" style={styles.errorCopy}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorMessage}>{message}</Text>
        </View>
        {onRestorePosition && (
          <Button onPress={onRestorePosition}>Restore position</Button>
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  errorTitle: {
    color: theme.colors.dangerText,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.body,
  },
  errorCopy: { gap: theme.spacing.sm },
  errorMessage: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
  },
}));
