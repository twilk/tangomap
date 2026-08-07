/**
 * Client-side emitter for the two browser-reachable event names.
 *
 * Fire-and-forget by design: telemetry must never delay, block or fail a user
 * interaction, and the caller has nothing useful to do with the outcome. Prefers
 * `sendBeacon` so an event survives the page being closed mid-navigation — a
 * skill_page_view that only lands when the reader stays is a biased sample.
 *
 * Same-origin only: the path is a bare '/api/events', never an absolute URL, so
 * nothing can be pointed at a third party by configuration mistake.
 */
import type { EventName } from '@/src/lib/events';

/** The only two names a browser may emit; the server enforces this again. */
type ClientEvent = Extract<EventName, 'invite_copied' | 'skill_page_view'>;

export function track(name: ClientEvent, payload?: { slug?: string; props?: Record<string, string | number | boolean> }): void {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({ name, ...payload });
  try {
    // Beacon first: survives unload, and the browser schedules it off the critical path.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      if (ok) return;
    }
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  } catch {
    /* private mode, blocked beacon, no fetch — telemetry is never worth an error */
  }
}
