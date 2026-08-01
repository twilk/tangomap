# Theme Sharing — Decouple, Revive, QA (design)

## Problem

The custom-theme sharing feature shipped in #36 (preset library + community gallery + share) is live but feels unfinished. Confirmed root causes:

1. **Sharing is gated behind the public-profile toggle.** `PATCH /api/presets/[id]` returns `needs_public` unless `isPublic && handle`, and the gallery read model filters on `isPublic`. A user who wants to share a style without exposing their DNA/progress page can't — so sharing looks broken.
2. **The gallery is empty and low-visibility.** `/api/community-themes` returns `[]` (nobody has shared, partly because of #1), and the panel sits below the starting presets in Settings.
3. **The end-to-end flow is unverified.** Save → name → share → appears in gallery → apply from another account was never walked through on a live signed-in session.

## Goals

- A user **with a handle** can share a theme **without** making their profile public.
- The gallery is **never empty on day one** (2–3 curated starters) and is **visible** in Settings → Theme.
- The save → share → discover → apply flow is **QA'd end-to-end** and any real defect is fixed.

## Non-goals

- No browsable `/themes` page — keep the Settings panel (user decision).
- No `Name[author]` label change — keep `Name — by @handle` (user de-scoped it).
- No preset overwrite/reorder; no changes to card or compare theming.
- No schema change — `theme_preset` / `isShared` / `handle` already exist; this is pure logic + UI.

## Design

### A. Decouple sharing from `isPublic` (needs only a handle)

- **`app/api/presets/[id]/route.ts`** — the `isShared: true` gate changes from `!prof?.isPublic || !prof.handle` → `!prof?.handle`, returning **`needs_handle`** (409) instead of `needs_public`. The 0-or-1 sibling-clear stays.
- **`src/lib/publicProfile.ts`** — `getCommunityThemes` and `getSharedTheme` drop `eq(profile.isPublic, true)` from the WHERE; keep `eq(themePreset.isShared, true)` ∧ `isNotNull(profile.handle)` ∧ the `parseTheme` revalidation. Update the JS defense-in-depth filter to drop the `isPublic` check (keep `isShared` + `authorHandle`).
- **`src/components/PresetLibrary.tsx`** — the Share pre-check + message change from "make your profile public" to **"set a handle in Settings"** (gate on `handle`, not `isPublic`); handle the 409 `needs_handle`.
- **`app/u/[handle]` `ApplySharedTheme`** — unchanged. The `/u/[handle]` page only exists for public profiles, so a non-public sharer simply has no `/u` page; their theme still appears in the gallery. State this explicitly so no one re-adds an `isPublic` gate here by mistake.
- **Privacy** — the shared read model already exposes only `{ id, name, seeds, authorHandle, authorDisplayName }`; no DNA/progress/private field. Decoupling from `isPublic` does not widen this. `getPublicProfile` (the DNA page) stays gated on `isPublic`.

### B. Revive the gallery

- **Seed — built-in starter themes (code, no DB, no fake account).** A curated constant `STARTER_COMMUNITY_THEMES` (2–3 entries: `{ name, seeds: Theme, authorHandle: 'tangomap', authorDisplayName: 'Tango Map' }`, e.g. "BloodRose", "Midnight"). Each is shaped as `CommunityTheme` with a stable id `starter:<slug>`. `getCommunityThemes` **prepends** the starters (validated by `parseTheme`) to the DB rows, so every consumer (the gallery, the API) sees them consistently. Starters apply/save exactly like any community theme (value-copy of seeds).
- **Stronger empty/onboarding state** — with starters present the gallery is never truly empty, but the panel still gets an inviting one-liner + CTA ("Share your first theme →") wired to the save-as-preset + share control.
- **Visibility** — the `CommunityThemes` panel gets a clear heading + short intro in Settings → Theme, positioned so it isn't lost under the starting presets. Layout/heading tweak only, `--tm-*` tokens (no hardcoded colours).

### C. QA end-to-end + fix

- A QA workstream that (1) traces the save → share (handle, no public profile) → gallery → apply/save-from-another-account paths in code, fixing any defect the decoupling surfaces, and (2) produces an exact signed-in walkthrough for the user to confirm on prod (Claude can't drive an authenticated session headlessly). The most likely "bug" was the `isPublic` coupling (A fixes it); QA confirms nothing else is broken.

## Units touched

| Unit | Change |
|---|---|
| `app/api/presets/[id]/route.ts` | share gate → `handle` only (`needs_handle`) |
| `src/lib/publicProfile.ts` | read model → drop `isPublic`; prepend starters |
| starters constant (new, e.g. `src/lib/communityStarters.ts`) | 2–3 curated `CommunityTheme`s |
| `src/components/PresetLibrary.tsx` | Share copy + 409 handling → handle |
| `src/components/CommunityThemes.tsx` + `app/settings/ThemeEditor.tsx` | heading/intro/empty-state/visibility |

## Testing

- **Unit:** presets route — share needs a handle (409 `needs_handle` without one; succeeds with a handle regardless of `isPublic`). Read model — a shared theme from a **non-public** author WITH a handle IS listed; a shared theme from a handle-less author is NOT; starters are always present + valid. Starters constant — every starter passes `parseTheme`. `CommunityThemes` — renders the starters.
- **Manual QA (user, on prod):** the signed-in walkthrough from §C.

## Rollout

Single PR (decouple + starters + gallery UX + tests). No migration. Deploy, then the user runs the auth'd walkthrough. All colours via `--tm-*` (project rule).
