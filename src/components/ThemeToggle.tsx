'use client';

import { useEffect, useRef } from 'react';

// Lucide sun / moon (same 24-grid, 2px stroke as the category icons).
const SUN =
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
const MOON = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/**
 * Light/dark toggle shared by every app screen. It writes the same
 * localStorage key (`tsm-theme`) the map bundle reads, so one control drives
 * both worlds and the choice persists across every page load (the no-flash
 * script in layout.tsx applies it before first paint).
 *
 * Both icons always render; CSS shows the correct one for the current
 * `data-theme`, so there is no hydration mismatch and no first-paint flash.
 */
export function ThemeToggle() {
  const ref = useRef<HTMLButtonElement>(null);

  // Post-mount only: reflect the actual theme into the label (server can't know it).
  const relabel = () => {
    const el = ref.current;
    if (!el) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const label = `Switch to ${dark ? 'light' : 'dark'} theme`;
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
  };
  useEffect(relabel, []);

  const toggle = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('tsm-theme', next);
    } catch {
      /* private mode / storage disabled — theme still applies for this page */
    }
    relabel();
  };

  return (
    <button ref={ref} type="button" className="tm-themebtn" onClick={toggle} aria-label="Toggle light and dark theme">
      <span className="tm-sun" dangerouslySetInnerHTML={{ __html: svg(SUN) }} />
      <span className="tm-moon" dangerouslySetInnerHTML={{ __html: svg(MOON) }} />
    </button>
  );
}
