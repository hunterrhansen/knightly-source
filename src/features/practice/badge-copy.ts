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
        title: badge.lesson,
        body: `Practice this idea: ${badge.lesson}.`,
      };
    case 'test':
      return {
        title: 'Practice check',
        body: 'Twelve positions on this topic. Aim for ten correct answers, then apply the idea in your games.',
      };
    case 'review':
      return {
        title: 'Mixed review',
        body: 'A previously practiced idea, not named. Recognize it in a new position.',
      };
    case 'rated':
      return {
        title: `Rated ${badge.rating}`,
        body: 'The puzzle’s Lichess rating. Yours are picked a little below your level.',
      };
  }
}
