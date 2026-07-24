import { test, expect } from 'vitest';
import { SKILLS } from '@/src/data/skills';
import { CATEGORIES } from '@/src/lib/dna';
import { getSkillContent, CATEGORY_OVERVIEW } from '@/src/lib/knowledge';

test('every one of the 62 skills has knowledge-base content', () => {
  const missing = SKILLS.filter((s) => !getSkillContent(s.slug)).map((s) => s.slug);
  expect(missing).toEqual([]);
});

test('each skill entry has the required shape', () => {
  for (const s of SKILLS) {
    const c = getSkillContent(s.slug)!;
    expect(c.tagline.length, s.slug).toBeGreaterThan(0);
    expect(c.summary.length, s.slug).toBeGreaterThan(20);
    expect(c.howItWorks.length, s.slug).toBeGreaterThan(20);
    expect(c.leaderCues.length, s.slug).toBeGreaterThanOrEqual(1);
    expect(c.followerCues.length, s.slug).toBeGreaterThanOrEqual(1);
    expect(c.commonMistakes.length, s.slug).toBeGreaterThanOrEqual(1);
  }
});

test('every category has an overview', () => {
  const missing = CATEGORIES.filter((c) => !CATEGORY_OVERVIEW[c.tag]).map((c) => c.tag);
  expect(missing).toEqual([]);
});
