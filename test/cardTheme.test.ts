import { describe, test, expect } from 'vitest';
import { FROZEN_CARD, cardPalette, cardPaletteFor, type CardPalette } from '@/src/lib/cardTheme';
import { deriveTokens, type Theme } from '@/src/lib/theme';
import { parseHex, rgba } from '@/src/lib/color';

// The exact colours the card hardcoded BEFORE it became theme-aware. Sources:
//  ground/gradTo   #0c0906              — card OG outer background / canvas bg stop
//  gradFrom        #221B14              — .tm-card + OG + canvas gradient start
//  gradMid         #110D09              — .tm-card + OG + canvas gradient mid
//  panel           #191309              — card OG PANEL const
//  border          rgba(241,233,220,.16)— card OG card border
//  ink             #F2EADC              — .tm-card colour / OG INK
//  muted           #9E907E              — .tm-card-* muted text / OG MUTED / AXICON
//  faint           #6C5F50              — .tm-card-serial / OG FAINT
//  ember           #E58C44              — accents / OG EMBER
//  emberSoft       rgba(229,140,68,.30) — OG blob fill / canvas halo
//  carmine         #E6415C              — star / OG carmine
//  ring            rgba(241,233,220,.09)— radar rings
const OLD_LITERALS: CardPalette = {
  ground: '#0c0906', gradFrom: '#221B14', gradMid: '#110D09', gradTo: '#0c0906',
  panel: '#191309', border: 'rgba(241,233,220,.16)', ink: '#F2EADC',
  muted: '#9E907E', faint: '#6C5F50', ember: '#E58C44',
  emberSoft: 'rgba(229,140,68,.30)', carmine: '#E6415C', ring: 'rgba(241,233,220,.09)',
};

// A legible custom theme (parseTheme would accept it), used to exercise cardPalette.
const THEME: Theme = { v: 1, ground: '#101828', ink: '#f8fafc', accent: '#38bdf8', accent2: '#34d399' };

describe('FROZEN_CARD', () => {
  test('equals the documented old card literals, key for key', () => {
    expect(FROZEN_CARD).toEqual(OLD_LITERALS);
  });

  test('cardPaletteFor(null) returns the frozen set (the exact same object)', () => {
    expect(cardPaletteFor(null)).toBe(FROZEN_CARD);
  });
});

describe('cardPalette(theme)', () => {
  const t = deriveTokens(THEME);
  const p = cardPalette(THEME);

  test('maps the solid tokens straight from deriveTokens', () => {
    expect(p.ground).toBe(t.ground);
    expect(p.gradTo).toBe(t.ground);
    expect(p.gradFrom).toBe(t.panel2);
    expect(p.gradMid).toBe(t.panel);
    expect(p.panel).toBe(t.panel2);
    expect(p.ink).toBe(t.ink);
    expect(p.muted).toBe(t.muted);
    expect(p.faint).toBe(t.faint);
    expect(p.ember).toBe(t.ember);
    expect(p.carmine).toBe(t.carmine);
  });

  test('composes the alpha tokens from the derived ink and accent', () => {
    const ink = parseHex(t.ink)!;
    const accent = parseHex(t.ember)!;
    expect(p.border).toBe(rgba(ink, 0.16));
    expect(p.ring).toBe(rgba(ink, 0.09));
    expect(p.emberSoft).toBe(rgba(accent, 0.30));
  });

  test('a themed palette differs from the frozen one (no accidental passthrough)', () => {
    expect(p.ground).not.toBe(FROZEN_CARD.ground);
    expect(p.ember).not.toBe(FROZEN_CARD.ember);
  });

  test('cardPaletteFor(theme) delegates to cardPalette', () => {
    expect(cardPaletteFor(THEME)).toEqual(cardPalette(THEME));
  });
});
