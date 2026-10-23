import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';

/** RNR-inspired circular fallback: the brand disc on its ledge; its containing control supplies the accessible name.
 * With `uri` the player's own picture covers the disc, which stays behind it while it
 * loads and returns if it never does. */
export function Avatar({
  name,
  size = 36,
  focused = false,
  pressed = false,
  uri,
}: {
  name: string;
  size?: number;
  focused?: boolean;
  pressed?: boolean;
  /** A player's picture (Chess.com's avatar); the initial shows without one. */
  uri?: string;
}) {
  const [failed, setFailed] = useState(false);
  const styles = useStyles();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        focused && styles.focused,
        pressed && styles.pressed,
      ]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.5) }]}>
        {name.trim().slice(0, 1).toUpperCase() || '?'}
      </Text>
      {uri && !failed && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  avatar: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 18,
    backgroundColor: theme.colors.brand,
    boxShadow: `inset 0 -3px 0 ${theme.colors.brandLedge}`,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focused: { borderWidth: 2, borderColor: theme.colors.focus },
  pressed: { opacity: 0.7 },
  initial: {
    fontFamily: theme.typography.heading,
    fontSize: 20,
    color: theme.colors.onBrand,
  },
}));
