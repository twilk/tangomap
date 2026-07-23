import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile, progress } from '@/db/schema';
import type { ProfileDTO, Style } from '@/src/lib/types';
import { masteredCount, milestones, sanitizeMastered } from '@/src/lib/progress';
import { perCategory, topStrengths } from '@/src/lib/dna';
import { DnaRadar } from '@/src/components/DnaRadar';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Settings — Tango Map',
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }
  const uid = session.user.id;

  const [prof, prog] = await Promise.all([
    db.query.profile.findFirst({ where: eq(profile.userId, uid) }),
    db.query.progress.findFirst({ where: eq(progress.userId, uid) }),
  ]);

  const initial: ProfileDTO = {
    handle: prof?.handle ?? null,
    isPublic: prof?.isPublic ?? false,
    displayName: prof?.displayName ?? null,
    style: (prof?.style as Style | null) ?? null,
  };
  const mastered = sanitizeMastered(prog?.mastered ?? []);
  const count = masteredCount(mastered);
  const cats = perCategory(mastered);
  const strong = topStrengths(mastered, 1)[0];
  const badges = milestones(count).length;

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <nav className="tm-top">
          <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
          <span className="tm-nav">
            <a className="tm-link" href="/">← The map</a>
            {initial.isPublic && initial.handle && (
              <a className="tm-link" href={`/u/${initial.handle}`}>View public</a>
            )}
            <a className="tm-link" href="/api/auth/signout">Sign out</a>
          </span>
        </nav>

        <h1 className="tm-h1">Your cockpit</h1>
        <p className="tm-lead">Read your own Tango DNA, then decide who else gets to. Publishing is off until you switch it on.</p>

        <div className="tm-strip" style={{ marginTop: '22px' }}>
          <div className="tm-s">
            <div className="tm-k">Mastered</div>
            <div className="tm-v">
              {count}
              <small>/62</small>
            </div>
          </div>
          <div className="tm-s">
            <div className="tm-k">Strongest</div>
            <div className="tm-v tm-sm">{strong ? strong.label : '—'}</div>
          </div>
          <div className="tm-s">
            <div className="tm-k">Milestones</div>
            <div className="tm-v">
              {badges}
              <small>/4</small>
            </div>
          </div>
          <div className="tm-s">
            <div className="tm-k">Visibility</div>
            <div className="tm-v tm-sm">{initial.isPublic ? 'Public' : 'Private'}</div>
          </div>
        </div>

        <section className="tm-sec">
          <h2 className="tm-sh">Your Tango DNA</h2>
          <DnaRadar categories={cats} />
        </section>

        <section className="tm-sec">
          <h2 className="tm-sh">Profile &amp; privacy</h2>
          <SettingsForm initial={initial} />
        </section>
      </main>
    </div>
  );
}
