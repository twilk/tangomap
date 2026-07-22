# Tango Map — Review & Fix Log

Live: https://partykamap.vercel.app · Repo: `twilk/tangomap`

## What this app is
A gamified **Argentine-tango skill map** (Duolingo-style skill tree): 62 techniques
across 10 levels (Beginners → Advanced), with `ready`/`mastered`/`locked` node states,
a "NEXT UP" panel, a level navigator, search, theme toggle, and a per-node detail panel
with a "Mark as mastered" action.

## Important constraint
`index.html` is a **generated single-file bundle** from a design-to-code tool
(`dc-runtime`, design-system namespace `Organic_organi`). The React logic + declarative
markup live inside a gzip+base64 manifest and a JSON-encoded `__bundler/template` string;
at boot the runtime does `document.documentElement.replaceWith(templateDoc)`. Only two
kinds of change are safe directly in the bundle:
1. `<head>` metadata (static head + template head).
2. **CSS token overrides** and **defensive progressive-enhancement scripts** injected into
   the template `<head>` (DOM-only, `try/catch`, poll for `.tsm`).

Anything needing component logic / new markup / layout math belongs in the **source
project** and must be re-exported.

---

## ✅ Shipped in the bundle (deployed)

**SEO / metadata** — real `<title>`, `<html lang>`, description, canonical, theme-color,
OpenGraph + Twitter (static head for scrapers + template head for the rendered DOM).

**Contrast (WCAG AA)** — muted label text was `--t-muted: neutral-600` (`#82796a`, ~3.6:1
on cream, fails AA). Override (light theme only) → `neutral-700` (`#645c50`, ~5.5:1, AA).
Verified live: `rgb(100,92,80)`, 5.53:1.

**Progressive enhancement** (injected script, DOM-only, all in `try/catch`) —
- **Fixed top progress bar** (`role="progressbar"`) visualizing X/62; updates live as you master
  skills, with an `aria-live` announcement ("N of 62 skills mastered").
- **First-visit onboarding** toast (dismissible, `localStorage`-gated) pointing new users at
  Level 1 and the keyboard shortcuts.
- Detail panel gets `role="dialog"` + `aria-label` on open, focus moves into it, and focus
  is restored to the originating node on close.
- `/` focuses the skill search.
- Keyboard **arrow-key navigation** between the nearest nodes (was 62 flat tab stops).
- Clearer theme-toggle label ("Switch to dark/light" instead of "Switch theme").

Scheduler note: the injected observers run on a `setTimeout` debounce, not
`requestAnimationFrame` (rAF is paused in background/hidden tabs, which silently broke an
earlier build).

**Could NOT be done in the bundle** — Esc-to-close the detail panel: dc-runtime's close
button (`data-dc-tpl`) ignores synthetic click/pointer events, so a programmatic close
isn't possible. The X button (real click / keyboard-activate) remains the only close.

---

## 👍 Already handled by the app / design system (NOT gaps — first review over-flagged these)
First-pass review inspected an **empty first-load** and wrongly concluded several things
were missing. Verified afterwards that the app already does them:
- **Progress persistence** — the app persists mastered skills to `localStorage`
  (`tsm-mastered`); reload keeps your progress. (Also persists `tsm-theme`, `tsm-sel`.)
- **Theme persistence** — native (`tsm-theme`). (An earlier PE duplicate was removed to
  avoid a restore race.)
- **Keyboard focus** — `:focus-visible { outline: 2px solid accent }` (+ dark variant).
- **Reduced motion** — `@media (prefers-reduced-motion: reduce)` disables animation/transition.
- **State shape-coding** — states are ring/check (per the legend), not color-only.
- **Mobile** — responsive reflow to one tall column, no horizontal overflow, tap-highlight
  reset, styled scrollbars, viewport meta.
- **Mastery action** — the detail panel has "Mark as mastered".

---

## 📋 Genuinely remaining — needs the design-to-code source project
(Not safely doable by hand-editing the compiled bundle.)

1. **Progress visibility** — top progress bar shipped; a *per-level* breakdown + an in-canvas
   ring still want source-side design.
2. **Legend** — show state glyphs inline; add the `locked/next` state to the legend text.
3. **Search** — autocomplete list (name + level); `aria-live` result count. (`/`-focus done.)
4. **NEXT UP** — "why now / unlocked by" caption; hover/click highlights the node on the map.
5. **Level navigator** — highlight active level + % complete per row; focus-trap.
6. **Nodes** — enlarge hit area to ≥44×44px (nodes are 40px; resizing shifts the
   absolutely-positioned map layout, so source-side).
7. **Paths** — light up a path when both endpoints are mastered; weight lines by relevance.
8. **Detail panel** — `role="dialog"` + focus in/out shipped; prereq/next links and a working
   Esc-to-close need source (dc-runtime's close ignores synthetic events — see above).
9. **Responsiveness** — desktop "fit to screen" + pinch/scroll zoom (SVG has no `viewBox`);
   minimap / "jump to level" on the long mobile scroll.
