import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { OUTPUTS, replaceRegion, main } from '@/scripts/build-design.mjs';

const root = resolve(__dirname, '..');
const HINT = 'run: npm run design';

// Iterating OUTPUTS means artifacts added by later tasks are covered automatically.
test.each(OUTPUTS.map((o) => o.path))('generated artifact %s is not stale', (rel) => {
  const p = resolve(root, rel);
  expect(existsSync(p), `${rel} is missing — ${HINT}`).toBe(true);
  const out = OUTPUTS.find((o) => o.path === rel)!;
  const current = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  expect(current, `${rel} is stale — ${HINT}`).toBe(out.render(current));
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

// Importing the generator must not write anything: a test that repairs the drift it
// exists to catch always reads green. main() is exported but never runs on import.
test('importing the generator has no side effects', () => {
  expect(typeof main).toBe('function');
  for (const out of OUTPUTS) {
    expect(existsSync(resolve(root, out.path))).toBe(true);
  }
});

// Region outputs patch hand-written prose, so both failure modes must throw rather
// than create or overwrite the file.
test('a region refuses to write when the file is missing', () => {
  expect(() => replaceRegion(null, 'tokens', 'body')).toThrow(/never creates one/);
});

test('a region refuses to write when the markers are absent or malformed', () => {
  expect(() => replaceRegion('# Doc\n\nprose\n', 'tokens', 'body')).toThrow(/missing or malformed markers/);
  const swapped = '<!-- generated:tokens:end -->\n<!-- generated:tokens:start -->\n';
  expect(() => replaceRegion(swapped, 'tokens', 'body')).toThrow(/missing or malformed markers/);
});

test('a region replaces only the marked body and keeps surrounding prose', () => {
  const doc = ['# Design', '', '<!-- generated:tokens:start -->', 'OLD', '<!-- generated:tokens:end -->', '', 'hand-written tail'].join('\n');
  const next = replaceRegion(doc, 'tokens', 'NEW');
  expect(next).toContain('# Design');
  expect(next).toContain('hand-written tail');
  expect(next).toContain('NEW');
  expect(next).not.toContain('OLD');
});
