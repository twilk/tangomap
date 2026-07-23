import { SKILLS } from '@/src/data/skills';
import { sanitizeMastered } from '@/src/lib/progress';

// The 13 skill categories (bundle node `tag`s) with human labels + a monochrome
// line icon (inner SVG markup, 24×24, currentColor), in display order. Icons are
// Lucide glyphs (lucide.dev, ISC-licensed) inlined as path data — no runtime dep;
// they match iconSvg()'s wrapper exactly (2px stroke, round caps, currentColor).
// The icon replaces the axis number on the radar and prefixes the label in rows.
export const CATEGORIES: { tag: string; label: string; icon: string }[] = [
  // Connection — lucide "users" (two dancers)
  { tag: 'PARTNER', label: 'Connection', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  // Body & Posture — lucide "person-standing"
  { tag: 'BODY', label: 'Body & Posture', icon: '<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>' },
  // Footwork — lucide "footprints"
  { tag: 'STEP', label: 'Footwork', icon: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>' },
  // Musicality — lucide "audio-lines"
  { tag: 'RHYTHM', label: 'Musicality', icon: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>' },
  // Turns — lucide "rotate-cw"
  { tag: 'ROTATION', label: 'Turns', icon: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>' },
  // Navigation — lucide "compass"
  { tag: 'SPACE', label: 'Navigation', icon: '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>' },
  // Contact — lucide "link"
  { tag: 'CONTACT', label: 'Contact', icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
  // Free Leg — lucide "wind" (a sweeping motion)
  { tag: 'FREE LEG', label: 'Free Leg', icon: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>' },
  // Off-Axis — the person-standing figure tilted off vertical (rhymes with Body; no standard glyph fits)
  { tag: 'OFF AXIS', label: 'Off-Axis', icon: '<g transform="rotate(18 12 20)"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></g>' },
  // Dynamics — lucide "zap" (lightning bolt)
  { tag: 'DYNAMICS', label: 'Dynamics', icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  // Genres — lucide "disc-3" (a record)
  { tag: 'GENRE', label: 'Genres', icon: '<path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="10"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/><circle cx="12" cy="12" r="2"/>' },
  // Styles — lucide "palette" (a variety of styles)
  { tag: 'STYLE', label: 'Styles', icon: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2Z"/>' },
  // Mastery — lucide "award" (a medal)
  { tag: 'MASTERY', label: 'Mastery', icon: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>' },
];

/** Wrap a category's inner icon markup in a themeable 24×24 line-icon <svg>.
 * The xmlns is required: this same string is also loaded as a data: URL <img>
 * onto the radar canvas, and a standalone SVG without the namespace fails to
 * load (inline in the DOM the browser infers it, as a data URL it does not). */
export function iconSvg(inner: string, size = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
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
