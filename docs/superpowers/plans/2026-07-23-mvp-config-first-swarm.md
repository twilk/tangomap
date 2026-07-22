# Tango Map MVP — Config-First + Parallel TDD Swarm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Phase 1 is executed sequentially by the orchestrator (Claude in Chrome + CLI, human-gated secrets). Phase 2 tasks are **independent** and dispatched with superpowers:dispatching-parallel-agents / subagent-driven-development — one agent per task, run concurrently. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the Tango Map accounts MVP — Google sign-in, cross-device progress sync, and an optional shareable profile — by locking every contract up front so implementation parallelizes.

**Architecture:** A Next.js (App Router) app on `partykamap.vercel.app` serves the existing map bundle unchanged and adds Auth.js (Google) + Supabase Postgres (via Drizzle). Because the bundle already persists `tsm-mastered`/`tsm-theme`/`tsm-sel` to `localStorage`, a small injected script bridges that state to `/api/progress`. Phase 1 provisions all infra and freezes all contracts (schema, DTOs, skills data, pure libs); Phase 2 tasks then touch **disjoint files** and depend only on Phase 1.

**Tech Stack:** Next.js 15, TypeScript, Auth.js v5 (`next-auth@beta`) + `@auth/drizzle-adapter`, Drizzle ORM + `drizzle-kit`, Supabase Postgres (`postgres` driver), Vitest + jsdom, `@vercel/og`, Vercel.

---

## Phase 0 — Decisions (ANSWERED — locked)

| Decision | Choice |
|---|---|
| Auth | Auth.js v5, Google provider (redirect `.../api/auth/callback/google` already configured) |
| Database | **Supabase Postgres** |
| DB toolkit | **Drizzle ORM** |
| Profile | User-chosen `handle`, `is_public = false` by default, link `/u/[handle]` |
| Map integration | Serve existing bundle + bridge its `localStorage` to the server (no design-to-code source) |
| Package manager / tests / scope | npm / Vitest / full MVP (auth + sync + profile) |

**Open item resolved in Phase 1.1:** whether a Supabase account exists. If not, the user creates it (agents cannot create accounts) and supplies the connection string; everything else is unchanged.

---

## Phase 1 — Configuration & Foundation (SEQUENTIAL — orchestrator + Claude in Chrome)

This phase is **not parallelizable**. It provisions infra and commits every contract Phase 2 depends on. Secrets are entered by the human, never by an agent.

### 1.1 — Provision Supabase (Claude in Chrome)
- [ ] Confirm the user is logged into Supabase in the connected Chrome. If no account: **STOP**, user signs up, then supplies the project ref + DB password; skip to 1.2 with the connection string.
- [ ] In Chrome: create project "TangoMap" (region near users). Wait for it to finish provisioning.
- [ ] Copy the **pooled** connection string (Settings → Database → Connection string → "Transaction" pooler, port `6543`) → this is `DATABASE_URL`. Copy the **direct** string (port `5432`) → `DIRECT_URL` (for migrations). The DB password is set/entered by the **user**.

### 1.2 — Scaffold app + tooling (CLI)
- [ ] `npm init` and install: `next react react-dom next-auth@beta @auth/drizzle-adapter drizzle-orm postgres`; dev: `typescript @types/node @types/react vitest jsdom drizzle-kit @types/pg`.
- [ ] Create `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

- [ ] Create `tsconfig.json` (paths `@/*` → `./*`), `next.config.mjs` (rewrite `/` → `/tangomap.html`), `app/layout.tsx`, `vitest.config.ts` (environment `jsdom`, include `test/**/*.test.ts`). Append `node_modules .next next-env.d.ts` to `.gitignore`.
- [ ] `git mv index.html public/tangomap.html`.
- [ ] Commit: `chore: scaffold Next.js + drizzle + auth + vitest`.

### 1.3 — CONTRACT: Drizzle schema (`db/schema.ts`) + client (`db/index.ts`) + `drizzle.config.ts`

- [ ] Create `db/schema.ts` (Auth.js Drizzle tables + app tables):

```ts
import {
  pgTable, text, timestamp, primaryKey, integer, boolean, jsonb,
} from 'drizzle-orm/pg-core';

// --- Auth.js (@auth/drizzle-adapter) standard Postgres schema ---
export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) }));

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (v) => ({ pk: primaryKey({ columns: [v.identifier, v.token] }) }));

// --- App tables ---
export const progress = pgTable('progress', {
  userId: text('userId').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  mastered: jsonb('mastered').$type<string[]>().notNull().default([]),
  theme: text('theme'),                 // 'light' | 'dark' | null
  sel: text('sel'),                     // last selected node slug
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
});

export const profile = pgTable('profile', {
  userId: text('userId').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  handle: text('handle').unique(),
  isPublic: boolean('isPublic').notNull().default(false),
  displayName: text('displayName'),
  style: text('style'),                 // 'salon' | 'milonguero' | 'nuevo' | null
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
});
```

- [ ] Create `db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
```

- [ ] Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_URL! },
});
```

- [ ] Run migrations: `npm run db:generate && npm run db:migrate`. Verify tables exist in Supabase.
- [ ] Commit: `feat: drizzle schema + migrations (auth + progress + profile)`.

### 1.4 — CONTRACT: Auth.js instance (`auth.ts`) + route handler
- [ ] Create `auth.ts`:

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users, accountsTable: accounts,
    sessionsTable: sessions, verificationTokensTable: verificationTokens,
  }),
  providers: [Google],
  session: { strategy: 'database' },
});
```

- [ ] Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] Commit: `feat: auth.js drizzle adapter + google`.

### 1.5 — CONTRACT: shared types (`src/lib/types.ts`)
- [ ] Create `src/lib/types.ts`:

```ts
export type Theme = 'light' | 'dark';
export type Style = 'salon' | 'milonguero' | 'nuevo';

export type Progress = { mastered: string[]; theme: Theme | null; sel: string | null; updatedAt: string };
export type ProgressInput = { mastered: string[]; theme: Theme | null; sel: string | null };

export type ProfileDTO = { handle: string | null; isPublic: boolean; displayName: string | null; style: Style | null };
export type ProfileInput = Partial<Omit<ProfileDTO, never>>;

export type PublicProfile = { handle: string; displayName: string | null; style: Style | null; mastered: string[] };
```

- [ ] Commit: `feat: shared DTO types`.

### 1.6 — CONTRACT: canonical skills data (`src/data/skills.ts`) — extracted from the bundle
- [ ] Write `scripts/extract-skills.mjs` that reads `public/tangomap.html`, JSON-parses the `__bundler/template`, and pulls each node's `{slug, name, level}` from the app's node markup/aria-labels (labels look like `"Name — desc. Level N."`; slugs match `tsm-mastered` values e.g. `mirada-cabeceo`). Emit `src/data/skills.ts`:

```ts
// AUTO-GENERATED by scripts/extract-skills.mjs — do not edit by hand.
export type Skill = { slug: string; name: string; level: number };
export const SKILLS: Skill[] = [ /* 62 entries */ ];
export const SKILL_SLUGS: Set<string> = new Set(SKILLS.map((s) => s.slug));
```

- [ ] Add `test/skills.test.ts` asserting `SKILLS.length === 62`, levels span `1..10`, all slugs unique. Run: `npm test -- test/skills.test.ts` → PASS.
- [ ] Commit: `feat: canonical 62-skill data extracted from bundle`.

### 1.7 — CONTRACT: pure libs (`src/lib/progress.ts`, `src/lib/handle.ts`, `src/lib/injectScript.ts`) — TDD
These are small, pure, and shared, so they belong to the foundation (Phase 2 tasks import them, never each other).

- [ ] `src/lib/progress.ts` with tests `test/progress.test.ts`:

```ts
import { SKILLS, SKILL_SLUGS } from '@/src/data/skills';

export const sanitizeMastered = (arr: unknown): string[] =>
  Array.isArray(arr) ? [...new Set(arr.filter((s): s is string => typeof s === 'string' && SKILL_SLUGS.has(s)))].slice(0, 62) : [];

export const masteredCount = (m: string[]): number => sanitizeMastered(m).length;

export const perLevel = (m: string[]): Record<number, { done: number; total: number }> => {
  const set = new Set(sanitizeMastered(m));
  const out: Record<number, { done: number; total: number }> = {};
  for (let lvl = 1; lvl <= 10; lvl++) out[lvl] = { done: 0, total: 0 };
  for (const s of SKILLS) { out[s.level].total++; if (set.has(s.slug)) out[s.level].done++; }
  return out;
};

export const milestones = (count: number): number[] => [5, 10, 25, 50].filter((m) => count >= m);
```

Tests must cover: unknown slugs dropped, dedupe, cap at 62, `perLevel` totals sum to 62, `milestones(0)===[]`, `milestones(26)===[5,10,25]`.

- [ ] `src/lib/handle.ts` with tests `test/handle.test.ts`:

```ts
const RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/; // 3..30 chars, no leading/trailing hyphen
export const isValidHandle = (h: string): boolean => RE.test(h);
export const normalizeHandle = (h: string): string => h.trim().toLowerCase();
```

Tests: accepts `ana-tango`, rejects `ab`, `-ana`, `ana-`, `Ana`, `a`.repeat(31); `normalizeHandle(' Ana ')==='ana'`.

- [ ] `src/lib/injectScript.ts` — the bundle-template script injector (from Plan 1's `injectScriptIntoTemplate`, complete code + `test/injectScript.test.ts`; see `docs/superpowers/plans/2026-07-22-app-shell-and-google-auth.md` Task 4 for the exact implementation and tests).
- [ ] Run: `npm test` → all green. Commit: `feat: pure libs (progress derivations, handle, script injection)`.

### 1.8 — Env + deploy skeleton (Chrome for Vercel env; user pastes secrets)
- [ ] Create `.env.example` (committed) and `.env.local` (gitignored) with: `AUTH_GOOGLE_ID` (the configured Client ID), `AUTH_GOOGLE_SECRET` (user pastes from Google Console), `AUTH_SECRET` (`openssl rand -base64 33`), `AUTH_URL=https://partykamap.vercel.app`, `DATABASE_URL`, `DIRECT_URL`.
- [ ] In Chrome (or `vercel env add`): set the same vars on Vercel **production**. Secrets pasted by the **user**.
- [ ] `git push origin main` → Vercel builds Next.js. Verify `curl https://partykamap.vercel.app/api/auth/providers` shows `google`, and `/` still serves the map.
- [ ] **Phase 1 exit criteria:** app deploys; map served; `providers` endpoint OK; DB tables exist; `npm test` green. **Now Phase 2 can fan out.**

---

## Phase 2 — Parallel TDD swarm tasks (INDEPENDENT — one agent each)

Every task below touches **disjoint files** and imports only Phase 1 contracts (`db/schema`, `src/lib/types`, `src/data/skills`, `src/lib/progress`, `src/lib/handle`, `src/lib/injectScript`, `@/auth`). No task imports another Phase 2 task's output. Dispatch concurrently.

| Task | Owns (files) | Depends on (Phase 1 only) |
|---|---|---|
| T1 progress API | `app/api/progress/route.ts` + test | schema, types, progress lib, auth |
| T2 sync client | `public/sync.js`, `scripts/inject-sync.mjs` + test | injectScript, /api/progress **contract** |
| T3 profile API | `app/api/profile/route.ts` + test | schema, types, handle lib, auth |
| T4 settings page | `app/settings/page.tsx`, `app/settings/SettingsForm.tsx` + test | /api/profile **contract**, types |
| T5 public profile | `app/u/[handle]/page.tsx`, `src/lib/publicProfile.ts` + test | schema, progress lib, types |
| T6 OG image | `app/u/[handle]/opengraph-image.tsx` + test | publicProfile **contract**, progress lib |
| T7 auth control | `public/auth-ui.js`, `scripts/inject-auth-ui.mjs` + test | injectScript |

> T6 uses `getPublicProfile` from T5's file. To keep them independent, **its signature is frozen here**: `export async function getPublicProfile(handle: string): Promise<PublicProfile | null>` in `src/lib/publicProfile.ts`. T6 imports it and mocks it in tests; the real function is T5's deliverable. Same-file ownership stays with T5.

### T1 — `POST/GET /api/progress`
**Contract:** `GET` → `200 Progress` for the session user (empty default if no row); `401` if unauthenticated. `PUT` body `ProgressInput` → upsert (sanitized) → `200 Progress`; `401` if unauthenticated.
- [ ] **Write failing test** `test/api.progress.test.ts` — mock `@/auth` (`auth()` → `{user:{id:'u1'}}` or `null`) and `@/db`; assert 401 without session, that `PUT` calls upsert with `sanitizeMastered`-filtered slugs, and `GET` returns the row shape.
- [ ] **Run** → FAIL (route missing).
- [ ] **Implement** `app/api/progress/route.ts`:

```ts
import { auth } from '@/auth';
import { db } from '@/db';
import { progress } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeMastered } from '@/src/lib/progress';
import type { Progress, ProgressInput } from '@/src/lib/types';

const empty = (): Progress => ({ mastered: [], theme: null, sel: null, updatedAt: new Date(0).toISOString() });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const row = await db.query.progress.findFirst({ where: eq(progress.userId, session.user.id) });
  const body: Progress = row
    ? { mastered: row.mastered, theme: row.theme as Progress['theme'], sel: row.sel, updatedAt: row.updatedAt.toISOString() }
    : empty();
  return Response.json(body);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const input = (await req.json()) as ProgressInput;
  const mastered = sanitizeMastered(input.mastered);
  const theme = input.theme === 'dark' || input.theme === 'light' ? input.theme : null;
  const sel = typeof input.sel === 'string' ? input.sel : null;
  const now = new Date();
  await db.insert(progress).values({ userId: session.user.id, mastered, theme, sel, updatedAt: now })
    .onConflictDoUpdate({ target: progress.userId, set: { mastered, theme, sel, updatedAt: now } });
  return Response.json({ mastered, theme, sel, updatedAt: now.toISOString() } satisfies Progress);
}
```

- [ ] **Run** → PASS. **Commit** `feat: /api/progress GET+PUT`.

### T2 — progress sync client (`public/sync.js`) + injection
**Contract:** on load, if `GET /api/progress` returns a signed-in body with `updatedAt` newer than local, write `tsm-mastered`/`tsm-theme` into `localStorage`; on change (storage/Mutation), debounce `PUT` the union of local+server mastered (first-run migration = union).
- [ ] **Write failing test** `test/sync.test.ts` (jsdom): mock `fetch`; eval `public/sync.js`; assert (a) server-newer hydrates localStorage, (b) a local master triggers a debounced `PUT` whose body mastered is the union, (c) unauthenticated (`{}`/401) is a no-op.
- [ ] **Run** → FAIL. **Implement** `public/sync.js` (defensive IIFE; reads/writes `tsm-mastered`, `tsm-theme`; `credentials:'same-origin'`; debounce 800ms; union on first push). **Implement** `scripts/inject-sync.mjs` using `injectScriptIntoTemplate(html,'/sync.js')` with the JSON round-trip validation guard.
- [ ] **Run** injector; re-run `test/mapServed.test.ts` (bundle still valid) → PASS. **Commit** `feat: localStorage<->server progress sync baked into bundle`.

### T3 — `GET/PUT /api/profile`
**Contract:** `GET` → own `ProfileDTO` (defaults if no row); `PUT` body `ProfileInput` → validate `handle` via `isValidHandle`+`normalizeHandle`, enforce uniqueness (`409` on clash), `isPublic` boolean, `style ∈ {salon,milonguero,nuevo,null}`; `401` if unauthenticated.
- [ ] **Write failing test** `test/api.profile.test.ts` — mock `@/auth`,`@/db`; assert 401 anon, 409 on duplicate handle, invalid handle rejected (`400`), happy-path upsert.
- [ ] **Run** → FAIL. **Implement** `app/api/profile/route.ts` (upsert on `profile.userId`, unique-handle check, validation via `@/src/lib/handle`). **Run** → PASS. **Commit** `feat: /api/profile GET+PUT with handle validation`.

### T4 — `/settings` page
**Contract:** authenticated page; form for `displayName`, `handle`, `style`, `isPublic`; submits to `/api/profile`; shows the public URL `/{handle}` when public. Redirects to sign-in if no session.
- [ ] **Write failing test** `test/settings.test.tsx` — render `SettingsForm` (client component) with a mocked `fetch`; assert fields render from an initial `ProfileDTO`, toggling public + saving PUTs the expected body, and a handle-clash `409` shows an inline error.
- [ ] **Run** → FAIL. **Implement** `app/settings/page.tsx` (server: `auth()` guard, load `ProfileDTO`, render `<SettingsForm initial=.../>`) and `app/settings/SettingsForm.tsx` (client form). **Run** → PASS. **Commit** `feat: /settings profile form`.

### T5 — `/u/[handle]` public page + `getPublicProfile`
**Contract (frozen):** `getPublicProfile(handle: string): Promise<PublicProfile | null>` returns the row only when `isPublic`; page `notFound()` (404) otherwise. Renders allow-listed fields only: level+style, `X/62`, per-level bars, milestone badges. **Never** dates/sel.
- [ ] **Write failing test** `test/publicProfile.test.ts` — mock `@/db`; assert private/unknown handle → `null`; public → `PublicProfile` with mastered; the page renders 404 for null and the count via `masteredCount` for a hit.
- [ ] **Run** → FAIL. **Implement** `src/lib/publicProfile.ts` (join `profile`+`progress`, gate on `isPublic`, `normalizeHandle`) and `app/u/[handle]/page.tsx` (SSR; `notFound()` when null; render via `@/src/lib/progress`). **Run** → PASS. **Commit** `feat: public /u/[handle] profile (private-safe)`.

### T6 — dynamic OG image for `/u/[handle]`
**Contract:** `app/u/[handle]/opengraph-image.tsx` renders a 1200×630 image with `displayName`/handle, `X/62`, and a progress bar; falls back to a generic image when `getPublicProfile` returns null.
- [ ] **Write failing test** `test/og.test.ts` — mock `getPublicProfile`; assert the route module exports `size`/`contentType` and returns an `ImageResponse` for both hit and null. (Assert metadata + no-throw; pixel output is not asserted.)
- [ ] **Run** → FAIL. **Implement** using `next/og` `ImageResponse` + `masteredCount`. **Run** → PASS. **Commit** `feat: dynamic OG image for public profile`.

### T7 — auth sign-in/out control (`public/auth-ui.js`) + injection
Identical to `docs/superpowers/plans/2026-07-22-app-shell-and-google-auth.md` Task 5 (complete code + jsdom test there). Owns `public/auth-ui.js`, `scripts/inject-auth-ui.mjs`.
- [ ] Implement + test + bake into bundle + re-run `test/mapServed.test.ts`. **Commit** `feat: sign-in/out control baked into bundle`.

---

## Phase 3 — Integrate & rollout (SEQUENTIAL — after swarm merges)
- [ ] Merge all Phase 2 branches; run full `npm test` + `npm run build`; deploy.
- [ ] **E2E smoke:** sign in as test user → master a skill → reload → still mastered; open on a second browser signed in → same `X/62`; set a public handle → `/u/[handle]` renders with correct OG; a private profile 404s; delete-my-data removes rows.
- [ ] Publish OAuth **Testing → Production** (basic scopes need no verification) so any Google user can sign in.
- [ ] Commit: `docs: rollout notes`.

---

## Self-Review

**1. Spec coverage** (SPEC.md §5 features): auth → 1.4/T7; progress persistence+migration → T1/T2; profile (handle, private default) → T3/T4/T5; sharing+OG → T5/T6; privacy (allow-list, private default, deletion) → T5 + Phase 3; env/secrets → 1.8. All mapped.

**2. Placeholder scan:** the only intentional generated blank is `SKILLS` in `src/data/skills.ts` — filled by `scripts/extract-skills.mjs` (1.6), guarded by a 62-entry test, not a hand-wave. Secrets are human-entered by design. No "TBD/handle edge cases/similar to Task N".

**3. Type/name consistency:** DTOs (`Progress`, `ProgressInput`, `ProfileDTO`, `ProfileInput`, `PublicProfile`, `Theme`, `Style`) defined once in `src/lib/types.ts` and imported by T1/T3/T4/T5/T6. `sanitizeMastered`/`masteredCount`/`perLevel`/`milestones` from `src/lib/progress.ts`; `isValidHandle`/`normalizeHandle` from `src/lib/handle.ts`; `injectScriptIntoTemplate` from `src/lib/injectScript.ts`; `getPublicProfile` signature frozen and shared by T5 (impl) and T6 (consumer). Schema table/column names (`progress.userId`, `profile.handle`, `profile.isPublic`) match across schema and routes.

**Parallelism check:** T1–T7 own disjoint files and import only Phase 1 outputs → safe to run concurrently. T2/T6 depend on *contracts* (frozen signatures) not other tasks' code, and mock them in tests.

---

## Execution handoff
Phase 1 is orchestrator-driven (Claude in Chrome + CLI; user pastes secrets and, if needed, creates the Supabase account). After Phase 1 exit criteria pass, dispatch T1–T7 as a parallel swarm (superpowers:dispatching-parallel-agents / subagent-driven-development), review each on return, then run Phase 3.
