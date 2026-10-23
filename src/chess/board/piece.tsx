import type { Color, PieceSymbol } from 'chess.js';
import { Platform } from 'react-native';
import Svg, { Circle, G, Path, Rect, SvgXml } from 'react-native-svg';
import { usePreferences } from '../../theme/preferences';
import { tokens } from '../../theme/tokens';
import { cburnettPieces } from './cburnett-art';
import { pieceBodies, pieceDetails, type Shape } from './piece-art';

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

export function Piece({
  kind,
  color,
  size,
}: {
  kind: PieceSymbol;
  color: Color;
  size: number;
}) {
  if (usePreferences().preferences.pieces === 'cburnett')
    return (
      <SvgXml
        xml={cburnettPieces[color][kind]}
        width={size}
        height={size}
        {...hidden}
        aria-hidden
      />
    );
  const white = color === 'w';
  const palette = tokens.pieces;
  const fill = white ? palette.white : palette.black;
  const shade = white ? palette.whiteShade : palette.blackShade;
  const outline = white ? palette.outline : palette.blackOutline;
  const stroke = {
    stroke: outline,
    strokeWidth: 4.5,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  } as const;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      {...hidden}
      aria-hidden
    >
      <Rect
        x={20}
        y={79}
        width={60}
        height={13}
        rx={6.5}
        {...stroke}
        fill={shade}
      />
      <G {...stroke} fill={fill}>
        {pieceBodies[kind].map((shape) => (
          <ArtShape key={JSON.stringify(shape)} shape={shape} />
        ))}
      </G>
      {kind === 'n' && (
        <Circle
          cx={35}
          cy={31}
          r={3.6}
          fill={white ? outline : palette.blackEye}
        />
      )}
      {pieceDetails[kind] && (
        <Path
          d={pieceDetails[kind]}
          fill="none"
          stroke={white ? shade : palette.blackDetail}
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}
