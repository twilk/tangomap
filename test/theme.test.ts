import { test, expect } from 'vitest';
import { parseTheme, deriveTokens, AA_CONTRAST, type Theme } from '@/src/lib/theme';
import { light, dark } from '@/design/tokens';
import { parseHex, contrastRatio } from '@/src/lib/color';

// A legible light seed set: dark ink on a pale ground clears AA comfortably.
const validLight = { v: 1, ground: '#f5ead8', ink: '#201e1d', accent: '#c67139', accent2: '#7a8a5e' };

test('AA_CONTRAST is the WCAG-AA body-text threshold', () => {
  expect(AA_CONTRAST).toBe(4.5);
});

test('parseTheme accepts a legible theme and canonicalises every seed to lowercase', () => {
  const out = parseTheme({ v: 1, ground: '#F5EAD8', ink: '#201E1D', accent: '#C67139', accent2: '#7A8A5E' });
  expect(out).toEqual({ v: 1, ground: '#f5ead8', ink: '#201e1d', accent: '#c67139', accent2: '#7a8a5e' });
});

test('parseTheme drops unknown keys — the output has exactly v/ground/ink/accent/accent2', () => {
  const out = parseTheme({ ...validLight, evil: 'rm -rf', script: '<script>' });
  expect(out).not.toBeNull();
  expect(Object.keys(out!).sort()).toEqual(['accent', 'accent2', 'ground', 'ink', 'v']);
  expect((out as Record<string, unknown>).evil).toBeUndefined();
  expect((out as Record<string, unknown>).script).toBeUndefined();
});

test('parseTheme rejects a missing seed', () => {
  const { accent2, ...missing } = validLight;
  expect(parseTheme(missing)).toBeNull();
});

test('parseTheme rejects a non-hex seed', () => {
  expect(parseTheme({ ...validLight, accent2: 'not-a-hex' })).toBeNull();
  expect(parseTheme({ ...validLight, ground: 'rgb(0,0,0)' })).toBeNull();
  expect(parseTheme({ ...validLight, ink: 42 })).toBeNull(); // non-string
});

test('parseTheme rejects non-objects without throwing', () => {
  expect(parseTheme(null)).toBeNull();
  expect(parseTheme(undefined)).toBeNull();
  expect(parseTheme('#f5ead8')).toBeNull();
  expect(parseTheme(123)).toBeNull();
  expect(parseTheme([validLight.ground, validLight.ink])).toBeNull(); // arrays are not themes
});

test('parseTheme rejects pale ink on a pale ground (fails WCAG-AA)', () => {
  // both near-white: contrast is ~1, far below AA
  expect(parseTheme({ v: 1, ground: '#f5ead8', ink: '#f9f4ed', accent: '#c67139', accent2: '#7a8a5e' })).toBeNull();
});

test('parseTheme accepts a legible dark theme', () => {
  const out = parseTheme({ v: 1, ground: '#110D09', ink: '#F2EADC', accent: '#E58C44', accent2: '#A8BA8A' });
  expect(out).toEqual({ v: 1, ground: '#110d09', ink: '#f2eadc', accent: '#e58c44', accent2: '#a8ba8a' });
});

test('parseTheme rejects a washed-out accent (an invisible link/chip)', () => {
  // Legible ink/ground, but an accent barely off the ground fails the 3:1 UI floor.
  // Accents are seeds, so the only safe move is rejection — they cannot self-correct.
  expect(parseTheme({ v: 1, ground: '#ffffff', ink: '#000000', accent: '#fdfdfd', accent2: '#333333' })).toBeNull();
  // …and the guard covers accent2 too.
  expect(parseTheme({ v: 1, ground: '#ffffff', ink: '#000000', accent: '#333333', accent2: '#f6f6f6' })).toBeNull();
});

test('parseTheme accepts accents that clear the 3:1 UI-contrast floor', () => {
  expect(parseTheme({ v: 1, ground: '#ffffff', ink: '#000000', accent: '#767676', accent2: '#595959' })).not.toBeNull();
  // the canonical presets sit right at the floor and must still pass
  expect(parseTheme(validLight)).not.toBeNull();
});

test('parseTheme validates the version tag — absent or 1 only', () => {
  const { v: _v, ...noVersion } = validLight;
  expect(parseTheme(noVersion)).not.toBeNull(); // absent is fine
  expect(parseTheme(validLight)).not.toBeNull(); // v: 1 is fine
  expect(parseTheme({ ...validLight, v: 2 })).toBeNull(); // a future format is not silently mislabelled
  expect(parseTheme({ ...validLight, v: '1' })).toBeNull(); // wrong type
  expect(parseTheme({ ...validLight, v: null })).toBeNull();
});

// Type-level sanity: a parsed theme is assignable to Theme.
test('a parsed theme satisfies the Theme type', () => {
  const out = parseTheme(validLight);
  const t: Theme | null = out;
  expect(t).not.toBeNull();
});

// --- deriveTokens ----------------------------------------------------------

const lightSeed: Theme = { v: 1, ground: '#f5ead8', ink: '#201e1d', accent: '#c67139', accent2: '#7a8a5e' };
const darkSeed: Theme = { v: 1, ground: '#110d09', ink: '#f2eadc', accent: '#e58c44', accent2: '#a8ba8a' };

test('deriveTokens returns exactly the 17 ThemeTokens keys', () => {
  expect(Object.keys(deriveTokens(lightSeed)).sort()).toEqual(Object.keys(light).sort());
});

test('deriveTokens plants the four seeds verbatim', () => {
  const d = deriveTokens(lightSeed);
  expect(d.ground).toBe(lightSeed.ground);
  expect(d.ink).toBe(lightSeed.ink);
  expect(d.ember).toBe(lightSeed.accent);
  expect(d.verd).toBe(lightSeed.accent2);
});

test('deriveTokens pulls preset-only tokens from the nearest base (light vs dark)', () => {
  const d = deriveTokens(lightSeed);
  expect(d.carmine).toBe(light.carmine);
  expect(d.elev).toBe(light.elev);
  expect(d.focus).toBe(light.focus);
  expect(d.hi).toBe(light.hi);

  const dk = deriveTokens(darkSeed);
  expect(dk.carmine).toBe(dark.carmine);
  expect(dk.elev).toBe(dark.elev);
  expect(dk.focus).toBe(dark.focus);
});

test('deriveTokens keeps derived ink/ground at or above WCAG-AA', () => {
  for (const seed of [lightSeed, darkSeed]) {
    const d = deriveTokens(seed);
    expect(contrastRatio(parseHex(d.ink)!, parseHex(d.ground)!)).toBeGreaterThanOrEqual(AA_CONTRAST);
  }
});

test('deriveTokens builds the soft accents in the token rgba style', () => {
  const d = deriveTokens(lightSeed);
  expect(d.emberSoft).toBe('rgba(198,113,57,.15)');
  expect(d.verdSoft).toBe('rgba(122,138,94,.15)');
  // and the ink-derived translucent tokens
  expect(d.line2).toBe('rgba(32,30,29,.07)');
  expect(d.chip).toBe('rgba(32,30,29,.05)');
});

test('deriveTokens is deterministic', () => {
  expect(deriveTokens(lightSeed)).toEqual(deriveTokens(lightSeed));
});

// --- property: the contrast guarantee survives derivation ------------------
// parseTheme gates ink/ground at AA; deriveTokens must never spend that margin.
// A seeded LCG (numerical-recipes constants, Math.imul for a true 32-bit product)
// drives the sweep so any failure reproduces byte-for-byte — no Math.random.
test('every random theme parseTheme accepts derives to an AA-legible palette', () => {
  let state = 0x2545f491 >>> 0; // fixed seed
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const randHex = () => '#' + Math.floor(rand() * 0x1000000).toString(16).padStart(6, '0');

  let accepted = 0;
  for (let i = 0; i < 2000; i++) {
    const theme = parseTheme({ v: 1, ground: randHex(), ink: randHex(), accent: randHex(), accent2: randHex() });
    if (!theme) continue;
    accepted++;
    const d = deriveTokens(theme);
    const ratio = contrastRatio(parseHex(d.ink)!, parseHex(d.ground)!);
    expect(ratio, `theme #${i} derived below AA: ${ratio}`).toBeGreaterThanOrEqual(AA_CONTRAST);
  }
  // Non-vacuity: a real share of the 2000 random themes must clear the boundary,
  // or the guarantee above would hold trivially over an empty set. The accent 3:1
  // gate (both accents, independently, vs a ground that already sits far from ink)
  // drops acceptance from 231 to 46 for this seed — still a substantial sample.
  // The floor sits well below 46 so incidental rounding shifts don't flake it.
  expect(accepted).toBeGreaterThan(30);
});
