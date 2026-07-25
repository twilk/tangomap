import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import axe from 'axe-core';
import { DancerCard, QR_COLORS, type DancerCardProps } from '@/src/components/DancerCard';
import { cardPaletteFor } from '@/src/lib/cardTheme';
import { parseHex, rgba } from '@/src/lib/color';
import QRCode from 'qrcode';

// Mock qrcode so the badge/story QR generation resolves in jsdom and we can
// inspect the colour pair it is asked to render.
vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const CATS = ['Connection', 'Body & Posture', 'Footwork', 'Musicality', 'Turns', 'Navigation', 'Contact', 'Free Leg', 'Off-Axis', 'Dynamics', 'Genres', 'Styles', 'Mastery'];

const baseProps: DancerCardProps = {
  name: 'Ana',
  handle: 'ana',
  style: 'salon',
  count: 31,
  tierName: 'Intermediate',
  tier: 'i',
  signature: 'Turns · Connection · Musicality',
  milestonesDone: 3,
  serial: 12,
  mintedYear: 2026,
  isOwner: false,
  dna: CATS.map((label, i) => ({ label, pct: i === 0 ? 100 : 40 })),
  ghostDna: null,
  recs: [
    { name: 'Boleo', label: 'Free Leg', level: 7, reason: 'Shore up your weakest started category' },
    { name: 'Vals', label: 'Genres', level: 5, reason: 'Finish the level closest to complete' },
  ],
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function render(props: Partial<DancerCardProps> = {}): Promise<void> {
  await act(async () => {
    root.render(<DancerCard {...baseProps} {...props} />);
  });
}

const q = <T extends Element = HTMLElement>(sel: string): T | null => container.querySelector<T>(sel);
const qa = (sel: string) => [...container.querySelectorAll(sel)];

describe('DancerCard', () => {
  test('front face: padded serial, tier frame class, earned-only milestone stars', async () => {
    await render();
    expect(q('.tm-card.front')?.className).toContain('t-i');
    expect(q('.tm-card-serial')?.textContent).toBe('Nº 0012 · 2026');
    expect(qa('.tm-card-miles span')).toHaveLength(3);
    // one maxed category → one star marker on the radar
    expect(qa('.tm-card-star')).toHaveLength(1);
  });

  test('zero milestones renders no star row at all (no dim placeholders)', async () => {
    await render({ milestonesDone: 0, count: 2 });
    expect(q('.tm-card-miles')).toBeNull();
  });

  test('ghost blob renders only when ghostDna is provided', async () => {
    await render();
    expect(q('.tm-card-ghost')).toBeNull();
    await render({ ghostDna: CATS.map((label) => ({ label, pct: 10 })) });
    expect(q('.tm-card-ghost')).not.toBeNull();
    expect(q('.tm-card-ghostkey')?.textContent).toContain('30 days ago');
  });

  test('back face lists the recommendations; flip button toggles aria state', async () => {
    await render();
    expect(qa('.tm-card-recs b').map((b) => b.textContent)).toEqual(['Boleo', 'Vals']);
    const flip = qa('.tm-card-actions button').find((b) => b.textContent?.includes('Flip')) as HTMLButtonElement;
    expect(q('.tm-cardflip')?.className).not.toContain('flipped');
    await act(async () => flip.click());
    expect(q('.tm-cardflip')?.className).toContain('flipped');
    expect(q('.tm-card.front')?.getAttribute('aria-hidden')).toBe('true');
  });

  test('screen-reader twin carries the full card story', async () => {
    await render();
    const sr = q('.tm-cardstage .tm-sr')?.textContent ?? '';
    expect(sr).toContain('Ana (@ana)');
    expect(sr).toContain('Nº 0012');
    expect(sr).toContain('31 of 62');
    expect(sr).toContain('3 milestones');
    expect(sr).toContain('Boleo');
  });

  test('badge dialog opens with a focused close button and restores focus on close', async () => {
    await render();
    const open = qa('.tm-card-actions button').find((b) => b.textContent?.includes('Badge')) as HTMLButtonElement;
    await act(async () => open.click());
    const close = q<HTMLButtonElement>('.tm-badge-close');
    expect(close).not.toBeNull();
    expect(document.activeElement).toBe(close);
    await act(async () => close!.click());
    expect(q('.tm-badge')).toBeNull();
    expect(document.activeElement).toBe(open);
  });

  test('default (no palette prop) paints the frozen card literals', async () => {
    await render();
    // blob stroke + a radar ring keep their exact old literals
    expect(q('.tm-card-blob')?.getAttribute('stroke')).toBe('#E58C44');
    expect(q('circle[stroke]')?.getAttribute('stroke')).toBe('rgba(241,233,220,.09)');
    // and the root exposes the frozen --tm-card-* the CSS falls back to
    const stage = q<HTMLElement>('.tm-cardstage')!;
    expect(stage.style.getPropertyValue('--tm-card-ember')).toBe('#E58C44');
    expect(stage.style.getPropertyValue('--tm-card-muted')).toBe('#9E907E');
    expect(stage.style.getPropertyValue('--tm-card-line')).toBe('rgba(241,233,220,.11)');
    // decorative tints keep their exact old literals when frozen
    expect(stage.style.getPropertyValue('--tm-card-glow-ember')).toBe('rgba(229,140,68,.16)');
    expect(stage.style.getPropertyValue('--tm-card-glow-verd')).toBe('rgba(97,171,149,.13)');
    expect(stage.style.getPropertyValue('--tm-card-mono')).toBe('rgba(229,140,68,.07)');
  });

  test('a themed palette repaints the SVG strokes and the root css vars', async () => {
    const palette = cardPaletteFor({ v: 1, ground: '#101828', ink: '#f8fafc', accent: '#38bdf8', accent2: '#34d399' });
    expect(palette.ember).not.toBe('#E58C44'); // guard: the theme actually differs
    await render({ palette });
    expect(q('.tm-card-blob')?.getAttribute('stroke')).toBe(palette.ember);
    const stage = q<HTMLElement>('.tm-cardstage')!;
    expect(stage.style.getPropertyValue('--tm-card-ember')).toBe(palette.ember);
    expect(stage.style.getPropertyValue('--tm-card-grad-from')).toBe(palette.gradFrom);
    // decorative tints are composed from the palette's accent / second accent
    expect(stage.style.getPropertyValue('--tm-card-glow-ember')).toBe(rgba(parseHex(palette.ember)!, 0.16));
    expect(stage.style.getPropertyValue('--tm-card-glow-verd')).toBe(rgba(parseHex(palette.verd)!, 0.13));
    expect(stage.style.getPropertyValue('--tm-card-mono')).toBe(rgba(parseHex(palette.ember)!, 0.07));
  });

  test('the QR export stays the fixed frozen dark-on-light pair, even under a light theme', async () => {
    // the shared constant is the frozen pair, never palette-derived
    expect(QR_COLORS).toEqual({ dark: '#110D09', light: '#F2EADC' });

    // opening the badge under a LIGHT custom theme still requests that fixed pair
    const light = cardPaletteFor({ v: 1, ground: '#f5ead8', ink: '#201e1d', accent: '#b5642c', accent2: '#5f7048' });
    await render({ palette: light });
    const open = qa('.tm-card-actions button').find((b) => b.textContent?.includes('Badge')) as HTMLButtonElement;
    await act(async () => {
      open.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const calls = vi.mocked(QRCode.toDataURL).mock.calls as unknown as Array<[string, { color: { dark: string; light: string } }]>;
    const lastColor = calls.at(-1)?.[1]?.color;
    expect(lastColor).toEqual({ dark: '#110D09', light: '#F2EADC' });
    expect(lastColor?.dark).not.toBe(light.gradMid); // definitely not the light palette's own colour
  });

  test('axe finds no violations on the rendered card (front + actions)', async () => {
    await render();
    const results = await axe.run(container, {
      rules: {
        // jsdom has no layout engine — color-contrast needs real rendering.
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  });
});
