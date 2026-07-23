import { SKILLS } from '@/src/data/skills';
import { sanitizeMastered } from '@/src/lib/progress';

// The 13 skill categories (bundle node `tag`s) with human labels + an icon, in
// display order. The icon replaces the axis number on the radar and prefixes the
// label in every legend/tape row.
export const CATEGORIES: { tag: string; label: string; icon: string }[] = [
  { tag: 'PARTNER', label: 'Connection', icon: '🤝' },
  { tag: 'BODY', label: 'Body & Posture', icon: '🧍' },
  { tag: 'STEP', label: 'Footwork', icon: '👣' },
  { tag: 'RHYTHM', label: 'Musicality', icon: '🎵' },
  { tag: 'ROTATION', label: 'Turns', icon: '🌀' },
  { tag: 'SPACE', label: 'Navigation', icon: '🧭' },
  { tag: 'CONTACT', label: 'Contact', icon: '🔗' },
  { tag: 'FREE LEG', label: 'Free Leg', icon: '🦵' },
  { tag: 'OFF AXIS', label: 'Off-Axis', icon: '🤸' },
  { tag: 'DYNAMICS', label: 'Dynamics', icon: '⚡' },
  { tag: 'GENRE', label: 'Genres', icon: '🎻' },
  { tag: 'STYLE', label: 'Styles', icon: '💃' },
  { tag: 'MASTERY', label: 'Mastery', icon: '🏆' },
];

export type CategoryStat = { tag: string; label: string; icon: string; done: number; total: number; pct: number };
export type CategorySkill = { name: string; slug: string; on: boolean };
export type CategoryDetail = CategoryStat & { skills: CategorySkill[] };

// Precompute tag -> skill slugs once (module load) so perCategory does not re-scan all 62.
const SLUGS_BY_TAG: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const s of SKILLS) (m.get(s.tag) ?? m.set(s.tag, []).get(s.tag)!).push(s.slug);
  return m;
})();

// tag -> full skill rows (for per-category drill-down).
const SKILLS_BY_TAG: Map<string, typeof SKILLS> = (() => {
  const m = new Map<string, typeof SKILLS>();
  for (const s of SKILLS) (m.get(s.tag) ?? m.set(s.tag, []).get(s.tag)!).push(s);
  return m;
})();

/** Like perCategory, but each category also carries its individual skills + mastery. */
export function perCategoryDetailed(mastered: string[]): CategoryDetail[] {
  const set = new Set(sanitizeMastered(mastered));
  return CATEGORIES.map(({ tag, label, icon }) => {
    const skills = (SKILLS_BY_TAG.get(tag) ?? []).map((s) => ({ name: s.name, slug: s.slug, on: set.has(s.slug) }));
    const done = skills.reduce((n, s) => n + (s.on ? 1 : 0), 0);
    const total = skills.length;
    return { tag, label, icon, done, total, pct: total ? Math.round((done / total) * 100) : 0, skills };
  });
}

/** "Tango DNA": mastery strength per category. Always returns all 13, in display order. */
export function perCategory(mastered: string[]): CategoryStat[] {
  const set = new Set(sanitizeMastered(mastered));
  return CATEGORIES.map(({ tag, label, icon }) => {
    const slugs = SLUGS_BY_TAG.get(tag) ?? [];
    const done = slugs.reduce((n, slug) => n + (set.has(slug) ? 1 : 0), 0);
    const total = slugs.length;
    return { tag, label, icon, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  });
}

/** Strongest categories (highest %, tie-break by count), among those with any progress. */
export function topStrengths(mastered: string[], n = 3): CategoryStat[] {
  return perCategory(mastered)
    .filter((c) => c.done > 0)
    .sort((a, b) => b.pct - a.pct || b.done - a.done)
    .slice(0, n);
}

/** A short human signature of the dancer's strengths, e.g. "Turns · Connection · Musicality". */
export function dnaSignature(mastered: string[]): string {
  const t = topStrengths(mastered, 3);
  return t.length ? t.map((c) => c.label).join(' · ') : 'Just getting started';
}
