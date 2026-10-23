import { cubicBezier } from 'react-native-reanimated';

/** `withTiming`'s default curve, `Easing.inOut(Easing.quad)`, for Reanimated
 * CSS animations and transitions, so a loop moved to CSS keeps its feel. */
export const quadInOut = cubicBezier(0.455, 0.03, 0.515, 0.955);
