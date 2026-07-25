// Compare-view clash reconciliation. /compare overlays two dancers on one radar,
// each drawn in their OWN theme's accent. When the two accents (or grounds) clash,
// this pure pass nudges ONLY the shared/adjoining values — the two blob strokes and
// the seam divider — back to legibility. No storage, no DOM, no Math.random/Date:
// deterministic, so the same pair always reconciles the same way.

import { parseHex, contrastRatio, mix, toHex, type RGB } from '@/src/lib/color';
import { deriveTokens, type Theme, type DerivedTokens } from '@/src/lib/theme';

/** WCAG UI-contrast floor for the two blob outlines and the seam. */
export const COMPARE_MIN = 3;

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

/**
 * The frozen page default — the exact four seeds the current .tm-profile light
 * palette expands to (design/tokens.ts `light`). It stands in for a THEMELESS
 * dancer so the themed side can be reconciled against a concrete palette. The page
 * still renders a themeless half with the literal --tm-* vars (byte-identical to
 * today); DEFAULT_THEME only ever feeds the contrast math, never repaints a half.
 */
export const DEFAULT_THEME: Theme = {
  v: 1,
  ground: '#f5ead8',
  ink: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
};

/** Lowest contrast of `c` against every colour in `againsts`. */
function minContrast(c: RGB, againsts: RGB[]): number {
  let m = Infinity;
  for (const g of againsts) m = Math.min(m, contrastRatio(c, g));
  return m;
}

/**
 * Deterministically pick a variant of `c` that clears `min` contrast against EVERY
 * colour in `againsts`. Tries `c` unchanged first, then scans fixed ramps of `c`
 * toward black and toward white, returning the first candidate that clears `min`.
 * If none does (the targets straddle `c` too tightly), returns the candidate with
 * the highest min-contrast — the best legibility available. Pure/deterministic.
 */
function ensureAgainst(c: RGB, againsts: RGB[], min: number): string {
  let best = c;
  let bestScore = minContrast(c, againsts);
  if (bestScore >= min) return toHex(c);
  for (const target of [BLACK, WHITE]) {
    for (let i = 1; i <= 20; i++) {
      const cand = mix(c, target, i / 20);
      const s = minContrast(cand, againsts);
      if (s > bestScore) {
        bestScore = s;
        best = cand;
      }
      if (bestScore >= min) return toHex(best);
    }
  }
  return toHex(best);
}

export type ComparePalettes = {
  /** Dancer A's full own palette (unchanged — each side keeps its identity). */
  a: DerivedTokens;
  /** Dancer B's full own palette. */
  b: DerivedTokens;
  /** A's blob stroke: A's accent, made legible on the shared ground. */
  aBlob: string;
  /** B's blob stroke: B's accent (or its 2nd accent if it clashed with A's),
   *  made legible on the shared ground AND ≥ COMPARE_MIN apart from aBlob. */
  bBlob: string;
  /** Divider that reads on BOTH grounds. */
  seam: string;
};

/**
 * Reconcile two dancers' themes for the shared compare radar. Each side keeps its
 * own `deriveTokens` palette; the two blob strokes are pushed apart if they clash
 * (B shifts toward its second accent, then away from A's stroke), each blob is made
 * legible on the shared neutral ground (mid of the two grounds), and the seam is
 * chosen to read on both grounds. Pure and deterministic.
 */
export function reconcileCompare(a: Theme, b: Theme): ComparePalettes {
  const ta = deriveTokens(a);
  const tb = deriveTokens(b);

  const aAcc = parseHex(ta.ember)!;
  const bAcc = parseHex(tb.ember)!;
  const groundA = parseHex(ta.ground)!;
  const groundB = parseHex(tb.ground)!;
  // The blobs overlay one chart, so their legibility ground is the neutral mid of
  // the two theme grounds — not either extreme.
  const sharedGround = mix(groundA, groundB, 0.5);

  // A keeps its own accent, made legible on the shared ground.
  const aBlob = ensureAgainst(aAcc, [sharedGround], COMPARE_MIN);
  const aBlobRGB = parseHex(aBlob)!;

  // B starts from its own accent; if that's too close to A's, fall back to B's
  // SECOND accent (verd) so the dancers stay visually distinct.
  const bBase = contrastRatio(aAcc, bAcc) < COMPARE_MIN ? parseHex(tb.verd)! : bAcc;
  // First try to satisfy both constraints (readable on ground AND apart from A).
  let bBlob = ensureAgainst(bBase, [sharedGround, aBlobRGB], COMPARE_MIN);
  // When the two can't both be met on the same ground (e.g. identical themes: two
  // distinct blobs can't both stay legible on one dark ground while ≥3 apart),
  // distinguishing the overlaid blobs wins — re-solve for separation alone.
  if (contrastRatio(parseHex(bBlob)!, aBlobRGB) < COMPARE_MIN) {
    bBlob = ensureAgainst(bBase, [aBlobRGB], COMPARE_MIN);
  }

  // The seam divides the two halves, so it must read on either ground.
  const seam = ensureAgainst(parseHex(ta.ink)!, [groundA, groundB], COMPARE_MIN);

  return { a: ta, b: tb, aBlob, bBlob, seam };
}
