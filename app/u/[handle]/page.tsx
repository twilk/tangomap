import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { sanitizeMastered, masteredCount } from '@/src/lib/progress';
import { dnaSignature } from '@/src/lib/dna';
import { ProfileSections } from '@/src/components/ProfileSections';
import { TopNav } from '@/src/components/TopNav';

// Live DB read: never statically cache, or a profile flipped to private would
// stay visible from the cache (a privacy leak) and progress would go stale.
export const dynamic = 'force-dynamic';

// Per-dancer title + description so shared /u/[handle] links read as the dancer,
// not the generic app. (getPublicProfile is cached, so this shares the page's query.)
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) return { title: 'Dancer not found — Tango Map' };
  const name = data.displayName ?? data.handle;
  const title = `${name} — Tango Map`;
  const description = `${name}'s Tango DNA: ${masteredCount(data.mastered)}/62 mastered · ${dnaSignature(data.mastered)}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'profile' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) notFound();

  // Is the viewer the owner of this handle? (drives a "this is your page" banner)
  const session = await auth();
  let isOwner = false;
  if (session?.user?.id) {
    const own = await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) });
    isOwner = !!own?.handle && own.handle === data.handle;
  }

  const mastered = sanitizeMastered(data.mastered);
  const signature = dnaSignature(mastered);
  const name = data.displayName ?? data.handle;
  const initial = (name.trim()[0] ?? '·').toUpperCase();

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav />

        {isOwner && (
          <div className="tm-owner">
            <span><span className="dot" aria-hidden="true" />You’re viewing your public profile — this is what others see.</span>
            <a className="tm-link-inline" href="/settings">Edit in Settings →</a>
          </div>
        )}

        <header className="tm-hero">
          <div className="tm-ava" aria-hidden="true">{initial}</div>
          <div className="tm-who">
            <h1>{name}</h1>
            <p className="tm-meta">
              <span>@{data.handle}</span>
              {data.style && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Style <b>{data.style}</b></span>
                </>
              )}
            </p>
            <p className="tm-sig">
              Signature — <b>{signature}</b>
            </p>
          </div>
        </header>

        <ProfileSections mastered={mastered} />

        <div className="tm-cta-row">
          <a className="tm-cta" href={`/compare?a=${encodeURIComponent(data.handle)}`}>
            Compare with another dancer <span className="tm-ar" aria-hidden="true">→</span>
          </a>
        </div>
      </main>
    </div>
  );
}
