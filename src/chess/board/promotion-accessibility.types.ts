import type { ReactNode, RefObject } from 'react';
import type { View } from 'react-native';
export type PromotionAccessibilityProps = Readonly<{
  children: ReactNode;
  anchorRef: RefObject<View | null>;
  size: number;
  firstControl: RefObject<View | null>;
  cancel: () => void;
}>;
