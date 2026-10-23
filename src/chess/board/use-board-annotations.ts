import type { Square } from 'chess.js';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import {
  type DrawingColor,
  type DrawingShortcut,
  drawingColor,
} from './drawing-colors';

type Drawing = Readonly<{ from: Square; to: Square; color: DrawingColor }>;
type SquareMark = Readonly<{ square: Square; color: DrawingColor }>;
type Draft = Readonly<{ from: Square; to: Square; shortcut: DrawingShortcut }>;
const empty = { squares: [] as SquareMark[], arrows: [] as Drawing[] };

export function useBoardAnnotations(positionId: string, enabled: boolean) {
  const [marks, setMarks] = useState(empty);
  const [draft, setDraft] = useState<Draft>();
  const draftRef = useRef<Draft | undefined>(undefined);
  const context = useRef({ positionId, enabled });
  const clear = useCallback(() => {
    draftRef.current = undefined;
    setDraft(undefined);
    setMarks(empty);
  }, []);
  useLayoutEffect(() => {
    if (context.current.positionId !== positionId || !enabled) clear();
    context.current = { positionId, enabled };
  }, [positionId, enabled, clear]);
  useLayoutEffect(
    () => () => {
      context.current.enabled = false;
    },
    [],
  );
  const current = () =>
    context.current.enabled && context.current.positionId === positionId;
  const cancel = () => {
    draftRef.current = undefined;
    setDraft(undefined);
  };
  return {
    squares: enabled ? marks.squares : [],
    arrows: enabled ? marks.arrows : [],
    draft:
      enabled && draft
        ? {
            from: draft.from,
            to: draft.to,
            color: drawingColor(draft.shortcut),
          }
        : undefined,
    clear,
    cancel,
    begin: (from: Square, shortcut: DrawingShortcut = 'default') => {
      if (!current()) return;
      draftRef.current = { from, to: from, shortcut };
      setDraft(draftRef.current);
    },
    update: (to: Square | null) => {
      if (!current() || !draftRef.current || !to || draftRef.current.to === to)
        return;
      draftRef.current = { ...draftRef.current, to };
      setDraft(draftRef.current);
    },
    finish: (to: Square | null) => {
      if (!current()) return;
      const drawing = draftRef.current;
      cancel();
      if (!current() || !drawing || !to) return;
      const from = drawing.from;
      const color = drawingColor(drawing.shortcut, from === to);
      setMarks((previous) => {
        if (from === to) {
          const existing = previous.squares.find(
            (mark) => mark.square === from,
          );
          const remaining = previous.squares.filter(
            (mark) => mark.square !== from,
          );
          return {
            ...previous,
            squares:
              existing?.color === color
                ? remaining
                : [...remaining, { square: from, color }],
          };
        }
        const existing = previous.arrows.find(
          (arrow) => arrow.from === from && arrow.to === to,
        );
        const remaining = previous.arrows.filter(
          (arrow) => arrow.from !== from || arrow.to !== to,
        );
        return {
          ...previous,
          arrows:
            existing?.color === color
              ? remaining
              : [...remaining, { from, to, color }],
        };
      });
    },
  };
}
