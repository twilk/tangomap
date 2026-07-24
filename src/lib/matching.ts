import { SKILLS } from '@/src/data/skills';
import { sanitizeMastered } from '@/src/lib/progress';

// Partner matching — grounded in docs/partner-matching-research.md.
// Dance/practice partner = SYMMETRIC score (shared repertoire + level proximity);
// this is what the joint-coordination + SBMM evidence supports, and being
// symmetric it is reciprocal by construction (no interaction history needed).
// Learning partner = ASYMMETRIC, bounded complementary gap; the beginner gains
// most, so it is framed honestly and gated to a small ability gap.

const LEVEL_BY_SLUG = new Map(SKILLS.map((s) => [s.slug, s.level] as const));
const NAME_BY_SLUG = new Map(SKILLS.map((s) => [s.slug, s.name] as const));
const MAX_LEVEL = 10;

const W_REP = 0.7; // shared-repertoire weight (Jaccard)
const W_LVL = 0.3; // level-proximity weight
const LEARN_MIN_GAP = 1; // they must be at least 1 level ahead …
const LEARN_MAX_GAP = 3; // … but no more than 3 (still danceable together)
const REACHABLE_AHEAD = 2; // teachable = skills at or just above the learner's reach

/** Furthest level reached: the highest level at which the dancer mastered any skill. */
export function reach(mastered: Set<string>): number {
  let r = 0;
  for (const slug of mastered) {
    const l = LEVEL_BY_SLUG.get(slug);
    if (l && l > r) r = l;
  }
  return r;
}

export type DanceScore = {
  shared: number; // |A ∩ B| — skills both can execute together
  jaccard: number; // |A ∩ B| / |A ∪ B|
  levelProx: number; // 1 − |reachA − reachB| / 10
  reachGap: number; // |reachA − reachB|
  score: number; // W_REP·jaccard + W_LVL·levelProx, in [0,1]
};

/** Symmetric dance-partner score: `danceScore(a,b) === danceScore(b,a)`. */
export function danceScore(aMastered: string[], bMastered: string[]): DanceScore {
  const A = new Set(sanitizeMastered(aMastered));
  const B = new Set(sanitizeMastered(bMastered));
  let shared = 0;
  for (const s of A) if (B.has(s)) shared++;
  const union = A.size + B.size - shared;
  const jaccard = union ? shared / union : 0;
  const reachGap = Math.abs(reach(A) - reach(B));
  const levelProx = 1 - reachGap / MAX_LEVEL;
  const score = W_REP * jaccard + W_LVL * levelProx;
  return { shared, jaccard, levelProx, reachGap, score };
}

export type LearnScore = {
  canTeach: number; // reachable skills `them` has that `me` lacks
  reachGap: number; // reachThem − reachMe (positive ⇒ them ahead)
  eligible: boolean; // gated: 1 ≤ reachGap ≤ 3 and canTeach > 0
  topSkills: string[]; // a few skill names to surface
};

/**
 * How much can `them` teach `me`? Complementary skills `them` mastered that `me`
 * hasn't, at reachable levels (≤ my reach + 2), gated to a bounded ability gap.
 * Asymmetric on purpose — this is the learner's view.
 */
export function learnScore(meMastered: string[], themMastered: string[]): LearnScore {
  const ME = new Set(sanitizeMastered(meMastered));
  const THEM = new Set(sanitizeMastered(themMastered));
  const rMe = reach(ME);
  const reachGap = reach(THEM) - rMe;

  const teachable: { slug: string; level: number }[] = [];
  for (const slug of THEM) {
    if (ME.has(slug)) continue;
    const l = LEVEL_BY_SLUG.get(slug);
    if (l && l <= rMe + REACHABLE_AHEAD) teachable.push({ slug, level: l });
  }
  teachable.sort((a, b) => a.level - b.level);

  const eligible = reachGap >= LEARN_MIN_GAP && reachGap <= LEARN_MAX_GAP && teachable.length > 0;
  return {
    canTeach: teachable.length,
    reachGap,
    eligible,
    topSkills: teachable.slice(0, 3).map((t) => NAME_BY_SLUG.get(t.slug) ?? t.slug),
  };
}
