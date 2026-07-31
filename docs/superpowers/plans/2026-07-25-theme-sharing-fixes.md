# Theme Sharing Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Decouple theme sharing from the public-profile toggle (needs only a handle), revive the community gallery (2–3 built-in starter themes + stronger, more visible panel), and QA the end-to-end flow, fixing any real defect.

**Architecture:** Pure logic + UI on the already-shipped #36 data model (`theme_preset`, `isShared`, `handle`). No schema/migration. All colours via `--tm-*` (project rule).

**Tech Stack:** Next.js 15, Drizzle/Postgres, Auth.js, Vitest. Reuse `parseTheme`/`CommunityTheme`.

**Spec:** `docs/superpowers/specs/2026-07-25-theme-sharing-fixes-design.md`.

---

### Task 1: Built-in starter community themes

**Files:** Create `src/lib/communityStarters.ts`; Test `test/communityStarters.test.ts`.

- [ ] Define `STARTER_COMMUNITY_THEMES: CommunityTheme[]` — 3 curated entries `{ id: 'starter:<slug>', name, seeds: Theme, authorHandle: 'tangomap', authorDisplayName: 'Tango Map' }`. Candidates (tune hexes until each passes `parseTheme` — ink/ground ≥ 4.5, accents ≥ 3): a cool dark "Midnight" (deep blue-grey ground, blue + green accents), a warm dark "Carmesí" (near-black rose ground, rose + gold accents), a light "Sereno" (warm off-white ground, teal + amber accents). Distinct from any user theme name.
- [ ] Test: every starter's `{v:1,...seeds}` passes `parseTheme` (non-null); ids are unique + stable (`starter:` prefix); shape matches `CommunityTheme`.
- [ ] Commit.

### Task 2: Decouple the share gate (API)

**Files:** Modify `app/api/presets/[id]/route.ts:47`; Test `test/api.presets.test.ts`.

- [ ] Change the `isShared:true` gate from `!prof?.isPublic || !prof.handle` → `!prof?.handle`, returning `{ error: 'needs_handle' }` (409). Keep the 0-or-1 sibling-clear.
- [ ] Test: PATCH `{isShared:true}` with NO handle → 409 `needs_handle`, no write; with a handle and `isPublic:false` → succeeds (share is set). Update/replace the old `needs_public` assertion.
- [ ] Commit.

### Task 3: Decouple the read model + prepend starters

**Files:** Modify `src/lib/publicProfile.ts` (`getCommunityThemes`, `getSharedTheme`); Test `test/publicProfile.test.ts`.

- [ ] `getCommunityThemes`: drop `eq(profile.isPublic, true)` from the WHERE (keep `isShared` ∧ `isNotNull(handle)` ∧ `parseTheme` revalidation ∧ the JS defense-in-depth filter minus `isPublic`); **prepend** `STARTER_COMMUNITY_THEMES` to the result.
- [ ] `getSharedTheme`: drop the `isPublic` requirement (return the shared preset for any handle'd author; keep `parseTheme`).
- [ ] Test: a shared theme from a **non-public** author WITH a handle IS listed; a shared theme from a handle-less author is NOT; the 3 starters are always present and appear first; the JS gate test (mixed rows) still enforces `isShared` + handle.
- [ ] Commit.

### Task 4: PresetLibrary Share UI → handle

**Files:** Modify `src/components/PresetLibrary.tsx`; Test `test/presetLibrary.test.tsx`.

- [ ] The Share pre-check + message change from "make your profile public" to "set a handle in Settings" (gate on `handle` prop, not `isPublic`). Handle the 409 `needs_handle` (same message). Keep everything else.
- [ ] Test: with no handle, clicking Share shows the "set a handle" message and makes NO PATCH; with a handle (isPublic false) Share PATCHes `{isShared:true}`.
- [ ] Commit.

### Task 5: Gallery UX — visibility, intro, starter labelling

**Files:** Modify `src/components/CommunityThemes.tsx`, `app/settings/ThemeEditor.tsx`, CSS (`app/tango.css`); Test `test/communityThemes.test.tsx`.

- [ ] Give the community panel a clear heading + one-line intro and position it so it isn't lost under the starting presets. Add an onboarding CTA ("Share your first theme →") wired to the save-as-preset control. Distinguish starters: show `by Tango Map` (no `@`) for `authorHandle === 'tangomap'`, `by @handle` for real users. `--tm-*` only, no hardcoded colours.
- [ ] Test: the gallery renders the starter buttons (labelled "Tango Map"); a real shared theme shows `@handle`; the CTA is present.
- [ ] Commit.

### Task 6: End-to-end QA + defect hunt

**Files:** (read-only trace; fix any defect found in the relevant file); Create `docs/superpowers/specs/2026-07-25-theme-sharing-qa.md` (the signed-in walkthrough).

- [ ] Trace the full path in code: save preset (`POST /api/presets`) → name/validate → share (`PATCH {isShared:true}` with a handle) → appears in `getCommunityThemes` → gallery renders it → from another account Apply (`applyCustomTheme` + `pushCustomTheme`) + "Save to my library". Look for any real defect beyond the (now-fixed) `isPublic` coupling — e.g. the disjoint-write rule, the 0-or-1 clear, `customThemeUpdatedAt` handling, the gallery cache header, missing revalidation. Fix any found (with a test).
- [ ] Write `2026-07-25-theme-sharing-qa.md`: the exact signed-in steps for the user to confirm on prod (two accounts: A shares with a handle + private profile; B sees it in the gallery, applies, saves to library).
- [ ] Commit.

---

## Self-review
- **Coverage:** decouple (Tasks 2–4), revive (Tasks 1, 5), QA (Task 6) — all spec sections covered.
- **No schema change** — confirmed (data model from #36).
- **Types:** `CommunityTheme` reused for starters; `Theme` seeds validated by `parseTheme`.
- **Colours:** every UI change uses `--tm-*` (project rule) — grep the diff before shipping.
- Ship as one PR after all tasks + a final review.
