import {
  Children,
  createContext,
  type PropsWithChildren,
  useContext,
} from 'react';
import { View } from 'react-native';
import { createStyles } from '../../theme/theme';
import { useWatchSurface } from '../kit/registry';
import type { ActionIconName } from './action-icon';
import { Button } from './button';

/** Chess.com-style row of actions pinned below a board: quiet icon actions,
 * then at most one filled primary on the right, shown only when it can be
 * pressed (never a disabled placeholder). */
export function ActionBar({ children }: PropsWithChildren) {
  const styles = useStyles();
  const tiles = useContext(Tiles);
  if (!tiles) return <View style={styles.bar}>{children}</View>;
  // Up to three tiles fit the label beside the icon; more stack it under.
  const crowded = Children.toArray(children).filter(Boolean).length > 3;
  return (
    <Tiles.Provider value={crowded ? 'stacked' : 'inline'}>
      <View style={[styles.bar, styles.tileBar]}>{children}</View>
    </Tiles.Provider>
  );
}

const Tiles = createContext<false | true | 'inline' | 'stacked'>(false);

/** Wide layouts' bars, as Chess.com's desktop review: every action a filled
 * tile of equal width, its label beside the icon, easy to see and hit. */
export function ActionTiles({ children }: PropsWithChildren) {
  return <Tiles.Provider value>{children}</Tiles.Provider>;
}

/** One action in the bar, on the shared Button so it presses like every
 * other. Side actions are ghosts with the icon over the label; the primary is
 * the wide ledge button, its forward arrow trailing the label. */
export function ActionButton({
  icon,
  label,
  onPress,
  disabled = false,
  primary = false,
  accessibilityLabel,
  shortcut,
}: {
  icon: ActionIconName;
  label: string;
  /** When the short visible label needs more words to be clear when spoken. */
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  /** The step most people take next, filled with the brand color. */
  primary?: boolean;
  /** Its web keyboard shortcut, shown on hover ("Best (B)"). */
  shortcut?: string;
}) {
  const styles = useStyles();
  // On the watch's wall, side actions are stone buttons with their label.
  const stone = useWatchSurface('ui.stoneButton');
  const tiles = useContext(Tiles);
  const trailing = icon === 'forward' || icon === 'next';
  return (
    <Button
      icon={icon}
      iconPlacement={
        tiles
          ? tiles === 'stacked'
            ? 'top'
            : trailing
              ? 'end'
              : 'start'
          : !primary && !stone
            ? 'top'
            : icon === 'forward'
              ? 'end'
              : 'start'
      }
      variant={primary ? 'primary' : stone || tiles ? 'secondary' : 'ghost'}
      paint={primary ? undefined : stone}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      shortcut={shortcut}
      style={primary && !tiles ? styles.primary : styles.target}
    >
      {label}
    </Button>
  );
}

const useStyles = createStyles((theme) => ({
  // No divider: the ledge buttons separate themselves, as Chess.com's do.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  tileBar: { gap: theme.spacing.sm },
  target: { flex: 1 },
  primary: { flex: 2 },
}));
