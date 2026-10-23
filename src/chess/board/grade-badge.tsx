import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { badgeGlyphColor, type MoveGrade, moveGrades } from './move-grade';

// Our own glyphs drawn to Chess.com's badge proportions: an 18×19 viewBox
// with a disc, a 30% disc shadow and a 20% glyph shadow, both offset down.
const question = (x: number) =>
  `M${x - 2.4} 6.4a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2 1-1.2 1.9v.5`;
const stroke = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Glyph({ grade, color }: { grade: MoveGrade; color: string }) {
  switch (grade) {
    case 'brilliant':
      return (
        <G fill={color}>
          <Rect x={5.4} y={3.6} width={2.4} height={7.4} rx={0.5} />
          <Rect x={5.4} y={12.2} width={2.4} height={2.4} rx={0.5} />
          <Rect x={10.2} y={3.6} width={2.4} height={7.4} rx={0.5} />
          <Rect x={10.2} y={12.2} width={2.4} height={2.4} rx={0.5} />
        </G>
      );
    case 'great':
      return (
        <G fill={color}>
          <Rect x={7.8} y={3.6} width={2.4} height={7.4} rx={0.5} />
          <Rect x={7.8} y={12.2} width={2.4} height={2.4} rx={0.5} />
        </G>
      );
    case 'best':
      return (
        <Path
          fill={color}
          d="M9 2.9 10.7 6.7 14.8 7.1 11.7 9.8 12.6 13.9 9 11.8 5.4 13.9 6.3 9.8 3.2 7.1 7.3 6.7Z"
        />
      );
    case 'excellent':
      return (
        <Path
          fill={color}
          d="M3.6 8.4h2.6v6H3.6z M7.2 14.4V8.4l2.7-4.6c1.4 0 2 1 1.5 2.4l-.5 1.6h2.6c1 0 1.6.9 1.4 1.8l-1.1 3.7c-.2.7-.9 1.1-1.6 1.1z"
        />
      );
    case 'good':
      return (
        <Path
          {...stroke}
          stroke={color}
          strokeWidth={2.8}
          d="M4.3 9.2 7.5 12.4 13.7 6.2"
        />
      );
    case 'book':
      return (
        <Path
          fill={color}
          d="M2.8 5.1c2.3-.7 4.5-.3 5.8.8v8.6c-1.3-1-3.5-1.4-5.8-.8z M15.2 5.1c-2.3-.7-4.5-.3-5.8.8v8.6c1.3-1 3.5-1.4 5.8-.8z"
        />
      );
    case 'inaccuracy':
      return (
        <G>
          <Path
            {...stroke}
            stroke={color}
            strokeWidth={2.3}
            d={question(7.1)}
          />
          <Circle cx={6.9} cy={13.4} r={1.25} fill={color} />
          <Rect x={11} y={3.6} width={2.4} height={7.4} rx={0.5} fill={color} />
          <Rect
            x={11}
            y={12.2}
            width={2.4}
            height={2.4}
            rx={0.5}
            fill={color}
          />
        </G>
      );
    case 'mistake':
      return (
        <G>
          <Path
            {...stroke}
            stroke={color}
            strokeWidth={2.4}
            d={question(9.2)}
          />
          <Circle cx={9} cy={13.4} r={1.3} fill={color} />
        </G>
      );
    case 'blunder':
      return (
        <G>
          <Path
            {...stroke}
            stroke={color}
            strokeWidth={2.2}
            d={question(6.6)}
          />
          <Circle cx={6.4} cy={13.4} r={1.2} fill={color} />
          <Path
            {...stroke}
            stroke={color}
            strokeWidth={2.2}
            d={question(11.8)}
          />
          <Circle cx={11.6} cy={13.4} r={1.2} fill={color} />
        </G>
      );
    case 'miss':
      return (
        <Path
          {...stroke}
          stroke={color}
          strokeWidth={2.8}
          d="M5.6 5.6 12.4 12.4 M12.4 5.6 5.6 12.4"
        />
      );
  }
}

/** A badge disc over its 30% drop shadow, in the 18×19 badge viewBox. */
export function BadgeDisc({ color }: { color: string }) {
  return (
    <>
      <Circle cx={9} cy={9.5} r={9} fill="#000000" opacity={0.3} />
      <Circle cx={9} cy={9} r={9} fill={color} />
    </>
  );
}

/** A badge glyph `draw`n twice: its 20% shadow offset down, then in `color`. */
export function ShadowedGlyph({
  color,
  draw,
}: {
  color: string;
  draw: (color: string) => ReactNode;
}) {
  return (
    <>
      <G opacity={0.2} transform="translate(0 0.5)">
        {draw('#000000')}
      </G>
      {draw(color)}
    </>
  );
}

const GradeMarks = ({ grade }: { grade: MoveGrade }) => (
  <ShadowedGlyph
    color={badgeGlyphColor(grade)}
    draw={(color) => <Glyph grade={grade} color={color} />}
  />
);

/** The disc with its shadow; hidden while a flashing badge grows. */
export function GradeDisc({ grade }: { grade: MoveGrade }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 18 19">
      <BadgeDisc color={moveGrades[grade].color} />
    </Svg>
  );
}

/** The white glyph with its own shadow. */
export function GradeGlyph({ grade }: { grade: MoveGrade }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 18 19">
      <GradeMarks grade={grade} />
    </Svg>
  );
}

/** A static Chess.com-style classification badge, `size` points across. */
export function GradeBadge({
  grade,
  size,
}: {
  grade: MoveGrade;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 19">
      <BadgeDisc color={moveGrades[grade].color} />
      <GradeMarks grade={grade} />
    </Svg>
  );
}
