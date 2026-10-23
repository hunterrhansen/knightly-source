/**
 * ‹ › for a solved line: Left/Right arrows, unless another control (the
 * board's square focus, a text field) already handled the key.
 */
export function stepDelta(event: {
  key: string;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}): -1 | 1 | undefined {
  if (event.defaultPrevented) return undefined;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
    return undefined;
  const target = event.target as {
    tagName?: string;
    isContentEditable?: boolean;
  } | null;
  if (
    target?.isContentEditable ||
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA' ||
    target?.tagName === 'SELECT'
  )
    return undefined;
  return event.key === 'ArrowLeft'
    ? -1
    : event.key === 'ArrowRight'
      ? 1
      : undefined;
}
