import { useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';

const shown: Record<string, string> = {
  Escape: 'Esc',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
};

/** On the web, a control's keyboard shortcut: announced through
 * `aria-keyshortcuts` and shown on hover as "Best (B)". `keys` takes ARIA's
 * form, alternatives separated by spaces ("Escape Backspace"); the first is
 * the one shown. React Native Web drops `title`, so it is set on the node. */
export function useShortcut(label: string, keys?: string) {
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as HTMLElement | null;
    const first = keys?.split(' ')[0];
    if (!node) return;
    if (first) node.title = `${label} (${shown[first] ?? first})`;
    else node.removeAttribute('title');
  }, [label, keys]);
  return {
    ref,
    props: keys && Platform.OS === 'web' ? { 'aria-keyshortcuts': keys } : {},
  };
}
