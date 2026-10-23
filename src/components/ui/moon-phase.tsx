import { useSpriteFamily } from '../kit/registry';
import { SpriteView } from '../kit/sprite';

/**
 * The streak moon at a day of its weekly cycle: new on day 0, full on day 7
 * (the kit's `reward.moon`). Decorative: label the streak itself.
 */
export function MoonPhase({ size, day }: { size: number; day: number }) {
  return (
    <SpriteView sprite={useSpriteFamily('reward.moon', day)} size={size} />
  );
}
