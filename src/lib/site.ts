/**
 * The canonical public origin, in one place.
 *
 * It was previously inlined in app/compare/page.tsx to build invite links; the
 * sitemap, robots and JSON-LD all need the same value, and three copies of a
 * hostname is how a staging URL eventually ends up in a crawl index.
 *
 * No trailing slash — every caller joins with a leading-slash path.
 */
export const SITE = 'https://partykamap.vercel.app';

/** Absolute URL for a site-relative path (`/skills` → `https://…/skills`). */
export function abs(path: string): string {
  return `${SITE}${path.startsWith('/') ? path : `/${path}`}`;
}
