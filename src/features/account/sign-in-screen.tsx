import { Link } from 'expo-router';
import {
  Platform,
  type StyleProp,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { useFoundation } from '../../lib/auth/auth-provider';
import { createStyles } from '../../theme/theme';
import { BrandMark, LaunchScreen, Screen } from '../../ui';
import { SignInAction } from './sign-in-action';

export function SignInScreen() {
  const styles = useStyles();
  const state = useFoundation();
  // Signed-in people wait here for their session, so they never see sign-in.
  if (state.phase === 'loading') return <LaunchScreen />;
  if (state.phase === 'error')
    return (
      <LaunchScreen
        error={{
          title: 'Could not connect',
          message: state.message,
          action: { label: 'Retry connection', onPress: state.retry },
        }}
        footer={<FooterLinks style={styles.launchLink} />}
      />
    );
  return (
    <Screen
      safeAreaEdges={['top', 'bottom']}
      avoidKeyboard
      contentContainerStyle={styles.frame}
    >
      {/* The original Knightly sign-in: brand, promise, then the card. */}
      <View style={styles.hero}>
        <View style={styles.brand}>
          <BrandMark />
          <Text style={styles.wordmark}>Knightly</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Turn your games into practice
        </Text>
        <Text style={styles.quiet}>
          Knightly finds the moves you missed in your own games and brings them
          back until you find them.
        </Text>
      </View>
      <View style={styles.panel}>
        {Platform.OS !== 'web' && (
          <Text style={styles.cardTitle}>Continue to Knightly</Text>
        )}
        <SignInAction />
      </View>
      <Link href="/privacy" asChild>
        <Text style={styles.privacy}>Privacy</Text>
      </Link>
      {__DEV__ && (
        <View style={styles.devLinks}>
          <DevLinks style={styles.link} />
        </View>
      )}
    </Screen>
  );
}
/** Privacy and, in development, the workshops stay reachable while offline. */
function FooterLinks({ style }: { style: StyleProp<TextStyle> }) {
  return (
    <>
      <Link href="/privacy" asChild>
        <Text style={style}>Privacy</Text>
      </Link>
      {__DEV__ && <DevLinks style={style} />}
    </>
  );
}
function DevLinks({ style }: { style: StyleProp<TextStyle> }) {
  return (
    <>
      <Link href="/shell-lab" asChild>
        <Text style={style}>Explore Today states</Text>
      </Link>
      <Link href="/board-lab" asChild>
        <Text style={style}>Explore board workshop</Text>
      </Link>
    </>
  );
}
const useStyles = createStyles((theme) => ({
  frame: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 488,
    justifyContent: 'center',
    alignSelf: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  hero: { alignItems: 'center', gap: theme.spacing.md },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // The original sign-in sets the wordmark and headline in Nunito.
  wordmark: {
    fontFamily: theme.typography.bold,
    fontSize: 32,
    color: theme.colors.ink,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderRadius: theme.radius.panel,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  title: {
    fontFamily: theme.typography.bold,
    fontSize: 26,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  quiet: {
    fontFamily: theme.typography.body,
    fontSize: 17,
    lineHeight: 25,
    color: theme.colors.inkMuted,
    textAlign: 'center',
  },
  cardTitle: {
    fontFamily: theme.typography.bold,
    fontSize: 20,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  // A link's child takes one style object (expo-router's Slot).
  privacy: {
    alignSelf: 'center',
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    minHeight: 44,
    paddingVertical: 12,
  },
  link: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    minHeight: 44,
    paddingVertical: 12,
  },
  launchLink: {
    color: theme.colors.onBrand,
    fontFamily: theme.typography.bold,
    minHeight: 44,
    paddingVertical: 12,
  },
  devLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
}));
