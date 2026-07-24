import { SKILLS, type Skill } from '@/src/data/skills';
import { CATEGORIES } from '@/src/lib/dna';
import { sanitizeMastered } from '@/src/lib/progress';

export type Rec = {
  name: string;
  slug: string;
  level: number;
  tag: string;
  label: string; // category label
  icon: string; // category icon markup
  reason: string;
  kind: 'start' | 'level' | 'weak' | 'frontier' | 'next';
};

const CAT_BY_TAG = new Map(CATEGORIES.map((c) => [c.tag, c]));

/**
 * "What's next" — pick a short, diverse set of concrete skills to learn next
 * from the dancer's current progress, each with a plain-English reason. Uses
 * only data we already have (per-level and per-category completion), so it works
 * for any profile with no extra input. Returns [] when everything is mastered.
 *
 * The mix, in priority order:
 *   1. finish the level closest to complete (quick wins),
 *   2. shore up the weakest started category,
 *   3. open the next untouched level (new ground),
 *   4. fill any remaining slots with the lowest-level unmastered skills.
 */
export function recommend(mastered: string[], limit = 4): Rec[] {
  const set = new Set(sanitizeMastered(mastered));
  const unmastered = SKILLS.filter((s) => !set.has(s.slug));
  if (unmastered.length === 0) return [];
  const doneCount = SKILLS.length - unmastered.length;

  const mk = (s: Skill, reason: string, kind: Rec['kind']): Rec => {
    const c = CAT_BY_TAG.get(s.tag);
    return { name: s.name, slug: s.slug, level: s.level, tag: s.tag, label: c?.label ?? s.tag, icon: c?.icon ?? '', reason, kind };
  };

  const recs: Rec[] = [];
  const seen = new Set<string>();
  const push = (r: Rec) => {
    if (!seen.has(r.slug) && recs.length < limit) {
      seen.add(r.slug);
      recs.push(r);
    }
  };

  // Brand-new dancer: point at the very first steps.
  if (doneCount === 0) {
    SKILLS.filter((s) => s.level === 1).slice(0, limit).forEach((s) => push(mk(s, 'Start here — your first steps', 'start')));
    return recs;
  }

  // Per-level completion.
  const levels = new Map<number, { done: number; total: number }>();
  for (const s of SKILLS) {
    const lv = levels.get(s.level) ?? { done: 0, total: 0 };
    lv.total++;
    if (set.has(s.slug)) lv.done++;
    levels.set(s.level, lv);
  }

  // 1) Finish the partially-done level that's closest to complete.
  const partial = [...levels.entries()]
    .filter(([, v]) => v.done > 0 && v.done < v.total)
    .sort((a, b) => b[1].done / b[1].total - a[1].done / a[1].total);
  if (partial.length) {
    const [ln, lv] = partial[0];
    const remaining = lv.total - lv.done;
    SKILLS.filter((s) => s.level === ln && !set.has(s.slug))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((s) => push(mk(s, `Finishes Level ${ln} — ${remaining} left`, 'level')));
  }

  // 2) Weakest category you've actually started.
  const catStats = CATEGORIES.map((c) => {
    const skills = SKILLS.filter((s) => s.tag === c.tag);
    const done = skills.filter((s) => set.has(s.slug)).length;
    return { c, skills, done, total: skills.length, pct: skills.length ? done / skills.length : 0 };
  })
    .filter((x) => x.done > 0 && x.done < x.total)
    .sort((a, b) => a.pct - b.pct);
  if (catStats.length) {
    const w = catStats[0];
    const next = w.skills.filter((s) => !set.has(s.slug)).sort((a, b) => a.level - b.level)[0];
    if (next) push(mk(next, `Strengthens ${w.c.label} — your weakest area`, 'weak'));
  }

  // 3) Next untouched level — new ground.
  const frontier = [...levels.entries()]
    .filter(([, v]) => v.done === 0 && v.total > 0)
    .sort((a, b) => a[0] - b[0])[0];
  if (frontier) {
    const [fn] = frontier;
    const s = SKILLS.filter((sk) => sk.level === fn).sort((a, b) => a.name.localeCompare(b.name))[0];
    if (s) push(mk(s, `New ground — opens Level ${fn}`, 'frontier'));
  }

  // 4) Fill remaining slots with the lowest-level unmastered skills.
  if (recs.length < limit) {
    [...unmastered].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).forEach((s) => push(mk(s, `Level ${s.level}`, 'next')));
  }

  return recs.slice(0, limit);
}
