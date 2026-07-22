# Tango Map — Accounts, Progress Sync & Shareable Profile
### End-to-end technical spec

Live: https://partykamap.vercel.app · Repo: `twilk/tangomap`

---

## 1. Goal

Turn the client-only Tango Map into an app with **accounts**, so a dancer's progress is
**durable and portable across devices**, plus an **optional, shareable public profile**.

Non-goals (MVP): video, pose-estimation grading, verifiable credentials, AR, real-time
collaboration. See "Vision later" in the roadmap — those are separate projects.

---

## 2. Current state (the starting point)

- **App:** an Argentine-tango skill map — 62 techniques across 10 levels, node states
  `ready`/`mastered`/`locked`, a detail panel with "Mark as mastered", search, theme toggle.
- **Hosting:** `partykamap.vercel.app` serves a **generated static single-file bundle**
  (`index.html`, from a design-to-code tool `dc-runtime`). Git-connected to Vercel:
  `git push` to `main` auto-deploys.
- **Persistence today:** the bundle **natively persists to `localStorage`**:
  - `tsm-mastered` — JSON array of mastered skill slugs, e.g. `["mirada-cabeceo"]`
  - `tsm-theme` — `"light"` | `"dark"`
  - `tsm-sel` — currently selected node slug
  This is **per-browser only** — it does not survive a different device/browser.
- **Google OAuth: already configured** (this project, done in Google Cloud Console):
  - Project **TangoMap**, consent screen "Tango Map", audience **External**, status **Testing**.
  - OAuth **Web client "Tango Map Web"**
    - Client ID: `126538791453-u68op5k4kqni72efg0nke7ljf8cgmedu.apps.googleusercontent.com`
    - Authorized origin: `https://partykamap.vercel.app`
    - Redirect URI: `https://partykamap.vercel.app/api/auth/callback/google` (Auth.js convention)
    - Client **Secret**: in the console (Clients → Tango Map Web) — NOT committed.
  - Test user: `wilczyy@gmail.com` (Testing mode allows only test users + project owners).

**Key constraint:** the map is a compiled bundle; we do **not** have its design-to-code
source. Any change to the map's internals must go through the source and be re-exported.
The architecture below is built so we **do not need** the source for MVP.

---

## 3. Target architecture

Replace the static deployment with a **Next.js (App Router) app on Vercel** at the same
domain. The app has three responsibilities:

1. **Serve the existing map bundle** unchanged (as the main view at `/`).
2. **Auth + API** (Auth.js Google, `/api/*`, Postgres).
3. **Public profile pages** (`/u/[handle]`), server-rendered from the DB.

### 3.1 The integration trick (why no source is needed)

The bundle already reads/writes `localStorage` (`tsm-mastered` etc.). So we **bridge
localStorage ↔ server** with a small injected sync script (the same progressive-enhancement
technique already used in this repo), gated on an authenticated session:

- On load, if signed in → `GET /api/progress` and, if server is newer, write `tsm-mastered`/
  `tsm-theme` into `localStorage` before the map reads them.
- On change (MutationObserver / storage events) → debounced `PUT /api/progress`.
- **First login migration:** merge the guest's existing `localStorage` mastered-set into the
  server (union), so nothing is lost.

The map never needs to be modified. The public profile page is a **separate Next.js page**
that renders from the DB, not from the bundle.

```
Browser ──▶ Next.js app (partykamap.vercel.app)
              ├── /                     → map bundle + sync script (+ login UI)
              ├── /api/auth/*           → Auth.js (Google)
              ├── /api/progress         → GET/PUT progress (session-guarded)
              ├── /settings             → profile visibility, handle, style
              ├── /u/[handle]           → public read-only profile (SSR)
              └── /u/[handle]/opengraph-image → dynamic OG (X/62 + streak)
                     │
                     ▼
                  Postgres (Auth.js tables + progress + profile)
```

### 3.2 Stack

- **Next.js** (App Router) on **Vercel**.
- **Auth.js (NextAuth v5)** — Google provider (matches the configured redirect URI).
- **Postgres** — **Supabase or Neon** (OPEN DECISION §9). Prisma or Drizzle as ORM/adapter.
- **@vercel/og** for dynamic profile OG images.

> If a hosted-auth provider (e.g. Supabase Auth) is chosen instead of Auth.js, the Google
> redirect URI changes to `https://<ref>.supabase.co/auth/v1/callback` and must be added in
> the console. The current console config assumes **Auth.js**.

---

## 4. Data model

Auth.js adapter tables (`users`, `accounts`, `sessions`, `verification_tokens`) as per the
chosen adapter, plus:

```sql
-- progress: one row per user
create table progress (
  user_id     text primary key references users(id) on delete cascade,
  mastered    jsonb not null default '[]',   -- ["mirada-cabeceo", ...] (mirrors tsm-mastered)
  theme       text,                          -- "light" | "dark"
  sel         text,                          -- last selected node slug
  updated_at  timestamptz not null default now()
);

-- profile: optional public presence
create table profile (
  user_id      text primary key references users(id) on delete cascade,
  handle       text unique,                  -- URL slug for /u/[handle]; null until set
  is_public    boolean not null default false, -- discovery OFF by default
  display_name text,
  style        text,                          -- "salon" | "milonguero" | "nuevo" | null
  created_at   timestamptz not null default now()
);
```

`mastered` is the source of truth for `X/62` and per-level counters (skill→level mapping is
static, derived from the map's known 62-skill / 10-level structure).

---

## 5. Features & behavior

### 5.1 Auth
- Google sign-in via Auth.js. Sign-in button in the map header; session shown as avatar.
- Sign-out returns to guest mode (local-only progress still works).

### 5.2 Progress persistence + migration
- `GET /api/progress` → `{ mastered, theme, sel, updated_at }` for the session user.
- `PUT /api/progress` → upsert; **session-guarded**, validate `mastered` is a string[] of
  known slugs, cap length at 62.
- Sync script reconciles by `updated_at` (last-write-wins for MVP; CRDT is "vision later").
- **First login:** `PUT` the union of local `tsm-mastered` and server `mastered`.

### 5.3 Profile
- `/settings`: toggle `is_public`, set a `handle` (validated `^[a-z0-9-]{3,30}$`, unique),
  `display_name`, `style`.
- `/u/[handle]`: SSR read-only page. **404 if `is_public=false`** or handle unknown.
- Dynamic OG image at `/u/[handle]/opengraph-image` with `X/62` + streak baked in.

### 5.4 Profile card content
- **Owner view** (on their own map/settings): `X/62`, per-level bars, current
  learning/mastered, streak, milestones (5/10/25/50), "next 3 ready".
- **Public view** (`/u/[handle]`): level + `style`, `X/62` and per-level, milestone badges.
  **Hidden by default:** exact dates, streak internals, anything revealing a routine.

---

## 6. Security & privacy
- Secrets in Vercel **env vars only**, never committed: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
  `AUTH_SECRET`, `DATABASE_URL`.
- All `/api/progress` writes require a valid session; users can only read/write **their own** row
  (enforce in the handler; if Supabase, add RLS policies too).
- Public profile exposes only allow-listed fields; `is_public` defaults **false**.
- **Account/data deletion** (GDPR): a "delete my data" action that removes the user's rows
  (cascade). Document what is stored and for how long.
- Validate/normalize `handle`; rate-limit public profile + OG endpoints.

---

## 7. Environment & config

`.env.example` (committed) / real values in Vercel:

```
AUTH_GOOGLE_ID=126538791453-u68op5k4kqni72efg0nke7ljf8cgmedu.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=            # from Google Console → Clients → Tango Map Web
AUTH_SECRET=                   # openssl rand -base64 33
AUTH_URL=https://partykamap.vercel.app
DATABASE_URL=                  # from Supabase/Neon
```

Google side is already done (§2). No scope config needed — Auth.js requests
`openid email profile` (non-sensitive; no verification required in Testing).

---

## 8. Implementation phases (the end-to-end process)

Each phase ends deployed and verifiable. Ship behind Testing mode until Phase 4.

**Phase 0 — App shell (foundation)**
1. Introduce Next.js in the repo; keep `index.html` (bundle) served at `/` (e.g. as a public
   asset rendered by a thin page, or via a catch-all that returns the bundle).
2. Add the injected sync-script hook (no-op until auth exists).
3. Deploy to Vercel on the same domain; confirm the map still works with **no regression**.
   _Done when: `partykamap.vercel.app` serves the map from the Next.js app, map fully functional._

**Phase 1 — Auth**
1. Add Auth.js + Google provider; set env vars (§7).
2. Sign-in / sign-out UI + session.
   _Done when: `wilczyy@gmail.com` (test user) can sign in via Google and see a session; sign-out works._

**Phase 2 — DB + progress sync**
1. Provision Postgres (§9 decision); run Auth.js adapter migrations + `progress` table.
2. Implement `GET/PUT /api/progress` (session-guarded, validated).
3. Wire the sync script: hydrate localStorage from server on load; push on change; **first-login
   migration** (union).
   _Done when: master a skill on device A → sign in on device B → the same skill is mastered; `X/62` matches._

**Phase 3 — Profile + sharing**
1. `profile` table + `/settings` (is_public, handle, display_name, style).
2. `/u/[handle]` SSR (404 when private) + dynamic OG image.
   _Done when: enabling public + setting a handle yields a working shareable link with a correct
   OG preview; private profiles 404._

**Phase 4 — Polish & rollout**
1. Profile-card content (owner vs public), privacy defaults, data-deletion action.
2. `llms.txt` + structured data (cheap GEO win).
3. Publish OAuth **Testing → Production** (basic scopes need no verification); real users can sign in.
   _Done when: any Google user can sign in; profiles shareable; delete-my-data works._

---

## 9. Open decisions & risks

- **Database / backend host** (needs an account the owner creates): **Supabase** (Auth +
  Postgres + RLS in one — recommended for speed) vs **Neon** (Postgres only) + Auth.js.
  This spec assumes **Auth.js for auth** (matches the configured Google redirect). If Supabase
  *Auth* is used instead, update the Google redirect URI accordingly.
- **Map integration:** serving the bundle from Next.js + localStorage sync is the MVP path
  (no source needed). A future full port (from the design-to-code source) would allow deeper,
  in-app progress UI — optional, not required.
- **Sync conflicts:** MVP uses last-write-wins on `updated_at`. Rare cross-device races can
  drop a just-mastered skill; acceptable for MVP, upgrade to CRDT later if needed.
- **Production verification:** only if sensitive scopes are added later; basic sign-in needs none.

---

## 10. Acceptance criteria (whole system)
- A signed-in user's progress survives reload **and** a different device/browser.
- First login merges (never discards) existing local progress.
- Profiles are private by default; a shared link shows only allow-listed fields with a correct
  OG preview; private/unknown handles 404.
- No secret is committed; all writes are session-scoped to the owner; data deletion works.
- The map itself is unchanged and regression-free throughout.
