import { useEffect, useLayoutEffect, useRef } from 'react';
import { DRAG_THRESHOLD } from './geometry';
import type { MouseBoardInputOptions } from './mouse-board-input.types';

export function useMouseBoardInput({
  board,
  enabled,
  context,
  callbacks,
}: MouseBoardInputOptions) {
  const latest = useRef({ callbacks, context });
  useLayoutEffect(() => {
    latest.current = { callbacks, context };
  }, [callbacks, context]);
  useEffect(() => {
    const element = board.current as unknown as HTMLElement | null;
    if (!element || !enabled) return;
    let active:
      | { id: number; x: number; y: number; moved: boolean }
      | undefined;
    const point = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    // As on Chess.com: an open hand over any piece, a closed one while
    // dragging, the arrow elsewhere.
    const cursor = (value: '' | 'grab' | 'grabbing') => {
      if (element.style.cursor !== value) element.style.cursor = value;
    };
    const hover = (event: PointerEvent) => {
      if (active || event.pointerType !== 'mouse') return;
      const p = point(event);
      cursor(latest.current.callbacks.grabbable(p.x, p.y) ? 'grab' : '');
    };
    const stop = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const cancel = () => {
      if (!active) return;
      const id = active.id;
      active = undefined;
      latest.current.callbacks.cancel();
      cursor('');
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    };
    const down = (event: PointerEvent) => {
      if (
        event.pointerType !== 'mouse' ||
        event.button !== 0 ||
        !event.isPrimary
      )
        return;
      stop(event);
      (event.target as HTMLElement)
        .closest('td')
        ?.focus({ preventScroll: true });
      const p = point(event);
      active = { id: event.pointerId, ...p, moved: false };
      element.setPointerCapture(event.pointerId);
      latest.current.callbacks.down(p.x, p.y);
    };
    const move = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.id) return;
      if (latest.current.context !== context) {
        cancel();
        return;
      }
      stop(event);
      if (!(event.buttons & 1)) {
        cancel();
        return;
      }
      const p = point(event);
      active.moved ||=
        Math.hypot(p.x - active.x, p.y - active.y) > DRAG_THRESHOLD;
      if (active.moved && element.style.cursor === 'grab') cursor('grabbing');
      latest.current.callbacks.move(p.x, p.y);
    };
    const up = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.id) return;
      stop(event);
      if (latest.current.context !== context) {
        cancel();
        return;
      }
      const p = point(event);
      const click =
        !active.moved &&
        Math.hypot(p.x - active.x, p.y - active.y) <= DRAG_THRESHOLD;
      active = undefined;
      latest.current.callbacks.up(p.x, p.y, click);
      hover(event);
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', keydown, true);
    element.addEventListener('pointerdown', down, true);
    element.addEventListener('pointermove', hover);
    element.addEventListener('pointerleave', hover);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    element.addEventListener('pointercancel', cancel, true);
    element.addEventListener('lostpointercapture', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('pointermove', hover);
      element.removeEventListener('pointerleave', hover);
      cursor('');
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      element.removeEventListener('pointercancel', cancel, true);
      element.removeEventListener('lostpointercapture', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', keydown, true);
    };
  }, [board, enabled, context]);
}
