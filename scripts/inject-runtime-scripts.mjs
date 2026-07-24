// Bakes EVERY runtime <script> the app injects into the map bundle's
// __bundler/template <head>, in one reproducible + idempotent step. Re-run after
// the bundle is regenerated from source to restore the whole startup chain:
//
//     node scripts/inject-runtime-scripts.mjs           # dry run (validates, no write)
//     node scripts/inject-runtime-scripts.mjs --write    # apply
//
// Self-contained plain JS on purpose — the older per-script injectors imported the
// TypeScript helper and so couldn't run under plain node. The injection algorithm
// below mirrors src/lib/injectScript.ts, which stays the unit-tested reference
// (test/injectScript.test.ts). Idempotent: a script already present (with or without
// a ?v= query) is left as-is. The ?v=N cache-bust suffixes are a separate manual
// concern applied on top of these base tags when a script's contents change.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The complete startup chain, in load order (all defer, so order is cosmetic —
// and note that already-present tags keep their existing document position, so a
// newly added script lands last regardless of where it sits in this array; the
// runtime coordinator is order-independent by design, see public/map-runtime.js):
//   sync           — progress persistence to /api/progress
//   map-runtime    — shared reconcile coordinator (one debounced observer + backstop)
//                    driving map-categories / map-skilllink; must be available to both
//   map-categories — "Browse by category" sidebar navigator (+ Learn links)
//   map-skilllink  — "Read the guide →" (+ teacher video badge) in the Skill Details panel
//   auth-ui        — Profile/Settings/Sign-in-out controls in the map header
//   theme-sync     — cross-tab / bfcache theme sync + meta[theme-color] for the map
//   onboarding     — first-visit welcome overlay
//   sw-register    — service-worker registration (installable/offline PWA)
const SCRIPTS = ['/sync.js', '/map-runtime.js', '/map-categories.js', '/map-skilllink.js', '/auth-ui.js', '/theme-sync.js', '/onboarding.js', '/sw-register.js'];
const OPEN = '<script type="__bundler/template">';

// Insert `<script src defer>` before </head> inside the bundle's JSON-encoded
// template, re-escaping every "</" as "</" so the outer bundler <script> is
// never closed early. Idempotent. Mirrors src/lib/injectScript.ts.
function injectOne(bundleHtml, scriptSrc) {
  const i = bundleHtml.indexOf(OPEN);
  if (i < 0) throw new Error('inject: __bundler/template not found');
  const start = i + OPEN.length;
  const end = bundleHtml.indexOf('</script>', start);
  if (end < 0) throw new Error('inject: template close not found');
  const decoded = JSON.parse(bundleHtml.slice(start, end).trim());
  if (decoded.includes(scriptSrc)) return bundleHtml; // idempotent
  const headClose = decoded.indexOf('</head>');
  if (headClose < 0) throw new Error('inject: </head> not found in template');
  const tag = `<script src="${scriptSrc}" defer></script>`;
  const patched = decoded.slice(0, headClose) + tag + decoded.slice(headClose);
  const reencoded = JSON.stringify(patched).replace(/<\//g, '<\\u002F');
  return bundleHtml.slice(0, start) + '\n' + reencoded + '\n' + bundleHtml.slice(end);
}

export function buildInjected(bundleHtml) {
  let out = bundleHtml;
  for (const src of SCRIPTS) out = injectOne(out, src);

  // Round-trip validation: payload stays valid JSON, references every script, has no
  // literal </script (would close the outer tag early), and kept existing content.
  const i = out.indexOf(OPEN);
  const start = i + OPEN.length;
  const end = out.indexOf('</script>', start);
  const raw = out.slice(start, end).trim();
  if (/<\/script/i.test(raw)) throw new Error('inject: literal </script inside template payload');
  const decoded = JSON.parse(raw);
  for (const src of SCRIPTS) if (!decoded.includes(src)) throw new Error(`inject: ${src} missing from decoded template`);
  if (!decoded.includes('<helmet>')) throw new Error('inject: <helmet> missing from decoded template');
  return out;
}

function run(write) {
  const here = dirname(fileURLToPath(import.meta.url));
  const htmlPath = resolve(here, '../public/tangomap.html');
  const before = readFileSync(htmlPath, 'utf8');
  const out = buildInjected(before);
  const changed = out !== before;
  if (write) {
    writeFileSync(htmlPath, out);
    console.log(`OK: ensured ${SCRIPTS.length} runtime scripts in ${htmlPath}${changed ? '' : ' (no change)'}`);
  } else {
    console.log(`dry run: validated ${SCRIPTS.length} scripts — ${changed ? 'WOULD add missing tags (run with --write)' : 'all present, no change'}.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.includes('--write'));
}
