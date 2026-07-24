import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { sanitizeMastered, masteredCount, perLevel } from '@/src/lib/progress';
import { dnaSignature, perCategory } from '@/src/lib/dna';
import { furthestTier, TIER_NAME } from '@/src/lib/levels';
import { DancerCard } from '@/src/components/DancerCard';
import { TopNav } from '@/src/components/TopNav';

// Same rule as /u/[handle]: live DB read so a profile flipped to private
// never lingers in a static cache.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) return { title: 'Dancer not found — Tango Map' };
  const name = data.displayName ?? data.handle;
  const title = `${name}'s dancer card — Tango Map`;
  const description = `${masteredCount(data.mastered)}/62 mastered · ${dnaSignature(data.mastered)}.`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) notFound();

  const mastered = sanitizeMastered(data.mastered);
  const name = data.displayName ?? data.handle;
  const tier = furthestTier(perLevel(mastered));

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav />
        <DancerCard
          name={name}
          handle={data.handle}
          style={data.style}
          initial={(name.trim()[0] ?? '·').toUpperCase()}
          count={mastered.length}
          tierName={tier ? TIER_NAME[tier] : null}
          signature={dnaSignature(mastered)}
          dna={perCategory(mastered).map((c) => ({ label: c.label, pct: c.pct }))}
        />
        <div className="tm-cta-row" style={{ textAlign: 'center', borderTop: 0, paddingTop: 0 }}>
          <a className="tm-cta ghost" href={`/u/${encodeURIComponent(data.handle)}`}>
            ← Full profile
          </a>
        </div>
      </main>
    </div>
  );
}
