import type { Metadata } from 'next';
import { ArScan } from '@/src/components/ArScan';

export const metadata: Metadata = {
  title: 'Scan a card — Tango Map',
  description: 'Point your camera at a presented card to see it in AR.',
};

// The scanner is a live camera experience — no data to prerender.
export const dynamic = 'force-static';

export default function Page() {
  return <ArScan />;
}
