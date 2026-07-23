import { test, expect } from 'vitest';
import { CATEGORIES, perCategory, topStrengths, dnaSignature } from '@/src/lib/dna';
import { SKILLS } from '@/src/data/skills';

test('13 categories, and every skill tag maps to a category', () => {
  expect(CATEGORIES.length).toBe(13);
  const known = new Set(CATEGORIES.map((c) => c.tag));
  for (const s of SKILLS) expect(known.has(s.tag)).toBe(true);
});

test('perCategory totals sum to 62 and start at 0 done', () => {
  const pc = perCategory([]);
  expect(pc.reduce((a, c) => a + c.total, 0)).toBe(62);
  expect(pc.every((c) => c.done === 0 && c.pct === 0)).toBe(true);
});

test('perCategory counts mastered per category and computes pct', () => {
  const partner = SKILLS.filter((s) => s.tag === 'PARTNER');
  const two = partner.slice(0, 2).map((s) => s.slug);
  const row = perCategory(two).find((c) => c.tag === 'PARTNER')!;
  expect(row.done).toBe(2);
  expect(row.total).toBe(partner.length);
  expect(row.pct).toBe(Math.round((2 / partner.length) * 100));
});

test('perCategory ignores unknown slugs', () => {
  const row = perCategory(['not-a-skill', 'garbage']).find((c) => c.tag === 'PARTNER')!;
  expect(row.done).toBe(0);
});

test('topStrengths and dnaSignature reflect the strongest categories', () => {
  const rotation = SKILLS.filter((s) => s.tag === 'ROTATION').map((s) => s.slug);
  const strengths = topStrengths(rotation, 3);
  expect(strengths[0].tag).toBe('ROTATION');
  expect(dnaSignature(rotation)).toContain('Turns');
  expect(dnaSignature([])).toBe('Just getting started');
});
