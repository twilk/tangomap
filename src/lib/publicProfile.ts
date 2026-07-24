import { cache } from 'react';
import { db } from '@/db';
import { profile, progress, progressHistory } from '@/db/schema';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { normalizeHandle } from '@/src/lib/handle';
import type { PublicProfile } from '@/src/lib/types';

/**
 * Look up a public profile by handle.
 * Returns null when no profile matches the (normalized) handle or the profile
 * is not public. Never exposes private fields (dates, `sel`, isPublic, userId).
 * Wrapped in React `cache` so a page and its `generateMetadata` share one query.
 */
export const getPublicProfile = cache(async (handle: string): Promise<PublicProfile | null> => {
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
});

export type CardData = PublicProfile & {
  /** Mint number: assigned once at profile creation (DB sequence), never recomputed. */
  serial: number;
  /** Year the profile was minted (season stamp). */
  mintedYear: number;
  /** Mastered set from the newest snapshot ≥30 days old, or null when no history reaches back that far. */
  ghostMastered: string[] | null;
};

/**
 * Everything the dancer-card page needs beyond the public profile: the minted
 * serial, the minted year, and the ≥30-day-old progress snapshot for the
 * growth "ghost" blob. Same privacy rule as getPublicProfile: null for missing
 * or private handles, no private fields out.
 */
export const getCardData = cache(async (handle: string): Promise<CardData | null> => {
  const h = normalizeHandle(handle);
  const row = await db.query.profile.findFirst({ where: eq(profile.handle, h) });
  if (!row || !row.isPublic) return null;

  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [progressRow, ghostRow] = await Promise.all([
    db.query.progress.findFirst({ where: eq(progress.userId, row.userId) }),
    db.query.progressHistory.findFirst({
      where: and(eq(progressHistory.userId, row.userId), lte(progressHistory.day, cutoff)),
      orderBy: (t, { desc }) => desc(t.day),
    }),
  ]);

  return {
    handle: row.handle!,
    displayName: row.displayName,
    style: row.style as PublicProfile['style'],
    mastered: progressRow?.mastered ?? [],
    // 0 only for rows minted before migration 0002 that somehow missed the
    // backfill — rendered as Nº 0000 rather than lying with a live count.
    serial: row.cardSerial ?? 0,
    mintedYear: row.createdAt.getUTCFullYear(),
    ghostMastered: ghostRow?.mastered ?? null,
  };
});

/**
 * Every public dancer, for the compare directory. Only ever the allow-listed
 * public fields; sorted strongest-first. Private profiles are excluded.
 */
export async function listPublicProfiles(limit = 60): Promise<PublicProfile[]> {
  const rows = await db
    .select({
      handle: profile.handle,
      displayName: profile.displayName,
      style: profile.style,
      mastered: progress.mastered,
    })
    .from(profile)
    .leftJoin(progress, eq(progress.userId, profile.userId))
    .where(and(eq(profile.isPublic, true), isNotNull(profile.handle)))
    .limit(limit);

  return rows
    .map((r) => ({
      handle: r.handle!,
      displayName: r.displayName,
      style: r.style as PublicProfile['style'],
      mastered: r.mastered ?? [],
    }))
    .sort((a, b) => b.mastered.length - a.mastered.length);
}
