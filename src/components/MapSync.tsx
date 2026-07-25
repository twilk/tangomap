'use client';

// Cross-device progress sync (mastered skills + theme MODE), last-write-wins. This is
// the React port of the bundle's deleted progress-sync script — same keys, same
// semantics — mounted once in the map screen (app/page.tsx). It is the ONLY thing that mirrors the mastered
// set (and the theme mode) to the server; the app pages do not.
//
// The clock is `tsm-updated`: the ms timestamp of the last REAL local change. On mount
// we reconcile by clock (adopt whichever side is newer, unioning once on a first-ever
// sync so nothing is lost); thereafter we push ONLY when the mastered set or theme mode
// actually changes — never on the map's incidental DOM churn, which is what used to let
// a stale device clobber a fresh one. The server (/api/progress) is the arbiter: it
// rejects a write older than what it holds and returns the authoritative row, which we
// then adopt (and reload once, to re-render the map from the adopted set).
//
// Guarded throughout: signed-out (GET 401 → no body) or offline is a silent no-op.

import { useEffect } from 'react';
import { readMode } from '@/src/lib/customTheme';

const KEY_M = 'tsm-mastered';
const KEY_T = 'tsm-theme';
const KEY_TS = 'tsm-updated';

/** Fired on `window` by the map whenever the mastered set changes (mark OR unmark),
 *  so MapSync pushes deterministically instead of relying on incidental DOM churn.
 *  The shared contract with src/components/TangoMap.tsx. */
export const MASTERED_CHANGE_EVENT = 'tsm-mastered-change';

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

  let observer: MutationObserver | null = null;
  let onStorage: ((e: StorageEvent) => void) | null = null;
  let onMastered: (() => void) | null = null;

  function adopt(s: ServerProgress): void {
    lset(KEY_M, JSON.stringify(serverMastered(s)));
    if (s.theme) lset(KEY_T, s.theme);
    lset(KEY_TS, String((s.updatedAt && Date.parse(s.updatedAt)) || Date.now()));
    lastM = keyOf(serverMastered(s));
    lastT = themeMode();
  }
  function reloadOnce(): void {
    try {
      if (!sessionStorage.getItem('tm-reconciled')) {
        sessionStorage.setItem('tm-reconciled', '1');
        location.reload();
      }
    } catch {
      /* jsdom / no sessionStorage — selection still applied, just no reload */
    }
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
          adopt(srv);
          reloadOnce();
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
    if (disposed) return;
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
  }

  fetch('/api/progress', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((s: ServerProgress | null) => {
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
        // Another device wrote more recently -> adopt the server, re-render if it
        // changes what we currently show.
        const changed = !sameSet(serverMastered(s), local) || (!!s.theme && s.theme !== lget(KEY_T));
        adopt(s);
        if (changed) {
          reloadOnce();
          return;
        }
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
    .catch(() => {});

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    if (observer) observer.disconnect();
    if (onStorage) window.removeEventListener('storage', onStorage);
    if (onMastered) window.removeEventListener(MASTERED_CHANGE_EVENT, onMastered);
  };
}

/** Mounts the progress-sync loop once in the map screen. Renders nothing. */
export function MapSync() {
  useEffect(() => startMapSync(), []);
  return null;
}

export default MapSync;
