import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { DnaRadar } from '@/src/components/DnaRadar';
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

/** A tiny two-category detail set (enough to render the radar + legend rows). */
const cats: CategoryDetail[] = [
  { tag: 'PARTNER', label: 'Connection', icon: '<circle cx="12" cy="12" r="4"/>', done: 1, total: 4, pct: 25, skills: [{ name: 'Embrace', slug: 'embrace', on: true, level: 1 }] },
  { tag: 'STEP', label: 'Footwork', icon: '<circle cx="12" cy="12" r="4"/>', done: 0, total: 4, pct: 0, skills: [{ name: 'Walk', slug: 'walk', on: false, level: 1 }] },
];

async function render() {
  await act(async () => {
    root.render(<DnaRadar categories={cats} />);
  });
}

const links = () => [...container.querySelectorAll<HTMLAnchorElement>('a.tm-skill-name')];

describe('DnaRadar skill links', () => {
  test('each skill name is an <a href="/skill/<slug>"> to its guide', async () => {
    await render();
    const hrefs = links().map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/skill/embrace');
    expect(hrefs).toContain('/skill/walk');
    const embrace = links().find((a) => a.getAttribute('href') === '/skill/embrace')!;
    expect(embrace.textContent).toBe('Embrace');
    expect(embrace.getAttribute('title')).toBe('Embrace');
  });

  test('collapsed-row links are pulled out of the tab order; opening a row restores it', async () => {
    await render();
    // nothing open → every link is tabIndex -1 (no focus trap on hidden content)
    for (const a of links()) expect(a.getAttribute('tabindex')).toBe('-1');

    // open the first legend row; its links become focusable, the rest stay guarded
    const row0 = container.querySelector<HTMLButtonElement>('.tm-lrow')!;
    await act(async () => row0.click());

    const embrace = links().find((a) => a.getAttribute('href') === '/skill/embrace')!;
    const walk = links().find((a) => a.getAttribute('href') === '/skill/walk')!;
    expect(embrace.getAttribute('tabindex')).toBeNull(); // undefined → attribute removed
    expect(walk.getAttribute('tabindex')).toBe('-1'); // still-collapsed row stays guarded
  });
});
