import type { ReactElement } from 'react';

export type NavigationHeaderProps = {
  /** The screen's name: shown as the header title, and its accessible name
   * when `titleView` replaces it. */
  title: string;
  /** Drawn in the title's place (the home's rank chip). */
  titleView?: () => ReactElement;
  onBack?: () => void;
  /** No bar behind the title: the screen's own art runs up under it. */
  transparent?: boolean;
};
