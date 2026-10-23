import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import { createStyles, useTheme } from '../../theme/theme';
import type { SkillAxis } from './progress-model';

/** Height for a given width: room above and below the shape for labels. */
const heightFor = (width: number) => Math.round(width * 0.75);

/** Five fixed axes, 0–100: the player's shape filled green, the previous
 * period dashed, the weakest axis marked with a coral dot and its word.
 * Unscored axes show a dash; the shape draws only when all five have a score. */
export function SkillRadar({
  axes,
  weakest,
  showPrevious,
}: {
  axes: SkillAxis[];
  weakest: SkillAxis['key'] | undefined;
  showPrevious: boolean;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const [width, setWidth] = useState(326);
  const height = heightFor(width);
  const center = { x: width / 2, y: height / 2 + 4 };
  const radius = Math.min(width * 0.25, height * 0.33);
  const at = (index: number, value: number, distance = radius) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const r = (distance * Math.max(0, Math.min(100, value))) / 100;
    return {
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
    };
  };
  const ring = (value: number) =>
    axes
      .map((_, index) => {
        const p = at(index, value);
        return `${p.x},${p.y}`;
      })
      .join(' ');
  const shape = (values: (number | null)[]) =>
    values.every((value) => value != null)
      ? values
          .map((value, index) => {
            const p = at(index, value ?? 0);
            return `${p.x},${p.y}`;
          })
          .join(' ')
      : null;
  const now = shape(axes.map((axis) => axis.score));
  const before = showPrevious ? shape(axes.map((axis) => axis.previous)) : null;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.frame, { height }]}
    >
      <Svg width={width} height={height} aria-hidden>
        <Polygon
          points={ring(100)}
          fill={theme.colors.surfaceMuted}
          stroke={theme.colors.line}
          strokeWidth={1.5}
        />
        {[66.7, 33.3].map((value) => (
          <Polygon
            key={value}
            points={ring(value)}
            fill="none"
            stroke={theme.colors.line}
            strokeWidth={1}
          />
        ))}
        {axes.map((axis, index) => {
          const end = at(index, 100);
          return (
            <Line
              key={axis.key}
              x1={center.x}
              y1={center.y}
              x2={end.x}
              y2={end.y}
              stroke={theme.colors.line}
              strokeWidth={1}
            />
          );
        })}
        {before && (
          <Polygon
            points={before}
            fill="none"
            stroke={theme.colors.inkMuted}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
        {now && (
          <Polygon
            points={now}
            fill={theme.colors.brand}
            fillOpacity={0.22}
            stroke={theme.colors.brand}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}
        {axes.map((axis, index) => {
          if (axis.score == null) return null;
          const p = at(index, axis.score);
          const weak = axis.key === weakest;
          return (
            <Circle
              key={axis.key}
              cx={p.x}
              cy={p.y}
              r={weak ? 6 : 3.5}
              fill={weak ? theme.colors.weak : theme.colors.brand}
              stroke={weak ? theme.colors.surface : 'none'}
              strokeWidth={2}
            />
          );
        })}
      </Svg>
      {axes.map((axis, index) => {
        const p = at(index, 100, radius + 30);
        const weak = axis.key === weakest;
        // The top axis has the width for "SAFETY · WEAKEST" on one line;
        // the others stack the word under the name.
        const top = index === 0;
        const labelWidth = width * (top ? 0.6 : 0.34);
        return (
          <View
            key={axis.key}
            style={[
              styles.label,
              {
                width: labelWidth,
                left: Math.max(
                  0,
                  Math.min(width - labelWidth, p.x - labelWidth / 2),
                ),
                top: p.y - (weak && !top ? 28 : 20),
              },
            ]}
          >
            {weak && top ? (
              <Text style={[styles.tagLine, styles.weak]} numberOfLines={1}>
                {`${axis.label.toUpperCase()} · WEAKEST`}
              </Text>
            ) : (
              <Text
                style={[styles.name, weak && styles.weak]}
                numberOfLines={1}
              >
                {axis.label}
              </Text>
            )}
            {weak && !top && (
              <Text style={[styles.tag, styles.weak]}>WEAKEST</Text>
            )}
            <Text style={styles.score}>
              {axis.score == null ? '—' : String(axis.score)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  frame: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  placeholder: {
    width: 200,
    height: 190,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCount: {
    position: 'absolute',
    top: 86,
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  label: { position: 'absolute', alignItems: 'center' },
  name: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 12,
  },
  tag: {
    fontFamily: theme.typography.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  tagLine: {
    fontFamily: theme.typography.bold,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  weak: { color: theme.colors.weak },
  score: {
    color: theme.colors.ink,
    fontFamily: theme.typography.heading,
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
}));

/** The locked shape: the empty pentagon, dashed, with how far along the
 * unlock is in the middle ("3/10"). */
export function SkillRadarPlaceholder({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const styles = useStyles();
  const { theme } = useTheme();
  const center = { x: 100, y: 100 };
  const corner = (index: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    return {
      x: center.x + Math.cos(angle) * 80,
      y: center.y + Math.sin(angle) * 80,
    };
  };
  const corners = [0, 1, 2, 3, 4].map(corner);
  return (
    <View style={styles.placeholder} aria-hidden>
      <Svg width={200} height={190} viewBox="0 0 200 190">
        <Polygon
          points={corners.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={theme.colors.surfaceMuted}
          stroke={theme.colors.inkMuted}
          strokeWidth={2}
          strokeDasharray="6 6"
        />
        {corners.map((p, index) => (
          <Line
            // biome-ignore lint/suspicious/noArrayIndexKey: five fixed corners
            key={index}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            stroke={theme.colors.line}
            strokeWidth={1}
          />
        ))}
        <Circle
          cx={center.x}
          cy={center.y}
          r={30}
          fill={theme.colors.surface}
          stroke={theme.colors.line}
          strokeWidth={1.5}
        />
      </Svg>
      <Text style={styles.placeholderCount}>{`${done}/${total}`}</Text>
    </View>
  );
}
