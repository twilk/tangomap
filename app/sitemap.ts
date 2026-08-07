import type { MetadataRoute } from 'next';
import { SKILLS } from '@/src/data/skills';
import { abs } from '@/src/lib/site';

/**
 * The crawlable surface. Everything here is statically generated and safe to index.
 *
 * DELIBERATELY ABSENT: `/u/<handle>` profiles. They are opt-in personal data (2 rows
 * today), and including them would turn this file into a live DB read on every crawl.
 * Also absent: /me, /settings, /signin, /signout, /compare — private, or useless without
 * parameters. /ar/scan stays out until it is raised or removed (roadmap Gate 5).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    { url: abs('/'), lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: abs('/skills'), lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ];

  // The 62 skill pages — the actual corpus, and the reason this file exists.
  const skills: MetadataRoute.Sitemap = SKILLS.map((s) => ({
    url: abs(`/skill/${s.slug}`),
    lastModified: now,
    changeFrequency: 'yearly',
    priority: 0.8,
  }));

  return [...core, ...skills];
}
