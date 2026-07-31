import { describe, test, expect } from 'vitest';
import { SKILLS } from '@/src/data/skills';
import { longestPrereqPath, pathSteps } from '@/src/lib/skillGraph';
// Cross-check against the id-space module ONLY in the test. slug === id everywhere
// (src/data/skills.ts), so the two graphs must agree key-for-key. The /skill page
// itself must never import mapGraph — that is enforced by the build, not here.
import * as mapGraph from '@/src/lib/mapGraph';

const bySlug = new Map(SKILLS.map((s) => [s.slug, s]));

describe('skillGraph depth (slug-space)', () => {
  test('pathSteps agrees with mapGraph.pathSteps for every skill', () => {
    for (const s of SKILLS) {
      expect(pathSteps(s.slug)).toBe(mapGraph.pathSteps(s.slug));
    }
  });

  test('longestPrereqPath agrees with mapGraph.longestPrereqPath for every skill', () => {
    for (const s of SKILLS) {
      expect(longestPrereqPath(s.slug)).toEqual(mapGraph.longestPrereqPath(s.slug));
    }
  });

  test('a bedrock skill (no deps) -> pathSteps 1, chain = [slug]', () => {
    const bedrock = SKILLS.filter((s) => s.deps.length === 0);
    expect(bedrock.length).toBeGreaterThan(0);
    for (const s of bedrock) {
      expect(pathSteps(s.slug)).toBe(1);
      expect(longestPrereqPath(s.slug)).toEqual([s.slug]);
    }
    // 'posture' is a known bedrock skill.
    expect(pathSteps('posture')).toBe(1);
  });

  test('a deep skill: chain starts at a rootless skill, each consecutive pair is a real dep edge, ends at the queried slug', () => {
    // The deepest skill in the graph — a genuine multi-level chain.
    const deepest = [...SKILLS].sort((a, b) => pathSteps(b.slug) - pathSteps(a.slug))[0];
    const chain = longestPrereqPath(deepest.slug);

    expect(pathSteps(deepest.slug)).toBeGreaterThan(1);
    expect(chain.length).toBe(pathSteps(deepest.slug));
    // ends with the queried skill (it is "you are here" on the page)
    expect(chain[chain.length - 1]).toBe(deepest.slug);
    // starts at a rootless skill (the deepest root of the DAG)
    expect(bySlug.get(chain[0])!.deps.length).toBe(0);
    // every step down the chain is a genuine prerequisite edge: chain[i-1] is a
    // direct dep of chain[i]
    for (let i = 1; i < chain.length; i++) {
      expect(bySlug.get(chain[i])!.deps).toContain(chain[i - 1]);
    }
  });

  test('a known chain: "cross" is 6 steps from the roots and ends at itself', () => {
    // Locked by test/tangoMap.test.tsx too (the detail panel shows "path steps" = 6).
    expect(pathSteps('cross')).toBe(6);
    const chain = longestPrereqPath('cross');
    expect(chain.length).toBe(6);
    expect(chain[chain.length - 1]).toBe('cross');
    expect(bySlug.get(chain[0])!.deps.length).toBe(0);
  });

  test('deterministic (memoised, no clock/random)', () => {
    for (const s of SKILLS.slice(0, 8)) {
      expect(longestPrereqPath(s.slug)).toEqual(longestPrereqPath(s.slug));
      expect(pathSteps(s.slug)).toBe(pathSteps(s.slug));
    }
  });
});
