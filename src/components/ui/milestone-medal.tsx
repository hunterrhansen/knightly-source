import { useSprite } from '../kit/registry';
import { SpriteView } from '../kit/sprite';

/** The streak milestone medal: the full moon in a gold medal on ribbons (the
 * kit's `reward.medal`). Decorative: label the milestone. */
export function MilestoneMedal({ size }: { size: number }) {
  return <SpriteView sprite={useSprite('reward.medal')} size={size} />;
}
