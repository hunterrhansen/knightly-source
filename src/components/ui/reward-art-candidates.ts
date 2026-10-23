import type { ImageSourcePropType } from 'react-native';

export type RewardItem = 'shard' | 'bonus' | 'medal' | 'chest';

export type RewardArtCandidate = {
  item: RewardItem;
  /** Direction id from docs/art-style-lock.md (a–d). */
  direction: string;
  /** Distinguishes several picks of one item and direction. */
  name: string;
  source: ImageSourcePropType;
};

/**
 * Candidate reward art under review in the Storybook gallery (development
 * only; see docs/art-style-lock.md). Add a line per PNG in
 * assets/reward-art/candidates/, for example:
 *
 * { item: 'shard', direction: 'b', name: 'shard-b-1',
 *   source: require('../../../assets/reward-art/candidates/shard-b-1.png') },
 */
export const rewardArtCandidates: RewardArtCandidate[] = [];
