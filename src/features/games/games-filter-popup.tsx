import { Button, ListItem, SettingsConfirmation } from '../../ui';
import type { GamesFilterPopupProps } from './games-filter-popup-types';

export function GamesFilterPopup({
  children,
  onCancel,
  onApply,
  onReset,
}: GamesFilterPopupProps) {
  return (
    <SettingsConfirmation title="Filters" onCancel={onCancel}>
      {children}
      <Button onPress={onApply}>Apply filters</Button>
      <ListItem label="Reset filters" onPress={onReset} />
    </SettingsConfirmation>
  );
}
