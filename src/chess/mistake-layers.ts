/** The backend's mistake layers (`layers.py`): which habit or skill a mistake
 * came from. See docs/specs/2026-10-16-safety-habit-training-design.md. */
export const mistakeLayers = [
  'theirThreat',
  'theirReply',
  'calculation',
  'ownTactic',
] as const;
type MistakeLayer = (typeof mistakeLayers)[number];

/** Short labels for a single move. */
const layerTags: Record<MistakeLayer, string> = {
  theirThreat: 'Their threat',
  theirReply: 'Their reply',
  calculation: 'Calculation',
  ownTactic: 'Your tactic',
};

/** Principles: what to do differently, named for a mistake's cause or layer
 * (docs/specs/2026-10-16-blunder-causes-design.md). The server sends the key. */
export const principles = [
  'blunderCheck',
  'checkReplies',
  'backRank',
  'loosePieces',
  'forcingFirst',
  'checkTheEnd',
  'tradeWhenAhead',
] as const;
export type Principle = (typeof principles)[number];
export const principleLabels: Record<Principle, string> = {
  blunderCheck: 'Before you move: what does their move threaten?',
  checkReplies: 'After your move: what are their checks, captures and threats?',
  backRank: 'Give your king an escape square',
  loosePieces: 'Loose pieces drop off',
  forcingFirst: 'Look at checks and captures first',
  checkTheEnd: 'Look at the final position of your line for their reply',
  tradeWhenAhead: 'Trade pieces when you’re ahead',
};

/** The tag for a move: its layer and, separately, time trouble. Hidden while
 * the move is still a puzzle to solve, since it would hint at the answer. */
export function moveTag(
  move: { layer?: MistakeLayer | null; time_trouble?: boolean | null },
  solving = false,
): string | undefined {
  if (solving) return undefined;
  const parts = [
    move.layer ? layerTags[move.layer] : undefined,
    move.time_trouble ? 'Low clock' : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}
