import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import {
  knightEye,
  knightPath,
  knightTransform,
  moon,
  moonCutout,
  tileDarkSquares,
} from './brand-mark-geometry';

export function BrandMark({ size = 36 }: { size?: number }) {
  const { theme } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <Rect
        x="4"
        y="8"
        width="92"
        height="88"
        rx="22"
        fill={theme.colors.brandLedge}
      />
      <Rect
        x="4"
        y="4"
        width="92"
        height="88"
        rx="22"
        fill={theme.colors.brand}
      />
      {tileDarkSquares.map((d) => (
        <Path key={d} d={d} fill={theme.colors.brandSquare} />
      ))}
      <Circle {...moon} fill={theme.boardAnnotations.hintGold} />
      <Circle {...moonCutout} fill={theme.colors.brandSquare} />
      <Path
        d={knightPath}
        transform={`translate(${knightTransform.x} ${knightTransform.y}) scale(${knightTransform.scale})`}
        fill={theme.colors.onBrand}
      />
      <Circle {...knightEye} fill={theme.colors.brand} />
    </Svg>
  );
}
