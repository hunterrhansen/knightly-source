import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { createStyles } from '../../theme/theme';
import {
  KnightlyGlyph,
  type KnightlyGlyphName,
  usePressSquish,
} from '../../ui';

// The side tiles (docs/specs/2026-10-19-path-home-design.md, "One screen, no
// tab bar"): Games and Progress float on the path's left edge, as
// Duolingo's side tiles, and open as modals over it.

function Tile({
  glyph,
  label,
  badge = 0,
  onPress,
}: {
  glyph: KnightlyGlyphName;
  label: string;
  /** A count on the tile's corner; none at 0. */
  badge?: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  // The tile sits on a 2 pt ledge (its thicker bottom border); a press seats it.
  const squish = usePressSquish({ drop: 2 });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={squish.onPressIn}
      onPressOut={squish.onPressOut}
      hitSlop={4}
    >
      <Animated.View style={[styles.tile, squish.style]}>
        <KnightlyGlyph name={glyph} size={34} />
        {badge > 0 && (
          <View style={styles.badge} aria-hidden>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Games (with the new games that have slips as its badge) and Progress. */
export function HomeTiles({
  newGames,
  onGames,
  onProgress,
}: {
  /** New games with moves that slipped past (`today.new_games_slipped`). */
  newGames: number;
  onGames: () => void;
  onProgress: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.column}>
      <Tile
        glyph="games"
        label={
          newGames > 0
            ? `Games, ${newGames} new ${newGames === 1 ? 'game' : 'games'} with slips`
            : 'Games'
        }
        badge={newGames}
        onPress={onGames}
      />
      <Tile glyph="star" label="Progress" onPress={onProgress} />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  column: { gap: theme.spacing.sm, alignItems: 'flex-start' },
  tile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.page,
    backgroundColor: theme.colors.gold,
  },
  badgeText: {
    color: theme.colors.onGold,
    fontFamily: theme.typography.bold,
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
}));
