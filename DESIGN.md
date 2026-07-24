---
name: Tango Map — "The Milonga at Night"
colors:
  primary: "#c67139"
  secondary: "#2C7869"
  tertiary: "#A6172E"
  ground: "#f5ead8"
  panel: "#f9f4ed"
  panelRaised: "#fdfbf5"
  ink: "#201e1d"
  muted: "#645c50"
  faint: "#968b79"
  line: "#dcd3c4"
  lineSubtle: "rgba(32,30,29,.07)"
  emberSoft: "rgba(198,113,57,.15)"
  verdigrisSoft: "rgba(44,120,105,.15)"
  chip: "rgba(32,30,29,.05)"
  focus: "#3F5BB0"
typography:
  h1:
    fontFamily: "Iowan Old Style, Georgia, Times New Roman, serif"
    fontSize: "clamp(28px, 6vw, 46px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(14px, 1.7vw, 16px)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  sectionLabel:
    fontFamily: "ui-monospace, SF Mono, Cascadia Mono, Menlo, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.22em"
  navLink:
    fontFamily: "ui-monospace, SF Mono, Cascadia Mono, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.06em"
  statValue:
    fontFamily: "ui-monospace, SF Mono, Cascadia Mono, Menlo, Consolas, monospace"
    fontSize: "clamp(18px, 2.6vw, 26px)"
    fontWeight: 600
    fontFeature: "tnum"
  signature:
    fontFamily: "Iowan Old Style, Georgia, Times New Roman, serif"
    fontSize: "clamp(15px, 2.2vw, 18px)"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "8px"
  input: "10px"
  card: "12px"
  panel: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  section: "34px"
  pagePadding: "clamp(20px, 5vw, 48px)"
  contentWidth: "760px"
  contentWidthWide: "880px"
components:
  navPill:
    textColor: "{colors.muted}"
    typography: "{typography.navLink}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  primaryButton:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.input}"
    padding: "11px 22px"
  dangerButton:
    backgroundColor: "{colors.tertiary}"
    textColor: "#ffffff"
    rounded: "{rounded.input}"
    padding: "11px 20px"
  ctaButton:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "11px"
    padding: "12px 18px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "11px 14px"
  statStrip:
    backgroundColor: "{colors.panelRaised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "15px 16px"
  input:
    backgroundColor: "{colors.panelRaised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "11px 13px"
  tag:
    textColor: "{colors.faint}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
---

## Overview

Tango Map is an Argentine-tango skill tracker: a map of 62 techniques across 10
levels, with accounts, progress sync, shareable public profiles, head-to-head
comparison, and partner matching.

The visual identity is **"the milonga at night"** — ember lamplight, verdigris
bronze, and carmine. It evokes a dimly lit Buenos Aires dance hall: warm paper
tones as the ground, a single warm accent (ember) that carries almost all
interactive emphasis, a cool teal (verdigris) as the counterpart voice, and
carmine reserved for mastery and danger.

Two hard constraints shape everything:

1. **The map bundle is untouchable.** The main map at `/` is a compiled
   single-file bundle from a design-to-code tool; we do not have its source.
   All app styling lives in `app/tango.css`, scoped under the `.tm-profile`
   class so it can never leak into the bundle. The light palette
   (`#f5ead8` / `#201e1d` / `#c67139` / `#dcd3c4`) is deliberately matched to
   the bundle's own palette so the map and the app read as one continuous
   product.
2. **The app tracks the map's theme, not the OS.** The bundle defaults to
   light and only goes dark on an explicit toggle stored in
   `localStorage["tsm-theme"]`. A no-flash script in the layout mirrors that
   value into `data-theme` on `<html>`; the dark palette is applied via
   `:root[data-theme="dark"] .tm-profile`. Never use
   `prefers-color-scheme` to pick the theme.

Character in one line: editorial serif headlines, utilitarian monospace labels,
quiet system-sans body — warm, tactile, and restrained, like a well-worn
practice journal.

## Colors

The palette has three voices, each with a fixed meaning. Meanings are semantic,
not decorative — do not swap them.

- **Ember `{colors.primary}`** — the lamplight. The default accent: links on
  hover, focus rings, primary buttons, progress fills, the brand dot, "beginner"
  tier, side A in comparisons. If something is interactive or in progress, it
  glows ember.
- **Verdigris `{colors.secondary}`** — the bronze. The counterpart voice:
  "intermediate" tier, side B in comparisons, success/"public" states, the
  teach-role avatar. It exists so two datasets can sit side by side without
  competing.
- **Carmine `{colors.tertiary}`** — the deepest red. Dual meaning by context:
  **mastery** (maxed-out dimensions, "advanced" tier, the hot end of the
  ember→carmine gradient) and **danger** (delete account, destructive
  confirmation). These never appear on the same screen region, so the dual role
  stays unambiguous.
- **Focus `{colors.focus}`** — a cool "moonlight" blue used only for
  hover/focus highlighting on the radar chart, chosen to be complementary to
  ember and distinct from verdigris so it never blends with data.

Neutrals are a warm paper ramp: `{colors.ground}` (page) → `{colors.panel}` →
`{colors.panelRaised}` (raised surfaces), with ink at `{colors.ink}` and two
levels of de-emphasis, `{colors.muted}` then `{colors.faint}`. Hairlines use
`{colors.line}`; sub-hairlines (row separators) use `{colors.lineSubtle}`.

Each accent has a soft companion (`{colors.emberSoft}`,
`{colors.verdigrisSoft}`, and `color-mix` at ~15% for carmine) used for chip
backgrounds, halos, and selected states — tint with the soft variant, never
with the full-strength accent.

### Dark theme

Dark is not an inversion; it is the same milonga after the lamps are lowered.
Warmth is preserved (near-black brown ground, parchment ink) and accents are
lifted for contrast on dark:

| Token | Light | Dark |
|---|---|---|
| ground | `#f5ead8` | `#110D09` |
| panel / panelRaised | `#f9f4ed` / `#fdfbf5` | `#1A1510` / `#221B14` |
| ink | `#201e1d` | `#F2EADC` |
| muted / faint | `#645c50` / `#968b79` | `#9E907E` / `#6C5F50` |
| line | `#dcd3c4` | `rgba(241,233,220,.11)` |
| ember | `#c67139` | `#E58C44` |
| verdigris | `#2C7869` | `#61AB95` |
| carmine | `#A6172E` | `#E6415C` |
| focus | `#3F5BB0` | `#8EA6FF` |

Always define both themes when adding a color: add the light value inside
`.tm-profile` and the dark value inside `:root[data-theme="dark"] .tm-profile`,
and set `color-scheme` appropriately. Never hard-code a hex in component rules
— go through a `--tm-*` custom property.

Body text pairs (`ink` on `ground`/`panel`) meet WCAG AA (4.5:1) in both
themes. Accent-on-soft-tint combinations are reserved for large text, labels
≥ semibold, and non-text indicators.

## Typography

Three families, three jobs — never mixed within a role:

- **Serif** (`Iowan Old Style, Georgia, serif`) — the editorial voice. Page
  headlines (`{typography.h1}`), the profile name, avatar initials, italic
  signature lines, and the comparison verdict. Weight 600, tight leading
  (1–1.18), slightly negative tracking. Italic `<em>` inside an h1 takes the
  ember color.
- **Monospace** (`ui-monospace, SF Mono, …`) — the instrument-panel voice.
  All labels, nav links, stats, counts, tags, and metadata. Small
  (9–12.5px), uppercase with wide tracking for labels (`0.1em`–`0.24em`;
  wider = smaller), sentence-case for values. All numerals use
  `font-variant-numeric: tabular-nums` so counts and scores never jitter.
- **System sans** (`system-ui, …`) — the quiet default. Body copy, form
  inputs, buttons, list rows. 12.5–15px at line-height 1.5.

Hierarchy is built from contrast of family and case, not from a long size
scale: a serif headline over a mono eyebrow label over sans body is the
signature stack. Headlines use `text-wrap: balance`. No font is loaded over
the network — every family is a system stack, by design (the app must stay
fast and offline-capable as a PWA).

## Layout

Single centered column: `{spacing.contentWidth}` max-width
(`{spacing.contentWidthWide}` for wide views like compare), fluid page padding
`{spacing.pagePadding}` horizontally clamped with `env(safe-area-inset-*)`
for notched devices, and a 72px bottom reserve.

Rhythm comes from a small step scale — `{spacing.xs}` through `{spacing.xl}`
for intra-component gaps, `{spacing.section}` between sections. Sections open
with a mono uppercase eyebrow (`.tm-sh`) sitting on a sub-hairline.

Structure is drawn with hairlines, not boxes: full-strength `{colors.line}`
for container borders, `{colors.lineSubtle}` for row separators inside lists.
Rows in data lists (legend, spine, compare tape) are CSS grids with fixed
gutter columns for indices and values, so numbers align down the page.

Everything is fluid-first: `clamp()` for type and padding, `flex-wrap` and
`auto-fill` grids for collections, and explicit mobile breakpoints
(~520–720px) that simplify grids to one column and drop redundant elements
(e.g. the compare minibars disappear under 560px because the numbers carry
the information). Interactive targets get `touch-action: manipulation`.

## Elevation & Depth

Depth is candlelight, not material design. There is one elevation token:

```
--tm-elev (light): 0 1px 0 rgba(255,255,255,.6),
                   0 2px 6px -2px rgba(32,30,29,.1),
                   0 26px 52px -32px rgba(32,30,29,.45)
--tm-elev (dark):  0 0 0 1px rgba(241,233,220,.04),
                   0 34px 66px -34px rgba(0,0,0,.9)
```

— a top inner highlight plus a long soft drop, applied only to the few truly
raised surfaces (stats strip, share card). Everything else sits flat on the
ground with a hairline border.

Glow substitutes for shadow on small lit elements: active cells, dots, and
toggles emit their own accent color (`box-shadow: 0 0 8px -2px <accent>`), and
the brand dot and milestones wear a 3px soft-tint ring. The radar has a slowly
rotating blurred conic-gradient halo behind it. Layering above content is
avoided entirely — no modals, popovers, or overlays exist; disclosure happens
in-place via accordions.

## Shapes

Roundness communicates role:

- **Pills (`{rounded.pill}`)** — anything small and label-like or chip-like:
  nav links, tags, tier badges, milestones, segmented controls, view switcher,
  progress tracks.
- **Soft rectangles (`{rounded.md}`–`{rounded.panel}`)** — surfaces. 8px for
  hoverable rows, 10px inputs and buttons, 12px cards and callouts, 13–14px
  large panels. Radius grows with the size of the surface.
- **Circles** — identity and state: avatars (radial ember→carmine gradient),
  status dots, the brand dot, toggle knobs.
- **Tiny squares (`{rounded.sm}`)** — data cells in the 62-skill grid and
  legend keys.

Progress bars are fully rounded tracks in `{colors.chip}` with accent fills;
maxed-out fills graduate ember→carmine and earn a `✦`.

## Components

All components live in `app/tango.css` with the `tm-` prefix, scoped under
`.tm-profile`. Reuse these before inventing new ones:

- **Nav pill (`.tm-link`, `.tm-themebtn`)** — `{components.navPill}`: mono
  label in a hairline pill; hover turns the border and text ember.
- **Primary button (`.tm-save`, compare submit)** —
  `{components.primaryButton}`: white on ember with a soft ember drop shadow;
  hover brightens (`filter: brightness(1.07)`); disabled at 55% opacity.
- **CTA (`.tm-cta`)** — `{components.ctaButton}`: quiet bordered button whose
  border ignites on hover; the arrow glyph inside is always ember. `.ghost`
  variant is smaller and transparent for secondary share actions.
- **Danger button (`.tm-btn-danger`, `.tm-btn-ghost-danger`)** —
  `{components.dangerButton}`: carmine, only inside the danger zone, which is
  itself a card with a carmine-mixed border and a two-step confirm.
- **Stats strip (`.tm-strip`)** — `{components.statStrip}`: a single elevated
  bar divided by hairlines; mono eyebrow + big tabular value per cell; wraps
  2×2 on mobile.
- **Cards (`.tm-rec`, `.tm-match`, `.tm-dancer`)** — `{components.card}`:
  hairline-bordered grid rows; recommendations use a 3px left border
  color-coded by kind (ember = next step, carmine = weak spot, verdigris =
  frontier).
- **Forms (`.tm-inp`, `.tm-select`, `.tm-seg`, `.tm-toggle`)** —
  `{components.input}`: panel-raised fields whose border turns ember on
  focus-within; segmented radios as pill options with soft-tint selection; the
  switch is a pill that fills ember and glows when on.
- **Tags (`.tm-tag`)** — `{components.tag}`: mono uppercase micro-pills;
  the `on` state drops its border for a verdigris soft tint.
- **Data viz (radar, genome, ranked bars, diverging bars, 62-grid)** — side A
  is always ember, side B always verdigris, tiers ember→verdigris→carmine;
  tracks are `{colors.chip}`; values are mono tabular.
- **Accordions (`.tm-acc`)** — in-place disclosure with explicit pixel-height
  animation (260ms, `cubic-bezier(.2,.7,.2,1)`) — grid-fr/auto-height
  animation collapses when nested, so keep the measured-height approach.

Interaction grammar, uniform everywhere: transitions are 150–260ms on
color/border/background only; every focusable element has
`outline: 2px solid var(--tm-ember); outline-offset: 2px` (negative offset
inside list rows); `prefers-reduced-motion: reduce` kills all animation and
transitions globally. Icon-only and glyph state changes always have a text or
`aria` counterpart, and purely visual grids provide a `.tm-sr` screen-reader
summary.

## Do's and Don'ts

**Do**

- Scope every new style under `.tm-profile` with a `tm-` class prefix; the
  map bundle at `/` must remain untouched by app CSS.
- Route every color through a `--tm-*` custom property and define light and
  dark values together, keyed off `data-theme`.
- Keep the semantic color roles: ember = interactive/progress/side A,
  verdigris = counterpart/success/side B, carmine = mastery or danger.
- Use mono + uppercase + wide tracking for labels, serif for headlines, sans
  for body — and `tabular-nums` on every number.
- Use soft tints (`*-s` variables, `{colors.chip}`) for fills and selected
  states; full-strength accents for text, borders, fills of bars, and glows.
- Draw structure with hairlines and whitespace; reserve `--tm-elev` for the
  few genuinely raised surfaces.
- Give every interactive element a visible ember `focus-visible` outline and
  respect `prefers-reduced-motion`.
- Design mobile-down: `clamp()` sizes, wrapping grids, and drop redundant
  detail (not information) at small widths.

**Don't**

- Don't use `prefers-color-scheme` for theming — the theme follows the map's
  `localStorage` toggle via `data-theme`, not the OS.
- Don't hard-code hex values in component rules or introduce new accent hues;
  the moonlight blue `{colors.focus}` is radar-only.
- Don't load web fonts — system stacks only.
- Don't use modals, popovers, or overlays; disclose in place with accordions.
- Don't put carmine "mastery" styling and carmine "danger" styling in the same
  screen region.
- Don't animate layout properties or exceed ~260ms; color, background, border,
  opacity, and measured height only.
- Don't mix type voices within a role (e.g. no sans labels, no mono
  headlines), and never use non-tabular numerals for stats.
- Don't tint large areas with full-strength accents — if a background needs
  accent, it takes the soft variant.
