import { describe, test, expect } from 'vitest';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { courseJsonLd } from '@/src/lib/jsonld';
import { SITE, abs } from '@/src/lib/site';
import { SKILLS } from '@/src/data/skills';
import { prerequisites } from '@/src/lib/skillGraph';

// Gate 1 item 2 of the CEO roadmap: the 62 statically generated skill pages existed
// but no crawler knew about them. These assert the acceptance criteria directly rather
// than by scraping built HTML, so they fail loudly if the corpus and the crawl surface
// ever drift apart.

describe('sitemap', () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  test('advertises every skill page — all 62, none missing', () => {
    const missing = SKILLS.filter((s) => !urls.includes(abs(`/skill/${s.slug}`)));
    expect(missing.map((s) => s.slug)).toEqual([]);
    expect(SKILLS.length).toBe(62);
  });

  test('includes the two entry points', () => {
    expect(urls).toContain(abs('/'));
    expect(urls).toContain(abs('/skills'));
  });

  // The privacy line. /u/<handle> is opt-in personal data; putting it in a crawl index
  // would also make this file a live DB read on every fetch.
  test('never advertises a dancer profile or a private route', () => {
    const leaked = urls.filter((u) => /\/(u|me|settings|signin|signout|compare|api)\b/.test(u));
    expect(leaked).toEqual([]);
  });

  test('every url is absolute and on the canonical origin', () => {
    expect(urls.every((u) => u.startsWith(`${SITE}/`))).toBe(true);
  });
});

describe('robots', () => {
  const r = robots();
  const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  const disallow = ([] as string[]).concat(rule.disallow ?? []);

  test('points crawlers at the sitemap', () => {
    expect(r.sitemap).toBe(abs('/sitemap.xml'));
  });

  test('closes the private surface', () => {
    for (const p of ['/api/', '/me', '/settings', '/signin', '/signout', '/compare', '/u/']) {
      expect(disallow).toContain(p);
    }
  });

  test('leaves the corpus open', () => {
    expect(rule.allow).toBe('/');
    expect(disallow.some((d) => d === '/' || d === '/skill/' || d === '/skills')).toBe(false);
  });
});

describe('skill JSON-LD', () => {
  test('is a valid schema.org Course and survives a JSON round-trip', () => {
    const skill = SKILLS[0];
    const ld = courseJsonLd(skill, 'A summary.', []);
    const parsed = JSON.parse(JSON.stringify(ld));
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Course');
    expect(parsed.url).toBe(abs(`/skill/${skill.slug}`));
    expect(parsed.name).toBe(skill.name);
  });

  test('carries prerequisites — the edges that make the corpus a graph', () => {
    // Pick a skill that actually has prerequisites, or the assertion proves nothing.
    const withDeps = SKILLS.find((s) => prerequisites(s.slug).length > 0);
    expect(withDeps).toBeDefined();
    const deps = prerequisites(withDeps!.slug);
    const ld = courseJsonLd(withDeps!, null, deps);
    expect(ld.coursePrerequisites).toHaveLength(deps.length);
    expect(ld.coursePrerequisites![0]['@id']).toBe(abs(`/skill/${deps[0].slug}`));
  });

  test('omits coursePrerequisites entirely for a root skill', () => {
    const ld = courseJsonLd(SKILLS[0], null, []);
    expect('coursePrerequisites' in ld).toBe(false);
  });

  test('falls back to a real description when a skill has no written summary', () => {
    const ld = courseJsonLd(SKILLS[0], null, []);
    expect(ld.description).toContain(SKILLS[0].name);
    expect(ld.description).not.toContain('null');
  });
});
