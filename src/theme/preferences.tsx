import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { z } from 'zod';
import { useSetAppearance } from './theme';

// Each field falls back alone so newer fields keep older stored choices. Keys
// no longer offered, such as the light/dark/system `theme` older builds saved,
// are dropped (Knightly is dark only).
const schema = z.object({
  board: z.enum(['sage', 'brown', 'green', 'blue', 'calm']).catch('sage'),
  pieces: z.enum(['knightly', 'cburnett']).catch('cburnett'),
  coordinates: z.enum(['inside', 'outside', 'none']).catch('inside'),
  animation: z
    .enum(['none', 'fast', 'medium', 'slow', 'natural', 'arcade', 'dynamic'])
    .catch('medium'),
  legalMoves: z.enum(['on', 'off']).catch('on'),
  lastMove: z.enum(['on', 'off']).catch('on'),
  sounds: z.enum(['on', 'off']).catch('on'),
  bestMove: z.enum(['on', 'off']).catch('on'),
  weekStart: z.enum(['sunday', 'monday']).catch('sunday'),
});
export type Preferences = z.infer<typeof schema>;
const defaults: Preferences = schema.parse({});
const key = 'knightly.display-preferences.v1';

// Board colours live with the theme; re-exported for existing callers.
export { boardSquareColors } from './theme';
export function parsePreferences(value: string | null): Preferences {
  try {
    const parsed = schema.safeParse(JSON.parse(value ?? '{}') ?? {});
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}
const Context = createContext({
  preferences: defaults,
  ready: false,
  error: '',
  set: (_patch: Partial<Preferences>) => {},
});
export function PreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const currentPreferences = useRef(defaults);
  const queue = useRef(Promise.resolve());
  const setAppearance = useSetAppearance();
  const apply = (value: Preferences) => setAppearance({ board: value.board });
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((stored) => {
        if (active) {
          const value = parsePreferences(stored);
          currentPreferences.current = value;
          setPreferences(value);
          setAppearance({ board: value.board });
        }
      })
      .catch(() => {
        if (active)
          setError(
            'Device preferences could not load. Changes apply for this session.',
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [setAppearance]);
  function set(patch: Partial<Preferences>) {
    if (!ready) return;
    const next = { ...currentPreferences.current, ...patch };
    currentPreferences.current = next;
    setPreferences(next);
    apply(next);
    queue.current = queue.current
      .then(() => AsyncStorage.setItem(key, JSON.stringify(next)))
      .then(() => setError(''))
      .catch(() =>
        setError(
          'This choice applies now, but could not be saved on this device.',
        ),
      );
  }
  return (
    <Context.Provider value={{ preferences, ready, error, set }}>
      {ready ? children : null}
    </Context.Provider>
  );
}
export function usePreferences() {
  return useContext(Context);
}
