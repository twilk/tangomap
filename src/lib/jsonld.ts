import type { Skill } from '@/src/data/skills';
import { abs } from '@/src/lib/site';

/**
 * schema.org JSON-LD for a skill page.
 *
 * A pure function on purpose: the page can only be checked by scraping built HTML,
 * whereas this can be asserted directly (see test/discoverability.test.ts). `Course`
 * is the honest type — a named unit of instruction with prerequisites — and
 * `coursePrerequisites` carries the thing that makes 62 pages a graph rather than 62
 * loose articles.
 */
export type SkillCourse = {
  '@context': 'https://schema.org';
  '@type': 'Course';
  '@id': string;
  url: string;
  name: string;
  description: string;
  inLanguage: 'en';
  teaches: string;
  educationalLevel: string;
  isPartOf: { '@type': 'Course'; '@id': string; name: string };
  provider: { '@type': 'Organization'; name: string; url: string };
  coursePrerequisites?: Array<{ '@type': 'Course'; '@id': string; name: string }>;
};

export function courseJsonLd(skill: Skill, summary: string | null, buildsOn: Skill[]): SkillCourse {
  const url = abs(`/skill/${skill.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': url,
    url,
    name: skill.name,
    description: summary
      ? `${skill.name}: ${summary}`
      : `${skill.name} — an Argentine tango skill (Level ${skill.level}).`,
    inLanguage: 'en',
    teaches: skill.name,
    educationalLevel: `Level ${skill.level}`,
    isPartOf: { '@type': 'Course', '@id': abs('/skills'), name: 'Tango Map — 62 skills' },
    provider: { '@type': 'Organization', name: 'Tango Map', url: abs('/') },
    ...(buildsOn.length
      ? {
          coursePrerequisites: buildsOn.map((p) => ({
            '@type': 'Course' as const,
            '@id': abs(`/skill/${p.slug}`),
            name: p.name,
          })),
        }
      : {}),
  };
}
