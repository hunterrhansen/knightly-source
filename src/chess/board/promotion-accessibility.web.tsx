import { useLayoutEffect, useRef } from 'react';
import type { PromotionAccessibilityProps } from './promotion-accessibility.types';

export function PromotionAccessibility({
  children,
  cancel,
}: PromotionAccessibilityProps) {
  const root = useRef<HTMLDivElement>(null);
  const latestCancel = useRef(cancel);
  latestCancel.current = cancel;
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const controls = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          '[data-testid^="promotion-choice-"], [data-testid="promotion-cancel"]',
        ),
      );
    const focusFirst = () => controls()[0]?.focus({ preventScroll: true });
    // Mask each sibling branch along the ancestor path, preserving prior state.
    const masked: {
      element: HTMLElement;
      inert: boolean;
      hidden: string | null;
    }[] = [];
    let branch: HTMLElement = node;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (
          sibling === branch ||
          !(sibling instanceof HTMLElement) ||
          ['SCRIPT', 'STYLE'].includes(sibling.tagName)
        )
          continue;
        masked.push({
          element: sibling,
          inert: sibling.inert,
          hidden: sibling.getAttribute('aria-hidden'),
        });
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    focusFirst();
    const containFocus = (event: FocusEvent) => {
      if (!node.contains(event.target as Node)) focusFirst();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        latestCancel.current();
      }
      if (event.key === 'Tab') {
        const buttons = controls();
        const current = buttons.indexOf(document.activeElement as HTMLElement);
        event.preventDefault();
        buttons[
          (current + (event.shiftKey ? -1 : 1) + buttons.length) %
            buttons.length
        ]?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('focusin', containFocus);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('focusin', containFocus);
      document.removeEventListener('keydown', handleKey, true);
      for (const { element, inert, hidden } of masked) {
        element.inert = inert;
        if (hidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', hidden);
      }
    };
  }, []);
  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Choose promotion piece"
      style={{ position: 'absolute', inset: 0 }}
    >
      {children}
    </div>
  );
}
