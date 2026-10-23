import type { ReactNode } from 'react';
import type {
  AccountSettings,
  PracticePace,
} from '../../lib/api/settings-contract';
export type SettingsPanelsProps = {
  section?: string;
  settings: AccountSettings;
  busy?: boolean;
  message?: string;
  onAnalysis?: (nodes: number) => void;
  onPace?: (pace: PracticePace) => void;
  onSync?: () => void;
  onRemove?: (source: string, handle: string) => void;
  onExport?: () => void;
  connectionForm?: ReactNode;
  preview?: boolean;
  onDeleteAccount?: () => void;
  deleteUnavailable?: boolean;
  onRetry?: () => void;
};
