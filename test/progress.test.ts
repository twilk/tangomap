import { test, expect } from 'vitest';
import { sanitizeMastered, masteredCount, perLevel, milestones } from '@/src/lib/progress';
import { SKILLS } from '@/src/data/skills';

test('sanitizeMastered drops unknown slugs, dedupes, and caps at 62', () => {
  expect(sanitizeMastered(['mirada-cabeceo', 'not-a-skill', 'mirada-cabeceo'])).toEqual(['mirada-cabeceo']);
  expect(sanitizeMastered('nope')).toEqual([]);
  expect(sanitizeMastered([1, 2, null])).toEqual([]);
  const all = SKILLS.map((s) => s.slug);
  expect(sanitizeMastered([...all, ...all]).length).toBe(62);
});

test('masteredCount counts only valid slugs', () => {
  expect(masteredCount(['mirada-cabeceo', 'posture', 'garbage'])).toBe(2);
});

test('perLevel totals cover all 62 skills across levels 1..10', () => {
  const pl = perLevel([]);
  let total = 0;
  for (let l = 1; l <= 10; l++) {
    expect(pl[l].done).toBe(0);
    total += pl[l].total;
  }
  expect(total).toBe(62);
});

test('perLevel counts mastered per level', () => {
  const first = SKILLS.find((s) => s.level === 1)!;
  const pl = perLevel([first.slug]);
  expect(pl[1].done).toBe(1);
});

test('milestones thresholds', () => {
  expect(milestones(0)).toEqual([]);
  expect(milestones(26)).toEqual([5, 10, 25]);
  expect(milestones(62)).toEqual([5, 10, 25, 50]);
});
