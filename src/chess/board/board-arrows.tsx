import type { Color } from 'chess.js';
import { View } from 'react-native';
import Svg, { G, Polygon } from 'react-native-svg';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { arrowGeometry } from './arrow-geometry';
import type { Presentation } from './board.types';
import type { useBoardAnnotations } from './use-board-annotations';

/** Feature arrows, the user's drawn arrows and the arrow being drawn, in order. */
export function boardArrows(
  presentation: Presentation,
  annotations: ReturnType<typeof useBoardAnnotations>,
) {
  return [
    ...presentation.arrows.map((arrow) => ({
      ...arrow,
      source: 'feature',
      color: tokens.boardAnnotations[arrow.tone],
    })),
    ...annotations.arrows.map((arrow) => ({
      ...arrow,
      source: 'user',
      color: tokens.boardDrawings[arrow.color],
      tone: 'analysis' as const,
    })),
    ...(annotations.draft
      ? [
          {
            ...annotations.draft,
            source: 'draft',
            tone: 'analysis' as const,
            color: tokens.boardDrawings[annotations.draft.color],
          },
        ]
      : []),
  ];
}

export function BoardArrows({
  arrows,
  width,
  orientation,
}: {
  arrows: ReturnType<typeof boardArrows>;
  width: number;
  orientation: Color;
}) {
  const styles = useStyles();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={styles.layer}
    >
      <Svg width={width} height={width} viewBox="0 0 8 8">
        {arrows.map((arrow) => {
          const geometry = arrowGeometry(arrow.from, arrow.to, orientation);
          if (!geometry) return null;
          const color = arrow.color;
          return (
            <G
              key={`${arrow.from}-${arrow.to}-${arrow.tone}-${arrow.source}`}
              testID={`arrow-${arrow.from}-${arrow.to}-${arrow.tone}`}
            >
              {/* Translucent like Chess.com's (0.8 fill × 0.8 opacity), so
                  the pieces under an arrow stay readable. */}
              <Polygon
                testID={`arrow-body-${arrow.from}-${arrow.to}-${arrow.tone}`}
                points={geometry.points}
                fill={color}
                fillOpacity={0.8}
                opacity={0.8}
              />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const useStyles = createStyles(() => ({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
}));
