import type { MoveVariant } from '../../chess/board';

export const labFixtures = {
  opening: {
    title: 'Claim the center',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    answer: { from: 'e2', to: 'e4' } as MoveVariant,
    reply: { from: 'e7', to: 'e5' } as MoveVariant,
    concept: 'Occupy the center with a pawn.',
    origin: 'Start with the pawn on e2.',
    solution: 'Play e2 to e4.',
  },
  promotion: {
    title: 'Practice underpromotion',
    fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    answer: { from: 'a7', to: 'a8', promotion: 'n' } as MoveVariant,
    reply: { from: 'e8', to: 'd7' } as MoveVariant,
    concept: 'For this authored demo, choose the piece that jumps.',
    origin: 'Start with the pawn on a7.',
    solution: 'Play a7 to a8 and choose a knight.',
  },
} as const;
export type LabFixtureId = keyof typeof labFixtures;
