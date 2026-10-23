import type { Color, Square } from 'chess.js';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { indexOf } from '../coordinates';

export function MateBadges({
  loser,
  winner,
  orientation,
  size,
}: {
  loser: Square;
  winner: Square;
  orientation: Color;
  size: number;
}) {
  const styles = useStyles();
  return (
    <>
      {(
        [
          ['loser', loser],
          ['winner', winner],
        ] as const
      ).map(([kind, square]) => {
        const index = indexOf(square, orientation);
        const diameter = Math.min(
          size * (kind === 'loser' ? 0.38 : 0.42),
          kind === 'loser' ? 28 : 32,
        );
        return (
          <View
            key={kind}
            testID={`mate-${kind}-badge`}
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={{
              position: 'absolute',
              left: ((index % 8) + 1) * size - diameter * 0.8,
              top: Math.max(0, Math.floor(index / 8) * size - diameter * 0.2),
              width: diameter,
              height: diameter,
            }}
          >
            <View
              style={[
                styles.badge,
                kind === 'loser' ? styles.loser : styles.winner,
              ]}
            >
              {kind === 'loser' ? (
                <Text
                  accessible={false}
                  style={{
                    color: '#fff',
                    fontWeight: '900',
                    fontSize: diameter * 0.65,
                  }}
                >
                  #
                </Text>
              ) : (
                <Svg width="78%" height="78%" viewBox="0 0 24 24">
                  <Path
                    d="M3 6l4 4 5-6 5 6 4-4-2 12H5z M5 21h14"
                    fill="#e9b949"
                    stroke="#9b7118"
                    strokeWidth="1.5"
                  />
                </Svg>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}
const useStyles = createStyles((theme) => ({
  badge: {
    flex: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  loser: {
    backgroundColor: tokens.boardAnnotations.danger,
    borderColor: theme.colors.surface,
  },
  winner: { backgroundColor: theme.colors.surface, borderColor: '#e9b949' },
}));
