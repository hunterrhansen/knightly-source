import type { PropsWithChildren } from 'react';
export type SettingsConfirmationProps = PropsWithChildren<{
  title: string;
  onCancel: () => void;
  busy?: boolean;
}>;
