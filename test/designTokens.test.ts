import { test, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { OUTPUTS, replaceRegion } from '@/scripts/build-design.mjs';

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
// Two subtleties, both learned by watching weaker versions of this test pass against a
// deliberately reintroduced bug. It must run in a CHILD process, because by the time an
// in-band assertion runs our own import has already happened. And it must DRIFT the
// artifacts first: the bug is a conditional repair, so against an already-clean tree the
// import writes nothing and the test passes while the bug is present.
test('importing the generator writes nothing', () => {
  const targets = OUTPUTS.map((o) => ({ path: o.path, p: resolve(root, o.path) }));
  const saved = targets.map((t) => readFileSync(t.p, 'utf8'));
  try {
    targets.forEach((t) => writeFileSync(t.p, 'DRIFTED\n'));
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', '-e', "import('./scripts/build-design.mjs')"],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    for (const t of targets) {
      expect(readFileSync(t.p, 'utf8'), `${t.path} was rewritten by a bare import`).toBe('DRIFTED\n');
    }
  } finally {
    targets.forEach((t, k) => writeFileSync(t.p, saved[k]));
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
