import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile, progress } from '@/db/schema';
import type { ProfileDTO, Style } from '@/src/lib/types';
import { masteredCount } from '@/src/lib/progress';
import { TangoDNA } from '@/src/components/TangoDNA';
import SettingsForm from './SettingsForm';

export const metadata = {
  title: 'Settings — Tango Map',
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/api/auth/signin');
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
  const mastered = prog?.mastered ?? [];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      <p style={{ fontSize: '1.25rem', margin: '0 0 1rem' }}>
        <strong>{masteredCount(mastered)}</strong> / 62 mastered
      </p>
      <div style={{ margin: '0 0 2rem' }}>
        <TangoDNA mastered={mastered} />
      </div>

      <SettingsForm initial={initial} />
    </main>
  );
}
