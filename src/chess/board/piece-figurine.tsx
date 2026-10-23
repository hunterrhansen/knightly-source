import type { Color, PieceSymbol } from 'chess.js';
import { Platform } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { pieceBodies, type Shape } from './piece-art';

const hidden =
  Platform.OS === 'web'
    ? {}
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };

function ArtShape({ shape }: { shape: Shape }) {
  switch (shape.type) {
    case 'path':
      return <Path d={shape.d} />;
    case 'rect':
      return (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
        />
      );
    case 'circle':
      return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} />;
  }
}

/** A piece's silhouette in one ink, for move notation ("♘f3"), as Chess.com's
 * move list draws it: White's filled, Black's outlined. Decorative: the SAN
 * beside it carries the letter for screen readers. */
export function PieceFigurine({
  kind,
  color,
  size,
  ink,
}: {
  kind: PieceSymbol;
  color: Color;
  size: number;
  ink: string;
}) {
  const filled = color === 'w';
  return (
    <Svg
      width={size}
      height={size}
      viewBox="12 10 76 86"
      {...hidden}
      aria-hidden
    >
      <G
        stroke={ink}
        strokeWidth={filled ? 4.5 : 6}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={filled ? ink : 'none'}
      >
        <Rect x={20} y={79} width={60} height={13} rx={6.5} />
        {pieceBodies[kind].map((shape) => (
          <ArtShape key={JSON.stringify(shape)} shape={shape} />
        ))}
      </G>
    </Svg>
  );
}
