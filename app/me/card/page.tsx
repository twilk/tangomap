import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';

export const dynamic = 'force-dynamic';

/**
 * "My card" (PWA shortcut target): bounce to the signed-in dancer's public
 * card, or to the place where they can get one (settings → handle/public,
 * signin → account).
 */
export default async function MyCardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const own = await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) });
  if (!own?.handle || !own.isPublic) redirect('/settings');
  redirect(`/u/${encodeURIComponent(own.handle)}/card`);
}
