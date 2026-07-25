import { describe, test, expect } from 'vitest';
import { reconcileCompare, compareHalves, COMPARE_MIN, DEFAULT_THEME } from '@/src/lib/compareTheme';
import { parseHex, contrastRatio, mix } from '@/src/lib/color';
import { deriveTokens, type Theme } from '@/src/lib/theme';

/** Contrast between two hex strings. */
const cr = (x: string, y: string) => contrastRatio(parseHex(x)!, parseHex(y)!);

// Three valid four-seed themes (all clear parseTheme's floors, though reconcile
// never gates — it derives directly).
const PLUM: Theme = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
const LIGHT: Theme = { v: 1, ground: '#f5ead8', ink: '#201e1d', accent: '#c67139', accent2: '#7a8a5e' };
const DARK: Theme = { v: 1, ground: '#110d09', ink: '#f2eadc', accent: '#e58c44', accent2: '#a8ba8a' };

describe('reconcileCompare', () => {
  test('COMPARE_MIN is 3 (WCAG UI contrast)', () => {
    expect(COMPARE_MIN).toBe(3);
  });

  test('each side keeps its OWN full derived palette', () => {
    const P = reconcileCompare(LIGHT, DARK);
    expect(P.a).toEqual(deriveTokens(LIGHT));
    expect(P.b).toEqual(deriveTokens(DARK));
  });

  test('identical themes → the two blob strokes are pushed ≥ COMPARE_MIN apart', () => {
    const P = reconcileCompare(PLUM, PLUM);
    expect(cr(P.aBlob, P.bBlob)).toBeGreaterThanOrEqual(COMPARE_MIN);
    expect(P.aBlob).not.toBe(P.bBlob);
  });

  test('light vs dark → each blob clears COMPARE_MIN against the shared (mid) ground', () => {
    const P = reconcileCompare(LIGHT, DARK);
    const shared = mix(parseHex(deriveTokens(LIGHT).ground)!, parseHex(deriveTokens(DARK).ground)!, 0.5);
    expect(contrastRatio(parseHex(P.aBlob)!, shared)).toBeGreaterThanOrEqual(COMPARE_MIN);
    expect(contrastRatio(parseHex(P.bBlob)!, shared)).toBeGreaterThanOrEqual(COMPARE_MIN);
  });

  test('the two blobs stay distinct even for a light-vs-dark pair', () => {
    const P = reconcileCompare(LIGHT, DARK);
    expect(cr(P.aBlob, P.bBlob)).toBeGreaterThanOrEqual(COMPARE_MIN);
  });

  test('seam clears COMPARE_MIN on BOTH grounds', () => {
    const P = reconcileCompare(LIGHT, DARK);
    expect(cr(P.seam, deriveTokens(LIGHT).ground)).toBeGreaterThanOrEqual(COMPARE_MIN);
    expect(cr(P.seam, deriveTokens(DARK).ground)).toBeGreaterThanOrEqual(COMPARE_MIN);
  });

  test('seam reads on both grounds for two similar dark themes too', () => {
    const P = reconcileCompare(PLUM, DARK);
    expect(cr(P.seam, deriveTokens(PLUM).ground)).toBeGreaterThanOrEqual(COMPARE_MIN);
    expect(cr(P.seam, deriveTokens(DARK).ground)).toBeGreaterThanOrEqual(COMPARE_MIN);
  });

  test('deterministic — no Math.random/Date; two calls are byte-equal', () => {
    expect(reconcileCompare(PLUM, LIGHT)).toEqual(reconcileCompare(PLUM, LIGHT));
    expect(reconcileCompare(LIGHT, DARK)).toEqual(reconcileCompare(LIGHT, DARK));
  });

  test('DEFAULT_THEME derives today\'s frozen compare accents (light page default)', () => {
    const t = deriveTokens(DEFAULT_THEME);
    // These are exactly the current .tm-profile literals the themeless halves use.
    expect(t.ember).toBe('#c67139');
    expect(t.verd).toBe('#7a8a5e');
    expect(t.ground).toBe('#f5ead8');
    expect(t.ink).toBe('#201e1d');
  });
});

describe('compareHalves (per-half decisions)', () => {
  test('two themeless dancers → every field undefined (frozen default)', () => {
    expect(compareHalves(null, null)).toEqual({});
  });

  test('themeA-only → BOTH blobs applied (B not left as the frozen literal) and ≥ COMPARE_MIN apart', () => {
    const H = compareHalves(PLUM, null);
    // The B half receives a reconciled stroke, not undefined — so it can shift off
    // the frozen verd to stay legible against A.
    expect(H.aBlob).toBeDefined();
    expect(H.bBlob).toBeDefined();
    expect(cr(H.aBlob!, H.bBlob!)).toBeGreaterThanOrEqual(COMPARE_MIN);
    // Only the themed (A) half is palette-scoped; the themeless (B) half keeps the page palette.
    expect(H.aTokens).toEqual(deriveTokens(PLUM));
    expect(H.bTokens).toBeUndefined();
    expect(H.seam).toBeDefined();
  });

  test('themeB-only → symmetric: both blobs applied, only B palette-scoped', () => {
    const H = compareHalves(null, DARK);
    expect(H.aBlob).toBeDefined();
    expect(H.bBlob).toBeDefined();
    expect(cr(H.aBlob!, H.bBlob!)).toBeGreaterThanOrEqual(COMPARE_MIN);
    expect(H.aTokens).toBeUndefined();
    expect(H.bTokens).toEqual(deriveTokens(DARK));
  });

  test('both themed → both palettes scoped, both blobs + seam present', () => {
    const H = compareHalves(LIGHT, DARK);
    expect(H.aTokens).toEqual(deriveTokens(LIGHT));
    expect(H.bTokens).toEqual(deriveTokens(DARK));
    expect(H.aBlob).toBeDefined();
    expect(H.bBlob).toBeDefined();
    expect(H.seam).toBeDefined();
  });
});
