import type { RankTier } from './types';

const tiers: readonly RankTier[] = ['page', 'squire', 'knight'];
const numerals: Readonly<Record<string, number>> = { I: 1, II: 2, III: 3 };

// The ranks past Knight III (the Keep, the March, the Citadel) have no art of
// their own yet: they wear the full knight's emblem.
const senior = new Set(['banneret', 'captain', 'warden', 'castellan']);

/** Which emblem draws a rank: its tier and level from the server's key
 * ("squire-2"), else from its name ("Squire II"). Ranks past Knight III draw
 * Knight III's; an unknown tier falls back to Page's rather than failing. */
export function rankEmblemOf(rank: { key?: string; name: string }): {
  tier: RankTier;
  level: number;
} {
  const [head = '', tail = ''] = rank.key
    ? rank.key.split('-')
    : rank.name.trim().split(/\s+/);
  if (senior.has(head.toLowerCase())) return { tier: 'knight', level: 3 };
  const tier = tiers.find((t) => t === head.toLowerCase()) ?? 'page';
  const level = rank.key ? Number(tail) || 0 : (numerals[tail] ?? 0);
  return { tier, level: Math.min(level, 3) };
}
