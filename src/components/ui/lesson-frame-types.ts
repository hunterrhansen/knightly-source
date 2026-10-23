import type { ReactNode } from 'react';
import type { BoardProps } from '../../chess/board';
import type { PointsAward } from '../../lib/lesson-points';
import type { Raid } from '../kit/types';

/** What a lesson frame lays out: see `LessonFrame`. */
export type LessonFrameProps = {
  /** Header and progress bar, above the body. */
  bars: ReactNode;
  /** Above the board: the coach's bubble (and an eval bar). Under it, on the
   * wall, in the watch frame. */
  coach: ReactNode;
  board?: BoardProps;
  /** Shown in place of the board's body while there is no board. */
  fallback?: ReactNode;
  /** The board's bottom side, for the points' flight. */
  orientation: 'w' | 'b';
  award?: PointsAward;
  /** Player rows against the board's top and bottom edges. */
  bands?: { above: ReactNode; under: ReactNode; bandHeight: number };
  /** Height kept free under the board for `below`. */
  reserve: number;
  /** Under the board; kept for layout under a sheet, but hidden and inert. */
  below?: ReactNode;
  /** A verdict sheet; `filled` on phones, where it runs square from the
   * board's bottom edge to the screen's. */
  sheet?: (filled: boolean) => ReactNode;
  actions?: ReactNode;
  /** Tighter spacing above the board (phones in review). */
  compact?: boolean;
  /** Fades the sheet out as the next step arrives. */
  fadeSheet?: boolean;
  /** Wide screens (`useWideLesson`), as Chess.com's review: the board fills
   * the height on the left, `beside` it a bar (the eval), and the bars,
   * coach, `panel` and actions stack in a side panel. `below` is unused. */
  side?: { beside?: ReactNode; panel: ReactNode };
  /** The lesson seen from the castle wall (opt-in per lesson). */
  watch?: boolean;
  /** In the watch frame, a one-line plaque at the treeline under the bars
   * (the position's label); its slot is always kept. */
  plaque?: ReactNode;
  /** In the watch frame, the opponent's pieces at the treeline and how they
   * react to the answer; the raid captain's plaque beside the position's. */
  raid?: Raid;
};
