import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import type { Style } from '@/src/lib/types';
import SettingsForm, { type ProfileFields } from './SettingsForm';
import ThemeEditor from './ThemeEditor';
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

  const initial: ProfileFields = {
    handle: prof?.handle ?? null,
    isPublic: prof?.isPublic ?? false,
    displayName: prof?.displayName ?? null,
    style: (prof?.style as Style | null) ?? null,
  };

  return (
    <div className="tm-profile">
      <main className="tm-wrap">
        <TopNav back="/me" />

        <h1 className="tm-h1">Settings</h1>
        <p className="tm-lead">Your handle, display name and style — and whether your profile is public. Publishing is off until you switch it on.</p>

        <section className="tm-sec" style={{ marginTop: '26px' }}>
          <h2 className="tm-sh">Profile &amp; privacy</h2>
          <SettingsForm initial={initial} />
        </section>

        <section className="tm-sec">
          <h2 className="tm-sh">Theme</h2>
          <p className="tm-lead" style={{ marginTop: '-6px' }}>Pick four colours; the app checks they stay legible, then themes everything to match. Only you see it — until you share it.</p>
          <ThemeEditor isPublic={initial.isPublic} handle={initial.handle} />
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
