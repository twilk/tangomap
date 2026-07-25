# Tango Map

An interactive skill map for Argentine tango — 62 techniques across 10 levels, with Google
sign-in, cross-device progress sync, and an optional shareable public profile.

Live: https://partykamap.vercel.app

## Quickstart (local dev)

Prerequisites: **Node 22.6+** (see `.nvmrc` = 22.12; the design generator uses
`--experimental-strip-types`, which needs 22.6) and a Supabase Postgres database (already
provisioned as project `tangomap`, eu-west-3).

```bash
git clone https://github.com/twilk/tangomap
cd tangomap
npm install

cp .env.example .env.local        # then fill the 3 secrets (see below)
npm run db:generate               # emit SQL from db/schema.ts (no DB needed)
npm run db:migrate                # apply it to Supabase (reads .env.local)
npm run dev                       # open the printed URL — the map renders
```

> **Migrations are manual and must target the right database.** `db:migrate` applies to whatever
> `DIRECT_URL` points at — make sure that's the intended DB. Follow expand-migrate-contract: land the
> migration on the DB **first**, confirm the columns/tables exist there, and only then merge code that
> reads them. Drizzle's queries select every column declared in `db/schema.ts`, so a schema that's ahead
> of the database returns 500s on every affected read (this bit production once).

Fill three values in `.env.local`:

| Var | Where from |
|-----|------------|
| `AUTH_GOOGLE_SECRET` | Google Cloud → Clients → "Tango Map Web" (or the `client_secret_*.json`) |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"` |
| DB password | replace `<<<DB_PW>>>` in `DATABASE_URL` and `DIRECT_URL` |

> Full Google sign-in only works on the production domain — the OAuth client authorizes
> `https://partykamap.vercel.app/api/auth/callback/google`, not `localhost`. Locally you can
> confirm the map renders and `/api/auth/providers` lists `google`.

## Scripts

| Script | Does |
|--------|------|
| `npm run dev` | Next.js dev server (port 3000, or the next free one) |
| `npm run build` / `start` | production build / serve |
| `npm test` | Vitest suite |
| `npm run db:generate` | generate migration SQL from `db/schema.ts` |
| `npm run db:migrate` | apply migrations to Supabase (uses `DIRECT_URL`) |

## How it works

The `/` route is a source React map (`app/page.tsx` → `src/components/TangoMap.tsx`), built from
`src/data/mapNodes.ts` through pure layout engines (`src/lib/mapLayout.ts`, `explorerLayout.ts`)
and styled on the app's own `--tm-*` tokens, so it inherits light/dark/custom theming for free.
`MapSync` mirrors progress (`tsm-mastered`) to the server. Auth.js (Google) + Supabase Postgres
via Drizzle handle accounts, progress, and profiles. Full design and rationale: **[SPEC.md](SPEC.md)**.

## Layout

```
app/            Next.js routes (api/auth, api/progress, api/profile, api/account, settings, u/[handle])
db/             Drizzle schema + client
src/lib/        pure libs (progress, handle, publicProfile, mapLayout, explorerLayout, mapGraph)
src/data/       62-skill data — mapNodes.ts is authoritative; skills.ts derives from it
src/components/  the source map (TangoMap, MapExplorer, MapSync, detail/search/category/home/onboarding)
public/         PWA service worker + static assets
test/           Vitest suites (mock @/db and @/auth)
```

## Deploy

Production rollout (env → migrate → merge → verify): **[DEPLOY.md](DEPLOY.md)**.
