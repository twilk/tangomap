# Theme step 2 — runtime injection + no-flash + 3-state toggle

Builds on the engine foundation (src/lib/theme.ts). Makes a custom theme a THIRD
`data-theme` value that renders across the app with no first-paint flash, and
extends the one shared toggle to cycle dark → light → custom (custom only when
configured). The map bundle falls back to the custom's nearest light/dark.

## localStorage contract
- `tsm-theme`: 'light' | 'dark' | 'custom'  (existing key, extended)
- `tsm-custom`: JSON of the Theme struct {v,ground,ink,accent,accent2} (for editing)
- `tsm-custom-css`: the full `:root[data-theme="custom"] .tm-profile{…}` block, pre-built
- `tsm-custom-polarity`: 'light' | 'dark' (theme-color meta + map fallback)

## Files
- CREATE src/lib/customTheme.ts — client module (apply/clear/cycle/read + css builder)
- CREATE test/customTheme.test.ts — jsdom unit tests
- MODIFY app/layout.tsx — extend the no-flash THEME_SCRIPT to inject the custom <style>
- MODIFY src/components/ThemeToggle.tsx — 3-state cycle + swatch icon
- MODIFY app/tango.css — show/hide the swatch icon under [data-theme=custom]
- MODIFY public/theme-sync.js — custom → polarity on the map; bump ?v in tangomap.html
