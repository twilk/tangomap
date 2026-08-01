import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { startMapSync, MASTERED_CHANGE_EVENT, MASTERED_ADOPTED_EVENT } from '@/src/components/MapSync';

// The React port of the bundle's old progress-sync script. startMapSync() reads
// globalThis fetch / localStorage / document / window exactly as the IIFE did, so we
// drive it under jsdom with a mocked fetch + localStorage and assert the same
// last-write-wins semantics the old sync test covered (keys tsm-mastered / tsm-theme /
// tsm-updated).

let stop: (() => void) | null = null;
function run(): void {
  stop = startMapSync();
}

// Flush pending microtasks. The GET chain is fetch -> .then(r.json()) -> .then(handler),
// so several turns are needed before the handler's side effects are observable.
async function flush(n = 16): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

type ProgressBody = { mastered: string[]; theme: 'light' | 'dark' | 'custom' | null; sel: string | null; updatedAt: string };

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
const puts = (m: ReturnType<typeof mockApi>) =>
  m.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
const putBody = (m: ReturnType<typeof mockApi>, i = 0) =>
  JSON.parse(String((puts(m)[i]![1] as RequestInit).body)) as { mastered: string[]; theme: string | null };
const ms = (iso: string) => String(Date.parse(iso));

// jsdom's `document` is shared across tests in a file. startMapSync attaches a
// MutationObserver to documentElement; without cleanup, observers from earlier tests
// survive and fire on a later test's DOM mutation (polluting its fetch mock). The
// returned cleanup disconnects it; we also track every observer as a backstop so each
// case runs against exactly one sync instance, as it would on a fresh page load.
const observers: MutationObserver[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  try {
    sessionStorage.clear();
  } catch {
    /* jsdom */
  }
  const RealMO = globalThis.MutationObserver;
  vi.stubGlobal(
    'MutationObserver',
    class extends RealMO {
      constructor(cb: MutationCallback) {
        super(cb);
        observers.push(this);
      }
    },
  );
});
afterEach(() => {
  stop?.();
  stop = null;
  observers.forEach((o) => o.disconnect());
  observers.length = 0;
  while (document.documentElement.lastChild) document.documentElement.removeChild(document.documentElement.lastChild);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MapSync progress sync (last-write-wins)', () => {
  test('(a) empty local is seeded from the server', async () => {
    const m = mockApi({ mastered: ['x'], theme: null, sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();
    expect(localStorage.getItem('tsm-mastered')).toBe('["x"]');
    expect(puts(m).length).toBe(0); // adopting the server never pushes
  });

  test('(b) first sync with pre-existing local (no clock) pushes the union — nothing lost', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['y']));
    const m = mockApi({ mastered: ['x'], theme: 'dark', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();
    expect(puts(m).length).toBeGreaterThan(0);
    expect([...putBody(m).mastered].sort()).toEqual(['x', 'y']); // union, migration one-shot
  });

  // THE regression test: a device whose local clock is OLDER than the server must
  // adopt the server and must NOT push its stale local set (that was the clobber).
  test('(c) server newer than local clock → adopt server, never push local', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a', 'b', 'c']));
    localStorage.setItem('tsm-updated', ms('2026-01-01T00:00:00.000Z')); // local is old
    const m = mockApi({ mastered: ['x'], theme: 'dark', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
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
    run();
    await flush();
    expect(puts(m).length).toBeGreaterThan(0);
    expect([...putBody(m).mastered].sort()).toEqual(['a', 'b']); // local wins, pushed as-is
  });

  test('(e) once in sync, incidental DOM churn (unchanged set) pushes NOTHING', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['x']));
    localStorage.setItem('tsm-updated', ms('2026-07-22T00:00:00.000Z')); // equal to server → in sync
    const m = mockApi({ mastered: ['x'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
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
    run();
    await flush();
    vi.advanceTimersByTime(2000);
    expect(localStorage.getItem('tsm-mastered')).toBeNull();
    expect(localStorage.getItem('tsm-theme')).toBeNull();
    expect(puts(m).length).toBe(0);
  });

  // THE de-bundle regression test: once in sync, an UNMARK (a set change with no
  // childList DOM churn and no toast) must still push the REDUCED set. The bundle's
  // MutationObserver missed this — the map now dispatches MASTERED_CHANGE_EVENT.
  test('(h) an unmark (set change + MASTERED_CHANGE_EVENT) pushes the reduced set', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['x', 'y']));
    localStorage.setItem('tsm-updated', ms('2026-07-22T00:00:00.000Z')); // equal → in sync
    const m = mockApi({ mastered: ['x', 'y'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();
    expect(puts(m).length).toBe(0); // in sync, nothing pushed yet
    // Unmark 'y': write the reduced set (as toggleMastered does) and fire the event.
    localStorage.setItem('tsm-mastered', JSON.stringify(['x']));
    window.dispatchEvent(new Event(MASTERED_CHANGE_EVENT));
    vi.advanceTimersByTime(1000); // debounce
    await flush();
    expect(puts(m).length).toBeGreaterThan(0);
    expect(putBody(m).mastered).toEqual(['x']); // the unmark reached the server
  });

  test('(g) the pushed theme is the normalised mode from readMode() (tsm-theme)', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-theme', 'dark');
    localStorage.setItem('tsm-updated', ms('2026-08-01T00:00:00.000Z')); // local newer → push
    const m = mockApi({ mastered: ['x'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();
    expect(puts(m).length).toBeGreaterThan(0);
    expect(putBody(m).theme).toBe('dark'); // readMode() → 'dark', pushed as progress.theme
  });

  // --- Live adoption: no page reload, ever -----------------------------------
  // Adopting another device's state used to call location.reload(). It now writes
  // localStorage and ANNOUNCES the change so the map re-renders in place.

  test('(i) adopting newer server progress announces it instead of reloading', async () => {
    const seen: string[] = [];
    const onAdopted = () => seen.push('adopted');
    window.addEventListener(MASTERED_ADOPTED_EVENT, onAdopted);
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-updated', ms('2026-07-01T00:00:00.000Z')); // local OLDER
    mockApi({ mastered: ['a', 'b'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();
    window.removeEventListener(MASTERED_ADOPTED_EVENT, onAdopted);

    expect(JSON.parse(localStorage.getItem('tsm-mastered')!)).toEqual(['a', 'b']); // adopted
    expect(seen).toEqual(['adopted']); // and announced exactly once
  });

  test('(j) adopting a newer server THEME reflects it on <html data-theme> live', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-theme', 'light');
    localStorage.setItem('tsm-updated', ms('2026-07-01T00:00:00.000Z')); // local OLDER
    mockApi({ mastered: ['a'], theme: 'dark', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();

    expect(localStorage.getItem('tsm-theme')).toBe('dark');
    // The reload used to be what repainted the page; the mode must now be applied.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  test('(k) adopting an UNCHANGED server state announces nothing (no needless re-render)', async () => {
    const seen: string[] = [];
    const onAdopted = () => seen.push('adopted');
    window.addEventListener(MASTERED_ADOPTED_EVENT, onAdopted);
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-theme', 'light');
    localStorage.setItem('tsm-updated', ms('2026-07-01T00:00:00.000Z')); // older clock…
    mockApi({ mastered: ['a'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' }); // …same data
    run();
    await flush();
    window.removeEventListener(MASTERED_ADOPTED_EVENT, onAdopted);

    expect(seen).toEqual([]);
  });

  // --- Cross-device liveness: re-pull when the tab comes back ----------------

  test('(l) returning to the tab re-pulls and adopts what another device changed', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-updated', ms('2026-07-22T00:00:00.000Z')); // in sync at mount
    const m = mockApi({ mastered: ['a'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();
    const getsAtMount = m.mock.calls.filter((c) => !(c[1] as RequestInit | undefined)?.method).length;

    // Meanwhile another device marks 'b'. The user switches back to this tab.
    mockApi({ mastered: ['a', 'b'], theme: 'light', sel: null, updatedAt: '2026-07-23T00:00:00.000Z' });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();

    expect(getsAtMount).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('tsm-mastered')!)).toEqual(['a', 'b']);
  });

  test('(m) a tab going HIDDEN does not trigger a pull', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-updated', ms('2026-07-22T00:00:00.000Z'));
    mockApi({ mastered: ['a'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();

    const m2 = mockApi({ mastered: ['a', 'b'], theme: 'light', sel: null, updatedAt: '2026-07-23T00:00:00.000Z' });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    expect(m2.mock.calls.length).toBe(0); // nothing fetched while hidden
    expect(JSON.parse(localStorage.getItem('tsm-mastered')!)).toEqual(['a']);
  });

  // Regression: a `storage` event is ANOTHER tab's change, already owned by that tab
  // (it pushes its own edits) or already on the server (it adopted them). Re-pushing
  // it here would stamp a fresh Date.now() on a passive copy, making an older snapshot
  // the newest write under last-write-wins — silently clobbering a genuinely newer
  // device. Found by an independent Codex review of #49.
  test('(n) a cross-tab storage event never triggers a PUT', async () => {
    localStorage.setItem('tsm-mastered', JSON.stringify(['a']));
    localStorage.setItem('tsm-updated', ms('2026-07-22T00:00:00.000Z'));
    mockApi({ mastered: ['a'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    run();
    await flush();

    // Another tab adopts the server's row and writes it to the shared localStorage.
    const m2 = mockApi({ mastered: ['a'], theme: 'light', sel: null, updatedAt: '2026-07-22T00:00:00.000Z' });
    localStorage.setItem('tsm-mastered', JSON.stringify(['a', 'b']));
    window.dispatchEvent(new StorageEvent('storage', { key: 'tsm-mastered' }));
    vi.advanceTimersByTime(1000); // past the 500ms debounce runCheck sits behind
    await flush();

    expect(puts(m2)).toHaveLength(0);
  });
});
