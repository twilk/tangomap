import { test, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { OUTPUTS, replaceRegion, buildDesign } from '@/scripts/build-design.mjs';
import { light, dark, card, rounded, semantic, type ThemeTokens } from '@/design/tokens';

const root = resolve(__dirname, '..');

// `npm run design` is the fix for a whole-file output, but for a region output it
// deliberately throws rather than creating the file — so pointing a maintainer at it
// would send them in a circle.
const missingHint = (out: (typeof OUTPUTS)[number]) =>
  out.region
    ? `${out.path} is missing — restore it from git, then re-run (a region output never creates its file)`
    : `${out.path} is missing — run: npm run design`;

// Iterating OUTPUTS means artifacts added by later tasks are covered automatically.
test.each(OUTPUTS.map((o) => o.path))('generated artifact %s is not stale', (rel) => {
  const out = OUTPUTS.find((o) => o.path === rel)!;
  const p = resolve(root, rel);
  expect(existsSync(p), missingHint(out)).toBe(true);
  const current = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  expect(current, `${rel} is stale — run: npm run design`).toBe(out.render(current));
});

// The staleness test above only proves the file on disk equals render()'s STRING — it
// never loads the module or checks its values. This artifact is a .ts module the card
// canvas and OG images `import`, so it must additionally (a) be valid, importable TS and
// (b) re-export exactly the source values. A buildTs() bug that emitted broken syntax, or
// silently dropped/renamed a token, would keep the string self-consistent and sail past
// the staleness check while shipping an unusable module. Importing it and comparing to the
// source is the coverage that catches that. `elev` is deliberately absent from the JS
// export (it is a CSS box-shadow whose light value embeds var(--tm-hi), meaningless to a
// canvas/OG renderer), so the theme comparison strips it from the source first.
test('the generated JS token export is importable and re-exports the source values', async () => {
  const mod = await import('@/src/lib/generated/tokens');
  const withoutElev = ({ elev: _elev, ...rest }: ThemeTokens) => rest;
  expect(mod.light).toEqual(withoutElev(light as ThemeTokens));
  expect(mod.dark).toEqual(withoutElev(dark as ThemeTokens));
  expect(mod.card).toEqual(card);
  expect(mod.rounded).toEqual(rounded);
  // The omission is a contract, not an accident: assert it explicitly so a future edit
  // that pipes a var()-bearing value back into the canvas export fails here.
  expect('elev' in mod.light).toBe(false);
  expect('elev' in mod.dark).toBe(false);
});

// The entrypoint is what CI and the deploy gate actually invoke, so exercise the
// real process rather than main() in-band. Asserts the deploy contract: exit 0 and
// a summary on stdout, because silence must never be mistaken for success.
test('the design:check entrypoint exits 0 and reports on a clean tree', () => {
  const stdout = execFileSync(
    process.execPath,
    ['--experimental-strip-types', resolve(root, 'scripts/design.mjs'), '--check'],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  expect(stdout.trim()).not.toBe('');
  expect(stdout).toContain('up to date');
}, 30_000);

// Importing the generator must not write anything: a generator that repairs drift on
// import makes the staleness test above unfailable, which is how this suite once read
// green while covering nothing.
//
// Three constraints, each learned by watching a weaker version pass against a deliberately
// reintroduced bug:
//   • it must run in a CHILD process — by the time an in-band assertion runs, our own import
//     of the module has already happened, so an in-band check can never observe the write;
//   • the artifacts it inspects must be DRIFTED first — the canonical bug is a *conditional*
//     repair, so against an already-clean tree the import writes nothing and the test passes
//     while the bug is present;
//   • it must NOT drift the real tracked files. A parallel Claude session shares this working
//     directory and also runs `vitest run`; two concurrent drift/restore cycles race, and one
//     run's restore can persist the other's DRIFTED text as the committed baseline (this
//     actually corrupted the tree during an earlier task). So the entire drift-and-check runs
//     inside a throwaway temp fixture — a self-contained copy of scripts/ + design/ with
//     DRIFTED copies of every OUTPUT — created under a unique mkdtemp path per run. The real
//     files are read only to be copied, never written, so concurrent runs cannot collide.
test('importing the generator writes nothing', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'design-purity-'));
  try {
    // build-design.mjs resolves its root two levels up from its own file and imports
    // ../design/tokens.ts, so copying both dirs keeps every path module-relative: any write a
    // buggy import performs lands under `fixture`, never in the repo.
    cpSync(resolve(root, 'scripts'), join(fixture, 'scripts'), { recursive: true });
    cpSync(resolve(root, 'design'), join(fixture, 'design'), { recursive: true });
    // Drift every declared OUTPUT inside the fixture. A repair-on-import would overwrite these
    // with freshly rendered content; a pure import leaves them exactly 'DRIFTED\n'.
    for (const out of OUTPUTS) {
      const p = join(fixture, out.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, 'DRIFTED\n');
    }
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', '-e', "import('./scripts/build-design.mjs')"],
      { cwd: fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    for (const out of OUTPUTS) {
      expect(readFileSync(join(fixture, out.path), 'utf8'), `${out.path} was rewritten by a bare import`).toBe('DRIFTED\n');
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 30_000);

// Region outputs patch hand-written prose, so every failure mode must throw rather
// than create, append to, or splice the file.
test('a region refuses to write when the file is missing', () => {
  expect(() => replaceRegion(null, 'tokens', 'body')).toThrow(/never creates one/);
});

test('a region refuses to write when the markers are absent or malformed', () => {
  expect(() => replaceRegion('# Doc\n\nprose\n', 'tokens', 'body')).toThrow(/missing or malformed markers/);
  const swapped = '<!-- generated:tokens:end -->\n<!-- generated:tokens:start -->\n';
  expect(() => replaceRegion(swapped, 'tokens', 'body')).toThrow(/missing or malformed markers/);
});

// DESIGN.md documents the design system, so a maintainer mentioning the marker
// convention in prose is the expected case — and indexOf would splice from their
// mention to the real region, deleting every hand-written line in between.
test('a region refuses to write when a marker is duplicated in prose', () => {
  const doc = [
    '# Design',
    '',
    'Wrap generated content in <!-- generated:tokens:start --> to mark the region.',
    '',
    '## Contributing',
    'hand-written paragraph one',
    'hand-written paragraph two',
    '',
    '<!-- generated:tokens:start -->',
    'OLD',
    '<!-- generated:tokens:end -->',
  ].join('\n');
  expect(() => replaceRegion(doc, 'tokens', 'NEW')).toThrow(/expected exactly one/);
  // What the old indexOf implementation would have done, for the record:
  const i = doc.indexOf('<!-- generated:tokens:start -->');
  const j = doc.indexOf('<!-- generated:tokens:end -->');
  const spliced = `${doc.slice(0, i + '<!-- generated:tokens:start -->'.length)}\nNEW\n${doc.slice(j)}`;
  expect(spliced).not.toContain('hand-written paragraph one');
  expect(spliced.split('\n').length).toBeLessThan(doc.split('\n').length);
});

test('a region refuses to write when the end marker is duplicated', () => {
  const doc = [
    '<!-- generated:tokens:start -->',
    'OLD',
    '<!-- generated:tokens:end -->',
    '',
    'The block above closes with <!-- generated:tokens:end -->.',
  ].join('\n');
  expect(() => replaceRegion(doc, 'tokens', 'NEW')).toThrow(/expected exactly one/);
});

// The self-contained variant: a fenced example pair absorbs the generated body, the
// real region keeps its stale content, and because that result is idempotent
// design:check would report "up to date" forever.
test('a region refuses to write when a fenced example shows both markers', () => {
  const doc = [
    '# Design',
    '',
    'For example:',
    '',
    '```md',
    '<!-- generated:tokens:start -->',
    '…generated table…',
    '<!-- generated:tokens:end -->',
    '```',
    '',
    '<!-- generated:tokens:start -->',
    'OLD',
    '<!-- generated:tokens:end -->',
  ].join('\n');
  expect(() => replaceRegion(doc, 'tokens', 'NEW')).toThrow(/expected exactly one/);
});

test('a region replaces only the marked body and keeps surrounding prose', () => {
  const doc = ['# Design', '', '<!-- generated:tokens:start -->', 'OLD', '<!-- generated:tokens:end -->', '', 'hand-written tail'].join('\n');
  const next = replaceRegion(doc, 'tokens', 'NEW');
  expect(next).toContain('# Design');
  expect(next).toContain('hand-written tail');
  expect(next).toContain('NEW');
  expect(next).not.toContain('OLD');
});

// ---------------------------------------------------------------------------
// DESIGN.md is a whole-file generated output: the prose AND the front matter live in
// DESIGN.md.tmpl and the token VALUES are substituted in by buildDesign. The test.each
// staleness case above already covers drift of the file on disk; these prove the
// substitution is COMPLETE (no brace-token survives), CORRECT (colours resolve to the real
// light token), and that the front matter is single-sourced (it cannot contradict the body).
// ---------------------------------------------------------------------------

// Loose on purpose — the same pattern the generator's guard uses. A strict
// `\{[a-z]+\.[a-zA-Z0-9]+\}` would let a near-miss ({Colors.primary}, {spacing.page-padding})
// through unnoticed; this catches ANY leftover brace-token.
const BRACE_TOKEN = /\{[A-Za-z][\w.-]*\}/g;

test('the generated DESIGN.md ships no literal brace-token', () => {
  const md = readFileSync(resolve(root, 'DESIGN.md'), 'utf8');
  const survivors = md.match(BRACE_TOKEN);
  expect(survivors, `unresolved brace-tokens in DESIGN.md: ${survivors?.join(', ')}`).toBeNull();
});

// The banner must be a YAML comment on line 2 — an HTML comment on line 1 would push the
// opening `---` down and break every front-matter parser.
test('the generated DESIGN.md keeps `---` on line 1 so the front matter stays valid', () => {
  const lines = readFileSync(resolve(root, 'DESIGN.md'), 'utf8').split('\n');
  expect(lines[0]).toBe('---');
  expect(lines[1]).toBe('# GENERATED from DESIGN.md.tmpl by npm run design — DO NOT EDIT');
});

// The completeness guard is load-bearing: an unknown or malformed placeholder must abort
// generation (naming the offender) rather than silently ship a broken doc. A known group
// with a bad key throws during substitution; an unknown group and a near-miss that the
// strict substitution grammar ignores are both caught by the loose survivor check.
test('buildDesign throws, naming the offender, on an unknown or malformed placeholder', () => {
  expect(() => buildDesign('accent is `{colors.bogus}`')).toThrow(/colors\.bogus/);
  expect(() => buildDesign('gap is `{nope.x}`')).toThrow(/nope\.x/);
  // near-miss the strict substitution regex skips but the loose guard still catches:
  expect(() => buildDesign('accent is `{Colors.primary}`')).toThrow(/Colors\.primary/);
  expect(() => buildDesign('pad is `{spacing.page-padding}`')).toThrow(/spacing\.page-padding/);
  expect(() => buildDesign('ember is `{colors.primary}`')).not.toThrow();
});

test('every {colors.X} resolves to the matching light token value', () => {
  // end-to-end spot check: {colors.primary} is the light ember value, via the semantic map
  expect(light[semantic.primary]).toBe(light.ember);
  expect(buildDesign('ember is `{colors.primary}`')).toContain(`ember is \`${light.ember}\``);
  // and the whole doc colour vocabulary resolves to a real light token — never "undefined"
  for (const name of Object.keys(semantic) as (keyof typeof semantic)[]) {
    const out = buildDesign(`{colors.${name}}`);
    expect(out, `{colors.${name}}`).toContain(light[semantic[name]]);
    expect(out, `{colors.${name}} must not resolve to undefined`).not.toContain('undefined');
  }
});

// The whole point of generating the doc: a token's value appears once, from source, so the
// front-matter header and the prose body can never disagree. secondary is the canary — its
// header literal used to be the stale teal #2C7869 while the body rendered #7a8a5e.
test('the front matter no longer contradicts the body (colours are single-sourced)', () => {
  const md = readFileSync(resolve(root, 'DESIGN.md'), 'utf8');
  const secondary = light[semantic.secondary];
  expect(md).toContain(`secondary: "${secondary}"`); // front-matter YAML map
  expect(md).toContain(`**Verdigris \`${secondary}\`**`); // Colors prose
  expect(md).not.toContain('#2C7869'); // the stale teal is gone everywhere
});

// ---------------------------------------------------------------------------
// The swap has landed. app/tango.css no longer declares the design tokens — the
// generated sheet (src/styles/generated/tokens.css) does, and tango only *consumes*
// them through var(). This test guards that direction: nothing in tango hand-
// overrides the generated source.
//
// It deliberately does NOT re-compare values against src/styles/generated/tokens.css.
// That file is generated from design/tokens.ts, so a value comparison against it would
// be a tautology the staleness test.each above already covers. The honest post-swap
// invariant is the opposite one: the two .tm-profile blocks in tango declare ZERO token
// properties, so a stray hand-edit reintroducing one fails here.
// ---------------------------------------------------------------------------

/** The live sheet the app loads. It used to hand-declare every --tm-, --serif,
 *  --sans and --mono token; post-swap it must declare none — it only reads them via
 *  var(). Selectors are matched on normalised whitespace, so `.tm-profile {` here and
 *  the generator's `.tm-profile{` are the same rule to declsIn. */
const LIVE_STYLESHEET = 'app/tango.css';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Advance past a quoted string that starts at `i`; returns the index of its
 *  closing quote (or past the end if unterminated). */
function endOfString(src: string, i: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
  return j;
}

/** Blank every comment to spaces, preserving offsets and newlines.
 *
 *  This runs before anything else so no later step can mistake a comment for a
 *  selector or a declaration — app/tango.css puts prose comments *inside* both token
 *  blocks and *between* the dark selector and its brace. Order matters in both
 *  directions: a `/*` inside url("…") must not open a comment, and an apostrophe
 *  inside a comment ("the viewer's own row", line 305) must not open a string and
 *  swallow the rest of the file. Comments win, then strings. */
function blankComments(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if (css[i] === '"' || css[i] === "'") {
      const end = endOfString(css, i);
      out += css.slice(i, end + 1);
      i = end + 1;
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

/** Split a rule body into declarations.
 *
 *  Splits on top-level `;` only, so neither the commas inside `rgba(…)` nor the `;`
 *  inside `url("data:image/svg+xml;utf8,…")` can cut a value in half, and only the
 *  first `:` separates property from value so `url("data:…")` keeps its scheme. A
 *  fragment containing a brace is a nested rule, not a declaration, and is dropped. */
function parseDecls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let depth = 0;
  let start = 0;
  const flush = (end: number) => {
    const piece = body.slice(start, end).trim();
    start = end + 1;
    if (!piece || piece.includes('{')) return;
    const colon = piece.indexOf(':');
    if (colon === -1) return;
    out[piece.slice(0, colon).trim()] = piece.slice(colon + 1).trim();
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'") i = endOfString(body, i);
    else if (c === '(' || c === '{') depth++;
    else if (c === ')' || c === '}') depth--;
    else if (c === ';' && depth === 0) flush(i);
  }
  flush(body.length); // a final declaration needs no trailing `;`
  return out;
}

/** Every declaration of the one TOP-LEVEL rule whose selector is `selector`.
 *
 *  Brace-matched from the rule's own `{`, never "the next `}`": app/tango.css has ~90
 *  other blocks, including nested `@media`, so a regex would end the block in the
 *  wrong place. Selectors are compared on normalised whitespace against the exact
 *  prelude, so `.tm-profile *` and `.tm-profile h1,.tm-profile h2` are not `.tm-profile`.
 *
 *  Nesting is part of the match, not just the selector. A `.tm-profile` block is only
 *  the block the app paints from if it sits at the top level: wrapped in `@media print`
 *  it paints nowhere on screen, wrapped in `@layer base` it loses the cascade to every
 *  unlayered rule, and swallowed by an unclosed `{` earlier in the file browsers drop
 *  it entirely. All three change what the app paints without changing one declared
 *  value, so a prelude-only match would report parity while the tokens paint nothing.
 *
 *  Throws rather than returning `{}` when the selector matches zero top-level rules
 *  (or more than one): an empty or wrong result would make every assertion below
 *  vacuously true, which is how a renamed or re-nested selector would turn this proof
 *  into a green no-op. */
function declsIn(css: string, selector: string): Record<string, string> {
  const src = blankComments(css);
  const want = norm(selector);
  const open: { prelude: string; from: number; depth: number }[] = [];
  const found: string[] = [];
  let nested = 0;
  let mark = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") i = endOfString(src, i);
    else if (c === '{') {
      open.push({ prelude: src.slice(mark, i), from: i + 1, depth: open.length });
      mark = i + 1;
    } else if (c === '}') {
      const rule = open.pop();
      if (rule && norm(rule.prelude) === want) {
        if (rule.depth === 0) found.push(src.slice(rule.from, i));
        else nested++;
      }
      mark = i + 1;
    } else if (c === ';') mark = i + 1;
  }
  if (found.length !== 1) {
    const why = nested
      ? ` (${nested} matched only inside another block — an at-rule wrapper or an unclosed rule ` +
        `earlier in the file changes what the app paints without changing a declared value)`
      : '';
    throw new Error(
      `selector "${selector}": expected exactly one matching rule at the top level, found ` +
        `${found.length}${why}. Refusing to return declarations — an empty or wrong result would ` +
        `let the token parity assertions pass vacuously.`,
    );
  }
  return parseDecls(found[0]);
}

/** A property that belongs to the token source, not to a consuming rule: any
 *  --tm-* custom property, or one of the three font-family tokens. */
const isTokenDecl = (prop: string) =>
  prop.startsWith('--tm-') || prop === '--serif' || prop === '--sans' || prop === '--mono';

test('app/tango.css declares no design tokens — the generated sheet is the only source', () => {
  const css = readFileSync(resolve(root, LIVE_STYLESHEET), 'utf8');
  const blocks = [
    { theme: 'light', selector: '.tm-profile' },
    { theme: 'dark', selector: ':root[data-theme="dark"] .tm-profile' },
  ];

  for (const { theme, selector } of blocks) {
    // declsIn still requires exactly one top-level rule with this selector, so a
    // renamed or re-nested block throws rather than passing vacuously. The blocks are
    // NOT empty of declarations post-swap (light keeps background/color/font-family/…,
    // dark keeps color-scheme), so the "exactly one" count guard does not false-trip.
    const decls = declsIn(css, selector);

    // Non-vacuity: prove the parser read a populated block before trusting its
    // "no tokens" verdict. Were declsIn to return {}, the filter below would pass
    // trivially — this is the guard against that.
    expect(
      Object.keys(decls).length,
      `${theme}: expected declsIn to read a populated "${selector}" block`,
    ).toBeGreaterThan(0);

    // The real assertion, and the reason this is not a tautology: the block must
    // hand-declare NO design token. Filtering the parsed set (rather than asserting
    // the block has zero declarations total) is what keeps it honest — the light block
    // legitimately still holds background/color/font-family/line-height/etc.
    const tokenDecls = Object.keys(decls).filter(isTokenDecl);
    expect(
      tokenDecls,
      `${theme}: "${selector}" in ${LIVE_STYLESHEET} must declare no --tm-*, --serif, --sans or ` +
        `--mono token — those now come from src/styles/generated/tokens.css. Found: ${tokenDecls.join(', ')}`,
    ).toEqual([]);
  }
});

// The parity test is only worth its green if the parser it rests on is honest, and
// every case below is drawn from something app/tango.css actually contains.
test('the stylesheet parser survives comments, nested braces and rgba commas', () => {
  const css = [
    "/* a comment holding the viewer's apostrophe, a } brace and a --tm-decoy:#bad; */",
    '@media (max-width:560px){ .other{--tm-ground:#000} }',
    '.tm-profile *{box-sizing:border-box}',
    '.tm-profile h1,.tm-profile h2{margin:0}',
    '/* prose sitting between the selector and its brace */',
    '.tm-profile',
    '{',
    '  --tm-ground:#f5ead8; --tm-line2:rgba(32,30,29,.07);',
    '  /* --tm-commented-out:#bad; */',
    '  background-image:url("data:image/svg+xml;utf8,<svg/>");',
    '  color-scheme:light',
    '}',
  ].join('\n');

  const d = declsIn(css, '.tm-profile');
  expect(d['--tm-ground']).toBe('#f5ead8');
  expect(d['--tm-line2']).toBe('rgba(32,30,29,.07)'); // commas inside rgba() do not split a value
  expect(d['--tm-commented-out']).toBeUndefined(); // a commented-out decl is not a declaration
  expect(d['--tm-decoy']).toBeUndefined(); // …nor is one in a comment outside the block
  expect(d['background-image']).toBe('url("data:image/svg+xml;utf8,<svg/>")'); // `;` inside a string
  expect(d['color-scheme']).toBe('light'); // the last declaration needs no trailing `;`
  expect(Object.keys(d)).toHaveLength(4); // the @media decoy and the sibling rules stayed out
});

test('a selector that matches nothing throws instead of passing vacuously', () => {
  const css = '.tm-profile{--tm-ground:#f5ead8}';
  expect(() => declsIn(css, '.tm-profil')).toThrow(/found 0/);
  expect(() => declsIn(css, '.tm-profile')).not.toThrow();
  // Two rules with the same selector are ambiguous: which one does the app paint from?
  expect(() => declsIn(`${css}\n${css}`, '.tm-profile')).toThrow(/found 2/);
});

// The nastiest false green available to this test: the block still exists, still has
// the right selector, and still declares all 17 correct values — but is no longer the
// block the app paints from. Matching on the selector alone would report parity.
test('a token block nested inside another rule is not adopted as the top-level one', () => {
  const block = '.tm-profile{--tm-ground:#f5ead8}';
  const wrapped = [
    ['@media print', `@media print{${block}}`], // paints nowhere on screen
    ['@layer base', `@layer base{${block}}`], // loses the cascade to every unlayered rule
    ['an unclosed rule', `.stray{color:red;\n${block}}`], // browsers drop the lot
  ] as const;
  for (const [what, css] of wrapped) {
    expect(() => declsIn(css, '.tm-profile'), `${what} must not be adopted`).toThrow(/found 0/);
    expect(() => declsIn(css, '.tm-profile'), `${what} should say why`).toThrow(/only inside another block/);
  }
  // …while the unwrapped baseline still parses, so this is a nesting check and not a
  // parser that simply refuses everything.
  expect(declsIn(block, '.tm-profile')).toEqual({ '--tm-ground': '#f5ead8' });
});
