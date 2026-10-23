import type { JourneyMap, JourneyWard } from '../../lib/api/journey-contract';
import { scheduled } from './journey-samples';

// The curriculum as `/api/journey`'s `wards` sends it (backend curriculum.WARDS),
// for the ward path's tests, stories and shell lab. Lessons are [key, name,
// track, teachable].

type SampleLesson = readonly [string, string, string, boolean];

const CURRICULUM: readonly (readonly [
  string,
  string,
  readonly SampleLesson[],
])[] = [
  [
    'board-vision',
    'What the board is saying',
    [
      ['board-vision', 'Board vision', 'defence', false],
      ['attack-defend', 'Attacking and defending', 'defence', false],
      ['exchange', 'The profitable exchange', 'tactic', false],
    ],
  ],
  [
    'mate-in-one',
    'Mate in one',
    [
      ['mate-in-one', 'Mate in one', 'mate', true],
      ['creating-mate', 'Creating mate', 'mate', true],
    ],
  ],
  [
    'loose-pieces',
    'Pieces left loose',
    [
      ['winning-material', 'Winning material', 'tactic', true],
      ['activity', 'Activity', 'positional', false],
    ],
  ],
  [
    'double-attack',
    'The double attack',
    [
      ['double-attack', 'Double attack', 'tactic', true],
      [
        'double-attack-king',
        'Double attack with the king in it',
        'tactic',
        true,
      ],
    ],
  ],
  [
    'mate-in-two',
    'Mate in two',
    [
      ['mate-in-two', 'Mate in two', 'mate', true],
      ['back-rank', 'The back rank', 'mate', true],
      ['mating-rook', 'Mating with the rook', 'mate', true],
    ],
  ],
  [
    'the-pin',
    'The pin',
    [
      ['pin', 'The pin', 'tactic', true],
      ['golden-rules', 'The three golden rules', 'opening', false],
    ],
  ],
  [
    'remove-the-defender',
    'Removing the defender',
    [
      ['eliminating-defence', 'Eliminating the defence', 'tactic', true],
      ['opening-principles', 'The opening', 'opening', false],
    ],
  ],
  [
    'discovered-attack',
    'The discovered attack',
    [['discovered-attack', 'Discovered attack', 'tactic', true]],
  ],
  [
    'defending-mate',
    'Seeing mate coming',
    [
      ['defending-mate', 'Defending against mate', 'defence', true],
      ['stalemate', 'Stalemate', 'endgame', false],
    ],
  ],
  [
    'in-between',
    'The in-between move',
    [
      ['intermezzo', 'The intermediate move', 'tactic', true],
      ['thinking-ahead', 'Thinking ahead', 'calculation', false],
    ],
  ],
  [
    'pawn-endings',
    'Pawn endings',
    [
      ['pawn-endings', 'Simple pawn endings', 'endgame', true],
      ['passed-pawn', 'Defending against a passed pawn', 'defence', true],
    ],
  ],
  [
    'double-check',
    'Discovered and double check',
    [
      ['discovered-check', 'Discovered check', 'tactic', true],
      ['double-check', 'Double check', 'tactic', true],
    ],
  ],
  [
    'pinned-pieces',
    'Attacking a pinned piece',
    [
      ['attacking-pinned', 'Attacking a pinned piece', 'tactic', true],
      ['defending-pin', 'Defending against a pin', 'defence', true],
    ],
  ],
  [
    'x-ray',
    'X-ray and skewer',
    [
      ['x-ray', 'The X-ray effect', 'tactic', true],
      ['skewer', 'Skewer', 'tactic', true],
    ],
  ],
  [
    'square-of-the-pawn',
    'The square of the pawn',
    [
      ['square-of-pawn', 'The square of the pawn', 'endgame', true],
      ['promotion', 'Queening a pawn', 'endgame', true],
      ['key-squares', 'Key squares', 'endgame', true],
    ],
  ],
  [
    'mating-patterns',
    'Mating patterns',
    [
      ['mating-nets', 'Mate after gaining access', 'mate', true],
      ['threats', 'Threats', 'defence', false],
    ],
  ],
  [
    'trapping',
    'Trapping a piece',
    [
      ['trapping', 'Trapping', 'tactic', true],
      ['mobility', 'Mobility', 'positional', false],
    ],
  ],
  [
    'luring',
    'Luring and interference',
    [
      ['luring', 'Luring', 'tactic', true],
      ['interfering', 'Interfering', 'tactic', true],
      ['deflection', 'Deflection', 'tactic', true],
      ['clearing', 'Clearing', 'tactic', true],
    ],
  ],
];

/**
 * The eighteen wards as the server derives them for a learner at post
 * `current`: the Gatehouse blocked (no drills exist), every teachable post
 * before `current` cleared, the rest ahead. `answered` sets the current post's
 * lessons' positions answered (all right), in order; 36 or more hold a lesson.
 */
export function sampleWards(
  current: number,
  answered: readonly number[] = [],
): JourneyWard[] {
  return CURRICULUM.map(([key, name, lessons], i) => {
    const index = i + 1;
    const blocked = lessons.every(([, , , teachable]) => !teachable);
    const state: JourneyWard['state'] = blocked
      ? 'blocked'
      : index < current
        ? 'cleared'
        : index === current
          ? 'current'
          : 'ahead';
    return {
      key,
      name,
      index,
      state,
      lessons: lessons.map(([lkey, lname, track, teachable], j) => {
        const solved =
          state === 'cleared' && teachable
            ? 36
            : state === 'current'
              ? (answered[j] ?? 0)
              : 0;
        return {
          key: lkey,
          name: lname,
          track,
          step: '2',
          held: teachable && solved >= 36,
          solves: solved,
          answered: solved,
          page_right: Math.min(12, solved),
          teachable,
        };
      }),
    };
  });
}

/** A learner at the Lists (post 4): Double attack held, the king's version
 * one puzzle in, with the schedule ahead. */
export const atTheLists: JourneyMap = {
  ...scheduled,
  // Reached on Oct 12: that night's watch and the 13th's (with an extra) are
  // the Lists' own.
  wards: sampleWards(4, [36, 1]).map((w) =>
    w.state === 'current' ? { ...w, entered_on: '2026-10-12' } : w,
  ),
};
