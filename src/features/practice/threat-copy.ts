import type { ThreatItem } from '../../lib/api/threat-contract';

/** What a threat question asks: a card's threat step asks `threat`. */
export type QuestionKind = ThreatItem['kind'];

type Copy = {
  /** The bubble's question. */
  title: string;
  /** What counts as an answer, under the question. */
  prompt: (playedSan: string) => string;
  /** The button for "nothing there", when the kind can have nothing there. */
  none?: { label: string; accessibilityLabel: string };
  /** The answer, named once shown: "Their threat: dxc3 wins a piece." */
  answer: string;
  /** Which part of the safety check it trains (checks, captures, threats): the label. */
  check: string;
};

const THREAT: Copy = {
  title: 'What do they threaten?',
  prompt: () =>
    'If you passed, what would they win? Play it on the board, or tap No threat.',
  none: {
    label: 'No threat',
    accessibilityLabel: 'Answer: they threaten nothing',
  },
  answer: 'Their threat',
  check: 'Threats',
};

/** Words for each kind of threat question (backend drill.py). */
export const QUESTION_COPY: Record<QuestionKind, Copy> = {
  threat: THREAT,
  calm: THREAT,
  allows: {
    title: 'What did your move allow?',
    prompt: (playedSan) =>
      `You played ${playedSan}. Play their best reply, or tap Nothing.`,
    none: {
      label: 'Nothing',
      accessibilityLabel: 'Answer: your move allowed nothing',
    },
    answer: 'Their reply',
    check: 'Their reply',
  },
  vision: {
    title: 'Something is loose',
    prompt: () => 'They left a piece unguarded. Take it.',
    answer: 'The loose piece',
    check: 'Captures',
  },
};
