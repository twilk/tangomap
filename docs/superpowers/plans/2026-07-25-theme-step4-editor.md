# Theme step 4 — Settings custom-theme editor (pure client)

Reordered ahead of step 3 (server sync) because it needs NO DB migration and is
what actually lets a user CREATE a custom theme (today: console-only). Writes
through the existing `customTheme.ts` API → localStorage; the whole app is the
live preview via `data-theme="custom"`.

## Files
- CREATE `app/settings/ThemeEditor.tsx` — client editor (4 seed pickers, live
  contrast feedback, candidate preview, Apply, reset-with-confirm, prefill).
- CREATE `test/themeEditor.test.tsx` — createRoot/act pattern (match settings.test.tsx).
- MODIFY `app/settings/page.tsx` — add a "Theme" section rendering <ThemeEditor/>.
- MODIFY `app/tango.css` — editor + preview classes.

## Engine reused (no new logic)
`parseTheme`, `deriveTokens`, `AA_CONTRAST`(4.5), `AA_UI_CONTRAST`(3) from
`@/src/lib/theme`; `parseHex`, `contrastRatio` from `@/src/lib/color`; `cssVar`
from `@/design/tokens`; `applyCustomTheme`/`clearCustomTheme`/`currentCustomTheme`
from `@/src/lib/customTheme`.

## Deferred (NOT in step 4 — avoid dead UI)
"Use on my card" (step 5) and "Share my theme" (step 6) toggles land with their
backing features, not as no-op checkboxes here.
