# Theme step 3 — server storage + cross-device custom-theme sync

Schema (migration 0003) already committed: profile.customTheme (jsonb, Theme),
cardUsesCustomTheme, themeShared, customThemeUpdatedAt. This step wires the
custom theme through the server so it follows a user across devices, and fixes
the mode coercion so 'custom' is no longer dropped to null.

## Sync model — last-write-wins, client-timestamped
- localStorage gains `tsm-custom-updated` (epoch ms) — stamped on every local
  apply/clear.
- On authed app load, <ThemeSync/> pulls /api/profile and compares timestamps:
  server newer → adopt (cache locally; re-inject if mode is custom; clear if the
  server theme is null); local newer → push. Ties → no-op.
- Editor Apply/Reset also push immediately (fire-and-forget).

## Files
- MODIFY db + types: `src/lib/types.ts` (ProfileDTO + input).
- MODIFY `app/api/profile/route.ts` — GET returns + PUT validates the 4 fields
  (customTheme via parseTheme; client-timestamped customThemeUpdatedAt).
- MODIFY `app/api/progress/route.ts` — theme coercion accepts 'custom'.
- MODIFY `src/lib/customTheme.ts` — tsm-custom-updated writes + cacheCustomTheme().
- CREATE `src/lib/themeSync.ts` — pushCustomTheme() + pullAndMergeTheme().
- CREATE `src/components/ThemeSync.tsx` — runs pullAndMergeTheme() on mount.
- MODIFY `app/layout.tsx` — render <ThemeSync/>.
- MODIFY `app/settings/ThemeEditor.tsx` — push on Apply/Reset.
- Tests: themeSync merge logic (mock fetch), customTheme timestamp/cache,
  profile route validation (match existing route-test pattern if any).

## Gate
Requires migration 0003 applied before merge/runtime. Build (next build) does
NOT hit the DB, so the preview builds green pre-migration; runtime verification
waits for the migration.
