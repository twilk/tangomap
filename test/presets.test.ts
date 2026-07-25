import { test, expect } from 'vitest';
import { PRESET_CAP, isValidPresetName, sanitizePresetName, canSavePreset, presetStyleVars } from '@/src/lib/presets';
import { deriveTokens } from '@/src/lib/theme';
import { cssVar } from '@/design/tokens';

const T = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' } as const;

test('cap is 5', () => expect(PRESET_CAP).toBe(5));

test('name validation: 2–24 visible chars, trims, rejects empty/too-long', () => {
  expect(isValidPresetName('Carmesí')).toBe(true);
  expect(isValidPresetName(' a ')).toBe(false);        // 1 visible char
  expect(isValidPresetName('x'.repeat(25))).toBe(false);
  expect(sanitizePresetName('  Neon  Nights ')).toBe('Neon Nights');
});

test('canSavePreset: false at cap, true below, false on duplicate name (case-insensitive)', () => {
  // Names must clear isValidPresetName (2–24 visible chars) — canSavePreset gates
  // on name validity first, so these use 2-char names to exercise cap/duplicate.
  const names = ['Aa', 'Bb', 'Cc', 'Dd'];
  expect(canSavePreset(names, 'Ee')).toEqual({ ok: true });
  expect(canSavePreset([...names, 'Xx'], 'Ff')).toEqual({ ok: false, reason: 'cap' });
  expect(canSavePreset(names, 'aa')).toEqual({ ok: false, reason: 'duplicate' });
  // A name that fails length validation is rejected with reason 'name'.
  expect(canSavePreset(names, 'a')).toEqual({ ok: false, reason: 'name' });
});

test('presetStyleVars maps every derived token to its --tm-* var for a self-preview', () => {
  const vars = presetStyleVars(T);
  const tokens = deriveTokens(T);
  for (const k of Object.keys(tokens)) expect(vars[cssVar(k as keyof typeof tokens)]).toBe(tokens[k as keyof typeof tokens]);
  expect(vars[cssVar('ground')]).toBe(tokens.ground);
});
