'use client';

import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import '@/src/styles/wiring.css';

/**
 * The "back one level" control in the top bar.
 *
 * Every screen passes the *logical parent* as `fallback`, and the pill renders
 * as a real `<a href={fallback}>` — so it has a hover URL, opens in a new tab
 * with ⌘/ctrl-click, and still works with JS off.
 *
 * On a plain left click we prefer real history: going back returns the dancer
 * to the exact scroll position and query they came from, which the parent URL
 * can't reproduce. That is only safe when there *is* somewhere to go back to
 * (`history.length > 1`) and the previous document was ours (`document.referrer`
 * same-origin) — otherwise back would leave the app entirely (a deep link
 * opened from Instagram, say, would bounce the visitor out), so we push the
 * fallback instead.
 */
export function BackLink({ fallback, label = 'Go back' }: { fallback: string; label?: string }) {
  const router = useRouter();

  // Same-origin referrer means the previous entry in this tab's history is a
  // page of ours. An empty referrer (fresh tab, QR scan, pasted link) is not.
  const canGoBack = () => {
    if (typeof window === 'undefined') return false;
    if (window.history.length <= 1) return false;
    const ref = document.referrer;
    if (!ref) return false;
    try {
      return new URL(ref).origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks (new tab / window / download) to the browser.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (canGoBack()) router.back();
    else router.push(fallback);
  };

  return (
    <a className="tm-link tm-back" href={fallback} aria-label={label} title={label} onClick={onClick}>
      <span aria-hidden="true">←</span>
    </a>
  );
}
