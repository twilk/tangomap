# Deploy runbook — Tango Map accounts MVP

Branch `feat/app-shell` holds the full MVP (Next.js + Auth.js + Supabase/Drizzle, map bundle
with baked login+sync, 62-skill data, progress/profile APIs, settings, public profile, OG image,
account deletion). Tests: `npm test` → all green. This is the sequence to go live.

## 0. One-time secrets (local)
`.env.local` already exists (gitignored). Fill the three `<<< >>>` markers:
- `AUTH_GOOGLE_SECRET` — from `client_secret_*.json` (`GOCSPX-…`)
- `AUTH_SECRET` — `node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"`
- `<<<DB_PW>>>` — the Supabase DB password, in `DATABASE_URL` and `DIRECT_URL`

## 1. Migrate the database
```bash
npm install
npm run db:generate     # emits SQL in ./drizzle from db/schema.ts
npm run db:migrate      # applies it to Supabase (uses DIRECT_URL, port 5432)
```
Verify in Supabase → Tables: `user`, `account`, `session`, `verificationToken`, `progress`, `profile`.

## 2. Local smoke test
```bash
npm run dev             # port 3000 is taken on this machine -> Next picks 3001+
```
Open the printed URL: the map renders and `…/api/auth/providers` returns `google`.
(Full Google sign-in only works on the production domain — the Google client authorizes
`https://partykamap.vercel.app/api/auth/callback/google`, not localhost.)

## 3. Production env on Vercel (set BEFORE merging — else the build ships with no config)
Set on the Vercel project (Production scope):
- `AUTH_GOOGLE_ID` = `126538791453-u68op5k4kqni72efg0nke7ljf8cgmedu.apps.googleusercontent.com`
- `AUTH_GOOGLE_SECRET` = (the secret)
- `AUTH_SECRET` = a fresh `randomBytes(33)` base64 (can differ from local)
- `AUTH_URL` = `https://partykamap.vercel.app`
- `DATABASE_URL` = the 6543 pooler string with the DB password
- `DIRECT_URL` = the 5432 pooler string with the DB password

## 4. Deploy
```bash
git checkout main
git merge feat/app-shell
git push origin main    # Vercel switches from static hosting to a Next.js build
```

## 5. Verify production
- `curl https://partykamap.vercel.app/api/auth/providers` → shows `google`.
- Open the site, click "Sign in with Google", sign in as test user `wilczyy@gmail.com`.
- Master a skill → reload → still mastered. Open on a second device signed in → same `X/62`.
- Set a public handle in `/settings` → `/u/{handle}` renders; a private profile 404s.
- `DELETE /api/account` (when signed in) wipes the account.

## 6. Open the app to everyone (later)
Google Cloud → Auth Platform → Audience → **Publish app** (Testing → Production).
Basic scopes (`openid email profile`) need no verification, so any Google user can then sign in.

## Notes
- The bundle injectors (`scripts/inject-{sync,auth-ui}.mjs`) are already run; re-run only if the
  bundle is replaced: `node --experimental-strip-types scripts/inject-sync.mjs --write` (the
  `MODULE_TYPELESS_PACKAGE_JSON` warning is harmless).
- Rotating secrets later: update `.env.local` and the Vercel env, then redeploy. The Google
  client secret can be rotated in Google Console → Clients → Tango Map Web.
