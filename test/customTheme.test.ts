import { test, expect, beforeEach } from 'vitest';
import {
  customStyleText,
  customPolarity,
  applyCustomTheme,
  clearCustomTheme,
  cycleMode,
  hasCustomTheme,
  readMode,
  setMode,
  currentCustomTheme,
} from '@/src/lib/customTheme';
import { deriveTokens, type Theme } from '@/src/lib/theme';

// A legible light-ground theme (ink/ground ≥ 4.5, accents ≥ 3): white ground, black
// ink, saturated blue/green accents. Its ground reads as 'light'.
const LIGHT_THEME: Theme = { v: 1, ground: '#ffffff', ink: '#000000', accent: '#0000ff', accent2: '#008000' };
// A legible dark-ground theme: black ground, white ink, bright yellow/cyan accents.
const DARK_THEME: Theme = { v: 1, ground: '#000000', ink: '#ffffff', accent: '#ffff00', accent2: '#00ffff' };
// Illegible: ink barely differs from ground → fails the AA contrast floor in parseTheme.
const ILLEGIBLE = { v: 1, ground: '#000000', ink: '#111111', accent: '#222222', accent2: '#333333' };

const CUSTOM_KEYS = ['tsm-custom', 'tsm-custom-css', 'tsm-custom-polarity'];

function styleEl() {
  return document.getElementById('tm-custom-theme');
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  const el = styleEl();
  if (el && el.parentNode) el.parentNode.removeChild(el);
});

// --- customStyleText ---------------------------------------------------------

test('customStyleText builds the :root[data-theme="custom"] .tm-profile block with derived values', () => {
  const css = customStyleText(deriveTokens(LIGHT_THEME));
  expect(css.startsWith(':root[data-theme="custom"] .tm-profile{')).toBe(true);
  expect(css.endsWith('}')).toBe(true);
  // the ground token appears with its derived (canonicalised) value
  expect(css).toContain('--tm-ground:#ffffff');
  // declarations are ;-joined, so multiple --tm-* tokens are present
  expect(css).toContain('--tm-ink:#000000');
});

// --- customPolarity ----------------------------------------------------------

test('customPolarity maps a light ground to light and a dark ground to dark', () => {
  expect(customPolarity(LIGHT_THEME)).toBe('light');
  expect(customPolarity(DARK_THEME)).toBe('dark');
});

// --- applyCustomTheme --------------------------------------------------------

test('applyCustomTheme with a valid theme writes all 3 keys, injects the style, sets data-theme=custom, returns true', () => {
  const ok = applyCustomTheme(LIGHT_THEME);
  expect(ok).toBe(true);

  // all three custom keys are written…
  for (const k of CUSTOM_KEYS) expect(localStorage.getItem(k)).not.toBeNull();
  expect(localStorage.getItem('tsm-custom-polarity')).toBe('light');
  expect(JSON.parse(localStorage.getItem('tsm-custom')!)).toEqual(LIGHT_THEME);

  // …the <style> is injected with the palette…
  const el = styleEl();
  expect(el).not.toBeNull();
  expect(el!.textContent).toContain('--tm-ground:#ffffff');
  expect(localStorage.getItem('tsm-custom-css')).toBe(el!.textContent);

  // …and the mode is now custom.
  expect(localStorage.getItem('tsm-theme')).toBe('custom');
  expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
  expect(readMode()).toBe('custom');
  expect(hasCustomTheme()).toBe(true);
});

test('applyCustomTheme with an illegible/invalid theme returns false and writes nothing', () => {
  const ok = applyCustomTheme(ILLEGIBLE);
  expect(ok).toBe(false);
  for (const k of CUSTOM_KEYS) expect(localStorage.getItem(k)).toBeNull();
  expect(localStorage.getItem('tsm-theme')).toBeNull();
  expect(styleEl()).toBeNull();
  expect(hasCustomTheme()).toBe(false);

  // a structurally-broken input is rejected the same way
  expect(applyCustomTheme('not a theme')).toBe(false);
  expect(applyCustomTheme(null)).toBe(false);
  for (const k of CUSTOM_KEYS) expect(localStorage.getItem(k)).toBeNull();
});

// --- cycleMode ---------------------------------------------------------------

test('cycleMode with no custom theme cycles dark ↔ light and never yields custom', () => {
  setMode('dark');
  expect(cycleMode()).toBe('light'); // dark → light
  expect(cycleMode()).toBe('dark'); // light → dark (no custom configured)
  expect(cycleMode()).toBe('light');
  expect(hasCustomTheme()).toBe(false);
});

test('cycleMode with a custom theme yields dark → light → custom → dark', () => {
  applyCustomTheme(LIGHT_THEME); // configures custom (and leaves us in custom mode)
  setMode('dark'); // start from a known point
  expect(cycleMode()).toBe('light'); // dark → light
  expect(cycleMode()).toBe('custom'); // light → custom (configured)
  expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
  // moving to custom re-injects the cached <style> even if it went missing
  const el = styleEl();
  expect(el).not.toBeNull();
  expect(el!.textContent).toContain('--tm-ground:');
  expect(cycleMode()).toBe('dark'); // custom → dark
});

test('cycleMode re-injects the custom style when the element is missing', () => {
  applyCustomTheme(LIGHT_THEME);
  setMode('light');
  // simulate a fresh document / bfcache where the <style> is gone
  const el = styleEl();
  el!.parentNode!.removeChild(el!);
  expect(styleEl()).toBeNull();
  expect(cycleMode()).toBe('custom');
  const reinjected = styleEl();
  expect(reinjected).not.toBeNull();
  expect(reinjected!.textContent).toContain('--tm-ground:#ffffff');
});

// --- clearCustomTheme --------------------------------------------------------

test('clearCustomTheme removes the keys + style and drops out of custom to the polarity', () => {
  applyCustomTheme(DARK_THEME); // dark ground → polarity 'dark', mode 'custom'
  expect(readMode()).toBe('custom');
  clearCustomTheme();

  for (const k of CUSTOM_KEYS) expect(localStorage.getItem(k)).toBeNull();
  expect(styleEl()).toBeNull();
  expect(hasCustomTheme()).toBe(false);
  // fell back to the stored polarity (dark), on both storage and the DOM
  expect(readMode()).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});

test('clearCustomTheme falls back to light for a light-ground custom theme', () => {
  applyCustomTheme(LIGHT_THEME); // light ground → polarity 'light'
  clearCustomTheme();
  expect(readMode()).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

test('clearCustomTheme leaves a non-custom mode untouched', () => {
  applyCustomTheme(LIGHT_THEME);
  setMode('dark'); // not in custom right now
  clearCustomTheme();
  // keys/style gone, but the mode we were in (dark) is preserved
  expect(hasCustomTheme()).toBe(false);
  expect(readMode()).toBe('dark');
});

// --- currentCustomTheme ------------------------------------------------------

test('currentCustomTheme round-trips the stored struct and is null when absent', () => {
  expect(currentCustomTheme()).toBeNull();
  applyCustomTheme(LIGHT_THEME);
  expect(currentCustomTheme()).toEqual(LIGHT_THEME);
  clearCustomTheme();
  expect(currentCustomTheme()).toBeNull();
});
