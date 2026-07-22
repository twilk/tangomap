# App Shell + Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static Tango Map deployment into a Next.js app on `partykamap.vercel.app` that still serves the existing map bundle unchanged and adds working Google sign-in.

**Architecture:** A Next.js (App Router) app serves the existing self-contained map bundle at `/` via a rewrite to a static file. Auth.js (NextAuth v5) provides Google OAuth at `/api/auth/*` using the already-configured Google client. A tiny client script (`/auth-ui.js`), baked into the bundle's own `__bundler/template` with the repo's proven injection technique, reads the session and renders a Sign-in / Sign-out control. No change to the compiled map internals. This is Plan 1 of 3 (next: progress sync, then profile/sharing — see `SPEC.md`).

**Tech Stack:** Next.js 15 (App Router, TypeScript), Auth.js v5 (`next-auth@beta`) Google provider, Vitest + jsdom for tests, Vercel for hosting.

**Preconditions (already done, see `SPEC.md`):** Google OAuth Web client "Tango Map Web" exists — Client ID `126538791453-u68op5k4kqni72efg0nke7ljf8cgmedu.apps.googleusercontent.com`, redirect `https://partykamap.vercel.app/api/auth/callback/google`, test user `wilczyy@gmail.com`. The Client Secret is in the Google Console (Clients → Tango Map Web). The current map bundle is the repo's root `index.html`.

---

## File Structure

- `package.json` — Next.js app manifest + scripts (new).
- `next.config.mjs` — rewrite `/` → `/tangomap.html` (new).
- `tsconfig.json` — TypeScript config with `@/*` path alias (new).
- `vitest.config.ts` — Vitest + jsdom setup (new).
- `auth.ts` — Auth.js instance (Google provider) (new).
- `app/api/auth/[...nextauth]/route.ts` — Auth.js route handlers (new).
- `public/tangomap.html` — the existing map bundle, moved from `index.html` (moved).
- `public/auth-ui.js` — client script: fetch session, render sign-in/out control (new).
- `src/lib/injectAuthUi.ts` — pure helper that bakes a `<script src>` into the bundle template (new).
- `scripts/inject-auth-ui.mjs` — one-shot runner that applies the helper to `public/tangomap.html` (new).
- `test/injectAuthUi.test.ts`, `test/authUi.test.ts` — unit tests (new).
- `.env.example` (committed), `.env.local` (gitignored) — env vars (new).

---

## Task 1: Scaffold the Next.js app + test runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `app/layout.tsx`, `.gitignore` (append), `test/smoke.test.ts`

- [ ] **Step 1: Create `package.json`**

Create `package.json`:

```json
{
  "name": "tangomap",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "inject:auth-ui": "node scripts/inject-auth-ui.mjs"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "next-auth": "5.0.0-beta.25"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "vitest": "2.1.8",
    "jsdom": "25.0.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `tsconfig.json`**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs` and minimal `app/layout.tsx`**

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/', destination: '/tangomap.html' }];
  },
};
export default nextConfig;
```

Create `app/layout.tsx` (required by App Router even though `/` is a rewrite):

```tsx
export const metadata = { title: 'Tango Map' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Append build artifacts to `.gitignore`**

Append to `.gitignore` (the file already ignores `.vercel`, `.env*`):

```
node_modules
.next
next-env.d.ts
```

- [ ] **Step 7: Write a smoke test**

Create `test/smoke.test.ts`:

```ts
import { test, expect } from 'vitest';

test('test runner works', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 8: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs app/layout.tsx vitest.config.ts .gitignore test/smoke.test.ts
git commit -m "chore: scaffold Next.js app + vitest"
```

---

## Task 2: Serve the existing map bundle at `/`

**Files:**
- Move: `index.html` → `public/tangomap.html`
- Test: `test/mapServed.test.ts`

- [ ] **Step 1: Move the bundle into `public/`**

Run:

```bash
mkdir -p public
git mv index.html public/tangomap.html
```

Expected: `public/tangomap.html` exists; repo root no longer has `index.html`.

- [ ] **Step 2: Write a test asserting the bundle is a valid self-contained page**

Create `test/mapServed.test.ts`:

```ts
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

test('map bundle exists and is a self-contained document', () => {
  const html = readFileSync('public/tangomap.html', 'utf8');
  expect(html).toContain('<!DOCTYPE html>');
  expect(html).toContain('__bundler/template');
  // 62 skills bundle is large; guard against accidental truncation
  expect(html.length).toBeGreaterThan(200_000);
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm test -- test/mapServed.test.ts`
Expected: PASS.

- [ ] **Step 4: Manually verify the rewrite serves the map**

Run: `npm run dev` then open `http://localhost:PORT/` (use the port Next prints; 3000 is taken on this machine).
Expected: the tango map renders exactly as on production. Stop the dev server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add public/tangomap.html
git commit -m "feat: serve map bundle at / via public/tangomap.html rewrite"
```

---

## Task 3: Add Auth.js with the Google provider

**Files:**
- Create: `auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `.env.example`, `.env.local`

- [ ] **Step 1: Create the Auth.js instance**

Create `auth.ts`:

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
});
```

> Auth.js v5 automatically reads `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` for the Google provider, and `AUTH_SECRET` for session encryption.

- [ ] **Step 2: Wire the route handlers**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Create `.env.example` (committed)**

Create `.env.example`:

```
# From Google Console -> Clients -> Tango Map Web
AUTH_GOOGLE_ID=126538791453-u68op5k4kqni72efg0nke7ljf8cgmedu.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=
# openssl rand -base64 33
AUTH_SECRET=
AUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Create `.env.local` (gitignored) with real dev values**

Create `.env.local` (NOT committed — `.env*` is already gitignored):

```
AUTH_GOOGLE_ID=126538791453-u68op5k4kqni72efg0nke7ljf8cgmedu.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=<paste from Google Console>
AUTH_SECRET=<output of: openssl rand -base64 33>
AUTH_URL=http://localhost:3000
```

Run to generate a secret: `openssl rand -base64 33`

- [ ] **Step 5: Verify the providers endpoint lists Google**

Run: `npm run dev` (note the port), then in another terminal:
`curl -s http://localhost:PORT/api/auth/providers`
Expected: JSON containing `"google"` with `"callbackUrl"` ending in `/api/auth/callback/google`. Stop the dev server.

> Note: local sign-in against Google will redirect-error unless `http://localhost:PORT` is added as an authorized origin/redirect in the Console. For this plan we verify the *provider wiring* locally and verify *actual sign-in* on the deployed domain (Task 6), which is already authorized. Adding a localhost origin is optional and out of scope here.

- [ ] **Step 6: Commit**

```bash
git add auth.ts app/api/auth/[...nextauth]/route.ts .env.example
git commit -m "feat: add Auth.js Google provider and route handlers"
```

---

## Task 4: Pure helper to bake a `<script>` into the bundle template

The bundle replaces `document.documentElement` with its `__bundler/template` at boot, so a script must live **inside** that JSON-encoded template (same technique as this repo's `scratchpad/patch_pe*.js`). This task builds and tests that helper in isolation.

**Files:**
- Create: `src/lib/injectAuthUi.ts`
- Test: `test/injectAuthUi.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/injectAuthUi.test.ts`:

```ts
import { test, expect } from 'vitest';
import { injectScriptIntoTemplate } from '@/src/lib/injectAuthUi';

// A minimal stand-in for the bundle: a __bundler/template script whose value is a
// JSON string of HTML, with closing tags escaped as / exactly like the real bundle.
function fakeBundle(templateHtml: string): string {
  const json = JSON.stringify(templateHtml).replace(/<\//g, '<\\u002F');
  return `<html><body>\n<script type="__bundler/template">\n${json}\n</script>\n</body></html>`;
}

function decodeTemplate(bundle: string): string {
  const open = '<script type="__bundler/template">';
  const i = bundle.indexOf(open) + open.length;
  const j = bundle.indexOf('</script>', i);
  return JSON.parse(bundle.slice(i, j).trim());
}

test('injects the script tag before </head> inside the template', () => {
  const bundle = fakeBundle('<!DOCTYPE html>\n<html><head>\n<title>x<\/title>\n<\/head>\n<body>hi<\/body><\/html>');
  const out = injectScriptIntoTemplate(bundle, '/auth-ui.js');
  const decoded = decodeTemplate(out);
  expect(decoded).toContain('<script src="/auth-ui.js" defer><\/script>');
  expect(decoded.indexOf('/auth-ui.js')).toBeLessThan(decoded.indexOf('</head>'));
});

test('result is still valid JSON with no literal </script inside the template', () => {
  const bundle = fakeBundle('<!DOCTYPE html>\n<html><head>\n<\/head>\n<body><\/body><\/html>');
  const out = injectScriptIntoTemplate(bundle, '/auth-ui.js');
  const open = '<script type="__bundler/template">';
  const i = out.indexOf(open) + open.length;
  const j = out.indexOf('</script>', i);
  const raw = out.slice(i, j);
  expect(() => JSON.parse(raw.trim())).not.toThrow();
  expect(/<\/script/i.test(raw)).toBe(false);
});

test('is idempotent — injecting twice does not duplicate', () => {
  const bundle = fakeBundle('<html><head><\/head><body><\/body></html>');
  const once = injectScriptIntoTemplate(bundle, '/auth-ui.js');
  const twice = injectScriptIntoTemplate(once, '/auth-ui.js');
  const count = (decodeTemplate(twice).match(/\/auth-ui\.js/g) || []).length;
  expect(count).toBe(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/injectAuthUi.test.ts`
Expected: FAIL — cannot find module `@/src/lib/injectAuthUi`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/injectAuthUi.ts`:

```ts
const OPEN = '<script type="__bundler/template">';

/**
 * Bake `<script src="{scriptSrc}" defer></script>` into the last position of the
 * bundle's __bundler/template <head>. The template is a JSON-encoded HTML string in
 * which closing tags are escaped as /; we preserve that so the outer bundler
 * <script> is never closed early. Idempotent.
 */
export function injectScriptIntoTemplate(bundleHtml: string, scriptSrc: string): string {
  const i = bundleHtml.indexOf(OPEN);
  if (i < 0) throw new Error('injectScriptIntoTemplate: __bundler/template not found');
  const start = i + OPEN.length;
  const end = bundleHtml.indexOf('</script>', start);
  if (end < 0) throw new Error('injectScriptIntoTemplate: template close not found');

  const decoded: string = JSON.parse(bundleHtml.slice(start, end).trim());
  if (decoded.includes(scriptSrc)) return bundleHtml; // idempotent

  const headClose = decoded.indexOf('</head>');
  if (headClose < 0) throw new Error('injectScriptIntoTemplate: </head> not found in template');

  const tag = `<script src="${scriptSrc}" defer></script>`;
  const patched = decoded.slice(0, headClose) + tag + decoded.slice(headClose);

  // Re-encode: JSON.stringify then re-escape every "</" to "</" (bundle convention),
  // which guarantees no literal </script closes the outer <script type="__bundler/template">.
  const reencoded = JSON.stringify(patched).replace(/<\//g, '<\\u002F');

  return bundleHtml.slice(0, start) + '\n' + reencoded + '\n' + bundleHtml.slice(end);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- test/injectAuthUi.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/injectAuthUi.ts test/injectAuthUi.test.ts
git commit -m "feat: tested helper to bake a script into the bundle template"
```

---

## Task 5: The auth-UI client script + one-shot injection into the bundle

**Files:**
- Create: `public/auth-ui.js`
- Test: `test/authUi.test.ts`
- Create: `scripts/inject-auth-ui.mjs`
- Modify: `public/tangomap.html` (baked by the runner)

- [ ] **Step 1: Write the failing test for the client control**

Create `test/authUi.test.ts`:

```ts
import { test, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('public/auth-ui.js', 'utf8');

async function run(session: unknown) {
  document.documentElement.innerHTML = '<head></head><body></body>';
  (globalThis as any).fetch = vi.fn(async () => ({ json: async () => session }));
  // eslint-disable-next-line no-eval
  (0, eval)(SRC); // executes the IIFE against the current jsdom document
  await new Promise((r) => setTimeout(r, 0)); // let the fetch().then microtasks flush
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

test('renders a Google sign-in link when there is no session', async () => {
  await run({}); // Auth.js returns {} for anonymous
  const el = document.getElementById('tm-auth');
  expect(el).not.toBeNull();
  const link = el!.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('/api/auth/signin');
  expect(link.textContent).toMatch(/sign in/i);
});

test('renders a sign-out link when a user is present', async () => {
  await run({ user: { name: 'Wilk', email: 'wilczyy@gmail.com' } });
  const link = document.querySelector('#tm-auth a')!;
  expect(link.getAttribute('href')).toBe('/api/auth/signout');
  expect(link.textContent).toMatch(/sign out/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/authUi.test.ts`
Expected: FAIL — `ENOENT: public/auth-ui.js` (file does not exist yet).

- [ ] **Step 3: Implement the client script**

Create `public/auth-ui.js`:

```js
(function () {
  try {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var signedIn = !!(s && s.user);
        var el = document.getElementById('tm-auth') || document.createElement('div');
        el.id = 'tm-auth';
        el.style.cssText =
          'position:fixed;top:8px;right:8px;z-index:2147483001;' +
          'font:600 13px system-ui,sans-serif';
        var href = signedIn ? '/api/auth/signout' : '/api/auth/signin';
        var label = signedIn ? 'Sign out' : 'Sign in with Google';
        el.innerHTML =
          '<a href="' + href + '" style="text-decoration:none;background:#c67139;' +
          'color:#fff;border-radius:999px;padding:6px 12px">' + label + '</a>';
        if (!el.parentNode && document.body) document.body.appendChild(el);
      })
      .catch(function () {});
  } catch (e) {}
})();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- test/authUi.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Write the one-shot injection runner**

Create `scripts/inject-auth-ui.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { injectScriptIntoTemplate } from '../src/lib/injectAuthUi.ts';

const PATH = 'public/tangomap.html';
const html = readFileSync(PATH, 'utf8');
const out = injectScriptIntoTemplate(html, '/auth-ui.js');

// Validate the round-trip before writing.
const open = '<script type="__bundler/template">';
const i = out.indexOf(open) + open.length;
const j = out.indexOf('</script>', i);
const raw = out.slice(i, j);
if (/<\/script/i.test(raw)) throw new Error('literal </script in template — aborting');
const decoded = JSON.parse(raw.trim());
if (!decoded.includes('/auth-ui.js')) throw new Error('auth-ui.js not present after inject');
if (!decoded.includes('<helmet>')) throw new Error('app body lost — aborting');

writeFileSync(PATH, out);
console.log('OK: /auth-ui.js baked into', PATH);
```

> The runner imports a `.ts` file; run it with Node's TS stripping (Node 22.6+): `node --experimental-strip-types scripts/inject-auth-ui.mjs`. If unavailable, compile `src/lib/injectAuthUi.ts` first or inline the function into the `.mjs`.

- [ ] **Step 6: Run the injection and verify**

Run: `node --experimental-strip-types scripts/inject-auth-ui.mjs`
Expected: prints `OK: /auth-ui.js baked into public/tangomap.html`.

Then re-run the guard test to confirm the real bundle is still valid:

Run: `npm test -- test/mapServed.test.ts`
Expected: PASS.

- [ ] **Step 7: Manually verify the control renders on the map**

Run: `npm run dev`, open `http://localhost:PORT/`.
Expected: the map renders and a "Sign in with Google" pill appears top-right. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add public/auth-ui.js test/authUi.test.ts scripts/inject-auth-ui.mjs public/tangomap.html
git commit -m "feat: sign-in/out control baked into the map bundle"
```

---

## Task 6: Deploy to Vercel and smoke-test real Google sign-in

**Files:** none (configuration + verification).

- [ ] **Step 1: Set production env vars on Vercel**

Run (Vercel CLI, project already linked):

```bash
vercel env add AUTH_GOOGLE_ID production
vercel env add AUTH_GOOGLE_SECRET production
vercel env add AUTH_SECRET production
vercel env add AUTH_URL production
```

Values: `AUTH_GOOGLE_ID` = the Client ID from `.env.example`; `AUTH_GOOGLE_SECRET` = the secret from the Google Console; `AUTH_SECRET` = a fresh `openssl rand -base64 33`; `AUTH_URL` = `https://partykamap.vercel.app`.

- [ ] **Step 2: Push to deploy**

```bash
git push origin main
```

Expected: Vercel detects Next.js, builds, and deploys to `partykamap.vercel.app`. The framework changes from static to Next.js on this deploy.

- [ ] **Step 3: Verify the providers endpoint in production**

Run: `curl -s https://partykamap.vercel.app/api/auth/providers`
Expected: JSON with `"google"` and `callbackUrl` `https://partykamap.vercel.app/api/auth/callback/google`.

- [ ] **Step 4: Smoke-test sign-in as the test user**

In a browser, open `https://partykamap.vercel.app/`, click "Sign in with Google", complete Google auth as `wilczyy@gmail.com`.
Expected: redirect back to the map; the control now shows "Sign out".

- [ ] **Step 5: Verify the session endpoint returns the user**

While signed in, open `https://partykamap.vercel.app/api/auth/session`.
Expected: JSON containing `user` with the signed-in email. Sign out via the control and confirm the session endpoint returns `{}`.

- [ ] **Step 6: Commit any config note (optional)**

If a deploy note or README update was made, commit it:

```bash
git add README.md
git commit -m "docs: note Next.js deploy + env vars for auth"
```

---

## Self-Review

**1. Spec coverage (Plan 1 = SPEC.md Phase 0 + Phase 1).**
- Serve the existing bundle from Next.js at the same domain, no regression → Task 2, Task 5 step 7.
- Auth.js + Google provider, env vars → Task 3, Task 6 step 1.
- Sign-in / sign-out UI + session → Task 5 (control), Task 6 steps 4–5.
- "Done when the test user can sign in and see a session; sign-out works" → Task 6 steps 4–5.
- Progress persistence, DB, migration, profile, OG → **intentionally deferred to Plans 2 & 3** (dependent milestones). Not gaps in this plan.

**2. Placeholder scan.** No "TBD/handle edge cases/similar to Task N". Every code step shows complete code; the only human-supplied values are secrets (`AUTH_GOOGLE_SECRET`, `AUTH_SECRET`) which must not be written by an agent — correctly left as explicit fill-ins in `.env.local`/Vercel env, never committed.

**3. Type/name consistency.** The helper is `injectScriptIntoTemplate(bundleHtml, scriptSrc)` in `src/lib/injectAuthUi.ts`, imported with that exact name in `test/injectAuthUi.test.ts` and `scripts/inject-auth-ui.mjs`. The client artifact is `public/auth-ui.js`, served at `/auth-ui.js`, and that exact `scriptSrc` string is used in the runner, the helper test, and the bundle. The Auth.js exports (`handlers`) match between `auth.ts` and `app/api/auth/[...nextauth]/route.ts`. The control element id `tm-auth` matches between `public/auth-ui.js` and `test/authUi.test.ts`.

**Result:** consistent; no gaps within Plan 1's scope.

---

## Next plans (write on request)
- **Plan 2 — Progress sync:** Postgres + Auth.js adapter, `progress` table, `GET/PUT /api/progress`, and an injected sync script that mirrors `tsm-mastered`/`tsm-theme`/`tsm-sel` ↔ server (with first-login union migration). Requires the DB-host decision (Supabase vs Neon).
- **Plan 3 — Profile & sharing:** `profile` table, `/settings`, `/u/[handle]` SSR (404 when private), dynamic OG image; then publish OAuth Testing → Production.
