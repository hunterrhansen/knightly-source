import type { RefObject } from 'react';
import type { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { DrawingShortcut } from './drawing-colors';

export function useDrawingShortcut(_board: RefObject<View | null>) {
  return useSharedValue<DrawingShortcut>('default');
}
