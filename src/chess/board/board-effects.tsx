import type { Color } from 'chess.js';
import { View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { AnswerBadge } from './answer-badge';
import { HintEffect } from './answer-effects';
import type { Presentation } from './board.types';
import type { checkState } from './check-state';
import { GradeEffect } from './grade-effect';
import { MateBadges } from './mate-badges';

/**
 * Answer, hint, mate and grade badges over the board. Badges for a move wait
 * `landingDelay` for its piece to land.
 */
export function BoardEffects({
  presentation,
  shownGrade,
  check,
  displayedFen,
  blocked,
  positionId,
  attemptId,
  orientation,
  width,
  landingDelay,
}: {
  presentation: Presentation;
  /** The grade, unless an error highlight covers its square. */
  shownGrade: Presentation['grade'];
  check: ReturnType<typeof checkState>;
  displayedFen: string;
  blocked: boolean;
  positionId: string;
  /** The rejected attempt the incorrect badges belong to. */
  attemptId: string | undefined;
  orientation: Color;
  width: number;
  landingDelay: number;
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
      {!blocked && presentation.correct?.square && (
        <AnswerBadge
          kind="correct"
          testID={`correct-badge-${presentation.correct.square}`}
          key={`${presentation.correct.id}:${presentation.correct.square}`}
          square={presentation.correct.square}
          orientation={orientation}
          cell={width / 8}
          delay={landingDelay}
        />
      )}
      {!blocked && presentation.hint && (
        <HintEffect
          square={presentation.hint.square}
          orientation={orientation}
          cell={width / 8}
        />
      )}
      {check?.mate && check.winner && (
        <MateBadges
          key={displayedFen}
          loser={check.king}
          winner={check.winner}
          orientation={orientation}
          size={width / 8}
        />
      )}
      {shownGrade && (
        <GradeEffect
          key={`${positionId}:${shownGrade.id ?? ''}:${shownGrade.square}:${shownGrade.kind}`}
          grade={shownGrade.kind}
          square={shownGrade.square}
          orientation={orientation}
          cell={width / 8}
          delay={landingDelay}
        />
      )}
      {presentation.highlights
        .filter((mark) => mark.tone === 'error' && mark.badge !== false)
        .map((mark) => (
          <AnswerBadge
            kind="incorrect"
            key={`${positionId}:${attemptId ?? presentation.grade?.id ?? ''}:${mark.square}`}
            testID={`rejection-marker-${mark.square}`}
            square={mark.square}
            orientation={orientation}
            cell={width / 8}
            delay={landingDelay}
          />
        ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
}));
