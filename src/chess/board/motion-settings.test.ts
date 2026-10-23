import { pieceFadeIn } from './motion-settings';

// Reanimated's withTiming copies every config key over its defaults, so an
// explicit `easing: undefined` replaced the default and crashed the frame loop
// in the web export ("n.easing is not a function") when a lesson's next
// position faded its pieces in.
test('a piece that appears without dropping in keeps the default easing', () => {
  expect(pieceFadeIn(false)).not.toHaveProperty('easing');
});

test('a piece dropping in eases out', () => {
  expect(typeof pieceFadeIn(true).easing).toMatch(/function|object/);
});
