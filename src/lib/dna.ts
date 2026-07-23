import { SKILLS } from '@/src/data/skills';
import { sanitizeMastered } from '@/src/lib/progress';

// The 13 skill categories (bundle node `tag`s) with human labels, in display order.
export const CATEGORIES: { tag: string; label: string }[] = [
  { tag: 'PARTNER', label: 'Connection' },
  { tag: 'BODY', label: 'Body & Posture' },
  { tag: 'STEP', label: 'Footwork' },
  { tag: 'RHYTHM', label: 'Musicality' },
  { tag: 'ROTATION', label: 'Turns' },
  { tag: 'SPACE', label: 'Navigation' },
  { tag: 'CONTACT', label: 'Contact' },
  { tag: 'FREE LEG', label: 'Free Leg' },
  { tag: 'OFF AXIS', label: 'Off-Axis' },
  { tag: 'DYNAMICS', label: 'Dynamics' },
  { tag: 'GENRE', label: 'Genres' },
  { tag: 'STYLE', label: 'Styles' },
  { tag: 'MASTERY', label: 'Mastery' },
];

export type CategoryStat = { tag: string; label: string; done: number; total: number; pct: number };

// Precompute tag -> skill slugs once (module load) so perCategory does not re-scan all 62.
const SLUGS_BY_TAG: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const s of SKILLS) (m.get(s.tag) ?? m.set(s.tag, []).get(s.tag)!).push(s.slug);
  return m;
})();

/** "Tango DNA": mastery strength per category. Always returns all 13, in display order. */
export function perCategory(mastered: string[]): CategoryStat[] {
  const set = new Set(sanitizeMastered(mastered));
  return CATEGORIES.map(({ tag, label }) => {
    const slugs = SLUGS_BY_TAG.get(tag) ?? [];
    const done = slugs.reduce((n, slug) => n + (set.has(slug) ? 1 : 0), 0);
    const total = slugs.length;
    return { tag, label, done, total, pct: total ? Math.round((done / total) * 100) : 0 };
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
