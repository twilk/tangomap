import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

/**
 * The shared top bar for every app screen: brand · "← The map" · any
 * page-specific links (passed as children) · the theme toggle. Centralising it
 * here guarantees the light/dark control appears on every page and stays
 * consistent. The map bundle keeps its own header toggle; both write the same
 * `tsm-theme` key, so the setting is unified across the whole app.
 */
export function TopNav({ children }: { children?: ReactNode }) {
  return (
    <nav className="tm-top">
      <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
      <span className="tm-nav">
        <a className="tm-link" href="/">← The map</a>
        <a className="tm-link" href="/skills">Learn</a>
        {children}
        <ThemeToggle />
      </span>
    </nav>
  );
}
