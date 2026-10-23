/** What a practice badge means, shown in the coach's bubble when it is tapped. */
export type BadgeAbout = { title: string; body: string };

/** The badge's own words, as practice-screen.tsx works them out for the item shown. */
export type Badge =
  | { kind: 'safety'; part: string }
  | { kind: 'same-idea' }
  | { kind: 'taught'; place: string; lesson: string }
  | { kind: 'review' }
  | { kind: 'test' }
  | { kind: 'rated'; rating: number };

const SAFETY_PART: Record<string, string> = {
  Threats: 'Here: what do they threaten?',
  Captures: 'Here: what’s loose to take?',
  'Their reply': 'Here: what did your move allow?',
};

/** Two short lines at most: the bubble keeps one height, so the board never moves. */
export function badgeAbout(badge: Badge): BadgeAbout {
  switch (badge.kind) {
    case 'safety':
      return {
        title: `Safety check · ${badge.part}`,
        body: `Before every move: checks, captures, threats. ${SAFETY_PART[badge.part] ?? ''}`.trim(),
      };
    case 'same-idea':
      return {
        title: 'Same idea',
        body: 'The tactic you just found, in a new position. One idea, many shapes.',
      };
    case 'taught':
      return {
        title: `At ${badge.place.replace(/^The /, 'the ')}`,
        body: `Tonight’s lesson: ${badge.lesson}. Holding it moves you on.`,
      };
    case 'test':
      return {
        title: 'The post’s test',
        body: 'Twelve positions from this post at its own level. Ten right and the post is yours; your games still have the last word.',
      };
    case 'review':
      return {
        title: 'Mixed review',
        body: 'An idea from a post you’ve passed, not named. Spot which one it is.',
      };
    case 'rated':
      return {
        title: `Rated ${badge.rating}`,
        body: 'The puzzle’s Lichess rating. Yours are picked a little below your level.',
      };
  }
}
