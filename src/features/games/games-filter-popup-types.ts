import type { PropsWithChildren } from 'react';

export type GamesFilterPopupProps = PropsWithChildren<{
  onCancel: () => void;
  onApply: () => void;
  onReset: () => void;
}>;
