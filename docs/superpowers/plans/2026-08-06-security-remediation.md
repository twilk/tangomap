# Security Remediation + Repo Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear all 7 production-dependency vulnerabilities (2 critical, 5 high) reported by `npm audit --omit=dev`, and tidy the repo state, without a Next.js major upgrade.

---

## STATUS — updated 2026-08-06

| Task | State | Shipped as | Advisories after |
|---|---|---|---|
| 1. Repo hygiene | ✅ **DONE** | #54 + out-of-band actions | 7 |
| 2. postcss + sharp overrides | ✅ **DONE** | #55 | **7 → 4** |
| 3. drizzle-orm 0.45.2 | ✅ **DONE** | #56 | **4 → 3** |
| 4. Auth stack | ✅ **DONE** | #57 | **3 → 0** |
| 5. CI audit gate | ✅ **DONE** | #57 | — |

**COMPLETE: 7 advisories → 0.** `npm audit --omit=dev` reports a clean production tree, and CI now enforces it (`npm audit --omit=dev --audit-level=high`, confirmed running on `main`).

**Verified in production after Task 3** (`dfe16f6`): `/u/wilk` renders real DB data (59/62 mastered), `/api/community-themes` returns 4, `/api/progress` returns 401 (not 500).

**Verified in production after Task 4** (`4c1c423`): `/api/auth/providers` 200 returning `google` with the correct callback URL, `/api/auth/csrf` 200, `/api/auth/session` 200 → `null` signed-out, `/api/progress` 401, `/u/wilk` still 59/62 from the DB, no JS errors. **The owner completed a real Google sign-in on production and confirmed it works** — the one step an agent cannot perform.

### Task 4's verification could NOT be done on a preview — record this before trying again

The plan's Step 5/6 assumed a preview deployment could exercise sign-in. It cannot, for two independent reasons, neither of them a code bug:

1. **Vercel env scoping is inconsistent.** `AUTH_GOOGLE_SECRET` is set for Preview+Production, but **`AUTH_GOOGLE_ID` and `AUTH_URL` are Production-only**. A preview therefore sends an empty `client_id` and Google replies `401 invalid_client: The OAuth client was not found`. This predates the upgrade by ~15 days and would break any version identically — it burned one verification attempt.
2. **Google requires an exact registered redirect URI**, and preview URLs are per-branch, so even with the env var present a fresh preview URL is rejected.

**DECIDED 2026-08-06 — do not propose preview auth testing again.** Making previews testable would need `AUTH_GOOGLE_ID` added to the Preview scope *and* a stable preview alias registered in Google Cloud. The owner's call is no: **auth changes are verified on production.** Two facts make that workable — every env var here is marked *Sensitive* in Vercel, so values are write-only and cannot be copied between scopes by any tool; and auth changes are rare enough that the ceremony would not pay for itself.

### Production verification protocol for auth changes

This replaces preview testing. It is what #57 actually used, and it worked.

1. **Capture the rollback point BEFORE merging** — the current `main` SHA and the live Vercel deployment id:
   ```bash
   git rev-parse --short origin/main
   gh api "repos/twilk/tangomap/deployments?environment=Production&per_page=1" --jq '.[0]|"deployment_id=\(.id) sha=\(.sha[:7])"'
   ```
   For #57 that was `c59591b` / deployment `5778719676`.
2. Merge, wait for the Production deployment to report `success`.
3. **Machine checks first** (these catch a broken adapter without anyone logging in):
   `/api/auth/providers` → 200 listing `google` with the right callback URL · `/api/auth/csrf` → 200 · `/api/auth/session` → 200 returning `null` when signed out · `/api/progress` → 401 not 500 · a public profile page still rendering its counts from the DB.
4. Owner completes one real Google sign-in. An agent cannot do this step.
5. If anything fails: Vercel dashboard → Deployments → **Instant Rollback** to the captured deployment (fastest), or `git revert` the merge and push.

Exposure window is a few minutes, and steps 1 and 3 are what keep it that way.

### Task 4 also needed a check the plan did not specify

`drizzle-kit generate` compares our schema only to our own migrations, so it cannot see an **adapter** that expects different columns. Adapter 1.11.3 does reference a WebAuthn `authenticator` table this schema lacks; it is safe only because `lib/pg.js` touches it exclusively inside `createAuthenticator` / `getAuthenticator` / `listAuthenticatorsByUserId` / `updateAuthenticatorCounter`, line 52 merely constructs the table object in memory, and this app configures Google alone with zero passkey references. **Re-run that reasoning if a provider is ever added.**

**Two corrections to this plan, learned by executing it:**

1. **Task 3 Step 2 expected `tsc` to error** on the object-form table configs. It did not — Drizzle 0.45.2 still *accepts* the deprecated form. The migration to array form was applied anyway, as the step's fallback instructed, ahead of its removal in the next major.
2. **Task 1 Step 4's pruning command was wrong.** `git branch -r --merged origin/main` returns **nothing** in this repo, because every PR is **squash-merged** — branch commits never become ancestors of `main`. The correct criterion is the set of head branches of merged PRs:
   ```bash
   gh pr list --state merged --limit 100 --json headRefName --jq '.[].headRefName' | sort -u > merged.txt
   git ls-remote --heads origin | sed 's|.*refs/heads/||' | sort -u > remote.txt
   comm -12 merged.txt remote.txt | grep -vx "feat/theme-sharing-fixes"
   ```
   That deleted 39 stale remote branches, 0 failures. `feat/theme-sharing-fixes` is excluded because a second session has it checked out in the `Map-theme` worktree.

**Architecture:** Four independent phases ordered by risk, each its own PR. Phase 1 is hygiene (no code). Phase 2 pins transitive packages via npm `overrides` — this is what avoids the `next@16` breaking change `npm audit fix --force` wants. Phase 3 moves the DB layer. Phase 4 moves the auth stack, which is the only phase that can lock users out, so it ships last and alone.

**Tech Stack:** Next.js 15.5.21 (App Router), React 19, TypeScript 5.7, Drizzle ORM 0.38.2 + Postgres (Supabase), Auth.js v5 (`next-auth@5.0.0-beta.25`) + Google.

---

## Findings this plan closes

Source: `npm audit --omit=dev` run 2026-08-06 against `main` @ `311bbaa`.

| # | Package | Have | Target | Sev | Real exposure here |
|---|---|---|---|---|---|
| V1 | `next-auth` | 5.0.0-beta.25 | 5.0.0-beta.32 | **CRITICAL** | live Google login path |
| V2 | `@auth/core` | ≤0.41.2 (transitive) | 0.41.3 | **CRITICAL** | OAuth state/nonce/PKCE cookies, `getToken()` throw |
| V3 | `@auth/drizzle-adapter` | 1.7.4 | 1.11.3 | HIGH | inherits V2 |
| V4 | `drizzle-orm` | 0.38.2 | 0.45.2 | HIGH | SQL injection via unescaped **identifiers** |
| V5 | `postcss` | 8.4.31 (pinned by next) | ≥8.5.23 | HIGH | build-time CSS only |
| V6 | `sharp` | ^0.34.3 (optional dep of next) | ≥0.35.0 | HIGH | libvips CVEs |
| V7 | `next` | 15.5.21 | *stays 15.5.21* | HIGH | flagged **only** as a parent of V5+V6; clears itself once those resolve, so this plan does not bump Next at all |

**Two exposure notes that shape the ordering — both verified, not assumed:**

- **V4 is lower risk than its severity suggests.** The advisory is about improperly escaped SQL *identifiers*. `grep -rn "sql\`" app src db` returns **zero** hits — every one of the 17 Drizzle call sites uses the typed query builder, and no identifier is ever interpolated from user input. Upgrade anyway; do not treat it as an active exploit path.
- **V6 is close to theoretical.** `sharp` is an `optionalDependencies` entry of `next`, used for `next/image` optimisation. `grep -rn "from 'next/image'" app src` returns **zero** hits — the app never imports it (`DancerCard` deliberately renders a raw `<img>` for a `data:` URI QR). Fix for hygiene, not urgency.

**Why no `next@16`:** `npm audit fix --force` proposes `next@16.3.0` because `next@15.5.22` pins `postcss: 8.4.31` exactly and declares `sharp: ^0.34.3`. Both are reachable with npm `overrides` while staying on 15.x. A major upgrade is not required to reach zero advisories, and is out of scope here.

---

## File Structure

| File | Phase | Responsibility |
|---|---|---|
| `.gitignore` | 1 | commit the pending `.gstack/` entry |
| `package.json` | 2,3,4 | dependency versions + the new `overrides` block |
| `package-lock.json` | 2,3,4 | regenerated by `npm install` |
| `db/schema.ts` | 3 | 4 table-config callbacks migrate to array form |
| `auth.ts` | 4 | Auth.js config; expected to need no edit, must be re-verified |
| `docs/superpowers/plans/2026-08-06-security-remediation.md` | — | this plan |

---

## Task 1: Repo hygiene (no application code)

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Fast-forward the stale local `main`**

Local `main` sits at `ea16c9e` (#39), 13 commits behind `origin/main`, with 0 local commits — every PR this cycle was built in a worktree. A shared worktree is in play (a second Claude session uses `WORKSPACE/Map-theme`), so confirm 0 ahead before pulling.

```bash
git -C C:/Users/Wilk/Documents/WORKSPACE/Map rev-list --count origin/main..main
```
Expected: `0`. If non-zero, STOP and inspect — do not pull.

```bash
git -C C:/Users/Wilk/Documents/WORKSPACE/Map pull --ff-only origin main
```
Expected: `Fast-forward`.

- [ ] **Step 2: Commit the pending `.gitignore` entry**

`.gitignore` has one uncommitted line, `.gstack/`, which predates this work. It is correct (gstack writes local state there) and should be committed, not reverted.

```bash
git -C C:/Users/Wilk/Documents/WORKSPACE/Map diff .gitignore
```
Expected: a single `+.gstack/` line.

- [ ] **Step 3: Close the stale Vercel CVE PR**

Open draft PR #1 ("Fix React Server Components CVE vulnerabilities", GHSA-9qr9-h5gf-34mp) bumps `next` **15.1.0 → 15.1.11**. The repo is on **15.5.21**, far past the patched release, and `npm audit` no longer reports that advisory. The PR was generated against an old snapshot and is obsolete.

Verify before closing, rather than trusting this plan:
```bash
npm audit --omit=dev --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const v=JSON.parse(d).vulnerabilities;console.log(Object.keys(v).includes('react-server-dom-webpack')||JSON.stringify(v).includes('9qr9')?'STILL VULNERABLE':'not reported — safe to close')})"
```
Expected: `not reported — safe to close`.

Then close with a reason (do NOT merge — it would *downgrade* Next):
```bash
gh pr close 1 --comment "Obsolete: this bumps next 15.1.0 -> 15.1.11, but main is on 15.5.21 and npm audit no longer reports GHSA-9qr9-h5gf-34mp. Merging would downgrade Next."
```

- [ ] **Step 4: Prune merged remote branches**

~20 remote branches are fully merged into `origin/main`. List them first; delete only those the check confirms.

```bash
git -C C:/Users/Wilk/Documents/WORKSPACE/Map branch -r --merged origin/main | grep -v 'HEAD\|origin/main' | sed 's|origin/||'
```

Do NOT delete `feat/theme-sharing-fixes` — it is checked out in the second session's `Map-theme` worktree. Its content already shipped via #47 (verified: `src/lib/communityStarters.ts`, the `canShare = !!handle` gate, and the `needs_handle` API gate are all on `main`), but deleting a branch another worktree has checked out breaks that workspace.

- [ ] **Step 5: Commit**

```bash
git add .gitignore && git commit -m "chore: ignore .gstack/ local state"
```

---

## Task 2: postcss + sharp via npm overrides (no Next major)

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Record the baseline advisory count**

```bash
npm audit --omit=dev --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d).metadata.vulnerabilities)))"
```
Expected: `{"info":0,"low":0,"moderate":0,"high":5,"critical":2,"total":7}`

- [ ] **Step 2: Add the `overrides` block**

Add to `package.json`, as a top-level key (sibling of `devDependencies`):

```json
  "overrides": {
    "postcss": "^8.5.25",
    "sharp": "^0.35.3"
  }
```

Add this comment to the PR body (JSON takes no comments): `next@15.5.x` pins `postcss` to exactly `8.4.31` and declares `sharp: ^0.34.3`; both are below the patched versions and neither is reachable without an override while staying on Next 15. `postcss` 8.4.31 → 8.5.25 is a minor bump of a build-time tool; `sharp` is an optional dep this app never invokes (`next/image` is unused).

- [ ] **Step 3: Install and confirm the tree actually moved**

```bash
npm install
node -p "require('./node_modules/postcss/package.json').version"
```
Expected: `8.5.25` (or later 8.5.x).

```bash
node -p "try{require('./node_modules/sharp/package.json').version}catch(e){'not installed (optional)'}"
```
Expected: `0.35.3` or `not installed (optional)` — either clears the advisory.

- [ ] **Step 4: Confirm both advisories are gone**

```bash
npm audit --omit=dev --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const v=JSON.parse(d).vulnerabilities;console.log('postcss:',v.postcss?'STILL PRESENT':'cleared');console.log('sharp:',v.sharp?'STILL PRESENT':'cleared');console.log(JSON.stringify(JSON.parse(d).metadata.vulnerabilities))})"
```
Expected: `postcss: cleared`, `sharp: cleared`, and the `next` entry gone too (it was flagged only *via* those two). Remaining should be the 4 auth/drizzle entries.

- [ ] **Step 5: Prove the build still works — postcss is in the CSS pipeline**

```bash
npm run lint && npm test && npm run build
```
Expected: lint exit 0, `403 passed`, `✓ Compiled successfully`, `Generating static pages (80/80)`.

- [ ] **Step 6: Verify the generated CSS did not change**

A postcss minor bump must not alter output. Compare a token that must survive verbatim:

```bash
grep -c "\-\-tm-ember" .next/static/css/*.css
```
Expected: non-zero. Then run `npm run design:check` (already part of `build`) — it fails if `design/tokens.ts` and the generated CSS diverge.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(deps): pin postcss + sharp via overrides, clearing 3 advisories without next@16"
```

---

## Task 3: drizzle-orm 0.38.2 → 0.45.2

**Files:**
- Modify: `package.json` (`drizzle-orm`, `drizzle-kit`), `db/schema.ts:27,39,56,93`
- Test: full suite + a migration no-op check

- [ ] **Step 1: Upgrade the two packages**

```bash
npm install drizzle-orm@0.45.2 drizzle-kit@0.31.10
```

- [ ] **Step 2: Typecheck to surface the breaking change**

```bash
npx tsc --noEmit
```
Expected: errors at `db/schema.ts` lines 27, 39, 56, 93. Drizzle 0.44+ replaced the object-returning table-config callback with an array-returning one. If tsc is clean, the deprecation is still accepted — apply Step 3 anyway, because the object form is removed in the next major.

- [ ] **Step 3: Migrate the 4 callbacks to array form**

`db/schema.ts:27`
```ts
}, (a) => [primaryKey({ columns: [a.provider, a.providerAccountId] })]);
```
`db/schema.ts:39`
```ts
}, (v) => [primaryKey({ columns: [v.identifier, v.token] })]);
```
`db/schema.ts:56`
```ts
}, (h) => [primaryKey({ columns: [h.userId, h.day] })]);
```
`db/schema.ts:93`
```ts
}, (t) => [index('theme_preset_userId_idx').on(t.userId)]);
```

- [ ] **Step 4: Typecheck + test**

```bash
npx tsc --noEmit && npm test
```
Expected: clean, `403 passed`.

- [ ] **Step 5: CRITICAL — prove no schema drift was introduced**

The single most dangerous outcome here is a serializer change that makes `drizzle-kit` think the schema differs from the recorded migrations, producing a spurious migration `0005`. Applying that to prod is exactly the failure mode that caused the 2026-07-25 outage.

```bash
npx drizzle-kit generate
git status --short drizzle/
```
Expected: **no new file** under `drizzle/`. `drizzle-kit` should report no schema changes.

If a new migration IS generated: **STOP.** Do not commit it. Inspect the SQL — if it is a no-op or a cosmetic re-statement of existing objects, delete it and record why in the PR. Never apply it to prod on the strength of a dependency bump.

- [ ] **Step 6: Confirm prod schema is untouched and the app still reads it**

```bash
npm run build
```
Expected: `Compiled successfully`, 80/80 pages — the build statically renders routes that query the DB.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json db/schema.ts
git commit -m "fix(deps): drizzle-orm 0.45.2 (SQL-identifier escaping advisory) + array-form table configs"
```

---

## Task 4: Auth stack — next-auth + @auth/core + @auth/drizzle-adapter

**Ships alone, last, and is the only phase that can lock users out.**

**Files:**
- Modify: `package.json`, `package-lock.json`
- Verify: `auth.ts` (expected unchanged)

- [ ] **Step 1: Upgrade**

```bash
npm install next-auth@5.0.0-beta.32 @auth/drizzle-adapter@1.11.3
```

`@auth/core` is transitive; confirm it moved past the advisory (`<=0.41.2`):
```bash
node -p "require('./node_modules/@auth/core/package.json').version"
```
Expected: `0.41.3` or later.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
`auth.ts` uses only the stable v5 surface — `NextAuth({ adapter, providers, session, pages })` with `DrizzleAdapter(db, {usersTable, accountsTable, sessionsTable, verificationTokensTable})`. No change is expected. If tsc errors, fix against the beta.32 types before continuing; do not loosen types to make it pass.

- [ ] **Step 3: Test + build**

```bash
npm test && npm run build
```
Expected: `403 passed`, `Compiled successfully`.

- [ ] **Step 4: Confirm no DB migration is implied**

The adapter owns `users`/`accounts`/`sessions`/`verificationTokens`. A column change between 1.7.4 and 1.11.3 would need a migration applied to prod BEFORE merge (see `migration-prod-target-outage`).

```bash
npx drizzle-kit generate
git status --short drizzle/
```
Expected: no new migration. If one appears, it MUST be applied to the production database before the PR merges, not after.

- [ ] **Step 5: Verify auth on a preview deployment — NOT production**

Push the branch and let Vercel build a preview. Then, against the preview URL:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<preview-url>/api/auth/providers"
```
Expected: `200`, listing Google.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<preview-url>/api/progress"
```
Expected: `401` (signed-out), **not** `500`. A 500 here means the session/adapter path is broken.

- [ ] **Step 6: Human-verified sign-in (BLOCKING — cannot be automated)**

Completing a Google sign-in requires entering account credentials, which an agent must not do. **The repo owner performs this step**, on the preview URL:

1. Sign in with Google → lands back signed in, `/settings` reachable.
2. `/me` shows the existing profile and progress (proves the DB session strategy still resolves).
3. Sign out → returns to signed-out state.

Also flag the expected blast radius before merging: sessions are `strategy: 'database'` so rows survive, but if the cookie format changed between beta.25 and beta.32, **all users are signed out once** and must log in again. That is acceptable, but should be a known outcome rather than a surprise.

- [ ] **Step 7: Merge, then confirm zero advisories**

```bash
npm audit --omit=dev --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d).metadata.vulnerabilities)))"
```
Expected: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`

- [ ] **Step 8: Post-deploy production check**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://partykamap.vercel.app/api/progress
```
Expected: `401`.

```bash
curl -s https://partykamap.vercel.app/api/community-themes | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('themes:',JSON.parse(d).length))"
```
Expected: `themes: 4`.

---

## Task 5: Lock the gate so this cannot rot again

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add an audit step to CI**

Insert after the `npm run lint` step:

```yaml
      # Fails the build on a new CRITICAL/HIGH advisory in PRODUCTION deps.
      # --omit=dev on purpose: a devDependency advisory does not ship to users
      # and must not block a release.
      - run: npm audit --omit=dev --audit-level=high
```

- [ ] **Step 2: Prove it passes only after Tasks 2–4 land**

```bash
npm audit --omit=dev --audit-level=high; echo "EXIT=$?"
```
Expected: `EXIT=0`. Before Task 4 this exits non-zero, which is why this task ships last.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore(ci): fail on high/critical advisories in production deps"
```

---

## Sequencing and risk

| Task | PR | Risk | Rollback |
|---|---|---|---|
| 1 hygiene | small | none | revert commit |
| 2 postcss/sharp | own PR | low — build-time only | revert `overrides` |
| 3 drizzle | own PR | medium — DB layer, watch for spurious migration | revert; no schema change means no data risk |
| 4 auth | own PR, alone | **high — can lock users out** | revert + redeploy; DB sessions survive |
| 5 CI gate | folded into Task 4's PR or its own | none | revert |

Tasks 2, 3 and 4 must **not** be combined. If auth breaks, the revert has to be surgical, and a combined PR forces reverting the other fixes with it.

## Out of scope

- **`next@16`** — not needed to reach zero advisories (see Task 2). A major upgrade deserves its own plan.
- **devDependency advisories** — `npm audit` without `--omit=dev` reports more; those do not ship to users. The CI gate in Task 5 deliberately scopes to production deps.
