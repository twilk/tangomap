# Changelog

Notable changes. Newest first. This app ships continuously (push to `main` → Vercel), so entries
are grouped by date rather than versioned releases.

## 2026-07-25

### Added
- **Source map replaces the generated bundle** (#40). The `/` landing page is now a source React map
  (`app/page.tsx` → `TangoMap`) built from `src/data/mapNodes.ts` through pure layout engines, on the
  app's `--tm-*` tokens — so it inherits light/dark/custom theming. The 313 KB `public/tangomap.html`
  bundle and all injected `map-*.js` scripts are deleted.
- **Custom theme system**: engine + flash-free runtime + 3-state toggle (#27), Settings editor (#28),
  cross-device sync (#30), dancer card + OG rendering (#38), and the preset library + community gallery
  + compare theming (#36).
- **AR card**: "Place my card" surface AR (#34), immersive/motion modes (#26, #32, #33), and the L2
  "card over the phone" present-marker scanner (#39).
- **Skill pages**: prev/next navigation and "Mostly useful with" (#31).

### Fixed
- Cross-device progress sync is last-write-wins so a stale device can't clobber fresh progress (#37).

### Infra
- `.github/workflows/ci.yml` runs `design:check` + `test` + `build` on every PR.
