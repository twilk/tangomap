import { describe, test, expect, beforeEach, vi } from 'vitest';

// --- Mock @/db: findFirst queries + the db.select(...) chain the community read
// model uses (theme_preset ⨝ profile). ---
const profileFindFirst = vi.fn();
const progressFindFirst = vi.fn();
const themePresetFindFirst = vi.fn();
const dbSelect = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      profile: { findFirst: (...args: unknown[]) => profileFindFirst(...args) },
      progress: { findFirst: (...args: unknown[]) => progressFindFirst(...args) },
      themePreset: { findFirst: (...args: unknown[]) => themePresetFindFirst(...args) },
    },
    select: (...args: unknown[]) => dbSelect(...args),
  },
}));

async function load() {
  return import('@/src/lib/publicProfile');
}

// The curated starters are prepended to every gallery read — imported here so the
// tests assert on the real data, not a copy.
import { STARTER_COMMUNITY_THEMES } from '@/src/lib/communityStarters';
const STARTER_IDS = STARTER_COMMUNITY_THEMES.map((t) => t.id);
const N_STARTERS = STARTER_COMMUNITY_THEMES.length;

/** A chainable db.select(...) stub that resolves to `rows` when `.limit()` is called,
 *  mirroring select().from().innerJoin().where().orderBy().limit(). */
function selectResolving(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = self;
  chain.innerJoin = self;
  chain.where = self;
  chain.orderBy = self;
  chain.limit = () => Promise.resolve(rows);
  return chain;
}

// A legible four-seed theme (ink/ground ≥ 4.5, accents ≥ 3) — parseTheme accepts it.
const THEME = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
// Sub-AA seeds — parseTheme rejects them (drops the row on read).
const BAD_THEME = { v: 1, ground: '#000000', ink: '#111111', accent: '#222222', accent2: '#333333' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublicProfile', () => {
  test('(a) unknown handle → null', async () => {
    profileFindFirst.mockResolvedValue(undefined);
    const { getPublicProfile } = await load();
    expect(await getPublicProfile('nobody')).toBeNull();
    // no progress lookup when there is no profile
    expect(progressFindFirst).not.toHaveBeenCalled();
  });

  test('(b) private profile → null', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'priv',
      isPublic: false,
      displayName: 'Priv',
      style: 'salon',
    });
    const { getPublicProfile } = await load();
    expect(await getPublicProfile('priv')).toBeNull();
  });

  test('(c) public profile → PublicProfile with mastered from the progress row', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'ana',
      isPublic: true,
      displayName: 'Ana',
      style: 'nuevo',
    });
    progressFindFirst.mockResolvedValue({
      userId: 'u1',
      mastered: ['mirada-cabeceo', 'posture', 'embrace'],
    });

    const { getPublicProfile } = await load();
    // handle is normalized (lower/trim) before lookup
    const result = await getPublicProfile('  ANA  ');

    expect(result).toEqual({
      handle: 'ana',
      displayName: 'Ana',
      style: 'nuevo',
      mastered: ['mirada-cabeceo', 'posture', 'embrace'],
    });
    // mastered equals exactly the mocked progress row's mastered
    expect(result?.mastered).toEqual(['mirada-cabeceo', 'posture', 'embrace']);
  });

  test('(c2) public profile with no progress row → mastered defaults to []', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u2',
      handle: 'bob',
      isPublic: true,
      displayName: null,
      style: null,
    });
    progressFindFirst.mockResolvedValue(undefined);

    const { getPublicProfile } = await load();
    const result = await getPublicProfile('bob');
    expect(result).toEqual({ handle: 'bob', displayName: null, style: null, mastered: [] });
  });

  test('(d) masteredCount on the result is correct', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'ana',
      isPublic: true,
      displayName: 'Ana',
      style: 'nuevo',
    });
    progressFindFirst.mockResolvedValue({
      userId: 'u1',
      mastered: ['mirada-cabeceo', 'posture', 'embrace'],
    });

    const { getPublicProfile } = await load();
    const { masteredCount } = await import('@/src/lib/progress');
    const result = await getPublicProfile('ana');

    expect(result).not.toBeNull();
    expect(masteredCount(result!.mastered)).toBe(3);
  });
});

describe('getCommunityThemes', () => {
  test('the 3 curated starters are always present and come FIRST, then the live shared themes', async () => {
    dbSelect.mockReturnValue(
      selectResolving([
        { id: 'p1', name: 'Carmesí', seeds: THEME, isShared: true, authorHandle: 'ana', authorDisplayName: 'Ana' },
      ]),
    );
    const { getCommunityThemes } = await load();
    const list = await getCommunityThemes();

    expect(list).toHaveLength(N_STARTERS + 1);
    expect(list.slice(0, N_STARTERS).map((t) => t.id)).toEqual(STARTER_IDS);
    expect(list[N_STARTERS].id).toBe('p1');
  });

  test('shapes valid rows and drops a malformed-seed one (re-validated through parseTheme)', async () => {
    dbSelect.mockReturnValue(
      selectResolving([
        { id: 'p1', name: 'Carmesí', seeds: THEME, isShared: true, authorHandle: 'ana', authorDisplayName: 'Ana' },
        { id: 'p2', name: 'Rotten', seeds: BAD_THEME, isShared: true, authorHandle: 'bob', authorDisplayName: null },
      ]),
    );
    const { getCommunityThemes } = await load();
    const live = (await getCommunityThemes()).slice(N_STARTERS);

    // The rotten row is dropped; the good one is shaped as CommunityTheme.
    expect(live).toHaveLength(1);
    expect(live[0]).toEqual({
      id: 'p1',
      name: 'Carmesí',
      seeds: THEME,
      authorHandle: 'ana',
      authorDisplayName: 'Ana',
    });
    // The privacy flags are NOT leaked into the DTO.
    expect(live[0]).not.toHaveProperty('isShared');
    expect(live[0]).not.toHaveProperty('isPublic');
    expect(dbSelect).toHaveBeenCalledTimes(1);
  });

  test('a shared theme from a NON-PUBLIC author WITH a handle IS listed (gate no longer requires isPublic)', async () => {
    dbSelect.mockReturnValue(
      selectResolving([
        { id: 'priv', name: 'Private author', seeds: THEME, isShared: true, isPublic: false, authorHandle: 'bob', authorDisplayName: 'Bob' },
      ]),
    );
    const { getCommunityThemes } = await load();
    const live = (await getCommunityThemes()).slice(N_STARTERS);
    expect(live.map((t) => t.id)).toEqual(['priv']);
  });

  test('JS gate (defense-in-depth): from a MIXED set only shared+handle rows survive (no isPublic requirement)', async () => {
    dbSelect.mockReturnValue(
      selectResolving([
        // shared + handle — survives, regardless of isPublic
        { id: 'ok', name: 'Keeper', seeds: THEME, isShared: true, isPublic: false, authorHandle: 'ana', authorDisplayName: 'Ana' },
        // NON-shared — a regression dropping eq(themePreset.isShared,true) must still not leak this
        { id: 'unshared', name: 'Not shared', seeds: THEME, isShared: false, isPublic: true, authorHandle: 'cid', authorDisplayName: 'Cid' },
        // null handle — a regression dropping isNotNull(profile.handle) must still not leak this
        { id: 'nohandle', name: 'No handle', seeds: THEME, isShared: true, isPublic: true, authorHandle: null, authorDisplayName: null },
      ]),
    );
    const { getCommunityThemes } = await load();
    const live = (await getCommunityThemes()).slice(N_STARTERS);

    expect(live.map((t) => t.id)).toEqual(['ok']);
  });

  test('drops a row whose author handle is null (defensive) and honours the limit arg', async () => {
    dbSelect.mockReturnValue(
      selectResolving([{ id: 'p1', name: 'X', seeds: THEME, isShared: true, authorHandle: null, authorDisplayName: null }]),
    );
    const { getCommunityThemes } = await load();
    // Only the starters remain after the null-handle live row is dropped.
    expect((await getCommunityThemes(10)).map((t) => t.id)).toEqual(STARTER_IDS);
  });

  test('an empty gallery still returns the starters (never empty on day one)', async () => {
    dbSelect.mockReturnValue(selectResolving([]));
    const { getCommunityThemes } = await load();
    expect((await getCommunityThemes()).map((t) => t.id)).toEqual(STARTER_IDS);
  });
});

describe('getCompareTheme', () => {
  test('unknown handle → null', async () => {
    profileFindFirst.mockResolvedValue(undefined);
    const { getCompareTheme } = await load();
    expect(await getCompareTheme('cmp-nobody')).toBeNull();
  });

  test('private profile → null (compare theme gated on reachability)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'cmp-priv', isPublic: false, customTheme: THEME });
    const { getCompareTheme } = await load();
    expect(await getCompareTheme('cmp-priv')).toBeNull();
  });

  test('public profile with a valid customTheme → the parsed (canonical) seeds', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'cmp-ana',
      isPublic: true,
      // NOT gated on cardUsesCustomTheme — compare is its own surface.
      cardUsesCustomTheme: false,
      customTheme: THEME,
    });
    const { getCompareTheme } = await load();
    expect(await getCompareTheme('  CMP-ANA  ')).toEqual(THEME);
  });

  test('public profile with no customTheme → null', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'cmp-plain', isPublic: true, customTheme: null });
    const { getCompareTheme } = await load();
    expect(await getCompareTheme('cmp-plain')).toBeNull();
  });

  test('a malformed stored customTheme → null (re-validated through parseTheme)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'cmp-bad', isPublic: true, customTheme: BAD_THEME });
    const { getCompareTheme } = await load();
    expect(await getCompareTheme('cmp-bad')).toBeNull();
  });
});

describe('getSharedTheme', () => {
  test('NON-PUBLIC author with a handle + a shared preset → returns it (no longer isPublic-gated)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'priv', isPublic: false, displayName: 'Priv' });
    themePresetFindFirst.mockResolvedValue({ id: 'p1', name: 'Carmesí', seeds: THEME, isShared: true });
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('priv')).toEqual({
      name: 'Carmesí',
      seeds: THEME,
      authorHandle: 'priv',
      authorDisplayName: 'Priv',
    });
  });

  test('handle-less author → null (no preset lookup)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: null, isPublic: true, displayName: null });
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('nohandle')).toBeNull();
    expect(themePresetFindFirst).not.toHaveBeenCalled();
  });

  test('unknown handle → null', async () => {
    profileFindFirst.mockResolvedValue(undefined);
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('nobody')).toBeNull();
    expect(themePresetFindFirst).not.toHaveBeenCalled();
  });

  test('public profile with no shared preset → null', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'ana', isPublic: true, displayName: 'Ana' });
    themePresetFindFirst.mockResolvedValue(undefined);
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('ana')).toBeNull();
  });

  test('public profile with a shared preset → returns the shaped theme (handle normalized)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'ana', isPublic: true, displayName: 'Ana' });
    themePresetFindFirst.mockResolvedValue({ id: 'p1', name: 'Carmesí', seeds: THEME, isShared: true });
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('  ANA ')).toEqual({
      name: 'Carmesí',
      seeds: THEME,
      authorHandle: 'ana',
      authorDisplayName: 'Ana',
    });
  });

  test('a shared preset with malformed seeds → null (re-validated on read)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'ana', isPublic: true, displayName: 'Ana' });
    themePresetFindFirst.mockResolvedValue({ id: 'p1', name: 'Rotten', seeds: BAD_THEME, isShared: true });
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('ana')).toBeNull();
  });
});
