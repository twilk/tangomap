import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import ApplySharedTheme from '@/src/components/ApplySharedTheme';
import type { Theme } from '@/src/lib/theme';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const A: Theme = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
// Structurally-valid hex that fails parseTheme's AA floor.
const BAD: Theme = { v: 1, ground: '#000000', ink: '#111111', accent: '#222222', accent2: '#333333' };

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  try { localStorage.clear(); } catch { /* ignore */ }
  document.documentElement.removeAttribute('data-theme');
  // pushCustomTheme() fires a best-effort PUT /api/profile — stub it so no real fetch.
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) } as Response)) as unknown as typeof fetch;
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

function button(): HTMLButtonElement {
  const b = container.querySelector<HTMLButtonElement>('button');
  if (!b) throw new Error('button not found');
  return b;
}

describe('ApplySharedTheme', () => {
  test('renders a labelled button naming the theme and the author handle', async () => {
    await act(async () => { root.render(<ApplySharedTheme theme={A} name="Carmesí" handle="ana" />); });
    expect(button().textContent).toMatch(/Carmesí/);
    expect(button().textContent).toMatch(/@ana/);
  });

  test('clicking applies the theme (data-theme=custom + tsm-custom-css written)', async () => {
    await act(async () => { root.render(<ApplySharedTheme theme={A} name="Carmesí" handle="ana" />); });

    await act(async () => { button().click(); await flush(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
    expect(localStorage.getItem('tsm-custom-css')).toBeTruthy();
  });

  test('a theme that fails re-validation shows a note and does NOT change data-theme', async () => {
    await act(async () => { root.render(<ApplySharedTheme theme={BAD} name="Rotten" handle="bob" />); });

    await act(async () => { button().click(); await flush(); });

    expect(container.textContent?.toLowerCase()).toMatch(/couldn.t apply/);
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});
