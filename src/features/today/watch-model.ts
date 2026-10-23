/** Habits to stack the watch on, following the chosen time of day. */
export function anchorSuggestions(time: string): readonly string[] {
  const hour = Number(time.slice(0, 2));
  if (hour < 11)
    return ['pour my coffee', 'finish breakfast', 'get to my desk'];
  if (hour < 17) return ['finish lunch', 'take a break', 'get home'];
  return ['finish dinner', 'brush my teeth', 'get into bed'];
}

/** The habit as stored: one trimmed line, without a leading "after I" the
 * learner typed themselves. */
export function cleanAnchor(input: string) {
  return input
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^after i\b[\s,]*/i, '')
    .replace(/[\s,.]+$/, '');
}

export const ANCHOR_MAX = 60;
/** Why the anchor can't be saved yet, or undefined. */
export function anchorProblem(anchor: string) {
  if (anchor.length < 2) return 'Pick or write the habit your watch follows.';
  if (anchor.length > ANCHOR_MAX)
    return `Keep it under ${ANCHOR_MAX} characters.`;
  return undefined;
}

/** "After I finish dinner, I will keep my watch." */
export const anchorSentence = (anchor: string) =>
  `After I ${anchor}, I will keep my watch.`;
