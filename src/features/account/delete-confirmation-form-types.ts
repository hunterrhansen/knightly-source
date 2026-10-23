export type DeleteConfirmationFormProps = {
  word: string;
  busy: boolean;
  notice?: string;
  error?: string;
  onWordChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};
