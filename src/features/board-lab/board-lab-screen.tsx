import type { Color, PieceSymbol } from 'chess.js';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Chessboard } from '../../chess/board';
import { Piece } from '../../chess/board/piece';
import { createStyles } from '../../theme/theme';
import { Button, Screen, ScreenContent, ScreenHeader } from '../../ui';
import { BoardAnswerDemo } from './board-answer-demo';
import { BoardBenchDemo } from './board-bench-demo';
import { BoardLabDemo } from './board-lab-demo';
import { BoardLineDemo } from './board-line-demo';
import { BoardPieceDemo } from './board-piece-demo';
import { BoardVisualStates } from './board-visual-states';
import type { LabMode } from './lab-session';
import { demoPromotion, useBoardDemo } from './use-board-demo';
import { WatchWallDemo } from './watch-wall-demo';

const kinds: readonly PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];
const colors: readonly Color[] = ['w', 'b'];

export function BoardLabScreen() {
  const styles = useStyles();
  const [orientation, setOrientation] = useState<Color>('w');
  const demo = useBoardDemo();
  const [mode, setMode] = useState<
    | LabMode
    | 'sandbox'
    | 'visuals'
    | 'lines'
    | 'answers'
    | 'polish'
    | 'bench'
    | 'wall'
  >(
    useLocalSearchParams<{ mode?: string }>().mode === 'wall'
      ? 'wall'
      : 'sandbox',
  );
  const invalid = demo.position.fen === 'invalid';
  const [largeText, setLargeText] = useState(false);
  const textScale = largeText ? 2 : 1;
  return (
    <Screen safeAreaEdges={['top', 'right', 'bottom', 'left']}>
      <ScreenHeader title="Board workshop" width="wide" titleMode="flex" />
      <ScreenContent width="wide" style={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>KNIGHTLY · DEVELOPMENT ONLY</Text>
          <Text style={styles.body(textScale)}>
            Tap a piece, then its destination, or drag it. Moves stay in this
            local sandbox.
          </Text>
        </View>
        <View style={styles.toolbar}>
          {(
            [
              'sandbox',
              'practice',
              'review',
              'visuals',
              'lines',
              'answers',
              'wall',
              'polish',
              'bench',
            ] as const
          ).map((choice) => (
            <Button key={choice} onPress={() => setMode(choice)}>
              {choice === 'bench'
                ? 'Benchmark'
                : choice === 'sandbox'
                  ? 'Board workshop'
                  : choice === 'polish'
                    ? 'Piece polish'
                    : choice === 'wall'
                      ? 'Watch wall'
                      : choice === 'answers'
                        ? 'Hints & answers'
                        : choice === 'lines'
                          ? 'Arrows & lines'
                          : choice === 'visuals'
                            ? 'Visual states'
                            : `${choice.charAt(0).toUpperCase()}${choice.slice(1)} demo`}
            </Button>
          ))}
        </View>
        {mode !== 'sandbox' ? (
          <>
            <View style={styles.toolbar}>
              <Button
                onPress={() => setOrientation(orientation === 'w' ? 'b' : 'w')}
              >
                Flip board
              </Button>
              <Button onPress={() => setLargeText(!largeText)}>
                {largeText ? 'Use 100% text' : 'Try 200% text'}
              </Button>
            </View>
            {mode === 'bench' ? (
              <BoardBenchDemo />
            ) : mode === 'wall' ? (
              <WatchWallDemo orientation={orientation} textScale={textScale} />
            ) : mode === 'polish' ? (
              <BoardPieceDemo orientation={orientation} textScale={textScale} />
            ) : mode === 'answers' ? (
              <BoardAnswerDemo
                orientation={orientation}
                textScale={textScale}
              />
            ) : mode === 'lines' ? (
              <BoardLineDemo orientation={orientation} textScale={textScale} />
            ) : mode === 'visuals' ? (
              <BoardVisualStates
                orientation={orientation}
                textScale={textScale}
              />
            ) : (
              <BoardLabDemo
                key={mode}
                mode={mode}
                orientation={orientation}
                textScale={textScale}
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.columns}>
              <View style={styles.boardColumn}>
                <Chessboard
                  position={demo.position}
                  orientation={orientation}
                  policy={demo.policy}
                  feedback={demo.feedback}
                  presentation={{
                    showDestinations: true,
                    lastMove: demo.lastMove,
                    transition: demo.transition,
                    highlights: [],
                    arrows: [],
                  }}
                  onAttempt={demo.onAttempt}
                  onRestorePosition={demo.reset}
                />
                <View style={styles.boardCaption}>
                  <Text style={styles.body(textScale)}>
                    {orientation === 'w' ? 'White' : 'Black'} at bottom
                  </Text>
                  <Text style={styles.body(textScale)}>
                    {demo.readOnly ? 'Read-only' : 'Move sandbox'}
                  </Text>
                  {demo.description && (
                    <Text style={styles.body(textScale)}>
                      {demo.description}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.controls}>
                <Text accessibilityRole="header" style={styles.sectionHeading}>
                  Look at it from both sides.
                </Text>
                <Button
                  textScale={textScale}
                  onPress={() =>
                    setOrientation(orientation === 'w' ? 'b' : 'w')
                  }
                >
                  Flip board
                </Button>
                <Button textScale={textScale} onPress={demo.reset}>
                  Reset board
                </Button>
                <Button
                  textScale={textScale}
                  onPress={() => demo.replace(demoPromotion)}
                >
                  Try promotion
                </Button>
                <Button
                  textScale={textScale}
                  onPress={() => demo.setReadOnly(!demo.readOnly)}
                >
                  {demo.readOnly ? 'Enable moves' : 'Make read-only'}
                </Button>
                <Button
                  textScale={textScale}
                  onPress={() => setLargeText(!largeText)}
                >
                  {largeText ? 'Use 100% text' : 'Try 200% text'}
                </Button>
                {!invalid && (
                  <Button
                    textScale={textScale}
                    onPress={() => demo.replace('invalid')}
                  >
                    Show invalid position
                  </Button>
                )}
              </View>
            </View>
            <View style={styles.artwork}>
              <Text accessibilityRole="header" style={styles.sectionHeading}>
                The full piece set
              </Text>
              <Text style={styles.body(textScale)}>
                All twelve pieces on both square colors. Compact samples use
                32-pixel artwork.
              </Text>
              {colors.map((color) => (
                <View key={color} style={styles.pieceRow}>
                  {kinds.map((kind) => (
                    <View key={`${color}-${kind}`} style={styles.piecePair}>
                      <View style={styles.lightSample}>
                        <Piece kind={kind} color={color} size={32} />
                      </View>
                      <View style={styles.darkSample}>
                        <Piece kind={kind} color={color} size={32} />
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}
      </ScreenContent>
    </Screen>
  );
}

const useStyles = createStyles((theme) => ({
  content: { gap: theme.spacing.xl },
  toolbar: {
    gap: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  intro: { gap: theme.spacing.sm },
  eyebrow: {
    color: theme.colors.brandText,
    fontFamily: theme.typography.bold,
    fontSize: theme.typography.size.small,
    letterSpacing: 1,
  },
  body: (scale: number) => ({
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: theme.typography.size.body * scale,
  }),
  sectionHeading: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: theme.typography.size.title,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xl },
  boardColumn: { width: '100%', maxWidth: theme.layout.boardMax },
  boardCaption: {
    paddingTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  controls: {
    flexGrow: 1,
    flexBasis: 280,
    gap: theme.spacing.md,
  },
  artwork: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  pieceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  piecePair: { flexDirection: 'row' },
  lightSample: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.boardLight,
  },
  darkSample: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.boardDark,
  },
}));
