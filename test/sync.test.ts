import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// public/sync.js is a defensive IIFE. We load its source and execute it in the
// jsdom global scope via indirect eval, so it binds to globalThis.fetch /
// localStorage / document / window / timers just like it would in the browser.
const SRC = readFileSync(fileURLToPath(new URL('../public/sync.js', import.meta.url)), 'utf8');
function runSync(): void {
  (0, eval)(SRC);
}

// Flush pending microtasks. The GET chain is fetch -> .then(r.json()) -> .then(handler),
// so several turns are needed before the handler's side effects are observable.
async function flush(n = 12): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

type ProgressBody = {
  mastered: string[];
  theme: 'light' | 'dark' | null;
  sel: string | null;
  updatedAt: string;
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('public/sync.js progress sync', () => {
  test('(a) signed-in GET seeds empty localStorage from the server', async () => {
    const server: ProgressBody = {
      mastered: ['x'],
      theme: null,
      sel: null,
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
    const fetchMock = vi.fn((_url: string, opts?: RequestInit) => {
      if (!opts || opts.method === undefined) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(server) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(String(opts.body))) });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(localStorage.getItem('tsm-mastered')).toBeNull();
    runSync();
    await flush();

    expect(localStorage.getItem('tsm-mastered')).toBe('["x"]');
  });

  test('(b) after the 800ms debounce a PUT fires with the union of local + server', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['y']));
    const server: ProgressBody = {
      mastered: ['x'],
      theme: 'dark',
      sel: null,
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
    const fetchMock = vi.fn((_url: string, opts?: RequestInit) => {
      if (!opts || opts.method === undefined) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(server) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(String(opts.body))) });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    runSync();
    await flush(); // let the GET handler run and arm the debounce

    // No PUT before the debounce elapses.
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'PUT')).toBe(false);

    vi.advanceTimersByTime(900); // fire the debounced pushNow -> PUT

    const putCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
    expect(putCall).toBeTruthy();

    const body = JSON.parse(String((putCall![1] as RequestInit).body)) as { mastered: string[] };
    expect([...body.mastered].sort()).toEqual(['x', 'y']);
  });

  test('(c) a 401 (ok:false) is a no-op: no localStorage writes, no PUT', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    runSync();
    await flush();
    vi.advanceTimersByTime(2000); // nothing was scheduled; prove it stays quiet

    expect(localStorage.getItem('tsm-mastered')).toBeNull();
    expect(localStorage.getItem('tsm-theme')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // GET only, never a PUT
  });
});
