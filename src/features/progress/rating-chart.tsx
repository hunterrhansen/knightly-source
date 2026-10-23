import { Circle } from '@shopify/react-native-skia';
import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Area,
  type CartesianActionsHandle,
  CartesianChart,
  Line,
  useChartPressState,
} from 'victory-native';
import { createStyles, useTheme } from '../../theme/theme';
import type { RatingChartProps } from './rating-points';

/** The rating as one line over a soft fill, no axes: tap or scrub sideways
 * to pick a game (the owner shows it). Keyboard and screen readers use the
 * owner's previous/next controls. */
export function RatingChart({ data, selected, onSelect }: RatingChartProps) {
  const styles = useStyles();
  const { theme } = useTheme();
  const { state } = useChartPressState({ x: 0, y: { rating: 0 } });
  const actions = useRef<CartesianActionsHandle<typeof state> | null>(null);
  const tapGesture = useMemo(
    () =>
      Gesture.Race(
        Gesture.Tap()
          .runOnJS(true)
          .onEnd((event, success) => {
            if (success) actions.current?.handleTouch(state, event.x, event.y);
          }),
      ),
    [state],
  );
  // Cross the JS boundary only when the selection moves to another game.
  useAnimatedReaction(
    () => state.matchedIndex.get(),
    (index, previous) => {
      if (index >= 0 && index !== previous) scheduleOnRN(onSelect, index);
    },
    [state, onSelect],
  );
  const low = Math.min(...data.map((point) => point.rating));
  const high = Math.max(...data.map((point) => point.rating));
  // A flat or nearly flat run still gets room to show small moves.
  const pad = Math.max(10, (high - low) * 0.1);
  return (
    <View testID="rating-chart" style={styles.chart} accessible={false}>
      <CartesianChart
        data={data}
        xKey="timestamp"
        yKeys={['rating']}
        chartPressState={state}
        actionsRef={actions}
        customGestures={tapGesture}
        chartPressConfig={{
          pan: { activeOffsetX: [-3, 3], failOffsetY: [-12, 12] },
        }}
        domain={{ y: [low - pad, high + pad] }}
        domainPadding={{ left: 6, right: 10, top: 10, bottom: 4 }}
        // victory-native 42 draws nothing without axisOptions; transparent
        // lines and no font keep the chart axis-free.
        axisOptions={{ lineColor: 'transparent' }}
      >
        {({ points, chartBounds }) => {
          const point = points.rating[selected];
          return (
            <>
              <Area
                points={points.rating}
                y0={chartBounds.bottom}
                color={theme.colors.sky}
                opacity={0.16}
              />
              <Line
                points={points.rating}
                color={theme.colors.sky}
                strokeWidth={3}
                curveType="linear"
              />
              {point?.y != null && (
                <>
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={9}
                    color={theme.colors.sky}
                    opacity={0.25}
                  />
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={5}
                    color={theme.colors.sky}
                  />
                </>
              )}
            </>
          );
        }}
      </CartesianChart>
    </View>
  );
}

const useStyles = createStyles(() => ({
  chart: { height: 132, width: '100%' },
}));
