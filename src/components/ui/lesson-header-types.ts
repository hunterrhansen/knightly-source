export type LessonHeaderProps = {
  title: string;
  /** ✕ at the start: leaves the lesson (progress is saved). */
  onClose?: () => void;
  /** The ✕'s spoken label. */
  closeLabel?: string;
  /** ‹ at the start, in place of ✕: back to the lesson or summary. */
  onBack?: () => void;
  /** The list button at the end: All moves. */
  onList?: () => void;
  /** Hides the header bar (keeping the screen's title for assistive tech and
   * back navigation): a lesson whose progress bar carries ✕ and the list,
   * one row like Duolingo, so the board gets the room. */
  hidden?: boolean;
};
