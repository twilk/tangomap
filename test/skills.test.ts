import { test, expect } from 'vitest';
import { SKILLS, SKILL_SLUGS } from '@/src/data/skills';

test('exactly 62 skills', () => {
  expect(SKILLS.length).toBe(62);
});

test('levels span 1..10', () => {
  const levels = new Set(SKILLS.map((s) => s.level));
  for (let l = 1; l <= 10; l++) expect(levels.has(l)).toBe(true);
});

test('slugs are unique and match the slug set', () => {
  expect(SKILL_SLUGS.size).toBe(62);
  expect(SKILL_SLUGS.has('mirada-cabeceo')).toBe(true);
});
