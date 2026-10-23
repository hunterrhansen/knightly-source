import type { RankTier } from './types';

const tiers: readonly RankTier[] = ['page', 'squire', 'knight'];
const numerals: Readonly<Record<string, number>> = { I: 1, II: 2, III: 3 };

/** Which emblem draws a rank: its tier and level from the server's key
 * ("squire-2"), else from its name ("Squire II"). Ranks are tuned on the
 * server, so an unknown tier falls back to Page's emblem rather than failing. */
export function rankEmblemOf(rank: { key?: string; name: string }): {
  tier: RankTier;
  level: number;
} {
  const [head = '', tail = ''] = rank.key
    ? rank.key.split('-')
    : rank.name.trim().split(/\s+/);
  const tier = tiers.find((t) => t === head.toLowerCase()) ?? 'page';
  const level = rank.key ? Number(tail) || 0 : (numerals[tail] ?? 0);
  return { tier, level: Math.min(level, 3) };
}
