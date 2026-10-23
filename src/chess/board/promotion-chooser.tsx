import type { Color, Square } from 'chess.js';
import { type RefObject, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { pieceNames } from '../position';
import type { MoveVariant, Promotion } from './board.types';
import { PIECE_FILL } from './geometry';
import { Piece } from './piece';
import { PromotionAccessibility } from './promotion-accessibility';
import { promotionLayout } from './promotion-layout';

export function PromotionChooser({
  anchorRef,
  variants,
  color,
  destination,
  orientation,
  size,
  choose,
  cancel,
}: {
  anchorRef: RefObject<View | null>;
  variants: readonly MoveVariant[];
  color: Color;
  destination: Square;
  orientation: Color;
  size: number;
  choose: (piece: Promotion) => void;
  cancel: () => void;
}) {
  const styles = useStyles();
  const scroll = useRef<ScrollView>(null);
  const firstControl = useRef<View>(null);
  const layout = promotionLayout(
    destination,
    orientation,
    size,
    variants.flatMap((move) => (move.promotion ? [move.promotion] : [])),
  );
  return (
    <PromotionAccessibility
      firstControl={firstControl}
      cancel={cancel}
      anchorRef={anchorRef}
      size={size}
    >
      <Pressable
        style={styles.backdrop}
        focusable={false}
        accessibilityRole="button"
        accessibilityLabel="Dismiss promotion picker"
        onPress={cancel}
      />
      <View
        testID="promotion-stack"
        style={[
          styles.stack,
          {
            left: layout.left,
            top: layout.top,
            width: layout.targetSize,
            height: layout.height,
          },
        ]}
      >
        <ScrollView
          ref={scroll}
          bounces={false}
          scrollEnabled={layout.contentHeight > layout.height}
          onContentSizeChange={() => {
            if (layout.fromBottom)
              scroll.current?.scrollToEnd({ animated: false });
          }}
          contentContainerStyle={{
            flexDirection: layout.fromBottom ? 'column-reverse' : 'column',
          }}
        >
          {layout.choices.map((piece, index) => (
            <Pressable
              key={piece}
              ref={index === 0 ? firstControl : undefined}
              testID={`promotion-choice-${piece}`}
              accessibilityRole="button"
              accessibilityLabel={`Promote to ${pieceNames[piece]}`}
              onPress={() => choose(piece)}
              style={({ pressed }) => [
                styles.choice,
                { height: layout.targetSize },
                pressed && styles.pressed,
              ]}
            >
              <Piece
                kind={piece}
                color={color}
                size={layout.targetSize * PIECE_FILL}
              />
            </Pressable>
          ))}
          <Pressable
            testID="promotion-cancel"
            accessibilityRole="button"
            accessibilityLabel="Cancel promotion"
            onPress={cancel}
            style={({ pressed }) => [
              styles.choice,
              { height: layout.cancelSize },
              pressed && styles.pressed,
            ]}
          >
            <Text allowFontScaling={false} style={styles.cancel}>
              ×
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </PromotionAccessibility>
  );
}
const useStyles = createStyles((theme) => ({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  stack: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
  },
  choice: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  pressed: { backgroundColor: theme.colors.surfaceMuted },
  cancel: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.body,
    fontSize: 26,
  },
}));
