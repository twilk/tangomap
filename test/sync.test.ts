import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// public/sync.js is a defensive IIFE. We load its source and execute it in the
// jsdom global scope via indirect eval, so it binds to globalThis.fetch /
// localStorage / document / window / timers just like it would in the browser.
const SRC = readFileSync('public/sync.js', 'utf8');
function runSync(): void {
  (0, eval)(SRC);
}

// Flush pending microtasks. The GET chain is fetch -> .then(r.json()) -> .then(handler),
// so several turns are needed before the handler's side effects are observable.
async function flush(n = 16): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

type ProgressBody = { mastered: string[]; theme: 'light' | 'dark' | null; sel: string | null; updatedAt: string };

/** fetch mock: GET returns `server`; PUT echoes its own body (the real API's
 *  accept path). Returns the vi.fn so tests can inspect PUT calls. */
function mockApi(server: ProgressBody | null) {
  const fetchMock = vi.fn((_url: string, opts?: RequestInit) => {
    if (!opts || opts.method === undefined) {
      return Promise.resolve({ ok: !!server, json: () => Promise.resolve(server) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(String(opts.body))) });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const puts = (m: ReturnType<typeof mockApi>) => m.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
const ms = (iso: string) => String(Date.parse(iso));

// jsdom's `document` is shared across tests in a file. sync.js attaches a
// MutationObserver to documentElement; without cleanup, observers from earlier
// tests survive and fire on a later test's DOM mutation (polluting its fetch
// mock). Track every observer and disconnect them between tests so each case
// runs against exactly one sync instance, as it would on a fresh page load.
const observers: MutationObserver[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  try { sessionStorage.clear(); } catch { /* jsdom */ }
  const RealMO = globalThis.MutationObserver;
  vi.stubGlobal(
    'MutationObserver',
    class extends RealMO {
      constructor(cb: MutationCallback) { super(cb); observers.push(this); }
    },
  );
});
afterEach(() => {
  observers.forEach((o) => o.disconnect());
  observers.length = 0;
  while (document.documentElement.lastChild) document.documentElement.removeChild(document.documentElement.lastChild);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('public/sync.js progress sync (last-write-wins)', () => {
  test('(a) empty local is seeded from the server', async () => {
    const m = mockApi({ mastered: ['x'], theme: null, sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    runSync();
    await flush();
    expect(localStorage.getItem('tsm-mastered')).toBe('["x"]');
    expect(puts(m).length).toBe(0); // adopting the server never pushes
  });

  test('(b) first sync with pre-existing local (no clock) pushes the union — nothing lost', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['y']));
    const m = mockApi({ mastered: ['x'], theme: 'dark', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    runSync();
    await flush();
    const put = puts(m)[0];
    expect(put).toBeTruthy();
    const body = JSON.parse(String((put![1] as RequestInit).body)) as { mastered: string[] };
    expect([...body.mastered].sort()).toEqual(['x', 'y']); // union, migration one-shot
  });

  // THE regression test: a device whose local clock is OLDER than the server must
  // adopt the server and must NOT push its stale local set (that was the clobber).
  test('(c) server newer than local clock → adopt server, never push local', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a', 'b', 'c']));
    localStorage.setItem('tsm-updated', ms('2026-01-01T00:00:00.000Z')); // local is old
    const m = mockApi({ mastered: ['x'], theme: 'dark', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    runSync();
    await flush();
    vi.advanceTimersByTime(1000);
    await flush();
    expect(localStorage.getItem('tsm-mastered')).toBe('["x"]'); // adopted the server
    expect(puts(m).length).toBe(0); // and did NOT clobber it with the stale local set
  });

  test('(d) local clock newer than server → push local', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a', 'b']));
    localStorage.setItem('tsm-updated', ms('2026-08-01T00:00:00.000Z')); // local is newer
    const m = mockApi({ mastered: ['x'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    runSync();
    await flush();
    const put = puts(m)[0];
    expect(put).toBeTruthy();
    const body = JSON.parse(String((put![1] as RequestInit).body)) as { mastered: string[] };
    expect([...body.mastered].sort()).toEqual(['a', 'b']); // local wins, pushed as-is
  });

  test('(e) once in sync, incidental DOM churn (unchanged set) pushes NOTHING', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['x']));
    localStorage.setItem('tsm-updated', ms('2026-07-22T00:00:00.000Z')); // equal to server → in sync
    const m = mockApi({ mastered: ['x'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    runSync();
    await flush();
    // simulate the map re-rendering: mutate the DOM without changing tsm-mastered
    document.documentElement.appendChild(document.createElement('div'));
    await flush();
    vi.advanceTimersByTime(1000); // let any debounced check fire
    await flush();
    expect(puts(m).length).toBe(0); // no real change → no push → no clobber
  });

  test('(f) a 401 (ok:false) is a no-op: no localStorage writes, no PUT', async () => {
    const m = mockApi(null);
    runSync();
    await flush();
    vi.advanceTimersByTime(2000);
    expect(localStorage.getItem('tsm-mastered')).toBeNull();
    expect(localStorage.getItem('tsm-theme')).toBeNull();
    expect(puts(m).length).toBe(0);
  });
});
