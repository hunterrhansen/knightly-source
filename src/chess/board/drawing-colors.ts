export type DrawingColor = 'yellow' | 'red' | 'blue' | 'green';
export type DrawingShortcut = 'default' | 'ctrl' | 'alt' | 'shift';
export function drawingColor(
  shortcut: DrawingShortcut,
  square = false,
): DrawingColor {
  if (shortcut === 'alt') return 'blue';
  if (shortcut === 'shift') return 'green';
  if (shortcut === 'ctrl') return square ? 'yellow' : 'red';
  return square ? 'red' : 'yellow';
}
