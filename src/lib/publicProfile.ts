import { cache } from 'react';
import { db } from '@/db';
import { profile, progress, progressHistory, themePreset } from '@/db/schema';
import { and, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { normalizeHandle } from '@/src/lib/handle';
import { parseTheme, type Theme } from '@/src/lib/theme';
import type { CommunityTheme, PublicProfile } from '@/src/lib/types';

/**
 * The raw profile row for an ALREADY-normalized handle, loaded at most once per
 * request (React `cache`). getPublicProfile and getSharedTheme both route through
 * this with the same normalized key, so a /u/[handle] view that needs both hits the
 * profile row a single time instead of twice. Callers must normalize first so the
 * cache key is shared.
 */
const profileRowByHandle = cache((normalizedHandle: string) =>
  db.query.profile.findFirst({ where: eq(profile.handle, normalizedHandle) }),
);

/**
 * Look up a public profile by handle.
 * Returns null when no profile matches the (normalized) handle or the profile
 * is not public. Never exposes private fields (dates, `sel`, isPublic, userId).
 * Wrapped in React `cache` so a page and its `generateMetadata` share one query.
 */
export const getPublicProfile = cache(async (handle: string): Promise<PublicProfile | null> => {
  const h = normalizeHandle(handle);
  const row = await profileRowByHandle(h);
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
 * The active theme a dancer's compare half renders in: their `profile.customTheme`,
 * re-validated through `parseTheme` (the trust boundary for stored, untrusted seeds).
 * Gated only on reachability — `isPublic` — NOT on `cardUsesCustomTheme`: compare is
 * its own surface, so a public dancer's active theme drives their half regardless of
 * the card toggle. Returns null for a missing/private profile, or one with no theme /
 * a stored theme that no longer clears the legibility floor. Routes through the same
 * cached `profileRowByHandle`, so a compare page needing several getters hits each
 * profile row once.
 */
export const getCompareTheme = cache(async (handle: string): Promise<Theme | null> => {
  const h = normalizeHandle(handle);
  const row = await profileRowByHandle(h);
  if (!row || !row.isPublic) return null;
  return parseTheme(row.customTheme);
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

/**
 * The community gallery read model: every shared preset whose author is public and
 * has a handle, newest first. Gated three ways at the DB (preset.isShared AND
 * profile.isPublic AND a non-null handle) and re-validated per row through parseTheme
 * — a stored seed that no longer clears the legibility floor is dropped, never
 * returned. Only the allow-listed public fields leave in the DTO; no userId, no dates.
 *
 * The privacy flags (isShared, isPublic) are also SELECTed and re-checked in JS below
 * — defense in depth. The SQL WHERE is the primary gate, but it's invisible to a
 * mocked-`db.select` unit test; the JS gate makes the invariant testable and survives a
 * regression that weakens the query. The flags never appear in the returned shape.
 */
export async function getCommunityThemes(limit = 60): Promise<CommunityTheme[]> {
  const rows = await db
    .select({
      id: themePreset.id,
      name: themePreset.name,
      seeds: themePreset.seeds,
      isShared: themePreset.isShared,
      isPublic: profile.isPublic,
      authorHandle: profile.handle,
      authorDisplayName: profile.displayName,
    })
    .from(themePreset)
    .innerJoin(profile, eq(profile.userId, themePreset.userId))
    .where(and(eq(themePreset.isShared, true), eq(profile.isPublic, true), isNotNull(profile.handle)))
    .orderBy(desc(themePreset.updatedAt))
    .limit(limit);

  return rows.flatMap((r) => {
    // Second line of defense: enforce the gate in JS too, before parsing/shaping.
    if (!r.isShared || !r.isPublic || !r.authorHandle) return [];
    const seeds = parseTheme(r.seeds);
    return seeds
      ? [{ id: r.id, name: r.name, seeds, authorHandle: r.authorHandle, authorDisplayName: r.authorDisplayName }]
      : [];
  });
}

/**
 * The one theme a single public dancer shares, for the "apply their theme" affordance
 * on /u/[handle]. Coupled to isPublic: a private profile (or one without a handle, or
 * with no shared preset, or whose shared seeds no longer validate) returns null. Seeds
 * pass parseTheme on read — the same trust boundary the gallery uses.
 */
export async function getSharedTheme(handle: string): Promise<{
  name: string;
  seeds: Theme;
  authorHandle: string;
  authorDisplayName: string | null;
} | null> {
  const h = normalizeHandle(handle);
  const prof = await profileRowByHandle(h);
  if (!prof || !prof.isPublic || !prof.handle) return null;

  const row = await db.query.themePreset.findFirst({
    where: and(eq(themePreset.userId, prof.userId), eq(themePreset.isShared, true)),
  });
  if (!row) return null;

  const seeds = parseTheme(row.seeds);
  if (!seeds) return null;

  return { name: row.name, seeds, authorHandle: prof.handle, authorDisplayName: prof.displayName };
}
