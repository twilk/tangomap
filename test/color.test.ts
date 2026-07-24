import { test, expect } from 'vitest';
import {
  parseHex,
  toHex,
  mix,
  rgba,
  relativeLuminance,
  contrastRatio,
} from '@/src/lib/color';

// --- parseHex --------------------------------------------------------------

test('parseHex accepts #fff, #RRGGBB and trims whitespace', () => {
  expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0 });
  expect(parseHex('#c67139')).toEqual({ r: 198, g: 113, b: 57 });
  expect(parseHex('  #F5EAD8  ')).toEqual({ r: 245, g: 234, b: 216 });
  // #abc expands to #aabbcc
  expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
});

test('parseHex rejects malformed input by returning null', () => {
  expect(parseHex('fff')).toBeNull(); // no hash
  expect(parseHex('#ff')).toBeNull(); // wrong length
  expect(parseHex('#ffff')).toBeNull(); // wrong length
  expect(parseHex('#fffff')).toBeNull(); // wrong length
  expect(parseHex('#fffffff')).toBeNull(); // wrong length
  expect(parseHex('#gggggg')).toBeNull(); // non-hex
  expect(parseHex('#12345z')).toBeNull(); // non-hex
  expect(parseHex('rgb(0,0,0)')).toBeNull(); // not a hex string
  expect(parseHex('')).toBeNull();
});

// --- toHex -----------------------------------------------------------------

test('toHex renders lowercase #rrggbb and round-trips parseHex', () => {
  expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  expect(toHex({ r: 198, g: 113, b: 57 })).toBe('#c67139');
  // uppercase input canonicalises to lowercase output
  expect(toHex(parseHex('#F5EAD8')!)).toBe('#f5ead8');
  // round-trip
  const rt = parseHex(toHex({ r: 12, g: 200, b: 7 }));
  expect(rt).toEqual({ r: 12, g: 200, b: 7 });
});

test('toHex clamps and rounds out-of-range / fractional channels', () => {
  expect(toHex({ r: -5, g: 300, b: 127.5 })).toBe('#00ff80');
});

// --- mix -------------------------------------------------------------------

test('mix is a linear interpolation between the two colours', () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  expect(mix(black, white, 0)).toEqual(black);
  expect(mix(black, white, 1)).toEqual(white);
  expect(mix(black, white, 0.5)).toEqual({ r: 127.5, g: 127.5, b: 127.5 });
  expect(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 40 }, 0.25)).toEqual({ r: 25, g: 50, b: 10 });
});

test('mix clamps t to [0,1]', () => {
  const a = { r: 10, g: 20, b: 30 };
  const b = { r: 200, g: 100, b: 50 };
  expect(mix(a, b, -1)).toEqual(a);
  expect(mix(a, b, 2)).toEqual(b);
});

// --- rgba ------------------------------------------------------------------

test('rgba drops the leading zero on the alpha and uses no spaces', () => {
  expect(rgba({ r: 198, g: 113, b: 57 }, 0.15)).toBe('rgba(198,113,57,.15)');
  expect(rgba({ r: 32, g: 30, b: 29 }, 0.07)).toBe('rgba(32,30,29,.07)');
  expect(rgba({ r: 32, g: 30, b: 29 }, 0.05)).toBe('rgba(32,30,29,.05)');
});

// --- luminance & contrast --------------------------------------------------

test('relativeLuminance is ~1 for white and ~0 for black', () => {
  expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
});

test('contrastRatio is ~21 for black/white, symmetric, and 1 for a colour on itself', () => {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  expect(contrastRatio(black, white)).toBeCloseTo(21, 1); // symmetric
  const x = { r: 120, g: 90, b: 60 };
  expect(contrastRatio(x, x)).toBeCloseTo(1, 5);
});
