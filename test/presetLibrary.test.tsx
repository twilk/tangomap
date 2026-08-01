import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import PresetLibrary from '@/src/components/PresetLibrary';
import { deriveTokens, type Theme } from '@/src/lib/theme';
import type { ThemePreset } from '@/src/lib/types';

// React 19's act() checks this flag; without it, act() logs a warning.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const A: Theme = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
const B: Theme = { v: 1, ground: '#0f1419', ink: '#e6edf3', accent: '#58a6ff', accent2: '#7ee2b8' };

function preset(id: string, name: string, seeds: Theme, isShared = false): ThemePreset {
  return { id, name, seeds, isShared, updatedAt: new Date(0).toISOString() };
}

/** Resolve every pending microtask + timer callback so a fetch().then(json) chain settles. */
function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** Install a fetch mock that dispatches by (method, url) and record every call. */
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

async function render(props: {
  initialActive: Theme | null;
  isPublic: boolean;
  handle: string | null;
}): Promise<void> {
  await act(async () => {
    root.render(<PresetLibrary {...props} />);
  });
  // Flush the on-mount GET /api/presets chain.
  await act(async () => { await flush(); });
}

function rows(): HTMLLIElement[] {
  return Array.from(container.querySelectorAll<HTMLLIElement>('li.tm-preset-row'));
}

function buttonIn(row: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(row.querySelectorAll('button')).find(
    (b) => b.textContent?.trim().toLowerCase() === label.toLowerCase(),
  );
  if (!btn) throw new Error(`button "${label}" not found in row`);
  return btn as HTMLButtonElement;
}

function saveInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>('[aria-label="preset name"]');
  if (!el) throw new Error('preset name input not found');
  return el;
}

function saveButton(): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Save',
  );
  if (!btn) throw new Error('Save button not found');
  return btn as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('PresetLibrary', () => {
  test('renders one row per preset from the mocked GET /api/presets', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') {
        return { body: [preset('p1', 'Carmesí', A), preset('p2', 'Ocean', B)] };
      }
      return {};
    });

    await render({ initialActive: A, isPublic: true, handle: 'zbig' });

    const r = rows();
    expect(r).toHaveLength(2);
    expect(r[0].querySelector('.name')?.textContent).toBe('Carmesí');
    expect(r[1].querySelector('.name')?.textContent).toBe('Ocean');
  });

  test('each row self-previews: inline --tm-ground equals that preset\'s derived ground', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') {
        return { body: [preset('p1', 'Carmesí', A), preset('p2', 'Ocean', B)] };
      }
      return {};
    });

    await render({ initialActive: null, isPublic: false, handle: null });

    const r = rows();
    expect(r[0].style.getPropertyValue('--tm-ground')).toBe(deriveTokens(A).ground);
    expect(r[1].style.getPropertyValue('--tm-ground')).toBe(deriveTokens(B).ground);
  });

  test('Save is disabled with a cap message when 5 presets already exist', async () => {
    const five = [1, 2, 3, 4, 5].map((i) => preset(`p${i}`, `P${i}`, A));
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') return { body: five };
      return {};
    });

    await render({ initialActive: A, isPublic: true, handle: 'zbig' });

    await act(async () => { setInputValue(saveInput(), 'A New Theme'); });

    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toMatch(/saved 5/i);
  });

  test('Save is disabled with an "apply a theme first" hint when initialActive is null', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') return { body: [] };
      return {};
    });

    await render({ initialActive: null, isPublic: true, handle: 'zbig' });

    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toMatch(/apply a theme first/i);
  });

  test('clicking Apply PATCHes /api/presets/<id> with {setActive:true} and applies the theme (data-theme=custom)', async () => {
    const fetchMock = installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') {
        return { body: [preset('p1', 'Carmesí', A)] };
      }
      if (method === 'PATCH' && url === '/api/presets/p1') return { body: { ok: true } };
      if (method === 'PUT' && url === '/api/profile') return { body: {} };
      return {};
    });

    await render({ initialActive: null, isPublic: true, handle: 'zbig' });

    await act(async () => {
      buttonIn(rows()[0], 'Apply').click();
      await flush();
    });

    const patch = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/presets/p1' && (init as RequestInit)?.method === 'PATCH',
    );
    expect(patch).toBeTruthy();
    expect(bodyOf(patch![1] as RequestInit)).toMatchObject({ setActive: true });
    // applyCustomTheme ran → the whole app is in custom mode.
    expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
    // and the row is now badged Active.
    expect(rows()[0].textContent).toMatch(/active/i);
  });

  test('the Active badge follows the initialActive prop when the editor changes the theme', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') {
        return { body: [preset('p1', 'Carmesí', A), preset('p2', 'Ocean', B)] };
      }
      return {};
    });

    // A matches p1's seeds → p1 is Active.
    await render({ initialActive: A, isPublic: true, handle: 'zbig' });
    expect(rows()[0].textContent).toMatch(/active/i);
    expect(rows()[1].textContent).not.toMatch(/active/i);

    // The editor applies theme B → the prop moves → the badge must follow to p2.
    await act(async () => {
      root.render(<PresetLibrary initialActive={B} isPublic={true} handle="zbig" />);
    });
    await act(async () => { await flush(); });

    expect(rows()[0].textContent).not.toMatch(/active/i);
    expect(rows()[1].textContent).toMatch(/active/i);
  });

  test('arming Delete then taking another action resets the confirm (two consecutive clicks required)', async () => {
    const fetchMock = installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') return { body: [preset('p1', 'Carmesí', A)] };
      if (method === 'PATCH' && url === '/api/presets/p1') return { body: { ok: true } };
      if (method === 'PUT' && url === '/api/profile') return { body: {} };
      if (method === 'DELETE' && url === '/api/presets/p1') return { body: { ok: true } };
      return {};
    });

    await render({ initialActive: null, isPublic: true, handle: 'zbig' });

    // First Delete click arms the confirm.
    await act(async () => { buttonIn(rows()[0], 'Delete').click(); await flush(); });
    expect(buttonIn(rows()[0], 'Confirm')).toBeTruthy();

    // An interposing action (Apply) must clear the armed confirm.
    await act(async () => { buttonIn(rows()[0], 'Apply').click(); await flush(); });
    expect(buttonIn(rows()[0], 'Delete')).toBeTruthy();

    // A single Delete click now only re-arms; it must NOT delete the row.
    await act(async () => { buttonIn(rows()[0], 'Delete').click(); await flush(); });
    expect(rows()).toHaveLength(1);
    const deleted = fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE');
    expect(deleted).toBe(false);
  });

  test('Share with NO handle shows the "set a handle" message and does NOT fetch a PATCH', async () => {
    const fetchMock = installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') {
        return { body: [preset('p1', 'Carmesí', A)] };
      }
      return {};
    });

    // Private profile is now irrelevant to sharing — only the missing handle gates it.
    await render({ initialActive: A, isPublic: false, handle: null });

    await act(async () => {
      buttonIn(rows()[0], 'Share').click();
      await flush();
    });

    expect(container.textContent).toMatch(/set a handle/i);
    expect(container.textContent).not.toMatch(/make your profile public/i);
    const anyPatch = fetchMock.mock.calls.some(
      ([, init]) => (init as RequestInit)?.method === 'PATCH',
    );
    expect(anyPatch).toBe(false);
  });

  test('Share WITH a handle (even on a private profile) PATCHes {isShared:true}', async () => {
    const fetchMock = installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') return { body: [preset('p1', 'Carmesí', A)] };
      if (method === 'PATCH' && url === '/api/presets/p1') return { body: { ok: true } };
      return {};
    });

    // isPublic:false, but a handle is present → sharing is allowed.
    await render({ initialActive: A, isPublic: false, handle: 'ana' });

    await act(async () => {
      buttonIn(rows()[0], 'Share').click();
      await flush();
    });

    const patch = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/presets/p1' && (init as RequestInit)?.method === 'PATCH',
    );
    expect(patch).toBeTruthy();
    expect(bodyOf(patch![1] as RequestInit)).toMatchObject({ isShared: true });
    // The row is now badged Shared.
    expect(rows()[0].textContent).toMatch(/shared/i);
  });

  test('a needs_handle 409 from the API surfaces the "set a handle" message', async () => {
    installFetch((method, url) => {
      if (method === 'GET' && url === '/api/presets') return { body: [preset('p1', 'Carmesí', A)] };
      if (method === 'PATCH' && url === '/api/presets/p1') return { ok: false, status: 409, body: { error: 'needs_handle' } };
      return {};
    });

    // Client thinks it has a handle, but the server disagrees (race / stale prop).
    await render({ initialActive: A, isPublic: true, handle: 'ana' });

    await act(async () => {
      buttonIn(rows()[0], 'Share').click();
      await flush();
    });

    expect(container.textContent).toMatch(/set a handle/i);
  });
});
