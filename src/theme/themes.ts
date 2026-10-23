import { tokens } from './tokens';

/** Knightly's only theme: the night palette (dark mode only; see
 * docs/technology-decisions.md#dark-only-theme). */
export const darkTheme = {
  ...tokens,
  colors: {
    page: '#161513',
    surface: '#24221f',
    surfaceMuted: '#302d29',
    line: '#3b3834',
    ink: '#f2f1ec',
    inkMuted: '#aba89f',
    brand: '#6cc23a',
    brandLedge: '#3f8a18',
    /** The app icon and splash tile's ledge (scripts/generate-brand.mjs). */
    brandTileLedge: '#4a9620',
    /** The brand tile's darker board squares. */
    brandSquare: '#5eb22f',
    onBrand: '#13200c',
    brandText: '#8ad850',
    /** Brand-tinted rows (Callout) under ink text. */
    brandTint: 'rgba(108,194,58,0.12)',
    dangerText: '#ff8f85',
    /** The one weakest item in a chart or list, always with its word. */
    weak: '#ff8f6b',
    weakTint: 'rgba(255,143,107,0.16)',
    focus: '#8cc8ff',
    sky: '#49a8f2',
    skyLedge: '#2577bb',
    onSky: '#08192a',
    gold: '#ffc233',
    goldLedge: '#c28c00',
    onGold: '#2a1d00',
    goldText: '#ffc233',
    flame: '#ff9600',
    boardSelection: '#e9b949',
    boardRejection: '#c33b36',
    boardRejectionFill: '#f4b2ab',
    onBoardRejection: '#ffffff',
    boardCoordinate: '#1d2618',
    boardLight: '#d9dfc2',
    boardDark: '#6f9450',
    // Board markings the Calm palette replaces (see preferences.tsx).
    boardCoordinateOnDark: '#13200c',
    boardMarker: '#13200c',
    boardCaptureTint: 'transparent',
  },
  /** Opacity of the legal-move dot and capture ring over the squares. */
  boardMarkerAlpha: { dot: 0.45, ring: 0.6 },
};
