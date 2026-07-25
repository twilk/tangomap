# Theme Presets, Community Sharing & Compare Propagation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each dancer a library of up to 5 named theme presets, let them publish one to a community gallery (`Name — by @handle`), render every preset control in its own colors, and propagate the active theme to the dancer card and the compare view (each half in its own theme, auto-reconciled when the two clash).

**Architecture:** The existing single `profile.customTheme` stays the *active* theme (already drives the app, card, and cross-device sync). A new `theme_preset` table holds the *library* (≤5 rows/user); applying a preset copies its seeds into `profile.customTheme`. Publishing flags one preset `isShared` and is gated on `isPublic`. All seeds pass the existing `parseTheme` legibility/trust boundary on every store, publish, read, and apply. Compare renders each dancer's half from its own `deriveTokens`, with a pure `reconcileCompare(a,b)` pass that nudges values only where the two halves share/adjoin.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Auth.js v5, Drizzle/Postgres, Vitest (jsdom). Engine already built: `src/lib/theme.ts` (`Theme`, `parseTheme`, `deriveTokens`, `AA_CONTRAST`=4.5, `AA_UI_CONTRAST`=3), `src/lib/color.ts` (`parseHex`, `toHex`, `mix`, `rgba`, `relativeLuminance`, `contrastRatio`), `src/lib/cardTheme.ts` (`cardPaletteFor`), `design/tokens.ts` (`cssVar`).

---

## Scope check

Three subsystems share one foundation (the preset data model): **(P2–P3) preset library**, **(P4–P5) community sharing + gallery**, **(P6) compare theming**. They are sequenced so each phase is independently shippable and testable. If you prefer, P6 can be split into its own plan — it depends only on `deriveTokens`, not on the library. Do NOT start P2+ until Phase 1's migration is confirmed present in the **production** DB (see the migrate-before-merge gate — a prior release 500'd prod by merging schema ahead of the DB).

## File structure

**New files**
- `db/schema.ts` — add `theme_preset` table (modify).
- `drizzle/0004_*.sql` + meta — generated migration (Phase 1).
- `src/lib/presets.ts` — pure preset helpers: cap/validation, active-copy, community gating, self-preview token mapping.
- `src/lib/compareTheme.ts` — pure `reconcileCompare(a,b)` clash reconciliation.
- `app/api/presets/route.ts` — GET (list) + POST (create).
- `app/api/presets/[id]/route.ts` — PATCH (rename / set-active / set-shared) + DELETE.
- `app/api/community-themes/route.ts` — GET shared presets (gated read model).
- `src/components/PresetLibrary.tsx` — library list + save-as-preset (client), self-colored rows.
- `src/components/CommunityThemes.tsx` — gallery panel (client), self-colored apply buttons.
- Tests: `test/presets.test.ts`, `test/compareTheme.test.ts`, `test/api.presets.test.ts`, `test/api.communityThemes.test.ts`, `test/presetLibrary.test.tsx`, `test/communityThemes.test.tsx`, extend `test/publicProfile.test.ts`.

**Modified files**
- `src/lib/types.ts` — `ThemePreset`, `CommunityTheme` DTOs.
- `app/settings/ThemeEditor.tsx` — mount `<PresetLibrary/>` + `<CommunityThemes/>`; "share" wiring.
- `app/settings/page.tsx` — pass `isPublic`/`handle` to the editor for the share gate.
- `src/lib/publicProfile.ts` — `getSharedTheme(handle)` for the profile "apply" affordance (optional, P5).
- `app/compare/page.tsx` + `src/components/DnaCompareRadar.tsx` — apply per-half themes via `reconcileCompare` (P6).

---

## Phase 1 — Data model & migration

### Task 1: `theme_preset` table

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0004_*.sql` (generated)

- [ ] **Step 1: Add the table to `db/schema.ts`** (after the `profile` table). The struct `Theme` type is already imported at the top (`import type { Theme } from '../src/lib/theme'`).

```ts
// A user's saved theme presets (library, ≤5 enforced in the API). The ACTIVE
// theme still lives in profile.customTheme; a preset is a named, reusable set of
// seeds. At most one preset per user may be `isShared` (community gallery).
export const themePreset = pgTable('theme_preset', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  seeds: jsonb('seeds').$type<Theme>().notNull(),
  isShared: boolean('isShared').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
}, (t) => ({ byUser: index('theme_preset_userId_idx').on(t.userId) }));
```
Add `index` to the `drizzle-orm/pg-core` import if not present.

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: writes `drizzle/0004_*.sql` creating `theme_preset` (+ FK + index) and a new `meta` snapshot/journal entry. Confirm the SQL is purely additive (a `CREATE TABLE`, no `ALTER`/`DROP` on existing tables).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts drizzle/
git commit -m "feat(theme): theme_preset table + migration 0004 (additive)"
```

> **MIGRATE-BEFORE-MERGE GATE (non-negotiable):** `db.query.*.findFirst()` selects every column declared in the schema, so a table/column in `schema.ts` that is absent from the prod DB 500s reads. Before merging ANY code from Phase 2 onward: (1) apply `0004` to the **production** DB (`npm run db:migrate` with `.env.local`'s `DIRECT_URL` pointing at prod, OR run the `CREATE TABLE` in the prod SQL console), (2) confirm the table exists in prod, (3) only then merge. A `theme_preset`-reading endpoint returning 500 on prod means the table is still missing.

---

## Phase 2 — Preset library: pure helpers + API

### Task 2: Pure preset helpers (`src/lib/presets.ts`)

**Files:**
- Create: `src/lib/presets.ts`
- Test: `test/presets.test.ts`

- [ ] **Step 1: Write failing tests** (`test/presets.test.ts`)

```ts
import { test, expect } from 'vitest';
import { PRESET_CAP, isValidPresetName, sanitizePresetName, canSavePreset, presetStyleVars } from '@/src/lib/presets';
import { deriveTokens } from '@/src/lib/theme';
import { cssVar } from '@/design/tokens';

const T = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' } as const;

test('cap is 5', () => expect(PRESET_CAP).toBe(5));

test('name validation: 2–24 visible chars, trims, rejects empty/too-long', () => {
  expect(isValidPresetName('Carmesí')).toBe(true);
  expect(isValidPresetName(' a ')).toBe(false);        // 1 visible char
  expect(isValidPresetName('x'.repeat(25))).toBe(false);
  expect(sanitizePresetName('  Neon  Nights ')).toBe('Neon Nights');
});

test('canSavePreset: false at cap, true below, false on duplicate name (case-insensitive)', () => {
  const names = ['A', 'B', 'C', 'D'];
  expect(canSavePreset(names, 'E')).toEqual({ ok: true });
  expect(canSavePreset([...names, 'X'], 'F')).toEqual({ ok: false, reason: 'cap' });
  expect(canSavePreset(names, 'a')).toEqual({ ok: false, reason: 'duplicate' });
});

test('presetStyleVars maps every derived token to its --tm-* var for a self-preview', () => {
  const vars = presetStyleVars(T);
  const tokens = deriveTokens(T);
  for (const k of Object.keys(tokens)) expect(vars[cssVar(k as keyof typeof tokens)]).toBe(tokens[k as keyof typeof tokens]);
  expect(vars[cssVar('ground')]).toBe(tokens.ground);
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run test/presets.test.ts`) — "not exported".

- [ ] **Step 3: Implement `src/lib/presets.ts`**

```ts
import { parseTheme, deriveTokens, type Theme } from '@/src/lib/theme';
import { cssVar } from '@/design/tokens';

export const PRESET_CAP = 5;

/** Collapse internal whitespace + trim; the stored/display form. */
export function sanitizePresetName(raw: string): string {
  return String(raw).replace(/\s+/g, ' ').trim();
}
/** 2–24 visible characters after sanitising. */
export function isValidPresetName(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const n = sanitizePresetName(raw);
  return n.length >= 2 && n.length <= 24;
}

export type SaveCheck = { ok: true } | { ok: false; reason: 'cap' | 'duplicate' | 'name' };
/** Gate a new save against the cap and case-insensitive name collisions. */
export function canSavePreset(existingNames: string[], name: string): SaveCheck {
  if (!isValidPresetName(name)) return { ok: false, reason: 'name' };
  if (existingNames.length >= PRESET_CAP) return { ok: false, reason: 'cap' };
  const lc = sanitizePresetName(name).toLowerCase();
  if (existingNames.some((n) => sanitizePresetName(n).toLowerCase() === lc)) {
    return { ok: false, reason: 'duplicate' };
  }
  return { ok: true };
}

/** Inline CSS custom properties that paint a control in a preset's OWN colors —
 *  the "self-preview". Same mapping the editor live-preview and customStyleText use. */
export function presetStyleVars(theme: Theme): Record<string, string> {
  const t = deriveTokens(theme);
  const out: Record<string, string> = {};
  for (const k of Object.keys(t) as (keyof typeof t)[]) out[cssVar(k)] = t[k];
  return out;
}

/** Server-side trust boundary re-export for the API layer. */
export { parseTheme };
```

- [ ] **Step 4: Run — expect PASS.** **Step 5: `npx tsc --noEmit`. Step 6: Commit** `feat(theme): pure preset helpers (cap, name, self-preview vars)`.

### Task 3: Preset DTOs (`src/lib/types.ts`)

**Files:** Modify `src/lib/types.ts`

- [ ] **Step 1: Add types** (import the struct Theme aliased to avoid the existing mode-string `Theme`):

```ts
import type { Theme as ThemeSeeds } from '@/src/lib/theme';

export type ThemePreset = {
  id: string;
  name: string;
  seeds: ThemeSeeds;
  isShared: boolean;
  updatedAt: string; // ISO
};
export type ThemePresetInput = { name: string; seeds: ThemeSeeds };
/** Public read model for the community gallery — never any private field. */
export type CommunityTheme = {
  id: string;
  name: string;
  seeds: ThemeSeeds;
  authorHandle: string;
  authorDisplayName: string | null;
};
```

- [ ] **Step 2: `npx tsc --noEmit`. Step 3: Commit** `feat(theme): preset + community DTOs`.

### Task 4: Preset list/create API (`app/api/presets/route.ts`)

**Files:**
- Create: `app/api/presets/route.ts`
- Test: `test/api.presets.test.ts`

- [ ] **Step 1: Write failing tests** — mirror `test/api.profile.test.ts`'s `vi.hoisted`/`vi.mock('@/auth')`/`vi.mock('@/db')` pattern. Mock `db.query.themePreset.findMany` and the `insert().values().returning()` chain.

```ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
const { mockAuth, mockFindMany, mockInsert, mockValues, mockReturning } = vi.hoisted(() => ({
  mockAuth: vi.fn(), mockFindMany: vi.fn(), mockInsert: vi.fn(), mockValues: vi.fn(), mockReturning: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mockAuth }));
vi.mock('@/db', () => ({ db: { query: { themePreset: { findMany: mockFindMany } }, insert: mockInsert } }));
const load = () => import('@/app/api/presets/route');
const post = (b: unknown) => new Request('http://localhost/api/presets', { method: 'POST', body: JSON.stringify(b) });
const valid = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };

beforeEach(() => {
  vi.clearAllMocks();
  mockReturning.mockResolvedValue([{ id: 'p1', name: 'Carmesí', seeds: valid, isShared: false, updatedAt: new Date(0) }]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });
  mockFindMany.mockResolvedValue([]);
});

describe('presets API', () => {
  test('GET 401 unauth', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await (await load()).GET()).status).toBe(401);
  });
  test('POST rejects an illegible theme with 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await (await load()).POST(post({ name: 'Bad', seeds: { v: 1, ground: '#111', ink: '#131313', accent: '#111', accent2: '#111' } }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });
  test('POST rejects at cap (5 existing) with 409 cap', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindMany.mockResolvedValue([1, 2, 3, 4, 5].map((i) => ({ name: `P${i}` })));
    const res = await (await load()).POST(post({ name: 'Sixth', seeds: valid }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'cap' });
  });
  test('POST happy path inserts the parsed (canonical) seeds and returns the row', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await (await load()).POST(post({ name: '  Carmesí ', seeds: valid }));
    expect(res.status).toBe(200);
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', name: 'Carmesí' }));
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `app/api/presets/route.ts`**

```ts
import { auth } from '@/auth';
import { db } from '@/db';
import { themePreset } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseTheme } from '@/src/lib/theme';
import { PRESET_CAP, isValidPresetName, sanitizePresetName, canSavePreset } from '@/src/lib/presets';
import type { ThemePreset } from '@/src/lib/types';

const toDTO = (r: { id: string; name: string; seeds: unknown; isShared: boolean; updatedAt: Date }): ThemePreset => ({
  id: r.id, name: r.name, seeds: parseTheme(r.seeds)!, isShared: r.isShared, updatedAt: r.updatedAt.toISOString(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await db.query.themePreset.findMany({ where: eq(themePreset.userId, session.user.id) });
  // Defensive: drop any row whose stored seeds no longer validate.
  return Response.json(rows.map((r) => ({ ...r })).filter((r) => parseTheme(r.seeds)).map(toDTO));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  let body: { name?: unknown; seeds?: unknown };
  try {
    const p = await req.json();
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw 0;
    body = p;
  } catch { return Response.json({ error: 'invalid_body' }, { status: 400 }); }

  const seeds = parseTheme(body.seeds);
  if (!seeds) return Response.json({ error: 'invalid_theme' }, { status: 400 });
  if (!isValidPresetName(body.name)) return Response.json({ error: 'invalid_name' }, { status: 400 });
  const name = sanitizePresetName(body.name as string);

  const existing = await db.query.themePreset.findMany({ where: eq(themePreset.userId, userId) });
  const check = canSavePreset(existing.map((e) => e.name), name);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 409 });

  const [row] = await db.insert(themePreset)
    .values({ userId, name, seeds, isShared: false })
    .returning();
  return Response.json(toDTO(row));
}
```

- [ ] **Step 4: Run — expect PASS. Step 5: `npx tsc --noEmit`. Step 6: Commit** `feat(theme): presets list/create API (cap + parseTheme gate)`.

### Task 5: Preset mutate/delete API (`app/api/presets/[id]/route.ts`)

**Files:**
- Create: `app/api/presets/[id]/route.ts`
- Test: extend `test/api.presets.test.ts`

Behavior: `PATCH` accepts a partial `{ name?, isShared?, setActive? }`. Ownership enforced (row.userId === session.user.id, else 404). `name` re-validated + de-duped. `isShared:true` enforces **0-or-1 per user** (clear the flag on the user's other presets in the same transaction) AND requires the profile to be **public with a handle** (else 409 `needs_public`). `setActive:true` copies the preset's seeds into `profile.customTheme` + bumps `customThemeUpdatedAt` (reuse the profile write path). `DELETE` removes the row (and if it was shared, nothing else needs clearing).

- [ ] **Step 1: Write failing tests** (append):

```ts
// PATCH isShared:true when the profile is private → 409 needs_public, no write
// PATCH isShared:true when public+handle → clears other presets' isShared, sets this one
// PATCH setActive:true → writes profile.customTheme = this.seeds + a Date customThemeUpdatedAt
// PATCH name → re-validated + de-duped (409 duplicate)
// PATCH/DELETE on a row owned by another user → 404
```
(Mock `db.query.themePreset.findFirst`, `db.query.profile.findFirst`, `db.update(...).set(...).where(...)`, `db.delete(...).where(...)`, and the profile update chain — same hoisted-mock style.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `app/api/presets/[id]/route.ts`:

```ts
import { auth } from '@/auth';
import { db } from '@/db';
import { themePreset, profile } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { parseTheme } from '@/src/lib/theme';
import { isValidPresetName, sanitizePresetName } from '@/src/lib/presets';

type Ctx = { params: Promise<{ id: string }> };

async function owned(userId: string, id: string) {
  const row = await db.query.themePreset.findFirst({ where: and(eq(themePreset.id, id), eq(themePreset.userId, userId)) });
  return row ?? null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;
  const row = await owned(userId, id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });

  let body: { name?: unknown; isShared?: unknown; setActive?: unknown };
  try { const p = await req.json(); if (!p || typeof p !== 'object' || Array.isArray(p)) throw 0; body = p; }
  catch { return Response.json({ error: 'invalid_body' }, { status: 400 }); }

  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    if (!isValidPresetName(body.name)) return Response.json({ error: 'invalid_name' }, { status: 400 });
    const name = sanitizePresetName(body.name as string);
    const siblings = await db.query.themePreset.findMany({ where: and(eq(themePreset.userId, userId), ne(themePreset.id, id)) });
    if (siblings.some((s) => s.name.toLowerCase() === name.toLowerCase())) return Response.json({ error: 'duplicate' }, { status: 409 });
    set.name = name;
  }

  if (body.isShared === true) {
    const prof = await db.query.profile.findFirst({ where: eq(profile.userId, userId) });
    if (!prof?.isPublic || !prof.handle) return Response.json({ error: 'needs_public' }, { status: 409 });
    // 0-or-1 shared per user: clear the others first.
    await db.update(themePreset).set({ isShared: false }).where(and(eq(themePreset.userId, userId), ne(themePreset.id, id)));
    set.isShared = true;
  } else if (body.isShared === false) {
    set.isShared = false;
  }

  await db.update(themePreset).set(set).where(and(eq(themePreset.id, id), eq(themePreset.userId, userId)));

  if (body.setActive === true) {
    const seeds = parseTheme(row.seeds);
    if (seeds) {
      await db.insert(profile).values({ userId, customTheme: seeds, customThemeUpdatedAt: new Date() })
        .onConflictDoUpdate({ target: profile.userId, set: { customTheme: seeds, customThemeUpdatedAt: new Date() } });
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const row = await owned(session.user.id, id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  await db.delete(themePreset).where(and(eq(themePreset.id, id), eq(themePreset.userId, session.user.id)));
  return Response.json({ ok: true });
}
```
> NOTE: the `setActive` upsert must NOT clobber other profile columns. Because `onConflictDoUpdate.set` lists only `customTheme`/`customThemeUpdatedAt`, existing handle/isPublic/etc. are preserved (Drizzle only updates listed columns). Verify in the test that `set` contains exactly those two keys.

- [ ] **Step 4: Run — expect PASS. Step 5: `npx tsc --noEmit`. Step 6: Commit** `feat(theme): preset mutate/delete API (share gate, 0-or-1, set-active)`.

---

## Phase 3 — Preset library UI (client) + self-previewing controls

### Task 6: `PresetLibrary` component

**Files:**
- Create: `src/components/PresetLibrary.tsx`
- Test: `test/presetLibrary.test.tsx`

Contract (`'use client'`): props `{ initialActive: Theme | null }` (the current active seeds, to offer "Save current as preset"). On mount, `GET /api/presets` → list. Renders:
- **Save-as-preset** row: name input + Save button. Save is disabled with a reason when `canSavePreset(names, name)` is not ok (cap/duplicate/name). On click `POST /api/presets {name, seeds: initialActive}`; on 200 prepend to list.
- **Library list**: each row is a `<div className="tm-preset-row" style={presetStyleVars(p.seeds)}>` so it paints in the preset's own colors (self-preview). Row shows name (in the preset's ink), a 4-swatch chip, **Active**/**Shared** badges, and controls: **Apply** (`PATCH {setActive:true}`), **Rename** (inline), **Share** (`PATCH {isShared:true}`; on 409 `needs_public` show "Make your profile public to share"), **Delete** (confirm → `DELETE`).
- Focus rings use the preset's own `--tm-focus`/accent so keyboard focus stays visible on any ground.

- [ ] **Step 1: Write failing tests** (`test/presetLibrary.test.tsx`, createRoot/act pattern from `settings.test.tsx`):
  - renders rows from a mocked `GET /api/presets`;
  - each row's inline style sets `--tm-ground` to that preset's derived ground (self-preview);
  - Save disabled at 5 presets (cap message shown);
  - clicking Apply PATCHes `{setActive:true}` to `/api/presets/<id>`;
  - Share on a private profile surfaces the "make public" message when the API returns 409 `needs_public`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** using `presetStyleVars` for row styling, `canSavePreset` for the Save gate, and `fetch` for each mutation (fire-and-refetch or optimistic). Guard all fetches in try/catch.
- [ ] **Step 4: Run — expect PASS. Step 5: tsc. Step 6: Commit** `feat(theme): preset library UI with self-colored rows`.

### Task 7: CSS for self-previewing controls (`app/tango.css`)

**Files:** Modify `app/tango.css`

- [ ] **Step 1:** Append rules (append-only; do not alter existing rules):

```css
.tm-preset-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--tm-line);background:var(--tm-ground);color:var(--tm-ink)}
.tm-preset-row .name{font-weight:600;color:var(--tm-ink)}
.tm-preset-row .badge{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--tm-line);border-radius:999px;padding:1px 7px;color:var(--tm-ember)}
.tm-preset-row .chip{width:44px;height:14px;border-radius:4px;background:linear-gradient(90deg,var(--tm-ground) 25%,var(--tm-ink) 25% 50%,var(--tm-ember) 50% 75%,var(--tm-verd) 75%)}
.tm-preset-row button:focus-visible{outline:2px solid var(--tm-focus);outline-offset:2px}
.tm-community-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.tm-community-btn{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:12px;border:1px solid var(--tm-line);background:var(--tm-ground);color:var(--tm-ink);cursor:pointer;text-align:left}
.tm-community-btn .by{color:var(--tm-muted);font-size:11px}
.tm-community-btn:focus-visible{outline:2px solid var(--tm-focus);outline-offset:2px}
```
(The `var(--tm-*)` here resolve to the inline preset vars set by `presetStyleVars`, so each control self-previews; outside a self-preview they fall back to the page theme.)

- [ ] **Step 2: `npm run design:check`** (still clean — you didn't touch `design/tokens.ts`). **Step 3: Commit** `style(theme): self-previewing preset + community controls`.

### Task 8: Mount the library in the editor

**Files:** Modify `app/settings/ThemeEditor.tsx`, `app/settings/page.tsx`

- [ ] **Step 1:** In `ThemeEditor`, render `<PresetLibrary initialActive={currentCustomTheme()} />` below the seed pickers. When the user Applies a preset via the library, also call the client `applyCustomTheme(seeds)` so the live app updates immediately (the API `setActive` handles the server side; the client call handles the flash-free local update + `pushCustomTheme`).
- [ ] **Step 2:** `page.tsx` already passes `initial` to `SettingsForm`; pass `isPublic`/`handle` down to `ThemeEditor` (new props) so the library's Share control can pre-explain the public-profile requirement before the API 409.
- [ ] **Step 3: tsc + vitest. Step 4: Commit** `feat(theme): wire preset library into Settings`.

---

## Phase 4 — Community read model

### Task 9: `getCommunityThemes` + `getSharedTheme`

**Files:** Modify `src/lib/publicProfile.ts`; Test: extend `test/publicProfile.test.ts`

- [ ] **Step 1: Write failing tests**: `getCommunityThemes()` returns only presets that are `isShared` AND whose author is `isPublic` with a handle, re-validated through `parseTheme` (a malformed stored seed is dropped), shaped as `CommunityTheme`; `getSharedTheme(handle)` returns that author's shared preset or null when the profile is private / has no shared preset.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** (join `theme_preset` → `profile`, gated + validated):

```ts
export async function getCommunityThemes(limit = 60): Promise<CommunityTheme[]> {
  const rows = await db
    .select({ id: themePreset.id, name: themePreset.name, seeds: themePreset.seeds,
              authorHandle: profile.handle, authorDisplayName: profile.displayName })
    .from(themePreset)
    .innerJoin(profile, eq(profile.userId, themePreset.userId))
    .where(and(eq(themePreset.isShared, true), eq(profile.isPublic, true), isNotNull(profile.handle)))
    .orderBy(desc(themePreset.updatedAt))
    .limit(limit);
  return rows.flatMap((r) => {
    const seeds = parseTheme(r.seeds);
    return seeds && r.authorHandle
      ? [{ id: r.id, name: r.name, seeds, authorHandle: r.authorHandle, authorDisplayName: r.authorDisplayName }]
      : [];
  });
}
```
(Add `getSharedTheme(handle)` similarly, filtered to one author.)

- [ ] **Step 4: Run — expect PASS. Step 5: tsc. Step 6: Commit** `feat(theme): community read model (gated + revalidated)`.

### Task 10: Community list API (`app/api/community-themes/route.ts`)

**Files:** Create `app/api/community-themes/route.ts`; Test `test/api.communityThemes.test.ts`

- [ ] **Step 1: Write failing test**: `GET` returns the `getCommunityThemes()` result as JSON with `Cache-Control: public, max-age=60`; does NOT require auth (it's public, gallery browsing). Mock `@/src/lib/publicProfile`.
- [ ] **Step 2: Run — FAIL. Step 3: Implement**:

```ts
import { getCommunityThemes } from '@/src/lib/publicProfile';
export const dynamic = 'force-dynamic';
export async function GET() {
  const themes = await getCommunityThemes();
  return Response.json(themes, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
```
- [ ] **Step 4: PASS. Step 5: tsc. Step 6: Commit** `feat(theme): community-themes list endpoint`.

---

## Phase 5 — Community gallery panel

### Task 11: `CommunityThemes` component (in Settings → Theme)

**Files:** Create `src/components/CommunityThemes.tsx`; Test `test/communityThemes.test.tsx`; mount in `ThemeEditor`.

Contract (`'use client'`): on mount `GET /api/community-themes` → list. Renders a `.tm-community-grid` of `.tm-community-btn` buttons, each `style={presetStyleVars(t.seeds)}` (self-colored), showing `{name}` (in its ink) and `by @{handle}` (in its muted). Click → re-validate via `applyCustomTheme(t.seeds)` (the client boundary re-parses) → live apply + `pushCustomTheme()` + offer **"Save to my library"** (opens the Save-as-preset flow prefilled with the community name, subject to the 5-cap). If `applyCustomTheme` returns false (shouldn't, since the read model validated — but defense in depth), show a small "couldn't apply" note.

- [ ] **Step 1: Write failing tests**: renders buttons from a mocked list; each button's inline style paints its own ground; clicking a button sets `data-theme=custom` + writes `tsm-custom-css`; an invalid community entry (forced) shows the fallback note and does NOT change `data-theme`.
- [ ] **Step 2: FAIL. Step 3: Implement.** **Step 4: PASS. Step 5: tsc + design:check. Step 6: Commit** `feat(theme): community gallery panel with self-colored apply buttons`.

### Task 12: Share affordance on `/u/[handle]` (optional, coupled)

**Files:** Modify `app/u/[handle]/page.tsx` + a small `ApplySharedTheme` client button.

- [ ] Because sharing is coupled to `isPublic`, a public profile that has a shared preset can surface an "Apply {name} — @{handle}'s theme" button (reusing `getSharedTheme(handle)` + `applyCustomTheme` with re-validation). Tests: button present only when the author has a shared preset; click applies + syncs. Commit `feat(theme): apply-shared-theme on public profile`.

---

## Phase 6 — Compare theming (split halves + clash reconciliation)

### Task 13: `reconcileCompare` (pure)

**Files:** Create `src/lib/compareTheme.ts`; Test `test/compareTheme.test.ts`

Design: `/compare` shows two dancers. Each dancer's HALF (panel + its radar blob) renders in that dancer's own `deriveTokens`. Shared/adjoining elements — the **seam divider**, the **shared radar rings/labels** if the two blobs overlay one chart, and the **two blob fills against each other** — must stay legible. `reconcileCompare(a, b)` returns per-side palettes plus a shared "chrome" palette and reconciled accents:

```ts
import { parseHex, contrastRatio, mix, toHex, type RGB } from '@/src/lib/color';
import { deriveTokens, type Theme } from '@/src/lib/theme';

export const COMPARE_MIN = 3;          // WCAG UI contrast for the two blob outlines
const WHITE: RGB = { r: 255, g: 255, b: 255 }, BLACK: RGB = { r: 0, g: 0, b: 0 };

/** Nudge `c` toward white or black (whichever direction increases contrast vs
 *  `against`) until it clears `min`, up to `steps` tries; returns the adjusted hex. */
function ensureContrast(c: RGB, against: RGB, min: number): string {
  if (contrastRatio(c, against) >= min) return toHex(c);
  const target = relativeIsDark(against) ? WHITE : BLACK;
  let cur = c;
  for (let i = 0; i < 12 && contrastRatio(cur, against) < min; i++) cur = mix(cur, target, 0.12);
  return toHex(cur);
}
function relativeIsDark(c: RGB): boolean { return (0.2126*c.r + 0.7152*c.g + 0.0722*c.b) / 255 < 0.5; }

export type ComparePalettes = {
  a: ReturnType<typeof deriveTokens>;
  b: ReturnType<typeof deriveTokens>;
  aBlob: string;        // dancer A blob stroke — contrasts with B's and the shared ground
  bBlob: string;        // dancer B blob stroke
  seam: string;         // divider that contrasts with BOTH grounds
};

/** Each side keeps its own palette; the two blob accents are pushed apart if they
 *  clash, and the seam is chosen to read on both grounds. Pure/deterministic. */
export function reconcileCompare(a: Theme, b: Theme): ComparePalettes {
  const ta = deriveTokens(a), tb = deriveTokens(b);
  const aAcc = parseHex(ta.ember)!, bAcc = parseHex(tb.ember)!;
  const groundA = parseHex(ta.ground)!, groundB = parseHex(tb.ground)!;
  // If the two accents are too close to each other, shift B's toward its accent2.
  let bBlobRGB = bAcc;
  if (contrastRatio(aAcc, bAcc) < COMPARE_MIN) bBlobRGB = parseHex(tb.verd ?? tb.ember)!;
  // Each blob must also read on the shared (neutral) chart ground = mid of the two grounds.
  const sharedGround = mix(groundA, groundB, 0.5);
  const aBlob = ensureContrast(aAcc, sharedGround, COMPARE_MIN);
  const bBlob = ensureContrast(bBlobRGB, sharedGround, COMPARE_MIN);
  const seam = ensureContrast(parseHex(ta.ink)!, sharedGround, COMPARE_MIN);
  return { a: ta, b: tb, aBlob, bBlob, seam };
}
```
> Note `deriveTokens` output has no `verd` key by that name — it has `verd`. Confirm the key (`tb.verd`) exists in `DerivedTokens`; it does (the second accent). Adjust the property access to the real key.

- [ ] **Step 1: Write failing tests**: identical themes → the two blobs are pushed apart to ≥ `COMPARE_MIN` contrast; a light theme vs a dark theme → each blob still clears `COMPARE_MIN` against the shared ground; `seam` clears contrast on both grounds; output is deterministic (no `Math.random`).
- [ ] **Step 2: FAIL. Step 3: Implement** (fix the `verd` key access to the actual `DerivedTokens` field). **Step 4: PASS. Step 5: tsc. Step 6: Commit** `feat(theme): compare clash reconciliation`.

### Task 14: Apply per-half themes on `/compare`

**Files:** Modify `app/compare/page.tsx`, `src/components/DnaCompareRadar.tsx`

- [ ] **Step 1:** Read the current `DnaCompareRadar` to find its color literals and how it draws the two blobs/rings/labels (it uses `--tm-*`/literals today). Load the two dancers' active themes: each dancer's `profile.customTheme` (via `getPublicProfile`/a small `getCompareTheme(handle)` returning the validated active seeds, gated on `isPublic`). Fall back to the frozen/default palette for a dancer with no theme.
- [ ] **Step 2:** Compute `const P = reconcileCompare(themeA ?? DEFAULT_A, themeB ?? DEFAULT_B)`. Wrap dancer A's half in `style={presetStyleVars(themeA)}` (self-theme) and B's half likewise; draw A's blob with `P.aBlob`, B's with `P.bBlob`, the divider with `P.seam`, and keep the shared rings/labels on a neutral mid-ground. Guarantee: when both dancers lack a custom theme, the compare view renders byte-identical to today (both DEFAULT palettes == current literals).
- [ ] **Step 3: Tests** (`test/compareTheme.test.ts` covers the pure part; add a `DnaCompareRadar` render test asserting the two blobs receive `P.aBlob`/`P.bBlob` and that with two null themes the current default colors are used). **Step 4: tsc + vitest + design:check. Step 5: Commit** `feat(theme): compare renders each dancer in their own theme, reconciled`.

---

## Self-review

**Spec coverage:**
- Save ≤5 named presets → Tasks 2,4,6 (cap enforced in `canSavePreset` + API 409).
- Share exactly one → Task 5 (0-or-1 + `needs_public` coupling to `isPublic`).
- Community buttons `Name — by @handle` → Tasks 9–11.
- Self-previewing controls (every button in its own colors) → `presetStyleVars` (Task 2), rows (Task 6), buttons (Task 11), CSS (Task 7).
- Personal theme on the card → already built (step 5, `cardUsesCustomTheme`); applying a preset copies into `profile.customTheme` which the card reads.
- Compare coloristics, split halves + clash detection → Tasks 13–14.
- Data saved/shared/propagated → Phases 1–5; cross-device sync reuses the existing `<ThemeSync/>` + `customThemeUpdatedAt` for the ACTIVE theme; the preset library is server-authoritative (fetched per load).

**Open items intentionally defaulted:** 5-cap UX = hard block with rename/delete (not overwrite-oldest); community ordering = newest (`updatedAt desc`); moderation = name length/charset sanitize only (no report queue in v1). Community list is public + 60s cached.

**Migrate-before-merge:** Phase 1's `theme_preset` must exist in prod before any Phase 2+ endpoint merges (a schema-ahead-of-DB read 500s prod). Same discipline that the 0003 outage taught.

**Type consistency:** `Theme` (struct) is imported aliased everywhere it meets the mode-string `Theme` in `types.ts`. `ThemePreset.seeds`/`CommunityTheme.seeds` are the struct. `presetStyleVars`, `reconcileCompare` both consume the struct `Theme`.

**Landing order note:** this stacks on step 5 (`feat/theme-card`) for the card propagation and on step-3 columns (already on main via #30). Rebase `feat/theme-card` onto main and land it first; then branch this work off the result.

---
