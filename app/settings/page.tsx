import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import type { ProfileDTO } from '@/src/lib/types';
import SettingsForm from './SettingsForm';

export const metadata = {
  title: 'Settings — Tango Map',
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  // The client form PUTs changes to /api/profile. We seed it with an empty
  // default; the API is the source of truth once the user saves.
  const initial: ProfileDTO = {
    handle: null,
    isPublic: false,
    displayName: null,
    style: null,
  };

  return (
    <main>
      <h1>Settings</h1>
      <SettingsForm initial={initial} />
    </main>
  );
}
