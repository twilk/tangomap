// Pure colour math for the theme engine. No theme, storage or DOM knowledge —
// just RGB in, strings/numbers out. The runtime sibling of the colour helpers in
// scripts/build-design.mjs, kept deliberately small and total (never throws).

export type RGB = { r: number; g: number; b: number };

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Parse `#rgb` or `#rrggbb` (leading/trailing whitespace tolerated) into an RGB.
 *  Returns null for anything else — a non-string, no hash, wrong length, non-hex
 *  digits, or a functional form like `rgb(…)`. Takes `unknown` so a direct
 *  `as any` caller cannot break the never-throws contract on `.trim()`. */
export function parseHex(s: unknown): RGB | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  const m = HEX.exec(t);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const byte = (c: number): string =>
  Math.round(Math.max(0, Math.min(255, c)))
    .toString(16)
    .padStart(2, '0');

/** Render an RGB as a lowercase `#rrggbb`. Channels are clamped to [0,255] and
 *  rounded, so fractional results from mix() and out-of-range values are safe. */
export function toHex(rgb: RGB): string {
  return '#' + byte(rgb.r) + byte(rgb.g) + byte(rgb.b);
}

/** Linear interpolation from a (t=0) to b (t=1), per channel. t is clamped to
 *  [0,1]; channels are left fractional — toHex() does the rounding. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

/** Format an `rgba(r,g,b,a)` string in the token style: no spaces, and no leading
 *  zero on the alpha (0.15 → `.15`), matching the values in design/tokens.ts.
 *  Trust-boundary invariant: `alpha` must be a numeric literal chosen by this
 *  module (0.15/0.07/0.05) — never a value threaded in from untrusted input. */
export function rgba(rgb: RGB, alpha: number): string {
  const a = String(alpha).replace(/^0(?=\.)/, '');
  return `rgba(${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)},${a})`;
}

const linearise = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance in [0,1] (≈1 white, ≈0 black). */
export function relativeLuminance(rgb: RGB): number {
  return 0.2126 * linearise(rgb.r) + 0.7152 * linearise(rgb.g) + 0.0722 * linearise(rgb.b);
}

/** WCAG contrast ratio in [1,21]. Symmetric in its arguments. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
