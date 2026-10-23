import { useWindowDimensions } from 'react-native';

const LINE = 1.35;

/**
 * Fixed text geometry for regions that must not change height, such as
 * anything above a board: callers clamp text to `lines` and reserve the
 * returned height, which follows the system text size.
 */
export function useTextBlock() {
  const { fontScale } = useWindowDimensions();
  return {
    lineHeight: (size: number) => Math.ceil(size * LINE * fontScale),
    height: (size: number, lines: number) =>
      Math.ceil(size * LINE * fontScale) * lines,
  };
}
