import { useEffect, useRef } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { squareAt } from '../coordinates';
import { createAnnouncementGate } from './announcements';
import type { BoardAccessibilityProps } from './board.types';

export function BoardAccessibility(
  props: BoardAccessibilityProps,
): React.JSX.Element {
  const gate = useRef(createAnnouncementGate());
  useEffect(() => {
    if (
      props.status &&
      gate.current.claim(props.statusId, props.statusReplaySafe)
    )
      AccessibilityInfo.announceForAccessibility(props.status);
  }, [props.status, props.statusId, props.statusReplaySafe]);
  // Constant styles and no wrapper per square: a re-render then sends no
  // prop updates for the grid, only for squares whose props changed.
  return (
    <View style={grid} accessible={false}>
      {Array.from({ length: 8 }, (_, row) => (
        <View
          key={squareAt(row * 8, props.orientation)[1]}
          accessible={false}
          style={rank}
        >
          {Array.from({ length: 8 }, (_, column) =>
            props.renderSquare(
              squareAt(row * 8 + column, props.orientation),
              false,
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const grid = { flex: 1 } as const;
const rank = { flex: 1, flexDirection: 'row' } as const;
