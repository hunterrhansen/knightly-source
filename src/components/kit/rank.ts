import type { RankTier } from './types';

const tiers: readonly RankTier[] = [
  'page',
  'squire',
  'knight',
  'banneret',
  'captain',
  'warden',
  'castellan',
];
const numerals: Readonly<Record<string, number>> = { I: 1, II: 2, III: 3 };

/** The tier a rank's name starts with, for the names that are more than one
 * word ("Knight Banneret II", "Captain of the Watch I"); a one-word tier is
 * matched by its own name. */
const namedTiers: readonly [RankTier, RegExp][] = [
  ['banneret', /^knight banneret\b/i],
  ['captain', /^captain of the watch\b/i],
  ['warden', /^warden of the march\b/i],
];

/** Which emblem draws a rank: its tier and level from the server's key
 * ("squire-2", "banneret-1"), else from its name ("Squire II", "Knight
 * Banneret I"). An unknown tier falls back to Page's rather than failing. */
export function rankEmblemOf(rank: { key?: string; name: string }): {
  tier: RankTier;
  level: number;
} {
  if (rank.key) {
    const [head = '', tail = ''] = rank.key.split('-');
    const tier = tiers.find((t) => t === head.toLowerCase()) ?? 'page';
    return { tier, level: Math.min(Number(tail) || 0, 3) };
  }
  const name = rank.name.trim();
  const words = name.split(/\s+/);
  const level = Math.min(numerals[words[words.length - 1] ?? ''] ?? 0, 3);
  const named = namedTiers.find(([, pattern]) => pattern.test(name))?.[0];
  const tier =
    named ?? tiers.find((t) => t === words[0]?.toLowerCase()) ?? 'page';
  return { tier, level };
}
