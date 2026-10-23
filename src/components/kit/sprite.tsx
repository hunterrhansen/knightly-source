import { useId } from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { decorative } from '../ui/reward-effects';
import type { Sprite, SpriteNode } from './types';

// react-native-svg hands its props to the DOM on web, where only aria-hidden
// is valid; the native accessibility props would warn there.
const svgHidden =
  Platform.OS === 'web' ? ({ 'aria-hidden': true } as const) : decorative;

/** A layer's identity among its siblings, for React keys. */
function keyOf(node: SpriteNode, index: number) {
  if (node.kind === 'group') return `g${index}|${node.transform}`;
  return `${index}|${node.kind ?? 'path'}`;
}

/**
 * The nodes of a sprite, for drawing inside an Svg (a sprite on its own, a
 * scene's tile). `clipIds` maps the sprite's clip names to document ids.
 */
export function SpriteNodes({
  nodes,
  clipIds,
}: {
  nodes: readonly SpriteNode[];
  clipIds?: Readonly<Record<string, string>>;
}) {
  return nodes.map((node, index) => {
    const key = keyOf(node, index);
    if (node.kind === 'group')
      return (
        <G key={key} transform={node.transform}>
          <SpriteNodes nodes={node.layers} clipIds={clipIds} />
        </G>
      );
    const clipPath =
      node.clip && clipIds?.[node.clip]
        ? `url(#${clipIds[node.clip]})`
        : undefined;
    const paint = {
      fill: node.fill ?? 'none',
      stroke: node.stroke,
      strokeWidth: node.strokeWidth,
      strokeLinejoin: node.linejoin,
      strokeLinecap: node.linecap,
      clipPath,
      transform: node.transform,
    };
    switch (node.kind) {
      case 'circle':
        return (
          <Circle key={key} cx={node.cx} cy={node.cy} r={node.r} {...paint} />
        );
      case 'ellipse':
        return (
          <Ellipse
            key={key}
            cx={node.cx}
            cy={node.cy}
            rx={node.rx}
            ry={node.ry}
            {...paint}
          />
        );
      case 'rect':
        return (
          <Rect
            key={key}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            rx={node.rx}
            {...paint}
          />
        );
      case 'line':
        return (
          <Line
            key={key}
            x1={node.x1}
            y1={node.y1}
            x2={node.x2}
            y2={node.y2}
            {...paint}
          />
        );
      case 'text':
        return (
          <SvgText
            key={key}
            x={node.x}
            y={node.y}
            fontSize={node.fontSize}
            textAnchor={node.anchor}
            fill={node.fill}
          >
            {node.text}
          </SvgText>
        );
      default:
        return <Path key={key} d={node.d} {...paint} />;
    }
  });
}

/** A sprite's width at a given height, keeping its drawing box's shape. */
function spriteWidth(sprite: Sprite, height: number) {
  return (height * sprite.viewBox[0]) / sprite.viewBox[1];
}

/**
 * Draws a kit sprite `size` points tall (its width follows its drawing box).
 * Decorative: label what it stands for on the parent.
 */
export function SpriteView({ sprite, size }: { sprite: Sprite; size: number }) {
  // SVG ids are document-wide on web; each drawing needs its own clips.
  const prefix = `${sprite.id.replace(/[^a-z0-9]/gi, '-')}-${useId().replace(/:/g, '')}`;
  const clips = Object.entries(sprite.clips ?? {});
  const clipIds = Object.fromEntries(
    clips.map(([name]) => [name, `${prefix}-${name}`]),
  );
  const [w, h] = sprite.viewBox;
  return (
    <Svg
      width={spriteWidth(sprite, size)}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      {...svgHidden}
    >
      {clips.length > 0 && (
        <Defs>
          {clips.map(([name, d]) => (
            <ClipPath key={name} id={clipIds[name]}>
              <Path d={d} />
            </ClipPath>
          ))}
        </Defs>
      )}
      <SpriteNodes nodes={sprite.layers} clipIds={clipIds} />
    </Svg>
  );
}
