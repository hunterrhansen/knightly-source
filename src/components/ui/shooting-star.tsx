import { useSprite } from '../kit/registry';
import { SpriteView } from '../kit/sprite';

/** The run bonus: a star shard streaking in as a shooting star (the kit's
 * `reward.shootingStar`). Its head sits up and right of centre
 * (`shootingStarHead`). Decorative: label the bonus. */
export function ShootingStar({ size }: { size: number }) {
  return <SpriteView sprite={useSprite('reward.shootingStar')} size={size} />;
}
