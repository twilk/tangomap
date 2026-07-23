import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { sanitizeMastered } from '@/src/lib/progress';
import { dnaSignature } from '@/src/lib/dna';
import { ProfileSections } from '@/src/components/ProfileSections';

// Live DB read: never statically cache, or a profile flipped to private would
// stay visible from the cache (a privacy leak) and progress would go stale.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) notFound();

  const mastered = sanitizeMastered(data.mastered);
  const signature = dnaSignature(mastered);
  const name = data.displayName ?? data.handle;
  const initial = (name.trim()[0] ?? '·').toUpperCase();

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <nav className="tm-top">
          <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
          <span className="tm-nav">
            <a className="tm-link" href="/">← The map</a>
          </span>
        </nav>

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
