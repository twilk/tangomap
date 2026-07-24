# Custom Theme Engine — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, tested core of the custom-theme system: a small user-editable `Theme` struct, a `deriveTokens()` that expands it into the full 17-token `--tm-*` palette, and a `parseTheme()` validator that guarantees any accepted theme is safe and legible.

**Architecture:** Users pick ~4 seed colours (`ground`, `ink`, `accent`, `accent2`); the engine derives the remaining tokens by colour math and takes the semantic/structural tokens (`carmine`, `focus`, `elev`, `hi`) from the nearest built-in preset (`light`/`dark` from `design/tokens.ts`, chosen by the ground's luminance). Validation runs at every trust boundary and enforces WCAG-AA contrast between `ink` and `ground`, so a stored or shared theme can never render the app unreadable and can never carry anything but validated colours. This is the runtime sibling of the build-time generator that just shipped.

**Tech Stack:** TypeScript, vitest 2 (jsdom), no new dependencies (colour math is ~40 lines).

---

## Scope

This is **step 1 of 6** in the theme-system roadmap. It deliberately ships **no UI, no storage, no injection** — only pure functions in `src/lib/`. Later plans cover: runtime injection + no-flash + the 3-state toggle (step 2), storage/sync (step 3), the Settings editor (step 4), card/OG integration (step 5), sharing (step 6).

It settles the two decisions that are most expensive to reverse once three surfaces consume them:
- **the `Theme` struct shape** (4 colour seeds, versioned, closed), and
- **the derivation + contrast contract** (any `parseTheme` output derives to an AA-legible palette).

Out of scope here and noted for a later plan: the optional `radius`/`font` seeds (trivial enum→scale lookups, no derivation risk), and the map bundle's `--t-*` bridge.

## Why these functions, in this order

`deriveTokens()` is the runtime counterpart of `scripts/build-design.mjs`: the generator turns the hand-edited source into 17 tokens at build time; this turns a user's 4 seeds into 17 tokens at runtime. Both feed the same `--tm-*` contract, so the app chrome, the canvas card, and the OG image can all call `deriveTokens()` and paint identically. Colour math comes first (Task 1) because both `parseTheme` (contrast check) and `deriveTokens` (mixing) depend on it.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/color.ts` (create) | Pure colour math: parse hex → rgb, canonical hex, linear mix, `rgba()` string, WCAG relative luminance and contrast ratio. No theme knowledge. |
| `src/lib/theme.ts` (create) | The `Theme` type, `DerivedTokens` type, `parseTheme(input): Theme \| null`, `deriveTokens(theme): DerivedTokens`. Imports `light`/`dark`/`ThemeTokens` from `design/tokens.ts` and the helpers from `color.ts`. |
| `test/color.test.ts` (create) | Unit tests for the colour math against known values. |
| `test/theme.test.ts` (create) | Validation, derivation, and the contrast-guarantee property test. |

---

### Task 1: Colour math (`src/lib/color.ts`)

**Files:** Create `src/lib/color.ts`, create `test/color.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/color.test.ts`:
```ts
import { test, expect } from 'vitest';
import { parseHex, toHex, mix, rgba, relativeLuminance, contrastRatio } from '@/src/lib/color';

test('parseHex accepts #rgb and #rrggbb, case-insensitively, rejects junk', () => {
  expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  expect(parseHex('#C67139')).toEqual({ r: 198, g: 113, b: 57 });
  expect(parseHex('  #c67139  ')).toEqual({ r: 198, g: 113, b: 57 });
  expect(parseHex('c67139')).toBeNull();      // no hash
  expect(parseHex('#12345')).toBeNull();      // wrong length
  expect(parseHex('#gggggg')).toBeNull();     // non-hex
  expect(parseHex('rgb(1,2,3)')).toBeNull();  // seeds are hex only
});

test('toHex round-trips and is lowercase 6-digit', () => {
  expect(toHex({ r: 198, g: 113, b: 57 })).toBe('#c67139');
  expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
});

test('mix is linear and clamps t', () => {
  const a = { r: 0, g: 0, b: 0 }, b = { r: 255, g: 255, b: 255 };
  expect(mix(a, b, 0)).toEqual(a);
  expect(mix(a, b, 1)).toEqual(b);
  expect(mix(a, b, 0.5)).toEqual({ r: 128, g: 128, b: 128 }); // rounds
});

test('rgba matches the existing token string format (no leading zero)', () => {
  expect(rgba({ r: 198, g: 113, b: 57 }, 0.15)).toBe('rgba(198,113,57,.15)');
  expect(rgba({ r: 32, g: 30, b: 29 }, 0.05)).toBe('rgba(32,30,29,.05)');
});

test('relativeLuminance matches WCAG reference points', () => {
  expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
});

test('contrastRatio is symmetric and hits known values', () => {
  const white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
  expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
  expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run test/color.test.ts`
Expected: FAIL — cannot resolve `@/src/lib/color`.

- [ ] **Step 3: Implement `src/lib/color.ts`**

```ts
// Pure colour math for the theme engine. No theme or DOM knowledge.
export type RGB = { r: number; g: number; b: number };

export function parseHex(input: string): RGB | null {
  const s = String(input).trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const hx = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const toHex = ({ r, g, b }: RGB): string => `#${hx(r)}${hx(g)}${hx(b)}`;

export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.max(0, Math.min(1, t));
  return { r: Math.round(a.r + (b.r - a.r) * k), g: Math.round(a.g + (b.g - a.g) * k), b: Math.round(a.b + (b.b - a.b) * k) };
}

// Matches the existing token string style: no space, no leading zero on the alpha.
export const rgba = ({ r, g, b }: RGB, alpha: number): string =>
  `rgba(${r},${g},${b},${String(alpha).replace(/^0(?=\.)/, '')})`;

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
export const relativeLuminance = ({ r, g, b }: RGB): number =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Run to green**

Run: `npx vitest run test/color.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/color.ts test/color.test.ts
git commit -m "feat(theme): pure colour math for the theme engine"
```

---

### Task 2: The `Theme` type and `parseTheme` validator (`src/lib/theme.ts`)

**Files:** Create `src/lib/theme.ts`, create `test/theme.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/theme.test.ts`:
```ts
import { test, expect } from 'vitest';
import { parseTheme, AA_CONTRAST } from '@/src/lib/theme';

const good = { v: 1, ground: '#f5ead8', ink: '#201e1d', accent: '#c67139', accent2: '#7a8a5e' };

test('parseTheme accepts a valid theme and canonicalises its colours', () => {
  const t = parseTheme({ ...good, ground: '#F5EAD8' });
  expect(t).not.toBeNull();
  expect(t!.ground).toBe('#f5ead8'); // lowercased canonical
  expect(t!.v).toBe(1);
});

test('parseTheme drops unknown keys and ignores extra input', () => {
  const t = parseTheme({ ...good, evil: 'url(x)', script: '</style>' });
  expect(t).not.toBeNull();
  expect(Object.keys(t!).sort()).toEqual(['accent', 'accent2', 'ground', 'ink', 'v']);
});

test('parseTheme rejects a missing or non-hex seed', () => {
  expect(parseTheme({ ...good, accent: undefined })).toBeNull();
  expect(parseTheme({ ...good, accent: 'red' })).toBeNull();
  expect(parseTheme({ ...good, ground: 'rgb(1,2,3)' })).toBeNull();
  expect(parseTheme(null)).toBeNull();
  expect(parseTheme('#fff')).toBeNull();
});

test('parseTheme rejects an ink/ground pair below AA contrast', () => {
  // pale ink on pale ground — unreadable
  expect(parseTheme({ ...good, ink: '#e8e0d0' })).toBeNull();
});

test('parseTheme accepts a legible dark theme too', () => {
  expect(parseTheme({ v: 1, ground: '#110d09', ink: '#f2eadc', accent: '#e58c44', accent2: '#a8ba8a' })).not.toBeNull();
});

test('AA_CONTRAST is the WCAG normal-text threshold', () => {
  expect(AA_CONTRAST).toBe(4.5);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run test/theme.test.ts`
Expected: FAIL — cannot resolve `@/src/lib/theme`.

- [ ] **Step 3: Implement the type + validator in `src/lib/theme.ts`**

```ts
import { parseHex, toHex, contrastRatio } from '@/src/lib/color';

/** The user-editable custom theme: four colour seeds, versioned and closed.
 *  Everything else is derived (deriveTokens). Kept deliberately small so the
 *  editor is 4 pickers, the validation surface is tiny, and a shared theme can
 *  carry nothing but four validated colours. */
export type Theme = {
  v: 1;
  ground: string; // page background
  ink: string;    // body text — must contrast the ground
  accent: string; // primary accent (the ember role)
  accent2: string; // secondary accent (the verd role)
};

/** WCAG AA for normal-size body text. */
export const AA_CONTRAST = 4.5;

const SEEDS = ['ground', 'ink', 'accent', 'accent2'] as const;

/** The single trust boundary. Runs on API write, on the no-flash read, and
 *  before applying a shared theme. Returns a canonicalised Theme or null —
 *  never throws, never trusts input shape, never emits an illegible theme. */
export function parseTheme(input: unknown): Theme | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const out = { v: 1 } as Theme;
  for (const k of SEEDS) {
    const rgb = typeof o[k] === 'string' ? parseHex(o[k] as string) : null;
    if (!rgb) return null;
    (out as Record<string, string>)[k] = toHex(rgb); // canonical lowercase #rrggbb
  }
  const ink = parseHex(out.ink)!;
  const ground = parseHex(out.ground)!;
  if (contrastRatio(ink, ground) < AA_CONTRAST) return null;
  return out;
}
```

- [ ] **Step 4: Run to green**

Run: `npx vitest run test/theme.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/theme.ts test/theme.test.ts
git commit -m "feat(theme): the Theme struct and the parseTheme trust boundary"
```

---

### Task 3: `deriveTokens` — expand 4 seeds into 17 tokens

**Files:** Modify `src/lib/theme.ts`, modify `test/theme.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `test/theme.test.ts`:
```ts
import { deriveTokens } from '@/src/lib/theme';
import { light, dark, type ThemeTokens } from '@/design/tokens';
import { parseHex, contrastRatio } from '@/src/lib/color';

const KEYS = Object.keys(light) as (keyof ThemeTokens)[];

test('deriveTokens returns every one of the 17 token keys', () => {
  const d = deriveTokens(parseTheme(good)!);
  expect(Object.keys(d).sort()).toEqual([...KEYS].sort());
});

test('the four seeds land on their tokens verbatim', () => {
  const d = deriveTokens(parseTheme(good)!);
  expect(d.ground).toBe('#f5ead8');
  expect(d.ink).toBe('#201e1d');
  expect(d.ember).toBe('#c67139');   // accent → ember role
  expect(d.verd).toBe('#7a8a5e');    // accent2 → verd role
});

test('semantic + structural tokens come from the nearest preset', () => {
  const lightD = deriveTokens(parseTheme(good)!);
  expect(lightD.carmine).toBe(light.carmine); // danger colour is not user-tunable
  expect(lightD.elev).toBe(light.elev);       // shadow from the light preset
  const darkD = deriveTokens(parseTheme({ v: 1, ground: '#110d09', ink: '#f2eadc', accent: '#e58c44', accent2: '#a8ba8a' })!);
  expect(darkD.carmine).toBe(dark.carmine);   // dark ground → dark preset
  expect(darkD.elev).toBe(dark.elev);
});

test('derivation preserves ink/ground legibility (already guaranteed by parseTheme)', () => {
  const d = deriveTokens(parseTheme(good)!);
  expect(contrastRatio(parseHex(d.ink)!, parseHex(d.ground)!)).toBeGreaterThanOrEqual(4.5);
});

test('soft/alpha tokens are rgba strings derived from their accent', () => {
  const d = deriveTokens(parseTheme(good)!);
  expect(d.emberSoft).toMatch(/^rgba\(198,113,57,\.15\)$/); // accent at 15%
  expect(d.verdSoft).toMatch(/^rgba\(122,138,94,\.15\)$/);
});

test('deriveTokens is deterministic', () => {
  const t = parseTheme(good)!;
  expect(deriveTokens(t)).toEqual(deriveTokens(t));
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run test/theme.test.ts`
Expected: FAIL — `deriveTokens` not exported.

- [ ] **Step 3: Implement `deriveTokens` in `src/lib/theme.ts`**

Add these imports/exports. The derivation rules are the initial tuning — they are intentionally simple and documented, and are cheap to change later (they don't alter the contract). What is fixed is: the four seeds land verbatim, the semantic/structural tokens come from the nearest preset, and the ink/ground contrast that `parseTheme` guaranteed is preserved (ground and ink pass through untouched).

```ts
import { mix, rgba, parseHex, relativeLuminance } from '@/src/lib/color';
import { light, dark, type ThemeTokens } from '@/design/tokens';

export type DerivedTokens = Record<keyof ThemeTokens, string>;

/** Ground luminance below this reads as a dark theme, so the semantic/structural
 *  tokens come from the dark preset. Tunable; 0.5 is a neutral midpoint. */
const DARK_GROUND_LUMINANCE = 0.5;

export function deriveTokens(theme: Theme): DerivedTokens {
  const ground = parseHex(theme.ground)!;
  const ink = parseHex(theme.ink)!;
  const accent = parseHex(theme.accent)!;
  const accent2 = parseHex(theme.accent2)!;
  const base = relativeLuminance(ground) < DARK_GROUND_LUMINANCE ? dark : light;

  // Panels step ground toward ink (a subtle raised surface, correct direction on
  // light OR dark ground because ink always contrasts the ground). Neutrals step
  // ink toward ground. Lines and chips are low-alpha ink.
  return {
    ...base,                               // carmine, focus, elev, hi from the preset
    ground: theme.ground,
    panel: toHexMix(ground, ink, 0.04),
    panel2: toHexMix(ground, ink, 0.08),
    ink: theme.ink,
    muted: toHexMix(ink, ground, 0.4),
    faint: toHexMix(ink, ground, 0.6),
    line: toHexMix(ground, ink, 0.15),
    line2: rgba(ink, 0.07),
    ember: theme.accent,
    emberSoft: rgba(accent, 0.15),
    verd: theme.accent2,
    verdSoft: rgba(accent2, 0.15),
    chip: rgba(ink, 0.05),
  };
}

// local helper — mix then stringify to canonical hex
function toHexMix(a: ReturnType<typeof parseHex>, b: ReturnType<typeof parseHex>, t: number): string {
  return require('@/src/lib/color').toHex(mix(a!, b!, t));
}
```
NOTE: do not use `require` in the final code (this is ESM) — import `toHex` at the top alongside the other `color` imports and call it directly. The `toHexMix` inline is shown only to make the intent explicit; implement it with a top-level `import { toHex } from '@/src/lib/color'` and `const toHexMix = (a, b, t) => toHex(mix(a, b, t))`.

- [ ] **Step 4: Run to green**

Run: `npx vitest run test/theme.test.ts && npx tsc --noEmit`
Expected: PASS, clean. If a soft-token format assertion fails, align `rgba()`'s output to the existing token style (`rgba(r,g,b,.15)`), don't loosen the test.

- [ ] **Step 5: Commit**
```bash
git add src/lib/theme.ts test/theme.test.ts
git commit -m "feat(theme): deriveTokens expands four seeds into the full palette"
```

---

### Task 4: The contrast-guarantee property test

The whole safety claim is "any theme that passes `parseTheme` derives to a legible palette." Task 2 checks it for a couple of cases; this pins it as a property over many random inputs, so a future change to `parseTheme` or `deriveTokens` that breaks the guarantee fails loudly.

**Files:** Modify `test/theme.test.ts`

- [ ] **Step 1: Write the test**

Append:
```ts
test('property: every parseTheme-accepted theme derives to AA-legible ink-on-ground', () => {
  // deterministic pseudo-random sweep (no Math.random — reproducible failures)
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const hex = () => '#' + Array.from({ length: 6 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
  let accepted = 0;
  for (let i = 0; i < 2000; i++) {
    const t = parseTheme({ v: 1, ground: hex(), ink: hex(), accent: hex(), accent2: hex() });
    if (!t) continue;
    accepted++;
    const d = deriveTokens(t);
    expect(contrastRatio(parseHex(d.ink)!, parseHex(d.ground)!)).toBeGreaterThanOrEqual(4.5);
  }
  expect(accepted).toBeGreaterThan(100); // the validator isn't rejecting everything
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run test/theme.test.ts`
Expected: PASS — every accepted theme is legible, and a healthy fraction (>100/2000) is accepted so the guarantee isn't vacuous.

- [ ] **Step 3: Full suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green (the existing 120 tests plus the new ones).

- [ ] **Step 4: Commit**
```bash
git add test/theme.test.ts
git commit -m "test(theme): property-test the contrast guarantee over random themes"
```

---

## Self-Review

**Spec coverage.** The foundation asked for: the `Theme` struct (Task 2), `deriveTokens` producing all 17 tokens (Task 3), `parseTheme` validating at the trust boundary with AA contrast (Task 2), and the guarantee that accepted themes are legible (Task 4). The two expensive decisions are locked: the struct is four versioned closed seeds; the derivation contract is "seeds verbatim + preset for semantic/structural + preserved ink/ground contrast." Colour math (Task 1) underpins both. Covered.

**Placeholder scan.** No TBDs. Every step has complete code and an explicit expected result. The one hazard — the `require` shown in Task 3 Step 3 — is called out in a NOTE with the correct ESM form, because an engineer reading tasks out of order must not copy the `require`.

**Type consistency.** `Theme`, `DerivedTokens`, `parseTheme`, `deriveTokens`, `AA_CONTRAST` keep their names across Tasks 2–4. `DerivedTokens = Record<keyof ThemeTokens, string>` reuses the real token type from `design/tokens.ts`, so a token added to the source makes Task 3's exhaustiveness test fail until derivation covers it — the same drift guard the generator uses. `rgba`/`toHex`/`mix`/`parseHex`/`contrastRatio`/`relativeLuminance` signatures are fixed in Task 1 and consumed unchanged.

**Known tuning vs contract.** The mix ratios (0.04/0.08/0.4/0.6/0.15) and `DARK_GROUND_LUMINANCE` are tuning — a later step may adjust them against the live preview, and no test hard-codes a derived neutral's exact hex (only the seeds, the preset passthroughs, and the soft-token format), so tuning won't churn the suite. The contract — seeds verbatim, preset for semantic tokens, contrast preserved — is what the tests pin.
