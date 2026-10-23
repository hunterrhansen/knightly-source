import { useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { moveGrades } from '../../chess/board';
import type { GameDetail } from '../../lib/api/review-contract';
import { createStyles } from '../../theme/theme';
import { tokens } from '../../theme/tokens';
import { gradeOf, whiteWinPct } from './review-moments';

const marked = new Set(['brilliant', 'great', 'mistake', 'blunder', 'miss']);

/** White's win chance across the game, notable moves as dots; tapping jumps
 * to the nearest move. */
export function WinGraph({
  game,
  height = 88,
  cursor,
  onSelect,
}: {
  game: GameDetail;
  height?: number;
  cursor?: number;
  onSelect?: (index: number) => void;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const count = game.plies.length;
  const x = (i: number) => (count ? (i / count) * width : 0);
  const y = (i: number) => height - (whiteWinPct(game, i) / 100) * height;
  let area = `M0 ${height}`;
  for (let i = 0; i <= count; i++) area += ` L${x(i)} ${y(i)}`;
  area += ` L${width} ${height} Z`;
  const dots = game.plies.filter((m) => marked.has(gradeOf(m) ?? ''));
  return (
    <Pressable
      accessibilityRole={onSelect ? 'adjustable' : 'image'}
      accessibilityLabel={`Win chance across the game, ${dots.length} notable moves marked`}
      disabled={!onSelect}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) =>
        width &&
        onSelect?.(Math.round((e.nativeEvent.locationX / width) * count))
      }
      style={[styles.frame, { height }]}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={tokens.evaluation.black}
          />
          <Path d={area} fill={tokens.evaluation.white} />
          <Line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="rgba(0,0,0,0.25)"
            strokeDasharray="3 3"
          />
          {cursor !== undefined && (
            <Rect
              x={x(cursor) - 1.5}
              y={0}
              width={3}
              height={height}
              fill="#49a8f2"
            />
          )}
          {dots.map((m) => {
            const grade = gradeOf(m);
            return grade ? (
              <Circle
                key={m.ply}
                cx={x(m.ply)}
                cy={y(m.ply)}
                r={5}
                fill={moveGrades[grade].color}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            ) : null;
          })}
        </Svg>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  frame: {
    borderRadius: theme.radius.control - 6,
    overflow: 'hidden',
    backgroundColor: tokens.evaluation.black,
  },
}));
