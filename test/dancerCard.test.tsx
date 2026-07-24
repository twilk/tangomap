import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import axe from 'axe-core';
import { DancerCard, type DancerCardProps } from '@/src/components/DancerCard';

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
