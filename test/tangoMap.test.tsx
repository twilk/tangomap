import { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { TangoMap } from '@/src/components/TangoMap';
import { MAP_NODES } from '@/src/data/mapNodes';

// React 19's act() checks this flag; without it, act() logs a warning.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout engine and no canvas: stub both so computeMapLayout runs as a
// pure function. measureText grows with text length; ResizeObserver is a no-op (the
// component measures once on mount regardless).
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ({
    font: '',
    measureText: (t: string) => ({ width: t.length * 8 }),
  });
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function render(): Promise<void> {
  await act(async () => {
    root.render(<TangoMap />);
  });
}

/** Click a node pill by its id (wrapped in act). */
async function clickNode(id: string): Promise<void> {
  const btn = container.querySelector<HTMLButtonElement>(`button.tsm-node[data-id="${id}"]`)!;
  await act(async () => btn.click());
}

/** Set a controlled input's value the React-compatible way, then fire `input`. */
async function typeIn(input: HTMLInputElement, value: string): Promise<void> {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!;
  await act(async () => {
    desc.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Every dependency resolves to a real node, so the edge count is the total deps. */
const EDGE_COUNT = MAP_NODES.reduce((n, node) => n + node.deps.length, 0);

describe('TangoMap', () => {
  test('renders a node button for each of the 62 map nodes', async () => {
    await render();
    const buttons = container.querySelectorAll('button.tsm-node');
    expect(buttons.length).toBe(MAP_NODES.length); // 62
    expect(new Set(Array.from(buttons, (b) => b.getAttribute('data-id'))).size).toBe(MAP_NODES.length);
  });

  test('renders one SVG edge path per dependency edge', async () => {
    await render();
    const paths = container.querySelectorAll('svg.tsm-edges path');
    expect(paths.length).toBe(EDGE_COUNT);
  });

  test('renders a label for every level band', async () => {
    await render();
    expect(container.querySelectorAll('.tsm-band').length).toBe(10);
  });

  test('clicking a node selects it and highlights its prereq + unlock edges', async () => {
    await render();

    const target = 'cross';
    const btn = container.querySelector<HTMLButtonElement>(`button[data-id="${target}"]`);
    expect(btn).not.toBeNull();
    expect(btn!.classList.contains('on')).toBe(false);

    await act(async () => {
      btn!.click();
    });

    // selected state applied to the clicked node
    expect(btn!.classList.contains('on')).toBe(true);
    expect(btn!.getAttribute('aria-pressed')).toBe('true');

    // prereq edges (cross is the dependent → edges where to === 'cross') light ember
    const prereqEdges = container.querySelectorAll(`svg.tsm-edges path[data-to="${target}"]`);
    expect(prereqEdges.length).toBeGreaterThan(0);
    prereqEdges.forEach((p) => {
      expect(p.getAttribute('data-hl')).toBe('prereq');
      expect(p.classList.contains('tsm-edge-prereq')).toBe(true);
    });

    // unlock edges (cross is the dependency → edges where from === 'cross') light verd
    const unlockEdges = container.querySelectorAll(`svg.tsm-edges path[data-from="${target}"]`);
    expect(unlockEdges.length).toBeGreaterThan(0);
    unlockEdges.forEach((p) => {
      expect(p.getAttribute('data-hl')).toBe('unlock');
      expect(p.classList.contains('tsm-edge-unlock')).toBe(true);
    });

    // an edge touching neither side of 'cross' dims
    const unrelated = Array.from(container.querySelectorAll('svg.tsm-edges path')).find(
      (p) => p.getAttribute('data-from') !== target && p.getAttribute('data-to') !== target,
    );
    expect(unrelated).toBeTruthy();
    expect(unrelated!.getAttribute('data-hl')).toBe('dim');
  });

  test('clicking the selected node again clears the selection', async () => {
    await render();
    const btn = container.querySelector<HTMLButtonElement>('button[data-id="cross"]')!;

    await act(async () => btn.click());
    expect(btn.classList.contains('on')).toBe(true);

    await act(async () => btn.click());
    expect(btn.classList.contains('on')).toBe(false);
    // with nothing focused, edges fall back to their base (neither prereq nor dim)
    const anyPath = container.querySelector('svg.tsm-edges path')!;
    expect(anyPath.getAttribute('data-hl')).toBe('base');
  });

  test('empty state until a node is selected', async () => {
    await render();
    expect(container.querySelector('.tsm-panel-empty')).not.toBeNull();
    expect(container.querySelector('.tsm-panel-name')).toBeNull();
  });

  test('selecting a node shows the detail panel: name, gloss, stats, prereq + unlock lists', async () => {
    await render();
    await clickNode('cross');

    // identity
    expect(container.querySelector('.tsm-panel-name')!.textContent).toContain('The Cross');
    expect(container.querySelector('.tsm-panel-gloss')!.textContent).toContain('la cruzada');

    // stats — requires = # direct prereqs (2), unlocks = # direct dependents (5),
    // path steps = longest prereq chain length (6: …→walking→outside-walking→cross)
    const stat = (k: string) =>
      container.querySelector(`.tsm-stat[data-stat="${k}"] .tsm-stat-num`)!.textContent;
    expect(stat('requires')).toBe('2');
    expect(stat('unlocks')).toBe('5');
    expect(stat('path')).toBe('6');

    // prerequisite list — cross.deps = outside-walking, weight-change
    const prereqs = container.querySelectorAll('[data-rel-list="prereq"] .tsm-rel');
    expect(prereqs.length).toBe(2);
    expect(new Set(Array.from(prereqs, (b) => b.getAttribute('data-id')))).toEqual(
      new Set(['outside-walking', 'weight-change']),
    );

    // unlock list — the five nodes that list 'cross' as a prerequisite
    const unlocks = container.querySelectorAll('[data-rel-list="unlock"] .tsm-rel');
    expect(unlocks.length).toBe(5);
    expect(new Set(Array.from(unlocks, (b) => b.getAttribute('data-id')))).toEqual(
      new Set(['cross-exits', 'ocho-adelante', 'improvisation', 'volcada', 'medialuna']),
    );
  });

  test('clicking a prerequisite in the panel selects THAT node', async () => {
    await render();
    await clickNode('cross');

    const prereq = container.querySelector<HTMLButtonElement>(
      '[data-rel-list="prereq"] .tsm-rel[data-id="outside-walking"]',
    )!;
    await act(async () => prereq.click());

    // the panel now describes Walking Outside, and its pill is the selected one
    expect(container.querySelector('.tsm-panel-name')!.textContent).toContain('Walking Outside');
    expect(
      container.querySelector('button.tsm-node[data-id="outside-walking"]')!.classList.contains('on'),
    ).toBe(true);
    expect(container.querySelector('button.tsm-node[data-id="cross"]')!.classList.contains('on')).toBe(false);
  });

  test('typing in search filters suggestions; Enter selects the top suggestion', async () => {
    await render();
    const input = container.querySelector<HTMLInputElement>('input.tsm-search-input')!;

    await typeIn(input, 'ocho');
    const options = container.querySelectorAll('#tsm-suglist button[role="option"]');
    // three skills whose name starts with "ocho" (adelante, atrás, cortado)
    expect(options.length).toBeGreaterThan(1);
    // top suggestion is the lowest-level match — ocho-adelante (level 1)
    expect(options[0].getAttribute('data-id')).toBe('ocho-adelante');

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.querySelector('.tsm-panel-name')!.textContent).toContain('Ocho Adelante');
    expect(
      container.querySelector('button.tsm-node[data-id="ocho-adelante"]')!.classList.contains('on'),
    ).toBe(true);
    // selecting clears the query and closes the listbox
    expect(input.value).toBe('');
    expect(container.querySelector('#tsm-suglist')).toBeNull();
  });

  test('mark-mastered writes the node id into localStorage[tsm-mastered] and toggles off', async () => {
    await render();
    await clickNode('cross');

    const master = container.querySelector<HTMLButtonElement>('.tsm-master')!;
    expect(master.getAttribute('aria-pressed')).toBe('false');

    await act(async () => master.click());
    expect(localStorage.getItem('tsm-mastered')).toBe('["cross"]');
    expect(master.getAttribute('aria-pressed')).toBe('true');
    // the pill picks up the "done" class on the map
    expect(container.querySelector('button.tsm-node[data-id="cross"]')!.classList.contains('done')).toBe(true);

    await act(async () => master.click());
    expect(localStorage.getItem('tsm-mastered')).toBe('[]');
    expect(master.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('button.tsm-node[data-id="cross"]')!.classList.contains('done')).toBe(false);
  });

  test('a persisted mastered set renders its pills done on mount', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['cross', 'walking']));
    await render();
    expect(container.querySelector('button.tsm-node[data-id="cross"]')!.classList.contains('done')).toBe(true);
    expect(container.querySelector('button.tsm-node[data-id="walking"]')!.classList.contains('done')).toBe(true);
    expect(container.querySelector('button.tsm-node[data-id="posture"]')!.classList.contains('done')).toBe(false);
  });

  test('selection persists: a pre-seeded tsm-sel is restored on mount', async () => {
    localStorage.setItem('tsm-sel', 'molinete');
    await render();

    expect(container.querySelector('button.tsm-node[data-id="molinete"]')!.classList.contains('on')).toBe(true);
    expect(container.querySelector('.tsm-panel-name')!.textContent).toContain('Molinete');
  });

  test('clearing the selection removes the tsm-sel key', async () => {
    await render();
    await clickNode('cross');
    expect(localStorage.getItem('tsm-sel')).toBe('cross');

    // clicking the same node again toggles it off and clears the key
    await clickNode('cross');
    expect(localStorage.getItem('tsm-sel')).toBeNull();
    expect(container.querySelector('.tsm-panel-empty')).not.toBeNull();
  });
});
