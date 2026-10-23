import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export function useSystemReducedMotion() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let alive = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        changed = true;
        setReduced(value);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive && !changed && value !== initial) setReduced(value);
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [initial]);
  return reduced;
}
