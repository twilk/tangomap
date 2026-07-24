// The runtime theme engine: a compact user theme (four colour seeds), its
// validating trust boundary, and expansion into the full --tm-* token set. Pure —
// no storage, no DOM. The runtime sibling of the build-time generator in
// scripts/build-design.mjs.

import { parseHex, toHex, mix, rgba, relativeLuminance, contrastRatio, type RGB } from '@/src/lib/color';
import { light, dark, type ThemeTokens } from '@/design/tokens';

/** A custom theme as persisted / transmitted: a version tag and four colour seeds
 *  (all `#rrggbb`). Everything else in the palette is derived from these. */
export type Theme = { v: 1; ground: string; ink: string; accent: string; accent2: string };

/** WCAG-AA minimum contrast for body text (ink and derived `muted`). */
export const AA_CONTRAST = 4.5;

/** WCAG minimum contrast for UI components / large text — the floor the two accent
 *  seeds (links, fills, chips) must clear against the ground to be visible. */
export const AA_UI_CONTRAST = 3;

/** The single trust boundary. Turns arbitrary untrusted input (a parsed JSON blob,
 *  a query param, localStorage) into a Theme or null — never throws.
 *
 *  The legibility contract a returned Theme guarantees (with deriveTokens):
 *    • ink vs ground ≥ 4.5  (body text; enforced here)
 *    • derived muted vs ground ≥ 4.5  (secondary text; deriveTokens self-corrects)
 *    • accent & accent2 vs ground ≥ 3  (UI/links; enforced here — seeds can't self-correct)
 *    • faint is intentionally decorative (tertiary, sub-AA by design, like the presets)
 *
 *  Also: rejects non-objects, arrays and null; rejects a version tag other than 1;
 *  requires all four seeds to be hex strings; canonicalises each to lowercase
 *  `#rrggbb`; and drops every other key. */
export function parseTheme(input: unknown): Theme | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;

  // A future v2 must be distinguishable, not silently read as v1.
  if (o.v !== undefined && o.v !== 1) return null;

  const ground = parseHex(o.ground);
  const ink = parseHex(o.ink);
  const accent = parseHex(o.accent);
  const accent2 = parseHex(o.accent2);
  if (!ground || !ink || !accent || !accent2) return null;

  if (contrastRatio(ink, ground) < AA_CONTRAST) return null;
  if (contrastRatio(accent, ground) < AA_UI_CONTRAST) return null;
  if (contrastRatio(accent2, ground) < AA_UI_CONTRAST) return null;

  return {
    v: 1,
    ground: toHex(ground),
    ink: toHex(ink),
    accent: toHex(accent),
    accent2: toHex(accent2),
  };
}

/** The full --tm-* palette a Theme expands to — the same 17 keys the source
 *  ThemeTokens declares. deriveTokens lists every key explicitly (never spreads a
 *  preset), so adding an 18th source token is a compile error here until derivation
 *  covers it — the exhaustiveness is real, not inherited. */
export type DerivedTokens = Record<keyof ThemeTokens, string>;

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const toHexMix = (a: RGB, b: RGB, t: number): string => toHex(mix(a, b, t));
const round = (c: RGB): RGB => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) });

/** The strongest shift of `muted` toward the ground (largest t ≤ 0.4) that still
 *  clears AA against the ground — found by binary search, evaluated on the ROUNDED
 *  colour that toHex actually emits so the guarantee survives serialisation. For an
 *  accepted theme ink/ground ≥ 4.5, so t = 0 (muted = ink) always passes; the search
 *  only ever tightens the desaturation from that safe floor. */
function mutedShift(ink: RGB, ground: RGB): number {
  let lo = 0;
  let hi = 0.4;
  let best = 0;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(round(mix(ink, ground, mid)), ground) >= AA_CONTRAST) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

/** Expand four seeds into the full token set. The nearest built-in preset (by
 *  ground luminance) supplies ONLY the four tokens a user does not choose — hi,
 *  carmine, focus and the elevation shadow, spread by name below. The seeds drive
 *  ground/ink/ember/verd; panels are raised toward white (lighter than ground, as
 *  in the presets); text tints and hairlines derive from ink and ground. `muted`
 *  carries a real AA floor; `faint` stays decorative (sub-AA by design). Pure and
 *  deterministic.
 *
 *  NOTE (M3): the preset pick is a hard split at luminance 0.5, so the four borrowed
 *  tokens jump discontinuously across it — a known edge, accepted, not smoothed here.
 *  NOTE (M5): the seeds are parsed here as well as in parseTheme; that second read is
 *  deliberate — it keeps deriveTokens callable on any Theme, not just parseTheme's
 *  output. `parseHex` is total, so the non-null assertions never fire in practice. */
export function deriveTokens(theme: Theme): DerivedTokens {
  const ground = parseHex(theme.ground)!;
  const ink = parseHex(theme.ink)!;
  const accent = parseHex(theme.accent)!;
  const accent2 = parseHex(theme.accent2)!;

  const base = relativeLuminance(ground) < 0.5 ? dark : light;

  return {
    // borrowed from the nearest preset — by name, never `...base`, so a new source
    // token cannot silently inherit a preset value instead of being derived:
    hi: base.hi,
    carmine: base.carmine,
    focus: base.focus,
    elev: base.elev,
    // seeds, re-serialised via toHex so derivation is total & idempotent even when a
    // caller hands over a non-canonical `x as Theme`:
    ground: toHex(ground),
    ink: toHex(ink),
    ember: toHex(accent),
    verd: toHex(accent2),
    // panels raised toward white (lighter than ground), matching the preset model:
    panel: toHexMix(ground, WHITE, 0.07),
    panel2: toHexMix(ground, WHITE, 0.14),
    // secondary text with a guaranteed AA floor; tertiary text stays decorative:
    muted: toHexMix(ink, ground, mutedShift(ink, ground)),
    faint: toHexMix(ink, ground, 0.6),
    line: toHexMix(ground, ink, 0.15),
    line2: rgba(ink, 0.07),
    chip: rgba(ink, 0.05),
    emberSoft: rgba(accent, 0.15),
    verdSoft: rgba(accent2, 0.15),
  };
}
