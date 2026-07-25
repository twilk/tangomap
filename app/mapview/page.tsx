import type { Metadata } from 'next';
import '@/app/tangomap.css';
import { TopNav } from '@/src/components/TopNav';
import { TangoMap } from '@/src/components/TangoMap';

// TEMPORARY preview route for the source React map (whole-map view). It exists
// only so this phase can be verified live; `/` still serves the legacy bundle.
// Later phases add the detail panel, search, explorer and category filter, at
// which point this becomes the real map screen.

export const metadata: Metadata = {
  title: 'Map (preview) — Tango Map',
  description: 'Preview of the source React whole-map view.',
};

export default function MapViewPage() {
  return (
    <div className="tm-profile tsm-page">
      <header className="tsm-topbar">
        <TopNav back="/" />
      </header>
      <TangoMap />
    </div>
  );
}
