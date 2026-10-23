import { Text, View } from 'react-native';
import type { AheadDay, KeptNight } from '../../lib/api/journey-contract';
import { createStyles } from '../../theme/theme';
import { addDays, Card } from '../../ui';
import type { HeldCounts } from './journey-map';
import { type PathNode, weekday } from './path-model';
import { MoveRow } from './tonight-card';

// The node cards for the path's schedule and history
// (docs/specs/2026-10-19-path-home-design.md, "The node card"): a night
// ahead's returning moves, a kept night's moves and where each stands now,
// and an extra watch kept. Every word is from `/api/journey`.

const moves = (n: number) => `${n} ${n === 1 ? 'move' : 'moves'}`;
const times = (n: number) => `${n} ${n === 1 ? 'time' : 'times'}`;

/** What a watch held: "5 moves held · 1 slipped past · 1 stopped slipping". */
function heldLine({ held, slipped, stopped }: HeldCounts) {
  const parts = [`${moves(held)} held`];
  if (slipped) parts.push(`${slipped} slipped past`);
  if (stopped) parts.push(`${stopped} stopped slipping`);
  return parts.join(' · ');
}

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** When a move is back: tonight, tomorrow, its weekday this week, else its
 * date. */
function backWhen(due: string, today: string) {
  if (due <= today) return 'tonight';
  if (due === addDays(today, 1)) return 'tomorrow';
  if (due < addDays(today, 7)) return weekday(due);
  return shortDate(due);
}

/** Where a kept night's move stands now. */
function standsNow(move: KeptNight['moves'][number], today: string) {
  if (move.state === 'stopped') return 'Stopped slipping';
  if (move.state === 'hidden' || !move.due) return 'Hidden from your watch';
  const back = backWhen(move.due, today);
  return move.state === 'held' ? `Held · back ${back}` : `Back ${back}`;
}

/** A night ahead: the moves the schedule returns then, and which of them a
 * Good answer would stop slipping. */
export function AheadCard({ node, day }: { node: PathNode; day: AheadDay }) {
  const styles = useStyles();
  const more = day.due - day.moves.length;
  return (
    <Card eyebrow={`Night ${node.night} · ${weekday(day.date)}`}>
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.headline}>
          {day.due ? `${moves(day.due)} come back` : 'Nothing comes back'}
        </Text>
        <Text style={styles.quiet}>
          {day.last_checks
            ? `${day.last_checks === 1 ? 'One' : day.last_checks} could stop slipping: a Good answer that night is ${day.last_checks === 1 ? 'its' : 'their'} last check.`
            : day.due
              ? 'Each one held brings it closer to its 11 days.'
              : 'New moves from your games still fill the watch.'}
        </Text>
      </View>
      {day.moves.length > 0 && (
        <View style={styles.rows}>
          {day.moves.flatMap((move) =>
            move.fen
              ? [
                  <MoveRow
                    key={`${move.game_id}-${move.ply}`}
                    row={{
                      gameId: move.game_id,
                      ply: move.ply,
                      fen: move.fen,
                      color: move.color,
                      label: `${move.label} · ${move.san}`,
                      day: null,
                      detail: [
                        move.opponent && `vs ${move.opponent}`,
                        move.held > 0
                          ? `held ${times(move.held)}`
                          : 'not held yet',
                      ]
                        .filter(Boolean)
                        .join(' · '),
                      chip: move.last_check ? 'Last check' : null,
                    }}
                  />,
                ]
              : [],
          )}
        </View>
      )}
      {more > 0 && <Text style={styles.quiet}>{`+${moves(more)}`}</Text>}
    </Card>
  );
}

/** A kept night: what its watch held and, once loaded, where each of its
 * moves stands now. */
export function KeptNightCard({
  node,
  night,
  today,
  failed,
}: {
  node: PathNode;
  night?: KeptNight;
  today: string;
  /** Its moves could not be loaded. */
  failed?: boolean;
}) {
  const styles = useStyles();
  const held = night ?? node.held;
  return (
    <Card eyebrow={`Night ${node.night}`}>
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.headline}>
          {`Night ${node.night} kept`}
        </Text>
        {held && <Text style={styles.body}>{heldLine(held)}</Text>}
        {node.milestone ? (
          <Text style={styles.quiet}>
            {node.milestone === 66
              ? '66 nights of keeping watch: a habit.'
              : `${node.milestone} nights: a milestone.`}
          </Text>
        ) : null}
      </View>
      {night && night.moves.length > 0 && (
        <View style={styles.rows}>
          <Text style={styles.eyebrow}>Where they stand now</Text>
          {night.moves.flatMap((move) =>
            move.fen
              ? [
                  <MoveRow
                    key={`${move.game_id}-${move.ply}`}
                    row={{
                      gameId: move.game_id,
                      ply: move.ply,
                      fen: move.fen,
                      color: move.color,
                      label: `${move.label} · ${move.san}`,
                      day: null,
                      detail: standsNow(move, today),
                      chip: null,
                    }}
                  />,
                ]
              : [],
          )}
        </View>
      )}
      {failed && !night && (
        <Text style={styles.quiet}>Couldn’t load that night’s moves.</Text>
      )}
    </Card>
  );
}

/** An extra watch kept: what it held. */
export function ExtraKeptCard({ node }: { node: PathNode }) {
  const styles = useStyles();
  return (
    <Card eyebrow="Extra watch">
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.headline}>
          Extra watch kept
        </Text>
        <Text style={styles.quiet}>
          {node.held
            ? heldLine(node.held)
            : `On night ${node.night}, after the night’s watch.`}
        </Text>
      </View>
    </Card>
  );
}

const useStyles = createStyles((theme) => ({
  text: { gap: 2 },
  rows: { gap: 10 },
  headline: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  body: {
    color: theme.colors.ink,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
  },
  quiet: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.small,
    lineHeight: 20,
  },
  eyebrow: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
}));
