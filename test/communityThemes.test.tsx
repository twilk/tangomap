import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import CommunityThemes from '@/src/components/CommunityThemes';
import { deriveTokens, type Theme } from '@/src/lib/theme';
import type { CommunityTheme } from '@/src/lib/types';

// React 19's act() checks this flag; without it, act() logs a warning.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const A: Theme = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
const B: Theme = { v: 1, ground: '#0f1419', ink: '#e6edf3', accent: '#58a6ff', accent2: '#7ee2b8' };
// Structurally-valid hex that fails parseTheme's AA floor: presetStyleVars still paints
// it (deriveTokens is total), but applyCustomTheme re-validates and refuses.
const BAD: Theme = { v: 1, ground: '#000000', ink: '#111111', accent: '#222222', accent2: '#333333' };

function ct(id: string, name: string, seeds: Theme, authorHandle = 'ana'): CommunityTheme {
  return { id, name, seeds, authorHandle, authorDisplayName: 'Ana' };
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

type Reply = { ok?: boolean; status?: number; body?: unknown };
function installFetch(router: (method: string, url: string) => Reply) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const r = router(method, url);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.body ?? {},
    } as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function bodyOf(init: RequestInit | undefined): Record<string, unknown> {
  return init?.body ? JSON.parse(init.body as string) : {};
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  try { localStorage.clear(); } catch { /* ignore */ }
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

async function render(): Promise<void> {
  await act(async () => { root.render(<CommunityThemes />); });
  await act(async () => { await flush(); }); // flush the on-mount GET
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button.tm-community-btn'));
}

describe('CommunityThemes', () => {
  test('renders one self-colored button per community theme (name + by @handle)', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') {
        return { body: [ct('p1', 'Carmesí', A, 'ana'), ct('p2', 'Ocean', B, 'bob')] };
      }
      return {};
    });

    await render();

    const b = buttons();
    expect(b).toHaveLength(2);
    expect(b[0].querySelector('.name')?.textContent).toBe('Carmesí');
    expect(b[0].querySelector('.by')?.textContent).toBe('by @ana');
    // Each button paints its own ground (self-preview).
    expect(b[0].style.getPropertyValue('--tm-ground')).toBe(deriveTokens(A).ground);
    expect(b[1].style.getPropertyValue('--tm-ground')).toBe(deriveTokens(B).ground);
  });

  test('a Tango Map starter is labelled "by Tango Map" (no @), a real dancer keeps "by @handle"', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') {
        return { body: [ct('starter:midnight', 'Midnight', B, 'tangomap'), ct('p1', 'Carmesí', A, 'ana')] };
      }
      return {};
    });

    await render();

    const b = buttons();
    // The official curator shows the brand name, never an @handle.
    expect(b[0].querySelector('.by')?.textContent).toBe('by Tango Map');
    expect(b[0].querySelector('.by')?.textContent).not.toMatch(/@/);
    // A real dancer's shared theme keeps the @handle.
    expect(b[1].querySelector('.by')?.textContent).toBe('by @ana');
  });

  test('renders a clear heading, a one-line intro, and the "Share your first theme" CTA', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') return { body: [ct('starter:midnight', 'Midnight', B, 'tangomap')] };
      return {};
    });

    await render();

    expect(container.querySelector('.tm-community-h')?.textContent).toMatch(/community/i);
    expect(container.querySelector('.tm-community-intro')?.textContent?.length).toBeGreaterThan(0);
    const cta = Array.from(container.querySelectorAll('button')).find((x) => /share your first theme/i.test(x.textContent ?? ''));
    expect(cta).toBeTruthy();
  });

  test('clicking a button applies the theme (data-theme=custom + tsm-custom-css written)', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') return { body: [ct('p1', 'Carmesí', A)] };
      if (method === 'PUT' && url === '/api/profile') return { body: {} };
      return {};
    });

    await render();

    await act(async () => { buttons()[0].click(); await flush(); });

    expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
    expect(localStorage.getItem('tsm-custom-css')).toBeTruthy();
  });

  test('a forced-invalid entry shows the "couldn\'t apply" note and does NOT change data-theme', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') return { body: [ct('p1', 'Rotten', BAD)] };
      return {};
    });

    await render();

    await act(async () => { buttons()[0].click(); await flush(); });

    expect(container.textContent?.toLowerCase()).toMatch(/couldn.t apply/);
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(localStorage.getItem('tsm-custom-css')).toBeNull();
  });

  test('after applying, "Save to my library" POSTs the community name+seeds to /api/presets', async () => {
    const fetchMock = installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') return { body: [ct('p1', 'Carmesí', A)] };
      if (method === 'PUT' && url === '/api/profile') return { body: {} };
      if (method === 'POST' && url === '/api/presets') return { body: { id: 'x', name: 'Carmesí', seeds: A, isShared: false, updatedAt: '' } };
      return {};
    });

    await render();
    await act(async () => { buttons()[0].click(); await flush(); });

    // The save affordance appears once a theme is applied.
    const save = Array.from(container.querySelectorAll('button')).find((x) => /save to my library/i.test(x.textContent ?? ''));
    expect(save).toBeTruthy();

    await act(async () => { save!.click(); await flush(); });

    const post = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/presets' && (init as RequestInit)?.method === 'POST',
    );
    expect(post).toBeTruthy();
    expect(bodyOf(post![1] as RequestInit)).toMatchObject({ name: 'Carmesí', seeds: A });
    expect(container.textContent?.toLowerCase()).toMatch(/saved to your library/);
  });

  test('"Save to my library" surfaces the 5-cap message on a 409 cap', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') return { body: [ct('p1', 'Carmesí', A)] };
      if (method === 'PUT' && url === '/api/profile') return { body: {} };
      if (method === 'POST' && url === '/api/presets') return { ok: false, status: 409, body: { error: 'cap' } };
      return {};
    });

    await render();
    await act(async () => { buttons()[0].click(); await flush(); });
    const save = Array.from(container.querySelectorAll('button')).find((x) => /save to my library/i.test(x.textContent ?? ''));
    await act(async () => { save!.click(); await flush(); });

    expect(container.textContent?.toLowerCase()).toMatch(/saved 5/);
  });

  test('an empty gallery renders nothing', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/community-themes') return { body: [] };
      return {};
    });
    await render();
    expect(container.querySelector('.tm-community-grid')).toBeNull();
  });
});
