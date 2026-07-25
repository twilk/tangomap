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
  test('shapes valid rows and drops a malformed-seed one (re-validated through parseTheme)', async () => {
    dbSelect.mockReturnValue(
      selectResolving([
        { id: 'p1', name: 'Carmesí', seeds: THEME, isShared: true, isPublic: true, authorHandle: 'ana', authorDisplayName: 'Ana' },
        { id: 'p2', name: 'Rotten', seeds: BAD_THEME, isShared: true, isPublic: true, authorHandle: 'bob', authorDisplayName: null },
      ]),
    );
    const { getCommunityThemes } = await load();
    const list = await getCommunityThemes();

    // The rotten row is dropped; the good one is shaped as CommunityTheme.
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      id: 'p1',
      name: 'Carmesí',
      seeds: THEME,
      authorHandle: 'ana',
      authorDisplayName: 'Ana',
    });
    // The privacy flags are NOT leaked into the DTO.
    expect(list[0]).not.toHaveProperty('isShared');
    expect(list[0]).not.toHaveProperty('isPublic');
    expect(dbSelect).toHaveBeenCalledTimes(1);
  });

  test('JS gate (defense-in-depth): from a MIXED set only shared+public+handle rows survive', async () => {
    dbSelect.mockReturnValue(
      selectResolving([
        // the one that should survive
        { id: 'ok', name: 'Keeper', seeds: THEME, isShared: true, isPublic: true, authorHandle: 'ana', authorDisplayName: 'Ana' },
        // shared but author PRIVATE — a regression dropping eq(profile.isPublic,true) must still not leak this
        { id: 'priv', name: 'Private author', seeds: THEME, isShared: true, isPublic: false, authorHandle: 'bob', authorDisplayName: 'Bob' },
        // NON-shared but public — a regression dropping eq(themePreset.isShared,true) must still not leak this
        { id: 'unshared', name: 'Not shared', seeds: THEME, isShared: false, isPublic: true, authorHandle: 'cid', authorDisplayName: 'Cid' },
        // null handle
        { id: 'nohandle', name: 'No handle', seeds: THEME, isShared: true, isPublic: true, authorHandle: null, authorDisplayName: null },
      ]),
    );
    const { getCommunityThemes } = await load();
    const list = await getCommunityThemes();

    expect(list.map((t) => t.id)).toEqual(['ok']);
  });

  test('drops a row whose author handle is null (defensive) and honours the limit arg', async () => {
    dbSelect.mockReturnValue(
      selectResolving([{ id: 'p1', name: 'X', seeds: THEME, isShared: true, isPublic: true, authorHandle: null, authorDisplayName: null }]),
    );
    const { getCommunityThemes } = await load();
    expect(await getCommunityThemes(10)).toEqual([]);
  });

  test('an empty gallery returns []', async () => {
    dbSelect.mockReturnValue(selectResolving([]));
    const { getCommunityThemes } = await load();
    expect(await getCommunityThemes()).toEqual([]);
  });
});

describe('getSharedTheme', () => {
  test('private profile → null (no preset lookup)', async () => {
    profileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'priv', isPublic: false, displayName: null });
    const { getSharedTheme } = await load();
    expect(await getSharedTheme('priv')).toBeNull();
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
