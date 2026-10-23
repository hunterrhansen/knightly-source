import { type RefObject, useEffect } from 'react';
import type { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type { DrawingShortcut } from './drawing-colors';

export function useDrawingShortcut(board: RefObject<View | null>) {
  const shortcut = useSharedValue<DrawingShortcut>('default');
  useEffect(() => {
    const element = board.current as unknown as HTMLElement | null;
    if (!element) return;
    const capture = (event: PointerEvent) => {
      shortcut.set(
        event.ctrlKey
          ? 'ctrl'
          : event.altKey
            ? 'alt'
            : event.shiftKey
              ? 'shift'
              : 'default',
      );
    };
    element.addEventListener('pointerdown', capture, true);
    return () => element.removeEventListener('pointerdown', capture, true);
  }, [board, shortcut]);
  return shortcut;
}
