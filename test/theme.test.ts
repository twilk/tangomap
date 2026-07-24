import { test, expect } from 'vitest';
import { parseTheme, AA_CONTRAST, type Theme } from '@/src/lib/theme';

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

// Type-level sanity: a parsed theme is assignable to Theme.
test('a parsed theme satisfies the Theme type', () => {
  const out = parseTheme(validLight);
  const t: Theme | null = out;
  expect(t).not.toBeNull();
});
