import type { Metadata } from 'next';
import '@/app/tangomap.css';
import { TopNav } from '@/src/components/TopNav';
import { TangoMap } from '@/src/components/TangoMap';
import { MapSync } from '@/src/components/MapSync';

// The home route IS the source React map. It renders inside app/layout.tsx, so it
// inherits the no-flash THEME_SCRIPT, <ThemeSync/> and the --tm-* design tokens for
// free — a custom palette colours the map with no extra wiring. The shell is the
// full-viewport .tsm-page column: a flush TopNav (Map · Learn · account · theme,
// the destinations the bundle's injected auth pill used to provide) over the map,
// which carries its own header (search + Map/Explorer toggle). <MapSync/> is the
// React port of the bundle's progress-sync script — cross-device progress persistence.

export const metadata: Metadata = {
  title: 'Tango Map',
  description: 'An interactive skill map for Argentine tango — 62 techniques across 10 levels.',
};

export default function HomePage() {
  return (
    <div className="tm-profile tsm-page">
      <header className="tsm-topbar">
        <TopNav />
      </header>
      <TangoMap />
      <MapSync />
    </div>
  );
}
