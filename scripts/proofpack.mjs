// Proofpack — screenshot every public screen in BOTH themes.
//
//   node scripts/proofpack.mjs                          # against production
//   BASE=http://localhost:3000 node scripts/proofpack.mjs
//   OUT=./shots node scripts/proofpack.mjs
//
// The app and the map both read the theme from localStorage `tsm-theme` (mirrored
// into <html data-theme>), so we seed it via addInitScript BEFORE any page script
// runs — that's the only way to get a deterministic dark capture on first paint.
// /me, /settings and /me/card are auth-gated and redirect to /signin when signed
// out; they are listed here as `auth: true` and skipped unless STORAGE_STATE
// points at a saved signed-in session.
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const BASE = process.env.BASE ?? 'https://partykamap.vercel.app';
const OUT = resolve(process.env.OUT ?? 'proofpack');
const HANDLE = process.env.E2E_HANDLE ?? 'wilk';
const STORAGE_STATE = process.env.STORAGE_STATE;

const SCREENS = [
  { id: '01-map', path: '/', label: 'The map', settle: 2500, fullPage: false },
  { id: '02-learn', path: '/skills', label: 'Learn — all 62 skills' },
  { id: '03-skill', path: '/skill/gancho', label: 'Skill detail (Gancho)' },
  { id: '04-profile', path: `/u/${HANDLE}`, label: 'Public profile' },
  { id: '05-card', path: `/u/${HANDLE}/card`, label: 'Dancer card', settle: 1800 },
  { id: '06-compare', path: '/compare', label: 'Compare' },
  { id: '07-signin', path: '/signin', label: 'Sign in' },
  { id: '08-me', path: '/me', label: 'My profile', auth: true },
  { id: '09-settings', path: '/settings', label: 'Settings', auth: true },
  { id: '10-mycard', path: '/me/card', label: 'My card', auth: true },
];

const THEMES = ['light', 'dark'];

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: theme,
      ...(STORAGE_STATE ? { storageState: STORAGE_STATE } : {}),
    });
    // Seed the theme before any page script runs, and mirror it onto <html>
    // exactly like the app's no-flash inline script does. Also mark both
    // first-visit overlays as seen — the app's welcome (`tsm-onboarded`) and the
    // map bundle's own coach tip (`tm-onboarded`) — otherwise a fresh Playwright
    // profile shows them on top of every capture and the proofpack proves nothing.
    await context.addInitScript((t) => {
      try {
        localStorage.setItem('tsm-theme', t);
        localStorage.setItem('tsm-onboarded', '1');
        localStorage.setItem('tm-onboarded', '1');
        document.documentElement.setAttribute('data-theme', t);
      } catch {}
    }, theme);

    const page = await context.newPage();
    for (const s of SCREENS) {
      if (s.auth && !STORAGE_STATE) {
        results.push({ ...s, theme, status: 'skipped-auth' });
        console.log(`skip  ${theme}  ${s.path}  (auth-gated, no STORAGE_STATE)`);
        continue;
      }
      const url = BASE + s.path;
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
        await page.waitForTimeout(s.settle ?? 900);
        const file = `${OUT}/${s.id}-${theme}.png`;
        await page.screenshot({ path: file, fullPage: s.fullPage !== false });
        const landed = new URL(page.url()).pathname;
        results.push({ ...s, theme, status: resp?.status() ?? 0, landed, file });
        console.log(`ok    ${theme}  ${s.path} -> ${landed}  ${file}`);
      } catch (e) {
        results.push({ ...s, theme, status: 'error', error: String(e).slice(0, 120) });
        console.log(`FAIL  ${theme}  ${s.path}  ${String(e).slice(0, 120)}`);
      }
    }
    await context.close();
  }

  await browser.close();
  writeIndex(results);
  const ok = results.filter((r) => typeof r.status === 'number').length;
  const skipped = results.filter((r) => r.status === 'skipped-auth').length;
  const failed = results.filter((r) => r.status === 'error').length;
  console.log(`\ncaptured ${ok}  skipped(auth) ${skipped}  failed ${failed}  -> ${OUT}`);
  console.log(`contact sheet: ${OUT}/index.html`);
  if (failed) process.exitCode = 1;
}

// Local contact sheet: light vs dark side by side, one row per screen. Uses
// relative image paths (not base64) so it stays full-fidelity and instant.
function writeIndex(results) {
  const rows = SCREENS.map((s) => {
    const cells = THEMES.map((t) => {
      const r = results.find((x) => x.id === s.id && x.theme === t);
      if (r?.file) return `<figure><figcaption>${t}</figcaption><a href="${basename(r.file)}" target="_blank"><img loading="lazy" src="${basename(r.file)}" alt="${s.label} (${t})"></a></figure>`;
      const why = r?.status === 'skipped-auth' ? 'requires a signed-in session' : `not captured (${r?.status ?? 'n/a'})`;
      return `<figure class="miss"><figcaption>${t}</figcaption><div class="ph">${why}</div></figure>`;
    }).join('');
    return `<section><h2>${s.label} <code>${s.path}</code></h2><div class="pair">${cells}</div></section>`;
  }).join('\n');

  writeFileSync(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8">
<title>Tango Map — proofpack</title>
<style>
:root{color-scheme:light dark}
body{font:15px/1.5 system-ui,sans-serif;max-width:1600px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:26px;margin:0 0 4px} .sub{opacity:.65;margin:0 0 28px}
section{margin:0 0 40px} h2{font-size:15px;font-weight:600;margin:0 0 10px}
code{opacity:.6;font-weight:400;font-size:13px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figure{margin:0} figcaption{font:11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em;opacity:.55;margin-bottom:6px}
img{width:100%;border:1px solid rgba(128,128,128,.35);border-radius:10px;display:block}
.ph{border:1px dashed rgba(128,128,128,.4);border-radius:10px;padding:40px 16px;text-align:center;opacity:.5;font-size:13px}
@media(max-width:900px){.pair{grid-template-columns:1fr}}
</style>
<h1>Tango Map — proofpack</h1>
<p class="sub">${BASE} · every public screen, light and dark · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
${rows}
`);
}

main();
