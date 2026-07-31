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

/**
 * The longest prerequisite chain ending at `slug`, inclusive of `slug` itself —
 * the slug-space mirror of mapGraph's `longestPrereqPath` (kept self-contained here
 * so the statically-generated /skill pages never reach into the id-space module).
 * Deepest root first, `slug` last. Memoized and cycle-safe: a back-edge into the
 * active stack terminates that branch instead of looping. Because slug === id
 * throughout this codebase, this agrees key-for-key with the id-space version.
 *
 * `pathSteps` (below) is this chain's length — the "path steps" depth: 1 for a
 * bedrock skill (just itself), growing by one for each prerequisite level beneath it.
 */
const PATH_MEMO = new Map<string, string[]>();
export function longestPrereqPath(slug: string): string[] {
  const stack = new Set<string>();
  const go = (sl: string): string[] => {
    const cached = PATH_MEMO.get(sl);
    if (cached) return cached;
    if (stack.has(sl)) return [sl]; // cycle guard: don't re-descend into the active path
    stack.add(sl);
    const s = bySlug.get(sl);
    let best: string[] = [];
    for (const dep of s ? s.deps : []) {
      const p = go(dep);
      if (p.length > best.length) best = p;
    }
    const chain = [...best, sl];
    PATH_MEMO.set(sl, chain);
    stack.delete(sl);
    return chain;
  };
  return go(slug);
}

/** The "path steps" depth: number of skills in the longest prerequisite chain (>= 1). */
export function pathSteps(slug: string): number {
  return longestPrereqPath(slug).length;
}
