/**
 * Native: no app-wide hardware key events without a native module; the ‹ ›
 * buttons step through the line. The web variant adds the arrow keys.
 */
export function useStepKeys(
  _enabled: boolean,
  _onStep: (delta: -1 | 1) => void,
) {}
