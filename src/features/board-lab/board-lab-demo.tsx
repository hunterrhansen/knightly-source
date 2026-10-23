import type { Color } from 'chess.js';
import { useReducer, useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard } from '../../chess/board';
import { createStyles } from '../../theme/theme';
import { Button } from '../../ui';
import { labFixtures } from './lab-fixtures';
import { createLabState, type LabMode, labReducer } from './lab-session';

let sequence = 0;
const sessionId = () => `lab-session-${++sequence}`;

export function BoardLabDemo(props: {
  mode: LabMode;
  orientation?: Color;
  textScale?: number;
}) {
  return <LabSession key={props.mode} {...props} />;
}

function LabSession({
  mode,
  orientation = 'w',
  textScale = 1,
}: {
  mode: LabMode;
  orientation?: Color;
  textScale?: number;
}) {
  const styles = useStyles();
  const [state, dispatch] = useReducer(labReducer, undefined, () =>
    createLabState(sessionId(), mode),
  );
  // Count raw callbacks, including any duplicate the reducer safely ignores.
  const [attempts, setAttempts] = useState(0);
  const [synchronous, setSynchronous] = useState(false);
  const fixture = labFixtures[state.fixtureId];
  const pending = state.phase === 'pending';
  const recovery = state.phase === 'failed' || state.phase === 'uncertain';
  const canHelp =
    mode === 'practice' && ['ready', 'rejected'].includes(state.phase);
  const replace = (next = false) => {
    setAttempts(0);
    const fixtureId = next
      ? state.fixtureId === 'opening'
        ? 'promotion'
        : 'opening'
      : state.fixtureId;
    const id = sessionId();
    dispatch({
      type: 'navigate',
      sessionId: id,
      fixtureId,
      position: { id: `${id}:0`, fen: labFixtures[fixtureId].fen },
    });
  };
  return (
    <View style={styles.layout}>
      <View style={styles.banner}>
        <Text style={styles.label(textScale)}>
          Board demo — simulated grading, no progress saved
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {mode === 'practice' ? fixture.title : 'Review demo history'}
        </Text>
        <Text style={styles.body(textScale)}>
          {mode === 'practice'
            ? 'Find the authored move. Every legal move remains available. Hints are optional; retries are unlimited.'
            : 'Browse a local, read-only sequence. Navigation never records a move.'}
        </Text>
      </View>
      <View style={styles.columns}>
        <View style={styles.board}>
          <Chessboard
            position={state.position}
            orientation={orientation}
            policy={state.policy}
            presentation={state.presentation}
            feedback={state.feedback}
            onAttempt={(attempt) => {
              setAttempts((count) => count + 1);
              dispatch({ type: 'attempt', attempt });
              if (synchronous) dispatch({ type: 'simulate', outcome: 'grade' });
            }}
            onTransitionComplete={(event) =>
              dispatch({
                type: 'transition-complete',
                sessionId: state.sessionId,
                ...event,
              })
            }
          />
          <View style={styles.caption}>
            <Text
              accessibilityLiveRegion="polite"
              style={styles.body(textScale)}
            >
              {state.phase === 'accepted'
                ? 'Accepted player move; waiting for its visual transition.'
                : state.phase === 'opponent'
                  ? 'Showing the opponent reply; input stays locked.'
                  : state.phase === 'review'
                    ? `History position ${state.reviewIndex + 1} of ${state.history.length}`
                    : `Demo state: ${state.phase}`}
            </Text>
            <Text
              style={styles.body(textScale)}
            >{`Demo attempts: ${attempts}`}</Text>
            {state.phase === 'rejected' && (
              <Text style={styles.rejection(textScale)}>Try again</Text>
            )}
            {state.completion && (
              <Text style={styles.body(textScale)}>{state.completion}</Text>
            )}
            <Text style={styles.body(textScale)}>
              Canonical history: {state.history.length} positions. Misses:{' '}
              {state.misses}. Help: {state.assistance}.
            </Text>
          </View>
        </View>
        <View style={styles.controls}>
          {mode === 'review' ? (
            <>
              <Button
                textScale={textScale}
                disabled={state.reviewIndex === 0}
                onPress={() =>
                  dispatch({
                    type: 'review-index',
                    index: state.reviewIndex - 1,
                  })
                }
              >
                Previous position
              </Button>
              <Button
                textScale={textScale}
                disabled={state.reviewIndex === state.history.length - 1}
                onPress={() =>
                  dispatch({
                    type: 'review-index',
                    index: state.reviewIndex + 1,
                  })
                }
              >
                Next position
              </Button>
              <Button
                textScale={textScale}
                onPress={() => dispatch({ type: 'review-index', index: 0 })}
              >
                Jump to start
              </Button>
              <Button
                textScale={textScale}
                onPress={() =>
                  dispatch({
                    type: 'review-index',
                    index: state.history.length - 1,
                  })
                }
              >
                Jump to latest
              </Button>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.title}>
                Simulation controls
              </Text>
              <Text style={styles.body(textScale)}>
                No request is sent. Choose a result explicitly, or enable
                immediate simulated grading.
              </Text>
              <Button
                textScale={textScale}
                onPress={() => setSynchronous(!synchronous)}
              >
                {synchronous
                  ? 'Disable synchronous grading'
                  : 'Enable synchronous grading'}
              </Button>
              <Button
                textScale={textScale}
                disabled={!pending}
                onPress={() => dispatch({ type: 'simulate', outcome: 'grade' })}
              >
                Simulate grading
              </Button>
              <Button
                textScale={textScale}
                disabled={!pending}
                onPress={() =>
                  dispatch({ type: 'simulate', outcome: 'reject' })
                }
              >
                Simulate rejection
              </Button>
              <Button
                textScale={textScale}
                disabled={!pending}
                onPress={() => dispatch({ type: 'simulate', outcome: 'fail' })}
              >
                Simulate connection failure
              </Button>
              <Button
                textScale={textScale}
                disabled={!pending}
                onPress={() =>
                  dispatch({ type: 'simulate', outcome: 'uncertain' })
                }
              >
                Simulate uncertain outcome
              </Button>
              {recovery && (
                <View style={styles.card}>
                  <Text accessibilityRole="header" style={styles.title}>
                    {state.phase === 'failed'
                      ? 'Connection recovery demo'
                      : 'Outcome reconciliation demo'}
                  </Text>
                  <Text style={styles.body(textScale)}>
                    The attempt is retained. Reconciliation supplies its
                    simulated result without resubmitting the move or counting a
                    chess mistake.
                  </Text>
                  <Button
                    textScale={textScale}
                    onPress={() =>
                      dispatch({ type: 'simulate', outcome: 'grade' })
                    }
                  >
                    Simulate reconciliation
                  </Button>
                </View>
              )}

              {state.phase === 'rejected' && (
                <View style={styles.card}>
                  <Text style={styles.body(textScale)}>
                    This legal move does not match the authored answer. Its
                    preview remains visible. No reliable move-specific
                    explanation is provided in this demo; use an optional hint
                    or retry.
                  </Text>
                  <Button
                    textScale={textScale}
                    onPress={() => dispatch({ type: 'retry' })}
                  >
                    Retry position
                  </Button>
                </View>
              )}
              {mode === 'practice' && (
                <View style={styles.card}>
                  <Text accessibilityRole="header" style={styles.title}>
                    Optional help
                  </Text>
                  <Button
                    textScale={textScale}
                    disabled={!canHelp}
                    onPress={() => dispatch({ type: 'hint', level: 'concept' })}
                  >
                    Show concept hint
                  </Button>
                  <Button
                    textScale={textScale}
                    disabled={!canHelp}
                    onPress={() => dispatch({ type: 'hint', level: 'origin' })}
                  >
                    Show origin hint
                  </Button>
                  <Text style={styles.body(textScale)}>
                    Opening the solution reveals the answer and records solution
                    assistance for this demo.
                  </Text>
                  <Button
                    textScale={textScale}
                    disabled={!canHelp}
                    onPress={() =>
                      dispatch({ type: 'hint', level: 'solution' })
                    }
                  >
                    Show solution (reveals answer)
                  </Button>
                  {state.assistance !== 'none' && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.body(textScale)}
                    >
                      {fixture[state.assistance]}
                    </Text>
                  )}
                  <Button
                    textScale={textScale}
                    disabled={!canHelp}
                    onPress={() => dispatch({ type: 'skip' })}
                  >
                    Skip exercise
                  </Button>
                </View>
              )}
            </>
          )}
          <Button textScale={textScale} onPress={() => replace()}>
            Reset demo
          </Button>
          <Button textScale={textScale} onPress={() => replace(true)}>
            Next exercise
          </Button>
        </View>
      </View>
    </View>
  );
}
const useStyles = createStyles((theme) => ({
  layout: { gap: theme.spacing.lg },
  banner: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  label: (scale: number) => ({
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body * scale,
  }),
  title: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.title,
  },
  rejection: (scale: number) => ({
    color: theme.colors.dangerText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.body * scale,
  }),
  body: (scale: number) => ({
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body * scale,
  }),
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg },
  board: { width: '100%', maxWidth: theme.layout.boardMax },
  caption: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  controls: {
    flexGrow: 1,
    flexBasis: 280,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
}));
