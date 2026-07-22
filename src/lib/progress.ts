import { SKILLS, SKILL_SLUGS } from '@/src/data/skills';

/** Keep only known skill slugs, de-duplicated, capped at 62. */
export const sanitizeMastered = (arr: unknown): string[] =>
  Array.isArray(arr)
    ? [...new Set(arr.filter((s): s is string => typeof s === 'string' && SKILL_SLUGS.has(s)))].slice(0, 62)
    : [];

export const masteredCount = (m: string[]): number => sanitizeMastered(m).length;

/** Per-level { done, total } for levels 1..10. Totals always sum to 62. */
export const perLevel = (m: string[]): Record<number, { done: number; total: number }> => {
  const set = new Set(sanitizeMastered(m));
  const out: Record<number, { done: number; total: number }> = {};
  for (let lvl = 1; lvl <= 10; lvl++) out[lvl] = { done: 0, total: 0 };
  for (const s of SKILLS) {
    out[s.level].total++;
    if (set.has(s.slug)) out[s.level].done++;
  }
  return out;
};

/** Milestone thresholds reached at a given mastered count. */
export const milestones = (count: number): number[] => [5, 10, 25, 50].filter((m) => count >= m);
