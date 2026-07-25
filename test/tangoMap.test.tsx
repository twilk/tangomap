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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(): Promise<void> {
  await act(async () => {
    root.render(<TangoMap />);
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
});
