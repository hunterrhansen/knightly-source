import { Button, Card } from '../../ui';
export function SettingsStatus({
  title,
  message,
  action,
  onAction,
  disabled,
}: {
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Card title={title} description={message}>
      {action && onAction && (
        <Button disabled={disabled} onPress={onAction}>
          {action}
        </Button>
      )}
    </Card>
  );
}
