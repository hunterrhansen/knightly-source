import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useState } from 'react';
import { Notice } from '../../ui';
import type { RatingChartProps } from './rating-points';

export function ChartSurface(props: RatingChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Expo renders routes in Node as well; CanvasKit belongs to the browser.
  if (!mounted) return <Notice title="Loading chart renderer…" />;
  return (
    <WithSkiaWeb
      opts={{ locateFile: () => '/canvaskit.wasm' }}
      fallback={<Notice title="Loading chart renderer…" />}
      getComponent={async () => ({
        default: (await import('./rating-chart')).RatingChart,
      })}
      componentProps={props}
    />
  );
}
