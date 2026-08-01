import { cache } from 'react';
import { db } from '@/db';
import { profile, progress, progressHistory, themePreset } from '@/db/schema';
import { and, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { normalizeHandle } from '@/src/lib/handle';
import { parseTheme, type Theme } from '@/src/lib/theme';
import { isMissingTable } from '@/src/lib/dbSafe';
import { STARTER_COMMUNITY_THEMES } from '@/src/lib/communityStarters';
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
  /** The owner's custom theme to render the card in — ONLY when they opted the card
   *  in (cardUsesCustomTheme) AND the stored struct re-validates. Null = frozen default. */
  customTheme: Theme | null;
  /** Epoch ms of the theme's last write, used to cache-bust the OG image. Null unless
   *  a customTheme is emitted. */
  customThemeUpdatedAt: number | null;
};

/**
 * Everything the dancer-card page needs beyond the public profile: the minted
 * serial, the minted year, and the ≥30-day-old progress snapshot for the
 * growth "ghost" blob. Same privacy rule as getPublicProfile: null for missing
 * or private handles, no private fields out.
 */
export const getCardData = cache(async (handle: string): Promise<CardData | null> => {
  const h = normalizeHandle(handle);
  const row = await profileRowByHandle(h);
  if (!row || !row.isPublic) return null;

  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [progressRow, ghostRow] = await Promise.all([
    db.query.progress.findFirst({ where: eq(progress.userId, row.userId) }),
    db.query.progressHistory.findFirst({
      where: and(eq(progressHistory.userId, row.userId), lte(progressHistory.day, cutoff)),
      orderBy: (t, { desc }) => desc(t.day),
    }),
  ]);

  // Gate on the opt-in AND re-validate the untrusted JSONB through parseTheme
  // (the trust boundary), so a malformed stored struct can never reach the card.
  // The clock only exists when a theme actually made it out.
  const customTheme = row.cardUsesCustomTheme ? parseTheme(row.customTheme) : null;
  const customThemeUpdatedAt =
    customTheme && row.customThemeUpdatedAt ? row.customThemeUpdatedAt.getTime() : null;

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
    customTheme,
    customThemeUpdatedAt,
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
 * Resolve a mint serial (the L2 AR marker id) back to its public handle. Same
 * privacy rule as the rest of this module: null for a missing serial or a
 * private profile, so a scanned marker can never surface a private card.
 */
export const getHandleBySerial = cache(async (serial: number): Promise<string | null> => {
  if (!Number.isInteger(serial) || serial <= 0) return null;
  const row = await db.query.profile.findFirst({
    where: and(eq(profile.cardSerial, serial), eq(profile.isPublic, true)),
  });
  return row?.handle ?? null;
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
 * The community gallery read model: the curated starters first, then every shared
 * preset whose author has a handle, newest first. Sharing is decoupled from isPublic —
 * a dancer can contribute a theme without publishing their DNA page — so the gate is
 * two ways at the DB (preset.isShared AND a non-null handle) and re-validated per row
 * through parseTheme; a stored seed that no longer clears the legibility floor is
 * dropped, never returned. Only the allow-listed public fields leave in the DTO; no
 * userId, no dates. The STARTER_COMMUNITY_THEMES are prepended so the gallery is never
 * empty on day one.
 *
 * The isShared flag is also SELECTed and re-checked in JS below — defense in depth. The
 * SQL WHERE is the primary gate, but it's invisible to a mocked-`db.select` unit test;
 * the JS gate makes the invariant testable and survives a regression that weakens the
 * query. The flag never appears in the returned shape.
 */
export async function getCommunityThemes(limit = 60): Promise<CommunityTheme[]> {
  // Deploy-safe: theme_preset ships before migration 0004 runs. While the table is
  // absent Postgres raises 42P01 — degrade to a starters-only gallery rather than 500.
  // Every OTHER error is a real fault and re-throws.
  let rows: Array<{
    id: string;
    name: string;
    seeds: unknown;
    isShared: boolean;
    authorHandle: string | null;
    authorDisplayName: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        id: themePreset.id,
        name: themePreset.name,
        seeds: themePreset.seeds,
        isShared: themePreset.isShared,
        authorHandle: profile.handle,
        authorDisplayName: profile.displayName,
      })
      .from(themePreset)
      .innerJoin(profile, eq(profile.userId, themePreset.userId))
      .where(and(eq(themePreset.isShared, true), isNotNull(profile.handle)))
      .orderBy(desc(themePreset.updatedAt))
      .limit(limit);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    // fall through with the empty `rows` — the starters still ship below.
  }

  const live = rows.flatMap((r) => {
    // Second line of defense: enforce the gate in JS too, before parsing/shaping.
    if (!r.isShared || !r.authorHandle) return [];
    const seeds = parseTheme(r.seeds);
    return seeds
      ? [{ id: r.id, name: r.name, seeds, authorHandle: r.authorHandle, authorDisplayName: r.authorDisplayName }]
      : [];
  });

  // Starters first, so the gallery leads with something tasteful even before any dancer shares.
  return [...STARTER_COMMUNITY_THEMES, ...live];
}

/**
 * The one theme a single dancer shares, for the "apply their theme" affordance on
 * /u/[handle]. Decoupled from isPublic (matching the gallery): any handle'd author's
 * shared preset resolves — a profile without a handle, with no shared preset, or whose
 * shared seeds no longer validate returns null. Seeds pass parseTheme on read — the same
 * trust boundary the gallery uses. (The /u/[handle] page is itself isPublic-gated via
 * getPublicProfile, so this only ever runs for a reachable page; the decoupling matters
 * for the gallery, which surfaces handle'd-but-private authors.)
 */
export async function getSharedTheme(handle: string): Promise<{
  name: string;
  seeds: Theme;
  authorHandle: string;
  authorDisplayName: string | null;
} | null> {
  const h = normalizeHandle(handle);
  const prof = await profileRowByHandle(h);
  if (!prof || !prof.handle) return null;

  // Deploy-safe: theme_preset ships before migration 0004. While the table is absent
  // Postgres raises 42P01 — this is the query that would otherwise 500 the
  // server-rendered /u/[handle] page, so degrade to "no shared theme". Real faults
  // (any other error) still propagate.
  let row;
  try {
    row = await db.query.themePreset.findFirst({
      where: and(eq(themePreset.userId, prof.userId), eq(themePreset.isShared, true)),
    });
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
  if (!row) return null;

  const seeds = parseTheme(row.seeds);
  if (!seeds) return null;

  return { name: row.name, seeds, authorHandle: prof.handle, authorDisplayName: prof.displayName };
}
