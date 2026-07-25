import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import ThemeEditor, { PRESETS } from '@/app/settings/ThemeEditor';
import { parseTheme } from '@/src/lib/theme';

// React 19's act() checks this flag; without it, act() logs a warning.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function resetTheme(): void {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  document.documentElement.removeAttribute('data-theme');
  document.getElementById('tm-custom-theme')?.remove();
}

beforeEach(() => {
  resetTheme();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  resetTheme();
  vi.restoreAllMocks();
});

async function render(): Promise<void> {
  await act(async () => {
    root.render(<ThemeEditor />);
  });
}

function q<T extends Element = HTMLElement>(selector: string): T {
  const el = container.querySelector<T>(selector);
  if (!el) throw new Error(`element not found: ${selector}`);
  return el;
}

// Set a controlled input's value the way React's synthetic event system expects:
// use the native prototype setter (bypasses React's value tracker) then dispatch
// a bubbling 'input' event so onChange fires.
function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function buttonByText(re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) => re.test(b.textContent ?? ''));
  if (!btn) throw new Error(`button not found: ${re}`);
  return btn as HTMLButtonElement;
}

describe('ThemeEditor', () => {
  test('every preset is a legible, parseable theme', () => {
    expect(PRESETS.length).toBeGreaterThan(0);
    for (const p of PRESETS) {
      expect(parseTheme({ v: 1, ...p.seeds })).not.toBeNull();
    }
  });

  test('renders 4 colour inputs and 4 hex inputs from the default seeds', async () => {
    await render();
    // Scope to the seed grid: the editor now also mounts the preset library below
    // it (which has its own text input), so a page-global selector would over-count.
    const grid = q('.tm-seedgrid');
    expect(grid.querySelectorAll('input[type="color"]').length).toBe(4);
    expect(grid.querySelectorAll('input[type="text"]').length).toBe(4);
  });

  test('an illegible ink seed disables Apply and warns about contrast', async () => {
    await render();

    await act(async () => {
      setInputValue(q<HTMLInputElement>('[aria-label="Text hex"]'), '#3a3020');
    });

    expect(buttonByText(/^Apply$/).disabled).toBe(true);
    expect(container.textContent).toMatch(/needs 4.5:1/);
  });

  test('applying a valid theme re-themes the app live via localStorage + data-theme', async () => {
    await render();

    await act(async () => {
      buttonByText(/^Apply$/).click();
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('custom');
    expect(localStorage.getItem('tsm-theme')).toBe('custom');
    expect(localStorage.getItem('tsm-custom-css')).toBeTruthy();
  });

  test('reset asks for confirmation, then clears the custom theme', async () => {
    await render();

    await act(async () => {
      buttonByText(/^Apply$/).click();
    });
    expect(localStorage.getItem('tsm-custom-css')).toBeTruthy();

    // First click on Reset only arms the confirmation.
    await act(async () => {
      buttonByText(/Reset/).click();
    });
    expect(container.textContent).toMatch(/Click again/);

    // Second click actually clears it.
    await act(async () => {
      buttonByText(/Click again/).click();
    });
    expect(localStorage.getItem('tsm-custom-css')).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('custom');
  });

  test('the card toggle PUTs /api/profile with ONLY cardUsesCustomTheme', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ cardUsesCustomTheme: false }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await render();

    const toggle = q<HTMLInputElement>('[aria-label="cardUsesCustomTheme"]');
    await act(async () => {
      toggle.click(); // flips false → true and fires React onChange
    });

    // The mount GET is a bare fetch; the toggle write is the PUT — isolate it.
    const putCall = fetchMock.mock.calls.find(([, opts]) => (opts as RequestInit | undefined)?.method === 'PUT');
    expect(putCall).toBeTruthy();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    // ONLY the flag — never the theme itself (disjoint-writer discipline).
    expect(body).toEqual({ cardUsesCustomTheme: true });
    expect(body).not.toHaveProperty('customTheme');
    expect(body).not.toHaveProperty('customThemeUpdatedAt');
  });

  test('prefills the seeds from an already-stored custom theme', async () => {
    localStorage.setItem(
      'tsm-custom',
      JSON.stringify({ v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' }),
    );

    await render();

    expect(q<HTMLInputElement>('[aria-label="Background"]').value).toBe('#1b1327');
  });
});
