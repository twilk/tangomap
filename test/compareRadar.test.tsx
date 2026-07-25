import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { DnaCompareRadar } from '@/src/components/DnaCompareRadar';
import { DnaGenome } from '@/src/components/DnaGenome';
import { DnaBars } from '@/src/components/DnaBars';
import type { CategoryDetail } from '@/src/lib/dna';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no matchMedia; the radar queries reduced-motion + color-scheme on mount.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
// ...nor ResizeObserver, which the radar observes its canvas with.
if (!(globalThis as { ResizeObserver?: unknown }).ResizeObserver) {
  (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** A tiny two-category detail set (enough to render the radar + one tape row). */
const cats = (done: [number, number]): CategoryDetail[] => [
  { tag: 'PARTNER', label: 'Connection', icon: '<circle cx="12" cy="12" r="4"/>', done: done[0], total: 4, pct: (done[0] / 4) * 100, skills: [{ name: 'Embrace', slug: 'embrace', on: done[0] > 0, level: 1 }] },
  { tag: 'STEP', label: 'Footwork', icon: '<circle cx="12" cy="12" r="4"/>', done: done[1], total: 4, pct: (done[1] / 4) * 100, skills: [{ name: 'Walk', slug: 'walk', on: done[1] > 0, level: 1 }] },
];

const A = { name: 'Ana', cats: cats([3, 1]) };
const B = { name: 'Bo', cats: cats([1, 2]) };

async function render(props: Record<string, unknown> = {}) {
  await act(async () => {
    root.render(<DnaCompareRadar a={A} b={B} {...props} />);
  });
}

const swatches = () => [...container.querySelectorAll<HTMLElement>('.tm-key i')];
const minibars = () => [...container.querySelectorAll<HTMLElement>('.tm-minibar i')];

describe('DnaCompareRadar per-half theming', () => {
  test('FROZEN default: two themeless dancers keep the current --tm-* literals', async () => {
    await render();
    const [aSw, bSw] = swatches();
    // Byte-identical to today: the legend swatches are the page ember/verd vars.
    expect(aSw.style.background).toBe('var(--tm-ember)');
    expect(bSw.style.background).toBe('var(--tm-verd)');
    // Minibars alternate ember (A) / verd (B) per row.
    for (const bar of minibars()) {
      expect(bar.style.background === 'var(--tm-ember)' || bar.style.background === 'var(--tm-verd)').toBe(true);
    }
    // The seam column carries no inline colour (stays on the CSS --tm-faint).
    const mid = container.querySelector<HTMLElement>('.tm-tr .mid');
    expect(mid?.style.color).toBe('');
    // No per-half palette scoping applied.
    const keys = [...container.querySelectorAll<HTMLElement>('.tm-key')];
    expect(keys[0].getAttribute('style')).toBeNull();
    expect(keys[1].getAttribute('style')).toBeNull();
  });

  test('THEMED: the two halves receive the reconciled strokes and differ', async () => {
    const aBlob = 'rgb(17, 34, 51)';
    const bBlob = 'rgb(200, 120, 40)';
    const seam = 'rgb(128, 128, 128)';
    await render({
      aBlob,
      bBlob,
      seam,
      aStyle: { '--tm-ground': '#123456' } as React.CSSProperties,
      bStyle: { '--tm-ground': '#654321' } as React.CSSProperties,
    });
    const [aSw, bSw] = swatches();
    expect(aSw.style.background).toBe(aBlob);
    expect(bSw.style.background).toBe(bBlob);
    expect(aSw.style.background).not.toBe(bSw.style.background);
    // The seam column now paints in the reconciled seam colour.
    const mid = container.querySelector<HTMLElement>('.tm-tr .mid');
    expect(mid?.style.color).toBe(seam);
    // Each half's --tm-* palette is scoped onto its legend key.
    const keys = [...container.querySelectorAll<HTMLElement>('.tm-key')];
    expect(keys[0].style.getPropertyValue('--tm-ground')).toBe('#123456');
    expect(keys[1].style.getPropertyValue('--tm-ground')).toBe('#654321');
  });
});

describe('DnaGenome / DnaBars per-half theming (Genome + Strengths tabs)', () => {
  async function renderNode(node: React.ReactElement) {
    await act(async () => root.render(node));
  }

  test('Genome FROZEN default: no colour props → no inline style (byte-identical)', async () => {
    await renderNode(<DnaGenome series={[A, B]} />);
    expect(container.querySelector('.tm-genome')?.getAttribute('style')).toBeNull();
  });

  test('Genome THEMED: aColor/bColor override the two series accents at the root', async () => {
    await renderNode(<DnaGenome series={[A, B]} aColor="rgb(17, 34, 51)" bColor="rgb(200, 120, 40)" />);
    const el = container.querySelector<HTMLElement>('.tm-genome')!;
    expect(el.style.getPropertyValue('--tm-ember')).toBe('rgb(17, 34, 51)');
    expect(el.style.getPropertyValue('--tm-verd')).toBe('rgb(200, 120, 40)');
  });

  test('Strengths FROZEN default: no colour props → no inline style (byte-identical)', async () => {
    await renderNode(<DnaBars series={[A, B]} />);
    expect(container.querySelector('.tm-dbars')?.getAttribute('style')).toBeNull();
  });

  test('Strengths THEMED: aColor/bColor override the two series accents at the root', async () => {
    await renderNode(<DnaBars series={[A, B]} aColor="rgb(17, 34, 51)" bColor="rgb(200, 120, 40)" />);
    const el = container.querySelector<HTMLElement>('.tm-dbars')!;
    expect(el.style.getPropertyValue('--tm-ember')).toBe('rgb(17, 34, 51)');
    expect(el.style.getPropertyValue('--tm-verd')).toBe('rgb(200, 120, 40)');
  });
});
