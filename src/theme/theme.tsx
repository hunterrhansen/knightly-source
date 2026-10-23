import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { darkTheme } from './themes';

export type Theme = typeof darkTheme;
export type BoardChoice = 'sage' | 'brown' | 'green' | 'blue' | 'calm';

const boardPalettes = {
  brown: ['#EDD6B0', '#B88762'],
  green: ['#EEEED2', '#769656'],
  blue: ['#DEE3E6', '#8CA2AD'],
} as const;
// Calm brings its own markings: the squares are so close that the default
// markers and coordinates fall below contrast minimums
// (docs/specs/2026-10-10-universal-chessboard-design.md#board-feel).
// Mid-grey rather than near-black, so black pieces stay readable too.
const calm = {
  boardLight: '#6F777E',
  boardDark: '#636A71',
  boardCoordinate: '#FFFFFF',
  boardCoordinateOnDark: '#FFFFFF',
  boardMarker: '#E6EAED',
  boardCaptureTint: '#7E868D',
} as const;

/** The light and dark square colours a board choice draws. */
export function boardSquareColors(
  board: BoardChoice,
): readonly [string, string] {
  if (board === 'calm') return [calm.boardLight, calm.boardDark];
  return board === 'sage'
    ? [darkTheme.colors.boardLight, darkTheme.colors.boardDark]
    : boardPalettes[board];
}

// One object per board, so styles cached by theme stay cached.
const themes = new Map<BoardChoice, Theme>();
/** The theme with the chosen board's squares and markings. */
function themeFor(board: BoardChoice): Theme {
  const cached = themes.get(board);
  if (cached) return cached;
  const [boardLight, boardDark] = boardSquareColors(board);
  const made: Theme =
    board === 'sage'
      ? darkTheme
      : {
          ...darkTheme,
          colors: {
            ...darkTheme.colors,
            ...(board === 'calm' ? calm : { boardLight, boardDark }),
          },
          boardMarkerAlpha:
            board === 'calm' ? { dot: 1, ring: 1 } : darkTheme.boardMarkerAlpha,
        };
  themes.set(board, made);
  return made;
}

type Appearance = { board: BoardChoice };
const initialAppearance: Appearance = { board: 'sage' };
const ThemeContext = createContext<{ theme: Theme }>({ theme: darkTheme });
const AppearanceContext = createContext<{
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}>({ appearance: initialAppearance, setAppearance: () => {} });

/** The app's theme (dark only, whatever the system appearance) with the chosen
 * board. Preferences push their choice in through `useSetAppearance`; until
 * they load, the Sage board shows. */
export function ThemeRoot({ children }: PropsWithChildren) {
  const [appearance, setAppearance] = useState(initialAppearance);
  const theme = themeFor(appearance.board);
  const value = useMemo(() => ({ theme }), [theme]);
  const control = useMemo(() => ({ appearance, setAppearance }), [appearance]);
  return (
    <AppearanceContext.Provider value={control}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useSetAppearance() {
  return useContext(AppearanceContext).setAppearance;
}

type Style = ViewStyle | TextStyle | ImageStyle;
type StyleEntry = Style | ((...args: never[]) => Style);

/**
 * Themed styles: `const useStyles = createStyles((theme) => ({ … }))` at module
 * level, then `const styles = useStyles()` in the component. Entries may be
 * functions of render values (`styles.label(scale)`). Styles are built once
 * per theme and reused, and are plain React Native styles, so they work on
 * every component, Reanimated's included.
 */
export function createStyles<T extends Record<string, StyleEntry>>(
  factory: (theme: Theme) => T,
): () => T {
  const cache = new WeakMap<Theme, T>();
  const styles = (theme: Theme) => {
    let made = cache.get(theme);
    if (!made) {
      made = factory(theme);
      cache.set(theme, made);
    }
    return made;
  };
  return function useStyles() {
    return styles(useContext(ThemeContext).theme);
  };
}
