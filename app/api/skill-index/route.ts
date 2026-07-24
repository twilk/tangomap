import { SKILLS } from '@/src/data/skills';

// Public name → slug → tag index for the 62 skills. The static map bundle only
// knows skill names (slugs are hand-authored, not derivable), so this lets it
// deep-link each node to its /skill/[slug] guide. Non-sensitive; cacheable.
export function GET() {
  return Response.json(
    { skills: SKILLS.map((s) => ({ name: s.name, slug: s.slug, tag: s.tag })) },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
