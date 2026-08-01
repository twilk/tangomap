# Theme Sharing — signed-in QA walkthrough

Claude can't drive an authenticated session headlessly, so this is the end-to-end check to run on prod after deploy. The suspected "it doesn't work" was the **isPublic coupling** — sharing used to require a public profile, and the gallery only listed public authors. That's now decoupled: sharing needs **only a handle**, and the gallery is seeded with 3 starter themes so it's never empty. A full code trace (review) found no other defect.

## Prep
- Account **A** (the sharer) and account **B** (the discoverer). A does NOT need a public profile — just a handle.

## A — create, name, share (no public profile needed)
1. Sign in as **A** → Settings → Theme.
2. If A has no handle yet: set one in Settings (the "Share" control will point you there otherwise).
3. In the editor pick 4 colours (or start from a preset), then in the preset library **Save** as e.g. `BloodRose`.
4. On the `BloodRose` row click **Share**.
   - Expected: it shares immediately (no "make your profile public" wall). With no handle it shows **"Set a handle in Settings to share"** instead — set one, retry.
5. Confirm only one preset shows the **Shared** badge (sharing a second moves the badge).

## B — discover, apply, save (from another account)
6. Sign in as **B** → Settings → Theme → the **Community themes** panel.
   - Expected: the 3 starters (**Midnight**, **Carmesí**, **Sereno** — labelled *by Tango Map*) **plus** `BloodRose — by @<A's handle>`.
7. Click `BloodRose` → the whole app recolours (flash-free). Reload — it persists (it's B's active theme now).
8. Click **Save to my library** on `BloodRose` → it appears in B's preset library (respects the 5-cap).
9. (Optional) A starter: click **Midnight** → applies; **Save to my library** → saved as a normal preset.

## Expected results / pass criteria
- Sharing works with a handle and a **private** profile (the old coupling is gone).
- The gallery is never empty (3 starters always present, first).
- `/api/community-themes` returns the starters + any shared themes (public endpoint; `curl https://partykamap.vercel.app/api/community-themes` shows ≥ 3 entries).
- A's DNA/progress page (`/u/<handle>`) still 404s while A's profile is private — decoupling sharing did **not** expose A's profile. Only the theme (name + colours + handle/displayName) is public.

## If something still fails
Note the exact step + what you saw (screenshot). The likely remaining causes would be data-specific (e.g. A never set a handle, or the 5-preset cap on B). Report back and I'll trace it.
