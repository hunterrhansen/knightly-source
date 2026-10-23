import Svg, { Path } from 'react-native-svg';

/** Knightly's streak symbol: filled once today counts, an outline before. */
export function Moon({
  size,
  color,
  filled = true,
}: {
  size: number;
  color: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
