import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { DailyReview } from '../../lib/api/today-contract';
import { StreakPill } from './streak-pill';
import { type PopoverAnchor, StreakPopover } from './streak-popover';
import { LiveStreakHistory } from './today-streak-calendar';
import { useDailyReview } from './use-daily-review';

/** The streak pill, which opens the streak as a popover under it: the page
 * stays put behind it. */
export function StreakButton({ streak }: { streak: DailyReview['streak'] }) {
  const pill = useRef<View>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const open = () =>
    pill.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
  return (
    // One view, so a header toolbar item hosts the pill and the popover together.
    <View ref={pill} collapsable={false}>
      <StreakPill streak={streak} onPress={open} />
      {anchor && (
        <StreakPopover
          streak={streak}
          anchor={anchor}
          onClose={() => setAnchor(null)}
        />
      )}
    </View>
  );
}

/** The streak for the native Today header; nothing until the review has loaded. */
export function TodayStreakBadge() {
  const streak = useDailyReview().data?.streak;
  return streak ? (
    <LiveStreakHistory>
      <StreakButton streak={streak} />
    </LiveStreakHistory>
  ) : null;
}
