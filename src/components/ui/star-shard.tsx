import { useSprite } from '../kit/registry';
import { SpriteView } from '../kit/sprite';

/** The star shard, Knightly's points reward (the kit's `reward.starShard`).
 * Decorative: label its count. */
export function StarShard({ size }: { size: number }) {
  return <SpriteView sprite={useSprite('reward.starShard')} size={size} />;
}
