import React, { act } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import SettingsForm from '@/app/settings/SettingsForm';
import type { ProfileDTO } from '@/src/lib/types';

// React 19's act() checks this flag; without it, act() logs a warning.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const baseInitial: ProfileDTO = {
  handle: null,
  isPublic: false,
  displayName: null,
  style: null,
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
  vi.restoreAllMocks();
});

async function render(initial: ProfileDTO): Promise<void> {
  await act(async () => {
    root.render(<SettingsForm initial={initial} />);
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

function saveButton(): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Save',
  );
  if (!btn) throw new Error('Save button not found');
  return btn as HTMLButtonElement;
}

describe('SettingsForm', () => {
  test('renders fields from the initial ProfileDTO', async () => {
    await render({
      handle: 'zbig',
      isPublic: true,
      displayName: 'Zbigniew',
      style: 'salon',
    });

    expect(q<HTMLInputElement>('[aria-label="displayName"]').value).toBe('Zbigniew');
    expect(q<HTMLInputElement>('[aria-label="handle"]').value).toBe('zbig');
    expect(q<HTMLSelectElement>('[aria-label="style"]').value).toBe('salon');
    expect(q<HTMLInputElement>('[aria-label="isPublic"]').checked).toBe(true);
  });

  test('filling handle and clicking Save PUTs /api/profile with the handle in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...baseInitial, handle: 'newhandle' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await render(baseInitial);

    await act(async () => {
      setInputValue(q<HTMLInputElement>('[aria-label="handle"]'), 'newhandle');
    });

    await act(async () => {
      saveButton().click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/profile');
    expect(opts.method).toBe('PUT');
    const body = JSON.parse(opts.body as string);
    expect(body.handle).toBe('newhandle');
  });

  test('shows an inline "taken" error when the API responds 409', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'handle_taken' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await render(baseInitial);

    await act(async () => {
      setInputValue(q<HTMLInputElement>('[aria-label="handle"]'), 'taken-one');
    });

    await act(async () => {
      saveButton().click();
    });

    expect(container.textContent).toMatch(/taken/i);
  });
});
