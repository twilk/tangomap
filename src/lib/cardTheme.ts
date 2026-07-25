// The dancer card's palette source. The card hardcodes a dark "frozen" look in
// four surfaces (DancerCard JSX/SVG, its downloadStory canvas, the .tm-card* CSS,
// and the two Satori OG routes). This module is the single place those surfaces
// read colours from, so the card can render in the owner's custom theme while
// falling back — byte-identical — to the exact old literals when they opt out.
//
// FROZEN_CARD's strings are EXACTLY the values that were hardcoded before this
// change; a test pins them. cardPaletteFor(null) returns that frozen set, so
// "no custom theme" == today, provably.

import { deriveTokens, type Theme } from '@/src/lib/theme';
import { parseHex, rgba } from '@/src/lib/color';

export type CardPalette = {
  ground: string; gradFrom: string; gradMid: string; gradTo: string;
  panel: string; border: string; ink: string; muted: string; faint: string;
  ember: string; emberSoft: string; carmine: string; verd: string; ring: string;
};

/** The exact colours the card used before it became theme-aware. Every string
 *  here equals a literal that was hardcoded in DancerCard, its canvas, the
 *  .tm-card* CSS, or the card OG route. Do NOT "tidy" these — a test asserts each
 *  against the documented old literal, and the whole "identical default" contract
 *  rests on them not drifting. */
export const FROZEN_CARD: CardPalette = {
  ground: '#0c0906', gradFrom: '#221B14', gradMid: '#110D09', gradTo: '#0c0906',
  panel: '#191309', border: 'rgba(241,233,220,.16)', ink: '#F2EADC',
  muted: '#9E907E', faint: '#6C5F50', ember: '#E58C44',
  emberSoft: 'rgba(229,140,68,.30)', carmine: '#E6415C',
  // the base RGB (97,171,149) behind the card's frozen verd glow tints; only ever
  // used to compose a themed tint, the frozen surfaces emit the literal directly.
  verd: '#61AB95', ring: 'rgba(241,233,220,.09)',
};

/** Map a validated custom Theme onto the card palette. Solid tokens come straight
 *  from deriveTokens; the alphas (border/emberSoft/ring) are composed from the ink
 *  and accent so they track the owner's palette the way the frozen ones tracked the
 *  card's. Pure — deriveTokens is deterministic and parseHex is total. */
export function cardPalette(theme: Theme): CardPalette {
  const t = deriveTokens(theme);
  const ink = parseHex(t.ink)!, accent = parseHex(t.ember)!;
  return {
    ground: t.ground, gradFrom: t.panel2, gradMid: t.panel, gradTo: t.ground,
    panel: t.panel2, border: rgba(ink, 0.16), ink: t.ink, muted: t.muted, faint: t.faint,
    ember: t.ember, emberSoft: rgba(accent, 0.30), carmine: t.carmine, verd: t.verd, ring: rgba(ink, 0.09),
  };
}

/** The card's single palette entry point. A theme → its themed palette; null (no
 *  custom theme, or the card opt-in is off) → the frozen default that renders
 *  identically to today. */
export const cardPaletteFor = (theme: Theme | null): CardPalette =>
  theme ? cardPalette(theme) : FROZEN_CARD;
