import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile, progress } from '@/db/schema';
import { sanitizeMastered } from '@/src/lib/progress';
import { dnaSignature } from '@/src/lib/dna';
import { ProfileSections } from '@/src/components/ProfileSections';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your profile — Tango Map' };

export default async function MePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const uid = session.user.id;

  const [prof, prog] = await Promise.all([
    db.query.profile.findFirst({ where: eq(profile.userId, uid) }),
    db.query.progress.findFirst({ where: eq(progress.userId, uid) }),
  ]);

  const mastered = sanitizeMastered(prog?.mastered ?? []);
  const signature = dnaSignature(mastered);
  const name = prof?.displayName ?? prof?.handle ?? session.user.name ?? 'You';
  const initial = (name.trim()[0] ?? '·').toUpperCase();
  const isPublic = prof?.isPublic ?? false;
  const handle = prof?.handle ?? null;

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <nav className="tm-top">
          <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
          <span className="tm-nav">
            <a className="tm-link" href="/">← The map</a>
            <a className="tm-link" href="/settings">Settings</a>
            <a className="tm-link" href="/signout">Sign out</a>
          </span>
        </nav>

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

        <div className="tm-callout">
          {mastered.length === 0 ? (
            <>
              You haven’t marked any skills yet — your Tango DNA fills in as you go.{' '}
              <a className="tm-link-inline" href="/">Open the map and start your climb →</a>
            </>
          ) : isPublic && handle ? (
            <>
              Your profile is live at <a className="tm-publink" href={`/u/${handle}`}>partykamap.vercel.app/u/{handle}</a>.
              {' '}
              <a className="tm-link-inline" href="/settings">Manage visibility →</a>
            </>
          ) : (
            <>
              This is your private view — only you can see it. <a className="tm-link-inline" href="/settings">Publish it in Settings →</a>
            </>
          )}
        </div>

        <ProfileSections mastered={mastered} />

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
