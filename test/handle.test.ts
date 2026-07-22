import { test, expect } from 'vitest';
import { isValidHandle, normalizeHandle } from '@/src/lib/handle';

test('accepts valid handles', () => {
  expect(isValidHandle('ana-tango')).toBe(true);
  expect(isValidHandle('abc')).toBe(true);
  expect(isValidHandle('a1b2c3')).toBe(true);
});

test('rejects invalid handles', () => {
  expect(isValidHandle('ab')).toBe(false);        // too short
  expect(isValidHandle('-ana')).toBe(false);       // leading hyphen
  expect(isValidHandle('ana-')).toBe(false);       // trailing hyphen
  expect(isValidHandle('Ana')).toBe(false);        // uppercase
  expect(isValidHandle('a'.repeat(31))).toBe(false); // too long
  expect(isValidHandle('has space')).toBe(false);
});

test('normalizeHandle trims and lowercases', () => {
  expect(normalizeHandle('  Ana ')).toBe('ana');
  expect(normalizeHandle('ANA-Tango')).toBe('ana-tango');
});
