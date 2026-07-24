# Design Token Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one machine-readable file the single source of truth for every design token, and generate the CSS, the JS export, and the human-readable doc from it — so a token can never again drift from the values the app actually paints.

**Architecture:** `design/tokens.ts` holds typed token objects for the light theme, the dark theme, and the always-dark card palette. `scripts/build-design.mjs` reads it and writes three generated artifacts: a CSS file of custom properties, a TS file of raw values for canvas/OG rendering (where CSS variables do not exist), and `DESIGN.md`. A vitest suite regenerates in memory and fails if any on-disk artifact is stale, which is what actually prevents drift. This refactor is value-preserving: every generated value is byte-identical to what `app/tango.css` declares today, so nothing changes visually.

**Tech Stack:** TypeScript, Node 22 ESM (`.mjs` scripts, matching `scripts/inject-runtime-scripts.mjs`), vitest 2 with jsdom, Next.js 15 App Router.

---

## Scope

This is **Refactor 1 of 4**. It deliberately does **not**:
- rename any CSS class (that is Refactor 2b — the migration option is still unchosen),
- replace any of the 164 hardcoded colour literals (Refactor 2a),
- add user themes or a settings editor (Refactors 3 and 4).

It only creates the source, the generator, the drift guard, and wires the generated CSS in behind the existing declarations. Each of the other refactors gets its own plan.

## Why this shape

The inventory found 19 token definitions (all in `app/tango.css`) but **164 colour literals outside them**, plus 83 `border-radius` literals across 16 distinct values. It also found live proof of drift: `app/tango.css:479` still paints the dancer card with `rgba(97,171,149,.13)` — the old teal `#61AB95` — even though `--tm-verd` was changed to sage. A source file alone would not have caught that. The **generated-artifact-is-stale test** is the part that does.

## File Structure

| File | Responsibility |
|---|---|
| `design/tokens.ts` (create) | The only hand-edited source. Typed token objects: `light`, `dark`, `card`, `radii`, `fonts`. Exports types so consumers are checked. |
| `scripts/build-design.mjs` (create) | Pure generator. Reads the source, writes the three artifacts. `--check` mode writes nothing and exits non-zero when stale. |
| `src/styles/generated/tokens.css` (generated) | `:root`-level custom properties for light and dark. Imported by `app/layout.tsx`. |
| `src/lib/generated/tokens.ts` (generated) | Raw values for canvas/OG renderers and injected map scripts. |
| `DESIGN.md` (generated) | Human-readable reference in the style of the attached example. |
| `test/designTokens.test.ts` (create) | Two guards: artifacts are not stale, and generated values still equal what `app/tango.css` declares. |

Generated files carry a `DO NOT EDIT` banner and are committed (so the app builds without a prebuild step, and so the diff is reviewable).

---

### Task 1: The token source

**Files:**
- Create: `design/tokens.ts`

- [ ] **Step 1: Write the source file**

Values are copied verbatim from `app/tango.css:13-41`. Do not "tidy" any of them — hex casing and `.045` style decimals must survive, because Task 3 compares them literally.

```ts
// The ONLY hand-edited design source. Everything under src/styles/generated,
// src/lib/generated and DESIGN.md is produced from this by scripts/build-design.mjs.
// Run `node scripts/build-design.mjs` after any change; CI fails if you forget.

export type ThemeTokens = {
  ground: string; panel: string; panel2: string; hi: string;
  ink: string; muted: string; faint: string;
  line: string; line2: string;
  ember: string; emberSoft: string;
  verd: string; verdSoft: string;
  carmine: string; chip: string;
  focus: string;
  elev: string;
};

/** Light "practica" — matched to the map bundle's own palette so the app and the
 *  map read as one continuous product. */
export const light: ThemeTokens = {
  ground: '#f5ead8', panel: '#f9f4ed', panel2: '#fdfbf5', hi: 'rgba(255,255,255,.6)',
  ink: '#201e1d', muted: '#645c50', faint: '#968b79',
  line: '#dcd3c4', line2: 'rgba(32,30,29,.07)',
  ember: '#c67139', emberSoft: 'rgba(198,113,57,.15)',
  verd: '#7a8a5e', verdSoft: 'rgba(122,138,94,.15)',
  carmine: '#A6172E', chip: 'rgba(32,30,29,.05)',
  focus: '#3F5BB0',
  elev: '0 1px 0 var(--tm-hi),0 2px 6px -2px rgba(32,30,29,.1),0 26px 52px -32px rgba(32,30,29,.45)',
};

export const dark: ThemeTokens = {
  ground: '#110D09', panel: '#1A1510', panel2: '#221B14', hi: 'rgba(241,233,220,.045)',
  ink: '#F2EADC', muted: '#9E907E', faint: '#6C5F50',
  line: 'rgba(241,233,220,.11)', line2: 'rgba(241,233,220,.05)',
  ember: '#E58C44', emberSoft: 'rgba(229,140,68,.14)',
  verd: '#A8BA8A', verdSoft: 'rgba(168,186,138,.15)',
  carmine: '#E6415C', chip: 'rgba(241,233,220,.05)',
  focus: '#8EA6FF',
  elev: '0 0 0 1px rgba(241,233,220,.04),0 34px 66px -34px rgba(0,0,0,.9)',
};

/** The dancer card is dark in BOTH themes, so it cannot use --tm-*. Today it
 *  hardcodes the dark values; naming them here is what lets Refactor 2a replace
 *  those literals without the card following the theme toggle. */
export const card = {
  ground: dark.ground, panel2: dark.panel2,
  ink: dark.ink, muted: dark.muted, faint: dark.faint,
  ember: dark.ember, carmine: dark.carmine,
} as const;

export const fonts = {
  serif: '"Iowan Old Style", Georgia, "Times New Roman", serif',
  sans: 'var(--font-figtree), system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace',
} as const;

/** Today the repo uses 16 distinct radii. This is the intended scale; Refactor 2a
 *  maps the strays onto it. Not yet consumed — declared so DESIGN.md documents it. */
export const radii = { pill: '999px', circle: '50%', lg: '18px', md: '12px', sm: '9px', xs: '4px' } as const;

/** CSS custom-property name for a theme token key. Single place the --tm- prefix
 *  is decided, so Refactor 2b can rename without touching the source values. */
export const cssVar = (key: keyof ThemeTokens): string =>
  '--tm-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace('-soft', '-s');
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 3: Commit**

```bash
git add design/tokens.ts
git commit -m "feat(design): add the token source of truth"
```

---

### Task 2: Generator — CSS output

**Files:**
- Create: `scripts/build-design.mjs`
- Test: `test/designTokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/designTokens.test.ts`:

```ts
import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCss } from '@/scripts/build-design.mjs';

const root = resolve(__dirname, '..');

test('the generated CSS file exists and is not stale', () => {
  const p = resolve(root, 'src/styles/generated/tokens.css');
  expect(existsSync(p), 'run: node scripts/build-design.mjs').toBe(true);
  expect(readFileSync(p, 'utf8')).toBe(buildCss());
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run test/designTokens.test.ts`
Expected: FAIL — cannot resolve `@/scripts/build-design.mjs`.

- [ ] **Step 3: Write the generator**

Create `scripts/build-design.mjs`. It imports the source with a `.ts` extension, which plain Node cannot do — so the source is duplicated at build time via a tiny loader-free approach: the generator imports the compiled values through vitest's alias in tests, and through `tsx`-free JSON at build. To avoid that complexity entirely, the generator reads `design/tokens.ts` values by importing it **through vitest only**, and the CLI path uses `node --experimental-strip-types` (Node 22 supports it).

```js
// Generates every design artifact from design/tokens.ts. Never edit the outputs.
//   node --experimental-strip-types scripts/build-design.mjs          # write
//   node --experimental-strip-types scripts/build-design.mjs --check  # verify only
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { light, dark, fonts, cssVar } from '../design/tokens.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BANNER = '/* GENERATED by scripts/build-design.mjs from design/tokens.ts — DO NOT EDIT */';

const decls = (t) =>
  Object.keys(t).map((k) => `  ${cssVar(k)}:${t[k]};`).join('\n');

export function buildCss() {
  return [
    BANNER,
    ':root{',
    `  --serif:${fonts.serif};`,
    `  --sans:${fonts.sans};`,
    `  --mono:${fonts.mono};`,
    '}',
    '.tm-profile{',
    decls(light),
    '}',
    ':root[data-theme="dark"] .tm-profile{',
    decls(dark),
    '}',
    '',
  ].join('\n');
}

const OUTPUTS = [['src/styles/generated/tokens.css', buildCss()]];

const check = process.argv.includes('--check');
let stale = 0;
for (const [rel, content] of OUTPUTS) {
  const p = resolve(root, rel);
  const current = existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (current === content) continue;
  stale++;
  if (check) { console.error(`stale: ${rel}`); continue; }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log(`wrote ${rel}`);
}
if (check && stale) process.exit(1);
if (!check && !stale) console.log('all design artifacts already up to date');
```

- [ ] **Step 4: Generate, then run the test**

```bash
node --experimental-strip-types scripts/build-design.mjs
npx vitest run test/designTokens.test.ts
```
Expected: generator prints `wrote src/styles/generated/tokens.css`; test PASSES.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-design.mjs src/styles/generated/tokens.css test/designTokens.test.ts
git commit -m "feat(design): generate tokens.css from the source, guarded by a staleness test"
```

---

### Task 3: Prove the generated values match today's app exactly

This is the task that makes the refactor safe. If it passes, the generated CSS can replace the hand-written declarations without any visual change.

**Files:**
- Modify: `test/designTokens.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/designTokens.test.ts`:

```ts
import { light, dark, cssVar, type ThemeTokens } from '@/design/tokens';

/** Pull `--tm-x:value` pairs out of a CSS block so we compare declarations, not
 *  formatting. */
function declsIn(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

test('every generated token equals the value app/tango.css declares today', () => {
  const legacy = readFileSync(resolve(root, 'app/tango.css'), 'utf8');
  const lightDecls = declsIn(legacy, '.tm-profile {');
  const darkDecls = declsIn(legacy, ':root[data-theme="dark"] .tm-profile{');

  for (const key of Object.keys(light) as (keyof ThemeTokens)[]) {
    expect(lightDecls[cssVar(key)], `light ${key}`).toBe(light[key]);
    expect(darkDecls[cssVar(key)], `dark ${key}`).toBe(dark[key]);
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run test/designTokens.test.ts`
Expected: PASS. If a key fails, the source has a typo — fix `design/tokens.ts` to match `app/tango.css`, never the other way round.

- [ ] **Step 3: Commit**

```bash
git add test/designTokens.test.ts
git commit -m "test(design): assert generated tokens match the live stylesheet"
```

---

### Task 4: JS export for canvas and OG rendering

`src/components/DancerCard.tsx` and the two `opengraph-image.tsx` files paint with hex literals because CSS variables do not exist on a canvas. This gives them a typed import to use in Refactor 2a.

**Files:**
- Modify: `scripts/build-design.mjs`
- Modify: `test/designTokens.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/designTokens.test.ts`:

```ts
test('the generated JS token export exists and is not stale', () => {
  const p = resolve(root, 'src/lib/generated/tokens.ts');
  expect(existsSync(p), 'run: node scripts/build-design.mjs').toBe(true);
  expect(readFileSync(p, 'utf8')).toBe(buildTs());
});
```

and add `buildTs` to the import from the generator.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run test/designTokens.test.ts`
Expected: FAIL — `buildTs` is not exported.

- [ ] **Step 3: Extend the generator**

In `scripts/build-design.mjs`, add the import of `card` and this export, then register it in `OUTPUTS`:

```js
import { light, dark, card, fonts, radii, cssVar } from '../design/tokens.ts';

export function buildTs() {
  const lit = (o) => JSON.stringify(o, null, 2);
  return [
    '// GENERATED by scripts/build-design.mjs from design/tokens.ts — DO NOT EDIT',
    '// Raw values for renderers that cannot read CSS custom properties: the card',
    '// canvas, the OG images, and the injected map scripts.',
    `export const light = ${lit(light)} as const;`,
    `export const dark = ${lit(dark)} as const;`,
    `export const card = ${lit(card)} as const;`,
    `export const radii = ${lit(radii)} as const;`,
    '',
  ].join('\n');
}
```

and:

```js
const OUTPUTS = [
  ['src/styles/generated/tokens.css', buildCss()],
  ['src/lib/generated/tokens.ts', buildTs()],
];
```

- [ ] **Step 4: Generate and test**

```bash
node --experimental-strip-types scripts/build-design.mjs
npx vitest run test/designTokens.test.ts && npx tsc --noEmit
```
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-design.mjs src/lib/generated/tokens.ts test/designTokens.test.ts
git commit -m "feat(design): generate a JS token export for canvas and OG renderers"
```

---

### Task 5: Generate DESIGN.md

**Files:**
- Modify: `scripts/build-design.mjs`
- Modify: `test/designTokens.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
test('DESIGN.md exists and is not stale', () => {
  const p = resolve(root, 'DESIGN.md');
  expect(existsSync(p), 'run: node scripts/build-design.mjs').toBe(true);
  expect(readFileSync(p, 'utf8')).toBe(buildDoc());
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run test/designTokens.test.ts`
Expected: FAIL — `buildDoc` is not exported.

- [ ] **Step 3: Extend the generator**

```js
export function buildDoc() {
  const row = (k) => `| \`${cssVar(k)}\` | \`${light[k]}\` | \`${dark[k]}\` |`;
  return [
    '<!-- GENERATED by scripts/build-design.mjs from design/tokens.ts — DO NOT EDIT -->',
    '# Tango Map — Style Reference',
    '',
    '> The milonga at night: ember lamplight, sage, carmine for mastery.',
    '',
    'Edit `design/tokens.ts`, then run `node --experimental-strip-types scripts/build-design.mjs`.',
    '',
    '## Tokens — Colours',
    '',
    '| Token | Light | Dark |',
    '|-------|-------|------|',
    ...Object.keys(light).map(row),
    '',
    '## Tokens — Type',
    '',
    `- serif: \`${fonts.serif}\``,
    `- sans: \`${fonts.sans}\``,
    `- mono: \`${fonts.mono}\``,
    '',
    '## Tokens — Radius scale',
    '',
    ...Object.entries(radii).map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '## Rules',
    '',
    '- The dancer card is dark in BOTH themes — use the `card` palette, never `--tm-*`.',
    '- Google brand colours in `app/signin/page.tsx` are NOT tokens and must stay literal.',
    '- The map at `/` owns its own `--t-*` tokens; we only bridge to them from injected scripts.',
    '',
  ].join('\n');
}
```

Register in `OUTPUTS`: `['DESIGN.md', buildDoc()]`.

- [ ] **Step 4: Generate and test**

```bash
node --experimental-strip-types scripts/build-design.mjs
npx vitest run test/designTokens.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-design.mjs DESIGN.md test/designTokens.test.ts
git commit -m "feat(design): generate DESIGN.md from the token source"
```

---

### Task 6: Wire the generated CSS in, with zero visual change

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/tango.css:12-41`
- Modify: `package.json`

- [ ] **Step 1: Import the generated sheet before tango.css**

In `app/layout.tsx`, the existing `import './tango.css';` becomes:

```tsx
import '@/src/styles/generated/tokens.css';
import './tango.css';
```

Order matters: `tango.css` still declares the same values, so it harmlessly wins until the next step removes them.

- [ ] **Step 2: Delete the now-duplicated declarations**

In `app/tango.css`, delete only the `--serif/--sans/--mono` lines and every `--tm-*` declaration from both the `.tm-profile` block and the `:root[data-theme="dark"] .tm-profile` block. **Keep** `color-scheme`, `background`, `color`, `font-family`, `line-height`, `min-height`, and every comment. The dark block will be left holding only `color-scheme:dark;` — that is correct, do not delete the block.

- [ ] **Step 3: Prove nothing changed**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all suites PASS. Note the Task 3 test now reads tokens from `app/tango.css` which no longer declares them — so **update it to read `src/styles/generated/tokens.css` instead**, keeping the same assertions. That test's job changes from "source matches legacy" to "generated CSS carries every token".

- [ ] **Step 4: Add the npm scripts**

In `package.json` `scripts`:

```json
"design": "node --experimental-strip-types scripts/build-design.mjs",
"design:check": "node --experimental-strip-types scripts/build-design.mjs --check"
```

- [ ] **Step 5: Visual verification against production**

```bash
npm run build
BASE=http://localhost:3000 npm run proofpack
```
Compare `proofpack/` against the committed set: the screenshots must be visually identical. Any difference means a token was dropped or reordered — fix before committing.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/tango.css package.json test/designTokens.test.ts
git commit -m "refactor(design): serve tokens from the generated sheet"
```

---

## Self-Review

**Spec coverage.** Refactor 1 asked for: one machine-readable source (Task 1), covering light and dark (Task 1), generating CSS (Task 2), a JS export for canvas (Task 4), and a human-readable doc (Task 5), with a test that fails on drift (Tasks 2, 4, 5) and a documented bridge decision for the map (recorded in the generated DESIGN.md rules, Task 5). Definition of done — "change one value, re-run, everything moves together" — is satisfied by `OUTPUTS` plus the three staleness tests. Covered.

**Placeholder scan.** No TBDs. Every code step carries complete code; every command states its expected result. Task 6 Step 2 names exactly which lines to delete and which to keep, rather than saying "clean up".

**Type consistency.** `ThemeTokens` keys are used identically in Tasks 1, 3 and 4. `cssVar` is defined once in Task 1 and imported by both the generator and the test. `buildCss` / `buildTs` / `buildDoc` keep their names across Tasks 2, 4, 5 and the `OUTPUTS` table.

**Known risk, called out deliberately.** Task 2 relies on `node --experimental-strip-types` to import a `.ts` source from an `.mjs` script (Node 22.12 supports it; the repo already runs Node 22.12 per the Vercel CLI banner). If it proves unreliable in CI, the fallback is to make `design/tokens.ts` a `.mjs` file with JSDoc types instead — one file changes, no task restructuring.
