import { SKILLS } from '@/src/data/skills';
import { sanitizeMastered } from '@/src/lib/progress';

// The 13 skill categories (bundle node `tag`s) with human labels + a monochrome
// line icon (inner SVG markup, 24×24, currentColor), in display order. The icon
// replaces the axis number on the radar and prefixes the label in every row.
export const CATEGORIES: { tag: string; label: string; icon: string }[] = [
  // Connection — two dancers linked (interlocking rings)
  { tag: 'PARTNER', label: 'Connection', icon: '<circle cx="9" cy="12" r="4.5"/><circle cx="15" cy="12" r="4.5"/>' },
  // Body & Posture — the standing axis (head, spine, base)
  { tag: 'BODY', label: 'Body & Posture', icon: '<circle cx="12" cy="5.5" r="2.5"/><path d="M12 8v11"/><path d="M8 19h8"/>' },
  // Footwork — ascending steps
  { tag: 'STEP', label: 'Footwork', icon: '<path d="M4 20h5v-5h5v-5h5V5"/>' },
  // Musicality — rhythm bars (a little equaliser)
  { tag: 'RHYTHM', label: 'Musicality', icon: '<path d="M6 15V9"/><path d="M10 17V7"/><path d="M14 16V8"/><path d="M18 14v-4"/>' },
  // Turns — the ocho / figure-eight
  { tag: 'ROTATION', label: 'Turns', icon: '<path d="M12 12C6 10 6 4 12 4c6 0 6 6 0 8-6 2-6 8 0 8 6 0 6-6 0-8Z"/>' },
  // Navigation — compass (needle in a circle)
  { tag: 'SPACE', label: 'Navigation', icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5 13.8 12 12 16.5 10.2 12Z"/>' },
  // Contact — the gancho hook
  { tag: 'CONTACT', label: 'Contact', icon: '<path d="M14 4v9a4 4 0 1 1-8 0"/>' },
  // Free Leg — a sweeping adorno to the free foot
  { tag: 'FREE LEG', label: 'Free Leg', icon: '<path d="M6 20Q6 8 16 6"/><circle cx="16.5" cy="6" r="1.8" fill="currentColor" stroke="none"/>' },
  // Off-Axis — leaning off the (dashed) axis
  { tag: 'OFF AXIS', label: 'Off-Axis', icon: '<path d="M12 4v16" stroke-dasharray="2 2" opacity="0.5"/><path d="M8 20 16 6"/><circle cx="16.3" cy="5.7" r="1.6" fill="currentColor" stroke="none"/>' },
  // Dynamics — energy (lightning bolt)
  { tag: 'DYNAMICS', label: 'Dynamics', icon: '<path d="M13 2 4 14h7l-1 8 10-13h-8Z" fill="currentColor" stroke="none"/>' },
  // Genres — beamed notes
  { tag: 'GENRE', label: 'Genres', icon: '<circle cx="7" cy="18" r="2.2" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="2.2" fill="currentColor" stroke="none"/><path d="M9 18V6l10-2v12"/>' },
  // Styles — a dancer
  { tag: 'STYLE', label: 'Styles', icon: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2v6m0 0-4 7m4-7 4 6M8.5 10.5 15.5 8.5"/>' },
  // Mastery — a four-point sparkle
  { tag: 'MASTERY', label: 'Mastery', icon: '<path d="M12 3 13.8 10.2 21 12 13.8 13.8 12 21 10.2 13.8 3 12 10.2 10.2Z"/>' },
];

/** Wrap a category's inner icon markup in a themeable 24×24 line-icon <svg>. */
export function iconSvg(inner: string, size = 16): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

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
