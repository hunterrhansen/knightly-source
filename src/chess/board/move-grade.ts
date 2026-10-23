// Chess.com's move-classification palette (static badge fills) and labels.
// `flash` marks the classes Chess.com animates in the middle of the square
// with a label before the badge settles on the corner.
export const moveGrades = {
  brilliant: {
    label: 'Brilliant',
    color: '#26c2a3',
    symbol: '!!',
    flash: 'Brilliant!',
  },
  great: { label: 'Great', color: '#749bbf', symbol: '!', flash: 'Great!' },
  best: { label: 'Best', color: '#81b64c', symbol: '★', flash: 'Best Move' },
  excellent: { label: 'Excellent', color: '#81b64c', symbol: '' },
  good: { label: 'Good', color: '#95b776', symbol: '✓' },
  book: { label: 'Book', color: '#d5a47d', symbol: '' },
  inaccuracy: {
    label: 'Inaccuracy',
    color: '#f7c631',
    symbol: '?!',
    flash: 'Inaccuracy',
  },
  mistake: {
    label: 'Mistake',
    color: '#ffa459',
    symbol: '?',
    flash: 'Mistake',
  },
  blunder: {
    label: 'Blunder',
    color: '#fa412d',
    symbol: '??',
    flash: 'Blunder',
  },
  miss: { label: 'Miss', color: '#ff7769', symbol: '×', flash: 'Miss' },
} as const satisfies Record<
  string,
  { label: string; color: string; symbol: string; flash?: string }
>;
export type MoveGrade = keyof typeof moveGrades;

/** A badge glyph's colour: white, a touch greyer on the coral Miss disc. */
export const badgeGlyphColor = (grade: MoveGrade) =>
  grade === 'miss' ? '#f1f2f2' : '#ffffff';
