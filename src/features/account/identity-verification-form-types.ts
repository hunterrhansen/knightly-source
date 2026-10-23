export type IdentityVerificationFormProps = {
  secondFactor: boolean;
  busy: boolean;
  notice?: string;
  error: string;
  credential: string;
  onCredentialChange: (value: string) => void;
  method: { label: string; password: boolean; numeric: boolean } | null;
  methods: { key: string; label: string; onSelect: () => void }[];
  onSubmit: () => void;
  onAnotherMethod: () => void;
  onCancel: () => void;
};
