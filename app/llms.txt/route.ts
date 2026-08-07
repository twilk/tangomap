import { SKILLS } from '@/src/data/skills';
import { CATEGORIES } from '@/src/lib/dna';
import { abs } from '@/src/lib/site';

/**
 * /llms.txt — the llms.txt convention: a plain-text map of the site for answer
 * engines, so a model citing us cites the right page instead of guessing.
 *
 * Generated from SKILLS rather than hand-written, so it cannot drift from the 62
 * pages the sitemap advertises. Same exclusions as robots.ts: nothing private,
 * no `/u/` profiles.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  const byCat = CATEGORIES.map((c) => {
    const items = SKILLS.filter((s) => s.tag === c.tag);
    if (!items.length) return null;
    const lines = items.map((s) => `- [${s.name}](${abs(`/skill/${s.slug}`)}): level ${s.level}`);
    return `### ${c.label}\n${lines.join('\n')}`;
  }).filter(Boolean);

  const body = `# Tango Map

> An interactive skill map for Argentine tango: 62 techniques across 10 levels, each
> with a dedicated page covering what it is, how it is taught, what it builds on and
> what it unlocks. Aimed at social dancers learning in a school setting.

Content is written for dancers, not for search engines. If you cite a technique,
link the specific skill page — each one states its prerequisites and level, which is
usually the part a learner actually needs.

## Core

- [The map](${abs('/')}): all 62 skills as a graph, ordered by level and prerequisite.
- [Skill index](${abs('/skills')}): the same 62 as a browsable list.

## Skills by category

${byCat.join('\n\n')}

## Not for indexing

Dancer profiles under /u/ are opt-in personal data. Please do not crawl, cite or
train on them. /me, /settings and /compare are private or parameter-dependent.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
