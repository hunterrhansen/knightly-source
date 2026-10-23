import type { Square as ChessSquare } from 'chess.js';
import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import { createStyles, useTheme } from '../../theme/theme';
import type { Piece as PieceData } from '../position';
import { answerColors } from './answer-badge';
import type { DrawingColor } from './drawing-colors';
import { PIECE_FILL } from './geometry';
import { type MoveGrade, moveGrades } from './move-grade';
import { Piece } from './piece';

type SquareProps = Parameters<typeof SquareView>[0];
/** Re-renders a square only when what it shows changes: a re-parsed position
 * gives new piece objects, so pieces compare by kind and colour. */
const sameSquare = (a: SquareProps, b: SquareProps) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<
    keyof SquareProps
  >;
  for (const key of keys) {
    if (key === 'piece') {
      if (a.piece?.kind !== b.piece?.kind || a.piece?.color !== b.piece?.color)
        return false;
    } else if (a[key] !== b[key]) return false;
  }
  return true;
};

export const Square = memo(SquareView, sameSquare);

function SquareView({
  square,
  userMarkColor,
  piece,
  size,
  rankLabel,
  fileLabel,
  selected = false,
  selectionShown = true,
  destination = false,
  captureTint = false,
  onActivate,
  hidePiece = false,
  focused = false,
  focusRequest,
  onCancel,
  hint,
  highlight,
  grade,
  lastMoveTone,
  checkTone,
  label,
}: {
  square: ChessSquare;
  userMarkColor?: DrawingColor;
  piece?: PieceData;
  size: number;
  rankLabel?: string;
  fileLabel?: string;
  selected?: boolean;
  /** False when another layer draws selection (the board's fast overlay). */
  selectionShown?: boolean;
  destination?: boolean;
  /** A legal capture on this square: palettes with a capture tint fill it. */
  captureTint?: boolean;
  /** Called with this square; keep it stable so the square stays memoized. */
  onActivate?: (square: ChessSquare) => void;
  hidePiece?: boolean;
  focused?: boolean;
  focusRequest?: number;
  onCancel?: () => void;
  hint?: string;
  grade?: MoveGrade;
  checkTone?: 'king' | 'path';
  /** What a screen reader says for this square (`squareDescription`). */
  label: string;
  lastMoveTone?: 'game' | 'line';
  highlight?: 'hint' | 'success' | 'error';
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' && focusRequest !== undefined && ref.current)
      AccessibilityInfo.sendAccessibilityEvent(ref.current, 'focus');
  }, [focusRequest]);
  const dark = (square.charCodeAt(0) - 97 + Number(square[1])) % 2 === 1;
  return (
    <View
      ref={ref}
      testID={`square-${square}`}
      accessible={Platform.OS !== 'web'}
      aria-hidden={Platform.OS === 'web' ? true : undefined}
      accessibilityRole={Platform.OS !== 'web' ? 'button' : undefined}
      accessibilityLabel={Platform.OS === 'web' ? undefined : label}
      accessibilityHint={Platform.OS === 'web' ? undefined : hint}
      accessibilityState={{ selected }}
      onAccessibilityTap={onActivate && (() => onActivate(square))}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'activate') onActivate?.(square);
        if (nativeEvent.actionName === 'escape') onCancel?.();
      }}
      accessibilityActions={[
        { name: 'activate' },
        ...(onCancel
          ? [{ name: 'escape' as const, label: 'Cancel selection' }]
          : []),
      ]}
      onAccessibilityEscape={onCancel}
      style={[styles.square, dark ? styles.dark : styles.light]}
    >
      {lastMoveTone && !highlight && !grade && (
        <View
          testID={`last-move-${square}-${lastMoveTone}`}
          style={[
            styles.selection,
            { opacity: 1 },
            lastMoveTone === 'line'
              ? dark
                ? styles.lineDark
                : styles.lineLight
              : dark
                ? styles.lastDark
                : styles.lastLight,
          ]}
        />
      )}
      {grade && highlight !== 'error' && (
        <View
          testID={`grade-fill-${square}-${grade}`}
          style={[
            styles.selection,
            { backgroundColor: moveGrades[grade].color, opacity: 0.35 },
          ]}
        />
      )}
      {highlight && (!grade || highlight === 'error') && (
        <View
          testID={`highlight-${square}-${highlight}`}
          style={[
            styles.selection,
            highlight === 'error'
              ? styles.errorColor
              : highlight === 'success'
                ? styles.successColor
                : undefined,
          ]}
        />
      )}
      {checkTone && (
        <View
          testID={`check-${square}-${checkTone}`}
          style={[
            styles.selection,
            {
              backgroundColor: '#c33b36',
              opacity: checkTone === 'king' ? 0.7 : 0.22,
            },
          ]}
        />
      )}
      {userMarkColor && (
        <View
          testID={`user-highlight-${square}`}
          style={[
            styles.selection,
            {
              backgroundColor: theme.boardDrawings[userMarkColor],
              opacity: 0.5,
            },
          ]}
        />
      )}
      {focused && <View style={styles.focus} />}
      {selected && selectionShown && <View style={styles.selection} />}
      {captureTint && theme.colors.boardCaptureTint !== 'transparent' && (
        <View style={styles.captureTint} />
      )}
      {piece && !hidePiece && size > 0 && (
        <Piece kind={piece.kind} color={piece.color} size={size * PIECE_FILL} />
      )}
      {destination && (
        <View style={piece ? styles.capture : styles.destination} />
      )}
      {rankLabel && (
        <Text
          accessible={false}
          style={[
            styles.coordinate,
            styles.rank,
            dark ? styles.onDark : styles.onLight,
          ]}
        >
          {rankLabel}
        </Text>
      )}
      {fileLabel && (
        <Text
          accessible={false}
          style={[
            styles.coordinate,
            styles.file,
            dark ? styles.onDark : styles.onLight,
          ]}
        >
          {fileLabel}
        </Text>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  square: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lastLight: { backgroundColor: theme.boardAnnotations.lastLight },
  lastDark: { backgroundColor: theme.boardAnnotations.lastDark },
  lineLight: { backgroundColor: theme.boardAnnotations.lineLight },
  lineDark: { backgroundColor: theme.boardAnnotations.lineDark },
  light: { backgroundColor: theme.colors.boardLight },
  dark: { backgroundColor: theme.colors.boardDark },
  focus: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderWidth: 3,
    borderColor: theme.colors.focus,
    zIndex: 2,
  },
  selection: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.boardSelection,
    opacity: 0.55,
  },
  // Chess.com's puzzle answer tints.
  errorColor: { backgroundColor: answerColors.incorrect.tint, opacity: 0.5 },
  successColor: { backgroundColor: answerColors.correct.tint, opacity: 0.5 },
  destination: {
    pointerEvents: 'none',
    position: 'absolute',
    width: '25%',
    aspectRatio: 1,
    borderRadius: 100,
    backgroundColor: theme.colors.boardMarker,
    opacity: theme.boardMarkerAlpha.dot,
  },
  captureTint: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.boardCaptureTint,
  },
  capture: {
    pointerEvents: 'none',
    position: 'absolute',
    width: '90%',
    aspectRatio: 1,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: theme.colors.boardMarker,
    opacity: theme.boardMarkerAlpha.ring,
  },
  coordinate: {
    position: 'absolute',
    fontFamily: theme.typography.bold,
    fontSize: 10,
    lineHeight: 12,
  },
  rank: { top: 2, left: 3 },
  file: { bottom: 1, right: 3 },
  onDark: { color: theme.colors.boardCoordinateOnDark },
  onLight: { color: theme.colors.boardCoordinate },
}));
