// The 10 levels of the Tango Map, with human titles and tier grouping.
// Titles mirror the bundle's level headings; tiers group the climb.
export type Tier = 'b' | 'i' | 'a';

export const LEVELS: { n: number; tier: Tier; title: string }[] = [
  { n: 1, tier: 'b', title: 'First Steps' },
  { n: 2, tier: 'b', title: 'The Cross & Ocho' },
  { n: 3, tier: 'b', title: 'Exits & Back Ochos' },
  { n: 4, tier: 'b', title: 'Giros & Close Embrace' },
  { n: 5, tier: 'b', title: 'Vals, Milonga & Music' },
  { n: 6, tier: 'b', title: 'First Figures' },
  { n: 7, tier: 'i', title: 'Craft' },
  { n: 8, tier: 'i', title: 'Figures Deepened' },
  { n: 9, tier: 'a', title: 'Dynamics' },
  { n: 10, tier: 'a', title: 'Styles & Mastery' },
];

export const TIER_NAME: Record<Tier, string> = { b: 'Beginner', i: 'Intermediate', a: 'Advanced' };
export const TIER_SHORT: Record<Tier, string> = { b: 'Beg', i: 'Int', a: 'Adv' };

/** Tier of the highest level the dancer has any mastery in (their furthest reach). */
export function furthestTier(levels: Record<number, { done: number; total: number }>): Tier | null {
  for (let n = 10; n >= 1; n--) if (levels[n]?.done > 0) return LEVELS[n - 1].tier;
  return null;
}
