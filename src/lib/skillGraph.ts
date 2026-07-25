import { SKILLS, type Skill } from '@/src/data/skills';
import { CATEGORIES } from '@/src/lib/dna';

// Skill navigation built on the map's own prerequisite graph (`Skill.deps`) and
// the /skills index reading order. All derived at module load from static data —
// safe to import into the statically-generated /skill/[slug] pages.

const bySlug = new Map(SKILLS.map((s) => [s.slug, s]));

/**
 * The 62 skills in the /skills index reading order: category by category (in
 * CATEGORIES display order), level-sorted within each. Prev/next walk this one
 * continuous sequence, so paging forward reads exactly like scrolling the index.
 */
export const ORDERED: readonly Skill[] = CATEGORIES.flatMap((c) =>
  SKILLS.filter((s) => s.tag === c.tag).sort((a, b) => a.level - b.level),
);

/** The skills immediately before/after this one in reading order; null at the ends. */
export function adjacent(slug: string): { prev: Skill | null; next: Skill | null } {
  const i = ORDERED.findIndex((s) => s.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? ORDERED[i - 1] : null,
    next: i < ORDERED.length - 1 ? ORDERED[i + 1] : null,
  };
}

/** Skills this one builds on — its prerequisites, lowest level first. */
export function prerequisites(slug: string): Skill[] {
  const s = bySlug.get(slug);
  if (!s) return [];
  return s.deps
    .map((d) => bySlug.get(d))
    .filter((x): x is Skill => x !== undefined)
    .sort((a, b) => a.level - b.level);
}

/** Skills that build on this one — the reverse edges, what it unlocks. */
export function unlocks(slug: string): Skill[] {
  return SKILLS.filter((s) => s.deps.includes(slug)).sort((a, b) => a.level - b.level);
}
