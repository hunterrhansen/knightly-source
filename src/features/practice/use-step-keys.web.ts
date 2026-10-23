import { useEffect, useRef } from 'react';
import { stepDelta } from './step-keys';

/** Left/Right arrows step through the line while `enabled`. */
export function useStepKeys(enabled: boolean, onStep: (delta: -1 | 1) => void) {
  const step = useRef(onStep);
  step.current = onStep;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const delta = stepDelta(event);
      if (!delta) return;
      event.preventDefault();
      step.current(delta);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
