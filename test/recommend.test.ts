import { test, expect } from 'vitest';
import { SKILLS } from '@/src/data/skills';
import { recommend } from '@/src/lib/recommend';

test('brand-new dancer gets Level 1 starters', () => {
  const recs = recommend([], 4);
  expect(recs.length).toBe(4);
  expect(recs.every((r) => r.level === 1)).toBe(true);
  expect(recs.every((r) => r.kind === 'start')).toBe(true);
});

test('all-mastered returns nothing', () => {
  const all = SKILLS.map((s) => s.slug);
  expect(recommend(all, 4)).toEqual([]);
});

test('recommends only unmastered skills, no dupes, capped at limit', () => {
  // master everything at level 1 so there is real per-level progress
  const mastered = SKILLS.filter((s) => s.level <= 2).map((s) => s.slug);
  const recs = recommend(mastered, 4);
  const set = new Set(mastered);
  expect(recs.length).toBeGreaterThan(0);
  expect(recs.length).toBeLessThanOrEqual(4);
  expect(recs.every((r) => !set.has(r.slug))).toBe(true); // never suggest a mastered skill
  expect(new Set(recs.map((r) => r.slug)).size).toBe(recs.length); // no duplicates
  expect(recs.every((r) => r.reason.length > 0 && r.label.length > 0)).toBe(true);
});

test('surfaces a "finish the level" quick win when a level is nearly done', () => {
  // master all of level 1 except one skill → that level is closest to complete
  const lvl1 = SKILLS.filter((s) => s.level === 1);
  const mastered = lvl1.slice(0, lvl1.length - 1).map((s) => s.slug);
  const recs = recommend(mastered, 4);
  const quickWin = recs.find((r) => r.kind === 'level');
  expect(quickWin).toBeDefined();
  expect(quickWin!.reason).toContain('Level 1');
});
