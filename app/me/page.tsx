import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile, progress } from '@/db/schema';
import { sanitizeMastered } from '@/src/lib/progress';
import { dnaSignature } from '@/src/lib/dna';
import { listPublicProfiles } from '@/src/lib/publicProfile';
import { ProfileSections } from '@/src/components/ProfileSections';
import { Recommendations } from '@/src/components/Recommendations';
import { PartnerMatches } from '@/src/components/PartnerMatches';
import { CopyButton } from '@/src/components/CopyButton';
import { TopNav } from '@/src/components/TopNav';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your profile — Tango Map' };

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const uid = session.user.id;

  const [prof, prog, dancers] = await Promise.all([
    db.query.profile.findFirst({ where: eq(profile.userId, uid) }),
    db.query.progress.findFirst({ where: eq(progress.userId, uid) }),
    listPublicProfiles(60),
  ]);

  const mastered = sanitizeMastered(prog?.mastered ?? []);
  const signature = dnaSignature(mastered);
  const name = prof?.displayName ?? prof?.handle ?? session.user.name ?? 'You';
  const initial = (name.trim()[0] ?? '·').toUpperCase();
  const isPublic = prof?.isPublic ?? false;
  const handle = prof?.handle ?? null;
  // Prefill compare with the viewer only when their profile is public (a private
  // handle wouldn't resolve on /compare); also excludes the viewer from candidates.
  const meHandle = isPublic && handle ? handle : null;

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav>
          <a className="tm-link" href="/settings">Settings</a>
          <a className="tm-link" href="/signout">Sign out</a>
        </TopNav>

        <header className="tm-hero">
          <div className="tm-ava" aria-hidden="true">{initial}</div>
          <div className="tm-who">
            <h1>{name}</h1>
            <p className="tm-meta">
              {handle ? <span>@{handle}</span> : <span>No handle yet</span>}
              {prof?.style && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Style <b>{prof.style}</b></span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className={isPublic ? 'tm-tag on' : 'tm-tag'}>{isPublic ? 'Public' : 'Private'}</span>
            </p>
            <p className="tm-sig">
              Signature — <b>{signature}</b>
            </p>
          </div>
        </header>

        {mastered.length === 0 ? (
          <div className="tm-callout">
            You haven’t marked any skills yet — your Tango DNA fills in as you go.{' '}
            <a className="tm-link-inline" href="/">Open the map and start your climb →</a>
          </div>
        ) : isPublic && handle ? (
          <section className="tm-share" aria-label="Share your profile">
            <a className="tm-ogthumb" href={`/u/${handle}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG route, not a static asset */}
              <img src={`/u/${handle}/opengraph-image`} alt={`Share card for @${handle}`} loading="lazy" width={1200} height={630} />
            </a>
            <div className="tm-share-body">
              <div className="tm-share-label">Your profile is live — share your DNA</div>
              <div className="tm-share-url num">partykamap.vercel.app/u/{handle}</div>
              <div className="tm-share-actions">
                <CopyButton text={`https://partykamap.vercel.app/u/${handle}`} label="Copy link" />
                <a className="tm-cta ghost" href={`/u/${handle}`}>Open <span className="tm-ar" aria-hidden="true">→</span></a>
                <a className="tm-link-inline" href="/settings">Manage visibility →</a>
              </div>
            </div>
          </section>
        ) : (
          <div className="tm-callout">
            This is your private view — only you can see it. <a className="tm-link-inline" href="/settings">Publish it in Settings →</a>
          </div>
        )}

        {mastered.length > 0 && <Recommendations mastered={mastered} />}

        <ProfileSections mastered={mastered} />

        {mastered.length > 0 && <PartnerMatches mastered={mastered} meHandle={meHandle} dancers={dancers} />}

        {handle && (
          <div className="tm-cta-row">
            <a className="tm-cta" href={`/compare?a=${encodeURIComponent(handle)}`}>
              Compare with another dancer <span className="tm-ar" aria-hidden="true">→</span>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
