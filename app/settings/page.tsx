import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import type { ProfileDTO, Style } from '@/src/lib/types';
import SettingsForm from './SettingsForm';
import { DeleteAccount } from '@/src/components/DeleteAccount';
import { TopNav } from '@/src/components/TopNav';

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

  const prof = await db.query.profile.findFirst({ where: eq(profile.userId, uid) });

  const initial: ProfileDTO = {
    handle: prof?.handle ?? null,
    isPublic: prof?.isPublic ?? false,
    displayName: prof?.displayName ?? null,
    style: (prof?.style as Style | null) ?? null,
  };

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav>
          <a className="tm-link" href="/me">Profile</a>
          <a className="tm-link" href="/signout">Sign out</a>
        </TopNav>

        <h1 className="tm-h1">Settings</h1>
        <p className="tm-lead">Your handle, display name and style — and whether your profile is public. Publishing is off until you switch it on.</p>

        <section className="tm-sec" style={{ marginTop: '26px' }}>
          <h2 className="tm-sh">Profile &amp; privacy</h2>
          <SettingsForm initial={initial} />
        </section>

        <div className="tm-cta-row">
          <a className="tm-cta" href="/me">
            View your profile <span className="tm-ar" aria-hidden="true">→</span>
          </a>
        </div>

        <section className="tm-sec">
          <h2 className="tm-sh danger">Danger zone</h2>
          <DeleteAccount />
        </section>
      </main>
    </div>
  );
}
