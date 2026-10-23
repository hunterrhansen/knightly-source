export type AccountLayoutProps = {
  accountName: string;
  onOpenSettings: (section: string) => void;
  onBack: () => void;
  onOpenPrivacy: () => void;
  onSignOut?: () => void;
  preview?: boolean;
};
