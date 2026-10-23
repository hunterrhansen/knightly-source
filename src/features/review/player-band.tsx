import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { PieceFigurine } from '../../chess/board';
import { capturedBy } from '../../chess/material';
import { createStyles, useTheme } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { formatClock } from './player-clocks';

/** Height of a player band above or below the review board. */
// The 32 px clock leaves 6 px between it and the board.
export const PLAYER_BAND = 44;
const TAKEN = 16;

/** A player's name, rating and clock beside the board, after Chess.com: the
 * clock is a box in the player's piece colour, full strength with a clock
 * icon for the side to move and dimmed for the other. Under the name, the
 * pieces they have taken at the shown position and their material lead. */
export function PlayerBand({
  name,
  rating,
  color,
  clock,
  toMove,
  fen,
}: {
  name: string;
  rating?: number | null;
  color: 'white' | 'black';
  /** Seconds left; leave out when the game recorded no clocks. */
  clock?: number | null;
  toMove: boolean;
  /** The shown position; leave out to show no captures. */
  fen?: string;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const white = color === 'white';
  const { taken, lead } = fen
    ? capturedBy(fen, white ? 'w' : 'b')
    : { taken: [], lead: 0 };
  const ink = white ? tokens.clock.black : tokens.clock.white;
  const time = clock == null ? undefined : formatClock(clock);
  return (
    <View
      accessible
      accessibilityLabel={`${name}${rating ? `, ${rating}` : ''}${lead ? `, up ${lead}` : ''}${time ? `, ${time} left` : ''}${toMove ? ', to move' : ''}`}
      style={styles.band}
    >
      <View style={styles.player}>
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {!!rating && <Text style={styles.rating}>({rating})</Text>}
        </View>
        {(taken.length > 0 || lead > 0) && (
          <View style={styles.taken}>
            {/* Figurines in one light ink, as the move list draws them: a
                black piece on the dark band is 1.2:1, the ink 7.7:1. */}
            {taken
              .map((kind, i) => ({
                kind,
                id: `${kind}-${i}`,
                // Chess.com overlaps like pieces and gaps between groups.
                stacked: i > 0 && kind === taken[i - 1],
              }))
              .map((p) => (
                <View key={p.id} style={p.stacked && styles.stacked}>
                  <PieceFigurine
                    kind={p.kind}
                    color={white ? 'b' : 'w'}
                    size={TAKEN}
                    ink={theme.colors.inkMuted}
                  />
                </View>
              ))}
            {lead > 0 && <Text style={styles.lead}>+{lead}</Text>}
          </View>
        )}
      </View>
      {time && (
        <View
          style={[
            styles.clock,
            white ? styles.clockWhite : styles.clockBlack,
            !toMove && styles.waiting,
          ]}
        >
          {toMove && (
            <Svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
              <Circle
                cx={12}
                cy={12}
                r={9}
                stroke={ink}
                strokeWidth={2.4}
                fill="none"
              />
              <Path
                d="M12 7v5l3 2"
                stroke={ink}
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          )}
          <Text style={[styles.time, { color: ink }]}>{time}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  band: {
    height: PLAYER_BAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  player: { flexShrink: 1, justifyContent: 'center' },
  who: { flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  taken: {
    height: TAKEN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
  },
  stacked: { marginLeft: -3 - TAKEN / 3 },
  lead: {
    marginLeft: 2,
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
  },
  name: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small + 1,
  },
  rating: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
  },
  // Chess.com: 3 px corners, the side's colour, the waiting clock at half strength.
  clock: {
    minWidth: 96,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 3,
  },
  clockWhite: { backgroundColor: tokens.clock.white },
  clockBlack: { backgroundColor: tokens.clock.black },
  waiting: { opacity: 0.5 },
  time: {
    fontFamily: theme.typography.bold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
}));
