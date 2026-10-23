import { type DrawingShortcut, drawingColor } from './drawing-colors';

test.each<[DrawingShortcut, string, string]>([
  ['default', 'yellow', 'red'],
  ['ctrl', 'red', 'yellow'],
  ['alt', 'blue', 'blue'],
  ['shift', 'green', 'green'],
])(
  '%s chooses the expected arrow and square colors',
  (shortcut, arrow, square) => {
    expect(drawingColor(shortcut)).toBe(arrow);
    expect(drawingColor(shortcut, true)).toBe(square);
  },
);
