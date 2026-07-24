'use client';

import { useEffect, useRef } from 'react';
import { cycleMode, hasCustomTheme, type Mode } from '@/src/lib/customTheme';

// Lucide sun / moon / droplet (same 24-grid, 2px stroke as the category icons). The
// droplet stands in for the custom "swatch" — a hand-mixed palette.
const SUN =
  '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
const MOON = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
const SWATCH = '<path d="M12 3c3.5 4 5.5 6.9 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.9 8.5 7 12 3Z"/>';
const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

/** The next theme the toggle would move to from `cur`, mirroring cycleMode's order:
 *  dark → light → (custom, if configured) → dark. Kept in lock-step with cycleMode so
 *  the label always names the button's actual destination. */
function nextOf(cur: string | null, hasCustom: boolean): Mode {
  if (cur === 'dark') return 'light';
  if (cur === 'custom') return 'dark';
  return hasCustom ? 'custom' : 'dark';
}

/**
 * Theme toggle shared by every app screen. It writes the same localStorage key
 * (`tsm-theme`) the map bundle reads, so one control drives both worlds and the
 * choice persists across every page load (the no-flash script in layout.tsx applies
 * it before first paint). Clicking cycles dark → light → custom (custom only once a
 * custom theme is configured) via cycleMode().
 *
 * All three icons always render; CSS shows the correct one for the current
 * `data-theme`, so there is no hydration mismatch and no first-paint flash.
 */
export function ThemeToggle() {
  const ref = useRef<HTMLButtonElement>(null);

  // Post-mount only: name the NEXT theme in the cycle (server can't know the mode).
  const relabel = () => {
    const el = ref.current;
    if (!el) return;
    const cur = document.documentElement.getAttribute('data-theme');
    const label = `Switch to ${nextOf(cur, hasCustomTheme())} theme`;
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
  };
  useEffect(relabel, []);

  const toggle = () => {
    cycleMode();
    relabel();
  };

  return (
    <button ref={ref} type="button" className="tm-themebtn" onClick={toggle} aria-label="Cycle theme">
      <span className="tm-sun" dangerouslySetInnerHTML={{ __html: svg(SUN) }} />
      <span className="tm-moon" dangerouslySetInnerHTML={{ __html: svg(MOON) }} />
      <span className="tm-swatch" dangerouslySetInnerHTML={{ __html: svg(SWATCH) }} />
    </button>
  );
}
