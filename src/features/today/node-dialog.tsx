import type { ReactNode } from 'react';

/** Natively a node's card is the platform's own sheet (node-sheet-options):
 * nothing to wrap. The web draws it as a dialog (node-dialog.web). */
export function NodeDialog({
  children,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return children;
}
