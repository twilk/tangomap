# Tango Map — Review & Fix Log

Live: https://partykamap.vercel.app · Repo: `twilk/tangomap`

## What this app is
A gamified **Argentine-tango skill map** (Duolingo-style skill tree): 62 techniques
across 10 levels (Beginners → Advanced), with `ready`/`mastered`/`locked` node states,
a "NEXT UP" panel, a level navigator, search, theme toggle, and a per-node detail panel.

## Important constraint
`index.html` is a **generated single-file bundle** from a design-to-code tool
(`dc-runtime`, design-system namespace `Organic_organi`). The React component logic and
the declarative page markup live inside a gzip+base64 manifest and a JSON-encoded
`__bundler/template` string. Only two classes of change are safe to make directly in the
bundle:
1. `<head>` metadata (static head + template head).
2. **CSS design-token overrides** injected as a higher-specificity `<style>` (survives the
   runtime HelmetManager re-hoisting the design-system styles).

Everything that needs component logic, new markup, or layout math must be done in the
**design-to-code source project** and re-exported. Hand-editing the compiled bundle for
those would risk breaking a working production app.

---

## ✅ Fixed in the bundle (deployed)

### SEO / metadata (both static head + runtime template head)
- Real `<title>` ("Tango Map — 62 Argentine Tango Skills, Beginner to Advanced") — was empty.
- `<html lang="en">` — was missing.
- `meta description`, `link canonical`, `theme-color`.
- OpenGraph + Twitter card tags for link previews.
- Static head serves these for non-JS scrapers; template head sets them in the rendered DOM.

### Accessibility — contrast (WCAG AA)
- **Muted label text** (title, legend, "NEXT UP", level/category labels) used
  `--t-muted: --color-neutral-600` (`#82796a`) on the cream bg = **~3.6:1 (fails AA)**.
- Override (light theme only): `--t-muted: --color-neutral-700` (`#645c50`) = **~5.5:1 (AA)**.
- Dark theme already used neutral-400 on dark bg (~7:1) — left unchanged.

---

## 👍 Already handled well in the design system (no action needed)
These were flagged during first-pass visual review but the source CSS already covers them:
- **Keyboard focus**: `:focus-visible { outline: 2px solid var(--color-accent) }` (+ dark variant).
- **Reduced motion**: `@media (prefers-reduced-motion: reduce){ animation:none; transition:none }`.
- **Mobile**: responsive reflow to a single tall column, no horizontal overflow, `-webkit-tap-highlight-color` reset, styled scrollbars, `meta viewport` present in the template.

---

## 📋 Backlog — needs the design-to-code source project

Each item lists the 2 proposals from the review. "Kind" = why it can't be a bundle CSS override.

1. **Progress indicator** (kind: component) — (a) visual progress bar/ring instead of only
   the "0/62" micro-text; (b) per-level/-tier counters ("Beginners 0/18 …").
2. **Legend** (kind: content) — (a) show state glyphs (ring/check) instead of words;
   (b) add the missing `locked/next` state to the legend.
3. **Search** (kind: component) — (a) search icon + `/` focus shortcut + `aria-live` result
   count; (b) autocomplete showing name + level, Enter jumps to the node on the map.
4. **Theme toggle** (kind: logic) — (a) state-target label/tooltip ("Switch to dark");
   (b) persist choice in `localStorage` + honor `prefers-color-scheme` on first load.
5. **Level navigator** (kind: logic) — (a) highlight the active level + show % complete per
   row; (b) focus-trap + `Esc` to close + `aria-expanded` on the opener.
6. **NEXT UP panel** (kind: logic) — (a) micro "why now / unlocked by" caption;
   (b) hover/click highlights the matching node + scrolls it into view.
7. **Skill nodes** (kind: layout+render) — (a) enlarge hit area to ≥44×44px;
   (b) differentiate states with shape/icon (lock, check), not color alone (colorblind-safe).
8. **Paths / connections** (kind: render) — (a) light up a path when both endpoints are
   mastered; (b) weight lines by relevance (ready→next thicker, distant deps thinner).
9. **Detail panel** (kind: logic) — (a) "Mark mastered/ready" action + prereq/next links;
   (b) proper `role="dialog"`, focus management, `Esc`, restore focus to the node.
10. **Focus/keyboard flow** (kind: logic) — (a) skip-to-map / skip-to-next-up links;
    (b) arrow-key navigation between adjacent nodes (62 tab stops is a long crawl).
11. **Responsiveness** (kind: layout) — (a) desktop "fit to screen" + pinch/scroll zoom
    (SVG has no `viewBox`); (b) minimap / "jump to level" + sticky progress on the tall mobile scroll.
12. **State persistence & onboarding** (kind: logic) — (a) persist mastered/ready/theme/last
    position in `localStorage` (currently resets on reload); (b) first-visit onboarding /
    empty-state pointing at the first 3 steps.
