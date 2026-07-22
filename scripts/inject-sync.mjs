// Bakes a <script src="/sync.js" defer> tag into public/tangomap.html's
// __bundler/template <head>, so the progress-sync IIFE loads inside the map bundle.
//
// GUARDED INTEGRATION STEP — this does NOTHING unless invoked explicitly with --write:
//     node scripts/inject-sync.mjs --write
// Importing the module, or running it without the flag, is a no-op by design.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { injectScriptIntoTemplate } from '../src/lib/injectScript.ts';

const SCRIPT_SRC = '/sync.js';
const OPEN = '<script type="__bundler/template">';

// Compute the injected bundle and validate the round-trip before returning it.
export function buildInjected(bundleHtml) {
  const out = injectScriptIntoTemplate(bundleHtml, SCRIPT_SRC);

  // Locate the __bundler/template payload in the output.
  const i = out.indexOf(OPEN);
  if (i < 0) throw new Error('inject-sync: __bundler/template not found in output');
  const start = i + OPEN.length;
  const end = out.indexOf('</script>', start);
  if (end < 0) throw new Error('inject-sync: template close not found in output');
  const raw = out.slice(start, end).trim();

  // The payload must contain no literal </script (would close the outer bundler tag early)...
  if (/<\/script/i.test(raw)) throw new Error('inject-sync: literal </script inside template payload');
  // ...must still be valid JSON...
  const decoded = JSON.parse(raw);
  // ...must now reference /sync.js...
  if (!decoded.includes(SCRIPT_SRC)) throw new Error('inject-sync: /sync.js missing from decoded template');
  // ...and must not have clobbered existing bundle content.
  if (!decoded.includes('<helmet>')) throw new Error('inject-sync: <helmet> missing from decoded template');

  return out;
}

export function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const htmlPath = resolve(here, '../public/tangomap.html');
  const bundleHtml = readFileSync(htmlPath, 'utf8');
  const out = buildInjected(bundleHtml);
  writeFileSync(htmlPath, out);
  console.log(`OK: injected ${SCRIPT_SRC} into ${htmlPath}`);
}

// Guard: only mutate files when this module is the entry point AND --write is passed.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly && process.argv.includes('--write')) {
  main();
} else if (invokedDirectly) {
  console.log('inject-sync: dry run (no changes). Pass --write to bake /sync.js into public/tangomap.html.');
}
