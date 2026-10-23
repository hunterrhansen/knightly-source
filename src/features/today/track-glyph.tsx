import Svg, { Circle, Path } from 'react-native-svg';

// A lesson's track as one small glyph, the same everywhere on the ward path
// (docs/specs/2026-10-20-ward-path-design.md, "Track glyphs"): crossed swords
// for tactics, a shield for defence, a crown for mate, a pawn for endgames,
// the lantern for calculation, an open gate for openings, a flag for
// positional play. Chunky solid shapes in one colour, so the glyph reads at
// 14px and follows the node's state.

type Glyph = { fills?: readonly string[]; strokes?: readonly string[] };

const GLYPHS: Record<string, Glyph> = {
  // Two blades crossing, tips up, each with a guard and a grip.
  tactic: {
    strokes: [
      'M5 4 L16 15',
      'M14 17 L18 13',
      'M16 15 L19.5 18.5',
      'M19 4 L8 15',
      'M6 13 L10 17',
      'M8 15 L4.5 18.5',
    ],
  },
  defence: {
    fills: [
      'M12 2.5 L20 5.5 V11 C20 16.5 16.3 20.3 12 21.8 C7.7 20.3 4 16.5 4 11 V5.5 Z',
    ],
  },
  mate: {
    fills: [
      'M3.5 18.5 L4.5 7.5 L9.2 11.5 L12 5 L14.8 11.5 L19.5 7.5 L20.5 18.5 Z',
    ],
    strokes: ['M4 21 H20'],
  },
  endgame: {
    fills: ['M8.5 21 H15.5 L14.6 14.5 H9.4 Z', 'M6.5 21.5 H17.5 V19.5 H6.5 Z'],
  },
  calculation: {
    fills: ['M7.5 8 H16.5 L15.3 19 H8.7 Z'],
    strokes: ['M9 4.5 H15', 'M12 4.5 V8', 'M10 21 H14'],
  },
  opening: {
    fills: [
      'M4 21 V10.5 A8 8 0 0 1 20 10.5 V21 H15.5 V13.5 A3.5 3.5 0 0 0 8.5 13.5 V21 Z',
    ],
  },
  positional: {
    fills: ['M7 4 H19 L16.5 8.5 L19 13 H7 Z'],
    strokes: ['M6 3 V21.5'],
  },
};

export function TrackGlyph({
  track,
  size = 22,
  color,
}: {
  track: string;
  size?: number;
  color: string;
}) {
  const glyph = GLYPHS[track] ?? GLYPHS.tactic ?? {};
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {track === 'endgame' && <Circle cx={12} cy={9} r={4} fill={color} />}
      {glyph.fills?.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
      {glyph.strokes?.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
