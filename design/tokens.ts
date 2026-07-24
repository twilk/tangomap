// The ONLY hand-edited design source. Everything under src/styles/generated,
// src/lib/generated and DESIGN.md is produced from this by scripts/build-design.mjs.
// Run `npm run design` after any change; `npm test` fails if you forget.

export type ThemeTokens = {
  ground: string; panel: string; panel2: string; hi: string;
  ink: string; muted: string; faint: string;
  line: string; line2: string;
  ember: string; emberSoft: string;
  verd: string; verdSoft: string;
  carmine: string; chip: string;
  focus: string;
  elev: string;
};

export type CardTokens = Pick<ThemeTokens, 'ground' | 'panel2' | 'ink' | 'muted' | 'faint' | 'ember' | 'carmine'>;

/** CSS custom-property name for a theme token key. Single place the --tm- prefix
 *  is decided, so a later rename does not touch the source values. */
export const cssVar = (key: keyof ThemeTokens): string =>
  '--tm-' + key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/-soft$/, '-s');

/** Light "practica" — matched to the map bundle's own palette so the app and the
 *  map read as one continuous product. */
export const light = {
  ground: '#f5ead8', panel: '#f9f4ed', panel2: '#fdfbf5', hi: 'rgba(255,255,255,.6)',
  ink: '#201e1d', muted: '#645c50', faint: '#968b79',
  line: '#dcd3c4', line2: 'rgba(32,30,29,.07)',
  ember: '#c67139', emberSoft: 'rgba(198,113,57,.15)',
  verd: '#7a8a5e', verdSoft: 'rgba(122,138,94,.15)',
  carmine: '#A6172E', chip: 'rgba(32,30,29,.05)',
  focus: '#3F5BB0',
  elev: `0 1px 0 var(${cssVar('hi')}),0 2px 6px -2px rgba(32,30,29,.1),0 26px 52px -32px rgba(32,30,29,.45)`,
} as const satisfies ThemeTokens;

export const dark = {
  ground: '#110D09', panel: '#1A1510', panel2: '#221B14', hi: 'rgba(241,233,220,.045)',
  ink: '#F2EADC', muted: '#9E907E', faint: '#6C5F50',
  line: 'rgba(241,233,220,.11)', line2: 'rgba(241,233,220,.05)',
  ember: '#E58C44', emberSoft: 'rgba(229,140,68,.14)',
  verd: '#A8BA8A', verdSoft: 'rgba(168,186,138,.15)',
  carmine: '#E6415C', chip: 'rgba(241,233,220,.05)',
  focus: '#8EA6FF',
  elev: '0 0 0 1px rgba(241,233,220,.04),0 34px 66px -34px rgba(0,0,0,.9)',
} as const satisfies ThemeTokens;

/** The dancer card is dark in BOTH themes, so it cannot use --tm-*. These were
 *  seeded from `dark` and are deliberately INDEPENDENT of it: the card is a
 *  published artifact (OG images, minted serials), so tuning the dark theme must
 *  not re-skin cards people have already shared. */
export const card = {
  ground: '#110D09', panel2: '#221B14',
  ink: '#F2EADC', muted: '#9E907E', faint: '#6C5F50',
  ember: '#E58C44', carmine: '#E6415C',
} as const satisfies CardTokens;

export const fonts = {
  serif: '"Iowan Old Style", Georgia, "Times New Roman", serif',
  sans: 'var(--font-figtree), system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace',
} as const;

/** Doc-facing colour name → ThemeTokens key. DESIGN.md names colours by their role
 *  (primary/secondary/…); this is the single place that vocabulary is mapped onto the
 *  theme tokens, so `npm run design` can substitute a `{colors.X}` placeholder with
 *  `light[semantic[X]]` (and the dark column of the colour table with `dark[semantic[X]]`).
 *  Verified against the prose in DESIGN.md. */
export const semantic = {
  primary: 'ember', secondary: 'verd', tertiary: 'carmine', focus: 'focus',
  ground: 'ground', panel: 'panel', panelRaised: 'panel2',
  ink: 'ink', muted: 'muted', faint: 'faint',
  line: 'line', lineSubtle: 'line2',
  emberSoft: 'emberSoft', verdigrisSoft: 'verdSoft', chip: 'chip',
} as const satisfies Record<string, keyof ThemeTokens>;

/** The layout scale the doc quotes, sourced from app/tango.css so DESIGN.md cannot drift
 *  from what the app paints: `.tm-wrap` max-width 760px (`.wide` 880px) and horizontal
 *  padding clamp(16px,4vw,32px); `.tm-sec` margin-top 34px. `xs`/`xl` are chosen
 *  representatives of the intra-component gap range (small step scale), not pulled from a
 *  single declaration — the doc uses them only to say gaps run "from xs through xl". */
export const space = {
  contentWidth: '760px', contentWidthWide: '880px',
  pagePadding: 'clamp(16px,4vw,32px)', section: '34px', xs: '6px', xl: '26px',
} as const;

/** The two type sizes the doc names inline, from app/tango.css: `.tm-h1` font-size and
 *  `.tm-link` (the nav pill) font-size. */
export const type = { h1: 'clamp(28px,6vw,46px)', navLink: '11px' } as const;

/** The doc-facing radius set — the canonical roundness scale, values matched to the app.
 *  From the Shapes prose and app/tango.css: pill 999px, circle 50%, panels 14px
 *  (`.tm-strip`/`.tm-share`), cards 12px (`.tm-rec`/`.tm-callout`), inputs & buttons 10px
 *  (`.tm-inp`/`.tm-save`), hoverable rows 8px (`.tm-lrow`), and `sm` 4px — the 62-skill
 *  grid cell (`.tm-cell`) and legend keys (`.tm-key i`). Replaces the earlier `radii`
 *  scale, which was aspirational and never matched the app. */
export const rounded = {
  pill: '999px', circle: '50%', panel: '14px', card: '12px', input: '10px', md: '8px', sm: '4px',
} as const;
