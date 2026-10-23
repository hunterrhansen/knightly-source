import type { Color } from 'chess.js';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { BoardProps } from '../../chess/board';
import { EMPTY_BOARD } from '../../chess/position';
import { createStyles } from '../../theme/theme';
import type { KnightMood } from './knight-mascot';

// A lesson's loading frame: the real layout with an empty board, the knight
// thinking in the coach bubble, and the pieces dropping in when the first
// position lands. A tip only after a beat, so a quick load never flashes text;
// a slow one says so rather than faking progress.
const TIP_AFTER = 400;
const SLOW_AFTER = 3000;

const tips = [
  'Before you move, check every capture and every check.',
  'Ask what their last move threatens.',
  'A piece that defends two things is easy to overload.',
  'Loose pieces drop off: keep yours defended.',
  'In a won position, trade pieces, not pawns.',
  'Rooks love open files.',
] as const;

/** What the knight says while a lesson loads: what it is doing, a tip after a
 * beat, and an honest note if it is taking long. */
export function useLoadingCoach(kind: 'practice' | 'game'): {
  title: string;
  body?: string;
  mood: KnightMood;
} {
  const [stage, setStage] = useState<'start' | 'tip' | 'slow'>('start');
  const [tip] = useState(
    () => tips[Math.floor(Math.random() * tips.length)] ?? tips[0],
  );
  useEffect(() => {
    const showTip = setTimeout(() => setStage('tip'), TIP_AFTER);
    const slow = setTimeout(() => setStage('slow'), SLOW_AFTER);
    return () => {
      clearTimeout(showTip);
      clearTimeout(slow);
    };
  }, []);
  return {
    title: kind === 'game' ? 'Opening your game' : 'Setting up your board',
    body:
      stage === 'start'
        ? undefined
        : stage === 'tip'
          ? `Tip: ${tip}`
          : 'Taking longer than usual. Hang on a moment.',
    mood: 'thinking',
  };
}

/** The board before a lesson's first position: squares only, read-only. */
export function emptyBoard(orientation: Color = 'w'): BoardProps {
  return {
    position: { id: 'loading', fen: EMPTY_BOARD },
    orientation,
    policy: { mode: 'read-only' },
    presentation: { showDestinations: false, highlights: [], arrows: [] },
    onAttempt: () => {},
  };
}

/** A grey bar standing in for a line of text still to come. */
export function SkeletonLine({ width }: { width: `${number}%` | number }) {
  const styles = useStyles();
  return (
    <View
      style={[styles.line, { width }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const useStyles = createStyles((theme) => ({
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceMuted,
  },
}));
