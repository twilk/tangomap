import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { getCardData } from '@/src/lib/publicProfile';
import { sanitizeMastered, masteredCount, milestones, perLevel } from '@/src/lib/progress';
import { dnaSignature, perCategory } from '@/src/lib/dna';
import { recommend } from '@/src/lib/recommend';
import { furthestTier, TIER_NAME } from '@/src/lib/levels';
import { DancerCard } from '@/src/components/DancerCard';
import { TopNav } from '@/src/components/TopNav';

// Same rule as /u/[handle]: live DB read so a profile flipped to private
// never lingers in a static cache.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const data = await getCardData(handle);
  if (!data) return { title: 'Dancer not found — Tango Map' };
  const name = data.displayName ?? data.handle;
  const title = `${name}'s dancer card — Tango Map`;
  const description = `${masteredCount(data.mastered)}/62 mastered · ${dnaSignature(data.mastered)} · Nº ${String(data.serial).padStart(4, '0')}.`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getCardData(handle);
  if (!data) notFound();

  // Owner check drives the milestone confetti (celebrate your own card only).
  const session = await auth();
  let isOwner = false;
  if (session?.user?.id) {
    const own = await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) });
    isOwner = !!own?.handle && own.handle === data.handle;
  }

  const mastered = sanitizeMastered(data.mastered);
  const name = data.displayName ?? data.handle;
  const tier = furthestTier(perLevel(mastered));
  const toDna = (m: string[]) => perCategory(m).map((c) => ({ label: c.label, pct: c.pct }));
  // The ghost is only worth inking when the SET differs from today's — equal
  // counts can still hide swapped skills that change the blob's shape.
  const ghostMastered = data.ghostMastered ? sanitizeMastered(data.ghostMastered) : null;
  const masteredSet = new Set(mastered);
  const sameSet = ghostMastered !== null
    && ghostMastered.length === mastered.length
    && ghostMastered.every((s) => masteredSet.has(s));
  const ghost = ghostMastered && !sameSet ? toDna(ghostMastered) : null;

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav />
        <DancerCard
          name={name}
          handle={data.handle}
          style={data.style}
          count={mastered.length}
          tierName={tier ? TIER_NAME[tier] : null}
          tier={tier}
          signature={dnaSignature(mastered)}
          milestonesDone={milestones(mastered.length).length}
          serial={data.serial}
          mintedYear={data.mintedYear}
          isOwner={isOwner}
          dna={toDna(mastered)}
          ghostDna={ghost}
          recs={recommend(mastered, 3).map((r) => ({ name: r.name, label: r.label, level: r.level, reason: r.reason }))}
        />
        <div className="tm-cta-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', borderTop: 0, paddingTop: 0 }}>
          <a className="tm-cta" href={`/compare?a=${encodeURIComponent(data.handle)}`}>
            Compare with {isOwner ? 'another dancer' : 'me'} <span className="tm-ar" aria-hidden="true">→</span>
          </a>
          <a className="tm-cta ghost" href={`/u/${encodeURIComponent(data.handle)}`}>
            ← Full profile
          </a>
        </div>
      </main>
    </div>
  );
}
