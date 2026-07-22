import { db } from '@/db';
import { profile, progress } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { normalizeHandle } from '@/src/lib/handle';
import type { PublicProfile } from '@/src/lib/types';

/**
 * Look up a public profile by handle.
 * Returns null when no profile matches the (normalized) handle or the profile
 * is not public. Never exposes private fields (dates, `sel`, isPublic, userId).
 */
export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const h = normalizeHandle(handle);
  const row = await db.query.profile.findFirst({ where: eq(profile.handle, h) });
  if (!row || !row.isPublic) return null;

  const progressRow = await db.query.progress.findFirst({
    where: eq(progress.userId, row.userId),
  });

  return {
    handle: row.handle!,
    displayName: row.displayName,
    style: row.style as PublicProfile['style'],
    mastered: progressRow?.mastered ?? [],
  };
}
