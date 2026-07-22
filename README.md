# Tango Map

An interactive skill map for Argentine tango — 62 techniques across 10 levels, with Google
sign-in, cross-device progress sync, and an optional shareable public profile.

Live: https://partykamap.vercel.app

## Quickstart (local dev)

Prerequisites: **Node 20+** and a Supabase Postgres database (already provisioned as project
`tangomap`, eu-west-3).

```bash
git clone https://github.com/twilk/tangomap
cd tangomap
npm install

cp .env.example .env.local        # then fill the 3 secrets (see below)
npm run db:generate               # emit SQL from db/schema.ts (no DB needed)
npm run db:migrate                # apply it to Supabase (reads .env.local)
npm run dev                       # open the printed URL — the map renders
```

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
| `npm test` | Vitest suite (41 tests) |
| `npm run db:generate` | generate migration SQL from `db/schema.ts` |
| `npm run db:migrate` | apply migrations to Supabase (uses `DIRECT_URL`) |

## How it works

The `/` route serves the existing self-contained map bundle (`public/tangomap.html`); two tiny
injected scripts bridge its `localStorage` (`tsm-mastered`/`tsm-theme`) to the server and add a
sign-in control. Auth.js (Google) + Supabase Postgres via Drizzle handle accounts, progress, and
profiles. Full design and rationale: **[SPEC.md](SPEC.md)**.

## Layout

```
app/            Next.js routes (api/auth, api/progress, api/profile, api/account, settings, u/[handle])
db/             Drizzle schema + client
src/lib/        pure libs (progress, handle, publicProfile, injectScript)
src/data/       62-skill data (generated from the bundle by scripts/extract-skills.mjs)
public/         the map bundle + injected sync.js / auth-ui.js
test/           Vitest suites (mock @/db and @/auth)
```

## Deploy

Production rollout (env → migrate → merge → verify): **[DEPLOY.md](DEPLOY.md)**.
