import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** A review shortcut, as Chess.com's and Lichess's desktop reviews have them. */
export type ReviewKey =
  | 'previous'
  | 'next'
  | 'first'
  | 'last'
  | 'advance'
  | 'flip'
  | 'back'
  | 'best'
  | 'explain'
  | 'hint'
  | 'reveal'
  | 'retry'
  | 'list';

type KeyEventLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: unknown;
};

type ElementLike = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
};

const keys: Record<string, ReviewKey> = {
  ArrowLeft: 'previous',
  ArrowRight: 'next',
  ArrowUp: 'first',
  Home: 'first',
  ArrowDown: 'last',
  End: 'last',
  Enter: 'advance',
  ' ': 'advance',
  f: 'flip',
  F: 'flip',
  Escape: 'back',
  Backspace: 'back',
  b: 'best',
  B: 'best',
  e: 'explain',
  E: 'explain',
  h: 'hint',
  H: 'hint',
  s: 'reveal',
  S: 'reveal',
  r: 'retry',
  R: 'retry',
  l: 'list',
  L: 'list',
};

/** The shortcut a key press means, or none: never while typing, inside the
 * board (its arrows move between squares), with a modifier held (browser
 * shortcuts), or Enter/Space on a focused control, which presses it. */
export function reviewKey(event: KeyEventLike): ReviewKey | undefined {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
    return;
  const key = keys[event.key];
  if (!key) return;
  const target = (event.target ?? {}) as ElementLike;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
  if (target.closest?.('[role="grid"]')) return;
  if (
    key === 'advance' &&
    (tag === 'button' ||
      tag === 'a' ||
      target.getAttribute?.('role') === 'button')
  )
    return;
  return key;
}

/** Web shortcuts for the review's current view; a key left out does nothing. */
export function useReviewKeys(
  actions: Partial<Record<ReviewKey, () => void>>,
  enabled = true,
) {
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined')
      return;
    const onKey = (event: KeyboardEvent) => {
      const key = reviewKey(event);
      const action = key && latest.current[key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
