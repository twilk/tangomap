'use client';

// Cross-device progress sync (mastered skills + theme MODE), last-write-wins. This is
// the React port of the bundle's deleted progress-sync script — same keys, same
// semantics — mounted once in the map screen (app/page.tsx). It is the ONLY thing that mirrors the mastered
// set (and the theme mode) to the server; the app pages do not.
//
// The clock is `tsm-updated`: the ms timestamp of the last REAL local change. We
// reconcile by clock (adopt whichever side is newer, unioning once on a first-ever
// sync so nothing is lost) on mount AND whenever the tab regains focus — that second
// trigger is what makes another device's change show up on an already-open page.
// Thereafter we push ONLY when the mastered set or theme mode actually changes — never
// on the map's incidental DOM churn, which is what used to let a stale device clobber a
// fresh one. The server (/api/progress) is the arbiter: it rejects a write older than
// what it holds and returns the authoritative row, which we then adopt.
//
// Adoption NEVER reloads the page. It writes localStorage, reflects the theme mode onto
// <html data-theme>, and fires MASTERED_ADOPTED_EVENT so the map re-renders in place.
//
// Guarded throughout: signed-out (GET 401 → no body) or offline is a silent no-op.

import { useEffect } from 'react';
import { readMode, setMode } from '@/src/lib/customTheme';

const KEY_M = 'tsm-mastered';
const KEY_T = 'tsm-theme';
const KEY_TS = 'tsm-updated';

/** Fired on `window` by the map whenever the mastered set changes (mark OR unmark),
 *  so MapSync pushes deterministically instead of relying on incidental DOM churn.
 *  The shared contract with src/components/TangoMap.tsx.
 *  SAME-TAB ONLY — a plain window Event never crosses tabs (see MASTERED_ADOPTED_EVENT
 *  and the `storage` listener for the cross-tab/cross-device paths). */
export const MASTERED_CHANGE_EVENT = 'tsm-mastered-change';

/** The inverse direction: fired by MapSync after it ADOPTS state that came from the
 *  server (another device), so the map re-reads and re-renders in place. This is what
 *  replaced a `location.reload()` — no user action may ever cost a page reload.
 *  Also same-tab only; cross-TAB adoption travels as a `storage` event, which the map
 *  listens for directly. */
export const MASTERED_ADOPTED_EVENT = 'tsm-mastered-adopted';

type ServerProgress = {
  mastered?: unknown;
  theme?: string | null;
  updatedAt?: string;
};

function lget(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lset(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode / storage disabled */
  }
}

function localMastered(): string[] {
  try {
    const a = JSON.parse(lget(KEY_M) || '[]');
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function localClock(): number {
  const n = parseInt(lget(KEY_TS) || '0', 10);
  return Number.isNaN(n) ? 0 : n;
}
function keyOf(arr: string[]): string {
  return arr.slice().sort().join('|');
}
function sameSet(a: string[], b: string[] | undefined): boolean {
  return keyOf(a) === keyOf(b || []);
}
/** The theme MODE we sync (light | dark | custom), normalised — the value the deleted
 *  the bundle read raw from `tsm-theme`, now sourced through customTheme so an absent /
 *  legacy value reads as 'light' consistently. */
function themeMode(): string {
  return readMode();
}
function serverMastered(s: ServerProgress): string[] {
  return Array.isArray(s.mastered) ? s.mastered.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Start the progress sync loop. Faithful port of the bundle's progress-sync script.
 * Reads globalThis
 * fetch / localStorage / document / window, so it runs identically in the browser and
 * under jsdom (test/mapSync.test.ts). Returns a cleanup that tears down the observer,
 * the storage listener and any pending debounce — for React unmount / StrictMode.
 */
export function startMapSync(): () => void {
  let lastM = keyOf(localMastered()); // mastered set we believe the server holds
  let lastT = themeMode(); // theme mode we believe the server holds
  let pushing = false;
  let timer: ReturnType<typeof setTimeout> | 0 = 0;
  let disposed = false;

  let watching = false; // listeners attached exactly once, however often we reconcile
  let reconciling = false; // collapses overlapping pulls (mount + a fast tab focus)

  let observer: MutationObserver | null = null;
  let onStorage: ((e: StorageEvent) => void) | null = null;
  let onMastered: (() => void) | null = null;
  let onVisible: (() => void) | null = null;

  /** Take the server's row as authoritative: persist it, reflect the theme MODE onto
   *  <html data-theme> immediately, and — if it actually changes what this tab shows —
   *  announce it so the map re-renders in place. Returns whether anything changed.
   *
   *  This used to end in `location.reload()`. It must not: a reload throws away the
   *  user's scroll, selection and any in-flight work, and it is exactly the "you must
   *  refresh to see it" behaviour the app is meant to be free of. */
  function adopt(s: ServerProgress): boolean {
    const nextM = serverMastered(s);
    const prevMKey = keyOf(localMastered());
    const prevT = themeMode();

    lset(KEY_M, JSON.stringify(nextM));
    // setMode (not a bare lset) so the mode lands on <html data-theme> too — the
    // repaint the reload used to provide.
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'custom') setMode(s.theme);
    lset(KEY_TS, String((s.updatedAt && Date.parse(s.updatedAt)) || Date.now()));

    lastM = keyOf(nextM);
    lastT = themeMode();

    const changed = prevMKey !== lastM || prevT !== lastT;
    if (changed) {
      try {
        window.dispatchEvent(new Event(MASTERED_ADOPTED_EVENT));
      } catch {
        /* no window (SSR) — nothing to re-render */
      }
    }
    return changed;
  }

  function push(ts: number): void {
    if (pushing) return;
    pushing = true;
    const sentM = localMastered();
    const sentT = themeMode();
    fetch('/api/progress', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mastered: sentM, theme: sentT, sel: null, updatedAt: new Date(ts).toISOString() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((srv: ServerProgress | null) => {
        pushing = false;
        if (!srv || !srv.updatedAt) return;
        // Arbiter's verdict: if it handed back something other than what we sent, the
        // server had newer state (our write was rejected as stale) — adopt + re-render.
        if (!sameSet(serverMastered(srv), sentM) || (srv.theme && srv.theme !== sentT)) {
          adopt(srv); // adopt() announces the change; the map re-renders in place
        } else {
          lastM = keyOf(serverMastered(srv));
          lastT = srv.theme || sentT;
          lset(KEY_TS, String(Date.parse(srv.updatedAt) || ts));
        }
      })
      .catch(() => {
        pushing = false;
      });
  }

  // Push only when the set or theme genuinely differs from what we last synced.
  function runCheck(): void {
    if (keyOf(localMastered()) === lastM && themeMode() === lastT) return; // nothing actually changed
    const ts = Date.now();
    lset(KEY_TS, String(ts));
    push(ts);
  }
  function scheduleCheck(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runCheck, 500);
  }

  function watch(): void {
    if (disposed || watching) return;
    watching = true;
    try {
      observer = new MutationObserver(scheduleCheck);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    } catch {
      /* no MutationObserver */
    }
    onStorage = (e: StorageEvent) => {
      if (e.key === KEY_M || e.key === KEY_T) scheduleCheck();
    };
    window.addEventListener('storage', onStorage);
    // Same-tab mark/unmark: the map dispatches this so an unmark (which produces no
    // childList mutation) is never missed. runCheck still no-ops if nothing changed.
    onMastered = () => scheduleCheck();
    window.addEventListener(MASTERED_CHANGE_EVENT, onMastered);

    // Cross-DEVICE liveness. There is no server push channel, so the cheapest correct
    // signal is "the user came back to this tab" — re-reconcile then, which is exactly
    // when a stale screen would otherwise be noticed. Costs one GET per focus, never
    // fires while hidden, and needs no polling.
    onVisible = () => {
      try {
        if (document.visibilityState === 'hidden') return;
      } catch {
        /* no document.visibilityState — treat as visible */
      }
      reconcile();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
  }

  /** Pull the server row and reconcile it against local by clock. Safe to call
   *  repeatedly (mount, tab focus); concurrent calls collapse into one. */
  function reconcile(): void {
    if (disposed || reconciling) return;
    reconciling = true;
    fetch('/api/progress', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: ServerProgress | null) => {
        reconciling = false;
        if (disposed) return;
        if (!s || !s.updatedAt) return; // signed out / no body -> no sync
        const serverTs = Date.parse(s.updatedAt) || 0;
        const lc = localClock();
        const local = localMastered();

        if (lc === 0 && local.length && !sameSet(local, serverMastered(s))) {
          // First sync on this browser with pre-existing local progress: union once so
          // nothing is lost (SPEC: first login merges, never discards), then push.
          const u: Record<string, 1> = {};
          local.concat(serverMastered(s)).forEach((x) => {
            u[x] = 1;
          });
          lset(KEY_M, JSON.stringify(Object.keys(u)));
          lastM = ''; // force the push to send the union
          push(Date.now());
        } else if (serverTs > lc) {
          // Another device wrote more recently -> adopt it. adopt() persists, repaints
          // the theme mode and announces the change so the map re-renders in place.
          adopt(s);
        } else if (lc > serverTs) {
          push(lc); // our local is newer -> push it
        } else {
          // Already in sync (equal clocks). Hydrate theme if local has none, then
          // baseline lastT to the ACTUAL local theme so a null-vs-server mismatch
          // can't masquerade as a change and trigger a spurious push.
          if (s.theme && !lget(KEY_T)) lset(KEY_T, s.theme);
          lastM = keyOf(serverMastered(s));
          lastT = themeMode();
        }

        watch();
      })
      .catch(() => {
        reconciling = false;
      });
  }

  reconcile();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    if (observer) observer.disconnect();
    if (onStorage) window.removeEventListener('storage', onStorage);
    if (onMastered) window.removeEventListener(MASTERED_CHANGE_EVENT, onMastered);
    if (onVisible) {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    }
  };
}

/** Mounts the progress-sync loop once in the map screen. Renders nothing. */
export function MapSync() {
  useEffect(() => startMapSync(), []);
  return null;
}

export default MapSync;
