import { test, expect } from 'vitest';
import { SKILLS } from '@/src/data/skills';
import { danceScore, learnScore } from '@/src/lib/matching';

const upToLevel = (max: number) => SKILLS.filter((s) => s.level <= max).map((s) => s.slug);
const ALL = SKILLS.map((s) => s.slug);

test('danceScore is symmetric', () => {
  const ab = danceScore(upToLevel(3), upToLevel(5));
  const ba = danceScore(upToLevel(5), upToLevel(3));
  expect(ab.score).toBeCloseTo(ba.score);
  expect(ab.shared).toBe(ba.shared);
});

test('identical dancers share everything and score ~1', () => {
  const a = upToLevel(4);
  const s = danceScore(a, a);
  expect(s.shared).toBe(a.length);
  expect(s.jaccard).toBeCloseTo(1);
  expect(s.reachGap).toBe(0);
  expect(s.score).toBeCloseTo(1);
});

test('closer level + more overlap scores higher than far-apart', () => {
  const me = upToLevel(3);
  const close = danceScore(me, upToLevel(4));
  const far = danceScore(me, ALL);
  expect(close.score).toBeGreaterThan(far.score);
  expect(far.reachGap).toBeGreaterThan(close.reachGap);
});

test('learnScore: a bounded-ahead dancer is an eligible teacher, and it is asymmetric', () => {
  const me = upToLevel(3); // reach 3
  const them = upToLevel(5); // reach 5, gap 2 (within 1..3)
  const l = learnScore(me, them);
  expect(l.reachGap).toBe(2);
  expect(l.eligible).toBe(true);
  expect(l.canTeach).toBeGreaterThan(0);
  expect(l.topSkills.length).toBeGreaterThan(0);
  // the beginner cannot teach the advanced dancer → not mutual
  expect(learnScore(them, me).eligible).toBe(false);
});

test('learnScore: a too-far-ahead dancer is NOT an eligible learning partner', () => {
  const me = upToLevel(2); // reach 2
  const them = ALL; // reach 10, gap 8 > 3
  expect(learnScore(me, them).eligible).toBe(false);
});
