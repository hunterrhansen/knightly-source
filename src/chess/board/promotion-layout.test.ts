import { promotionLayout } from './promotion-layout';

test('promotion choices and cancel fit within narrow boards in either orientation', () => {
  for (const size of [200, 320, 480]) {
    for (const orientation of ['w', 'b'] as const) {
      for (const square of ['a8', 'h8', 'a1', 'h1'] as const) {
        const layout = promotionLayout(square, orientation, size, [
          'q',
          'r',
          'b',
          'n',
        ]);
        expect(new Set(layout.choices)).toEqual(new Set(['q', 'r', 'b', 'n']));
        expect(layout.left).toBeGreaterThanOrEqual(0);
        expect(layout.left + layout.targetSize).toBeLessThanOrEqual(size);
        expect(layout.top).toBeGreaterThanOrEqual(0);
        expect(layout.top + layout.height).toBeLessThanOrEqual(size);
        expect(layout.targetSize).toBeGreaterThanOrEqual(44);
        expect(layout.cancelSize).toBeGreaterThanOrEqual(44);
        expect(layout.height).toBeGreaterThan(0);
        expect(layout.contentHeight).toBeGreaterThanOrEqual(layout.height);
      }
    }
  }
});
