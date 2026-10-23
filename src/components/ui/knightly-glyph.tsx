import { useId } from 'react';
import Svg, { ClipPath, Defs, Path } from 'react-native-svg';
import { type GlyphArtName, glyphArt } from './glyph-art';

export type KnightlyGlyphName = GlyphArtName;

/**
 * Knightly's chunky glyphs, for navigation and big moments: Today, Games,
 * Progress and Settings in the star shard's glossy cel (`glyph-art`).
 * Decorative by default; pass `title` when the glyph carries meaning on its own.
 */
export function KnightlyGlyph({
  name,
  size = 32,
  title,
}: {
  name: KnightlyGlyphName;
  size?: number;
  title?: string;
}) {
  // SVG ids are document-wide on web; each glyph needs its own clip.
  const clip = `glyph-${useId().replace(/:/g, '')}`;
  const art = glyphArt[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={!title}
    >
      <Defs>
        <ClipPath id={clip}>
          {art.silhouette.map((d) => (
            <Path key={d} d={d} />
          ))}
        </ClipPath>
      </Defs>
      {art.layers.map((layer, index) => (
        <Path
          // Layers repeat a shape in different colours.
          // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders
          key={index}
          d={layer.d}
          fill={layer.fill ?? 'none'}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath={layer.clip ? `url(#${clip})` : undefined}
        />
      ))}
    </Svg>
  );
}
