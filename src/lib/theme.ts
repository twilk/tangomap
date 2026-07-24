// The runtime theme engine: a compact user theme (four colour seeds), its
// validating trust boundary, and expansion into the full --tm-* token set. Pure —
// no storage, no DOM. The runtime sibling of the build-time generator in
// scripts/build-design.mjs.

import { parseHex, toHex, mix, rgba, relativeLuminance, contrastRatio, type RGB } from '@/src/lib/color';
import { light, dark, type ThemeTokens } from '@/design/tokens';

/** A custom theme as persisted / transmitted: a version tag and four colour seeds
 *  (all `#rrggbb`). Everything else in the palette is derived from these. */
export type Theme = { v: 1; ground: string; ink: string; accent: string; accent2: string };

/** WCAG-AA minimum contrast for body text. A theme whose ink fails this against
 *  its ground is rejected at the boundary — the app never renders illegible text. */
export const AA_CONTRAST = 4.5;

/** The single trust boundary. Turns arbitrary untrusted input (a parsed JSON blob,
 *  a query param, localStorage) into a Theme or null — never throws.
 *
 *  Rejects non-objects, arrays and null; requires all four seeds to be hex strings;
 *  canonicalises each to lowercase `#rrggbb`; drops every other key; and rejects a
 *  theme whose ink/ground contrast is below WCAG-AA. */
export function parseTheme(input: unknown): Theme | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;

  const seed = (k: string): RGB | null => (typeof o[k] === 'string' ? parseHex(o[k] as string) : null);
  const ground = seed('ground');
  const ink = seed('ink');
  const accent = seed('accent');
  const accent2 = seed('accent2');
  if (!ground || !ink || !accent || !accent2) return null;

  if (contrastRatio(ink, ground) < AA_CONTRAST) return null;

  return {
    v: 1,
    ground: toHex(ground),
    ink: toHex(ink),
    accent: toHex(accent),
    accent2: toHex(accent2),
  };
}

/** The full --tm-* palette a Theme expands to — the same 17 keys the build-time
 *  generator emits, so a token added to the source fails the exhaustiveness check
 *  here until derivation covers it. */
export type DerivedTokens = Record<keyof ThemeTokens, string>;

const toHexMix = (a: RGB, b: RGB, t: number): string => toHex(mix(a, b, t));

/** Expand four seeds into the full token set. The nearest built-in preset (by
 *  ground luminance) supplies the tokens a user does not choose — carmine, focus,
 *  hi and the elevation shadow — while the seeds drive ground/ink/ember/verd and
 *  the panels, text tints and hairlines derived from them. Pure and deterministic. */
export function deriveTokens(theme: Theme): DerivedTokens {
  const ground = parseHex(theme.ground)!;
  const ink = parseHex(theme.ink)!;
  const accent = parseHex(theme.accent)!;
  const accent2 = parseHex(theme.accent2)!;

  const base = relativeLuminance(ground) < 0.5 ? dark : light;

  return {
    ...base,
    ground: theme.ground,
    ink: theme.ink,
    ember: theme.accent,
    verd: theme.accent2,
    panel: toHexMix(ground, ink, 0.04),
    panel2: toHexMix(ground, ink, 0.08),
    muted: toHexMix(ink, ground, 0.4),
    faint: toHexMix(ink, ground, 0.6),
    line: toHexMix(ground, ink, 0.15),
    line2: rgba(ink, 0.07),
    chip: rgba(ink, 0.05),
    emberSoft: rgba(accent, 0.15),
    verdSoft: rgba(accent2, 0.15),
  };
}
