'use client';

// The client-side custom-theme runtime: persistence, no-flash <style> injection,
// and the three-state mode cycle (dark → light → custom). The pure engine lives in
// src/lib/theme.ts (parseTheme / deriveTokens); this module is the thin, browser-
// facing shell that talks to localStorage and the DOM. Every storage/document
// access is wrapped in try/catch so private mode, disabled storage or an SSR import
// can never throw — the theme simply falls back to the built-in light/dark pair.

import { parseTheme, deriveTokens, type Theme, type DerivedTokens } from '@/src/lib/theme';
import { cssVar, type ThemeTokens } from '@/design/tokens';
import { parseHex, relativeLuminance } from '@/src/lib/color';

/** The three themes the one shared toggle cycles through. `custom` is only reachable
 *  once a custom theme has been configured (see hasCustomTheme). */
export type Mode = 'light' | 'dark' | 'custom';

/** localStorage keys — the shared contract with the no-flash script in app/layout.tsx
 *  and public/theme-sync.js. Do not rename without updating both. */
const KEY_THEME = 'tsm-theme';
const KEY_CUSTOM = 'tsm-custom';
const KEY_CSS = 'tsm-custom-css';
const KEY_POLARITY = 'tsm-custom-polarity';

/** The single <style> element the custom palette lives in, injected into <head>. */
const STYLE_ID = 'tm-custom-theme';

// --- storage/DOM helpers, each total (never throws) --------------------------

function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage disabled — the theme still applies for this page */
  }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Create-or-update the single <style id="tm-custom-theme"> in <head>, setting its
 *  textContent to `css`. Synchronous, so a caller running before first paint gets
 *  the palette applied with no flash. */
function injectStyle(css: string): void {
  try {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  } catch {
    /* no document (SSR) or no head yet — nothing to inject into */
  }
}

function removeStyle(): void {
  try {
    const el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch {
    /* ignore */
  }
}

// --- public API --------------------------------------------------------------

/** Serialise a derived palette into the exact CSS block the no-flash script injects:
 *  `:root[data-theme="custom"] .tm-profile{--tm-…:…;…}`. Iterates every key of the
 *  derived token set, so a new source token is covered automatically. */
export function customStyleText(tokens: DerivedTokens): string {
  const decls = (Object.keys(tokens) as (keyof ThemeTokens)[])
    .map((k) => `${cssVar(k)}:${tokens[k]}`)
    .join(';');
  return `:root[data-theme="custom"] .tm-profile{${decls}}`;
}

/** Whether the custom theme's ground reads as a dark or a light surface — drives the
 *  map fallback (which can't render custom) and the theme-color meta. */
export function customPolarity(theme: Theme): 'light' | 'dark' {
  return relativeLuminance(parseHex(theme.ground)!) < 0.5 ? 'dark' : 'light';
}

/** True once a custom theme has been configured (its pre-built CSS is cached). */
export function hasCustomTheme(): boolean {
  return getItem(KEY_CSS) != null;
}

/** The persisted mode. Only 'dark' and 'custom' are stored explicitly; anything else
 *  (absent, unknown, legacy) means light. */
export function readMode(): Mode {
  const t = getItem(KEY_THEME);
  return t === 'dark' || t === 'custom' ? t : 'light';
}

/** Persist the mode and reflect it onto <html data-theme>. */
export function setMode(m: Mode): void {
  setItem(KEY_THEME, m);
  try {
    document.documentElement.setAttribute('data-theme', m);
  } catch {
    /* no document (SSR) */
  }
}

/** Validate untrusted input into a Theme, then make it the active custom theme:
 *  cache the struct, its pre-built CSS and its polarity, inject the <style>, and
 *  switch to custom mode. Returns false (writing nothing) if the input is not a
 *  legible theme. */
export function applyCustomTheme(input: unknown): boolean {
  const theme = parseTheme(input);
  if (!theme) return false;
  const css = customStyleText(deriveTokens(theme));
  setItem(KEY_CUSTOM, JSON.stringify(theme));
  setItem(KEY_CSS, css);
  setItem(KEY_POLARITY, customPolarity(theme));
  injectStyle(css);
  setMode('custom');
  return true;
}

/** Forget the custom theme entirely: drop the three cached keys and the <style>, and
 *  if we were in custom mode, fall back to the polarity the custom ground implied. */
export function clearCustomTheme(): void {
  const polarity = getItem(KEY_POLARITY) === 'dark' ? 'dark' : 'light';
  const wasCustom = readMode() === 'custom';
  removeItem(KEY_CUSTOM);
  removeItem(KEY_CSS);
  removeItem(KEY_POLARITY);
  removeStyle();
  if (wasCustom) setMode(polarity);
}

/** Advance the one shared toggle one step: dark → light → (custom, if configured) →
 *  dark. Moving TO custom re-injects the cached <style> in case it went missing
 *  (bfcache, a fresh document). Persists and returns the new mode. */
export function cycleMode(): Mode {
  const cur = readMode();
  let next: Mode;
  if (cur === 'dark') next = 'light';
  else if (cur === 'custom') next = 'dark';
  else next = hasCustomTheme() ? 'custom' : 'dark';

  if (next === 'custom') {
    const css = getItem(KEY_CSS);
    if (css) injectStyle(css);
  }
  setMode(next);
  return next;
}

/** The persisted custom theme struct, or null if none is stored or it no longer
 *  parses (future editor). */
export function currentCustomTheme(): Theme | null {
  const raw = getItem(KEY_CUSTOM);
  if (raw == null) return null;
  try {
    return parseTheme(JSON.parse(raw));
  } catch {
    return null;
  }
}
